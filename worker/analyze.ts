import { buildAnthropicBody, parseVerdict, toBase64, uncertain, type AiVerdict } from './copilot'
import type { Env } from './index'

export type Json = Record<string, unknown>

export async function sb(env: Env, path: string, init: RequestInit & { secret?: boolean } = {}) {
  const key = init.secret ? env.SUPABASE_SECRET_KEY! : env.SUPABASE_PUBLISHABLE_KEY
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json')
  return fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers })
}

export async function rpc<T>(env: Env, fn: string, args: Json, opts: { secret?: boolean; jwt?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.jwt) headers.authorization = `Bearer ${opts.jwt}`
  const res = await sb(env, `/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args), secret: opts.secret, headers })
  if (!res.ok) throw Object.assign(new Error(`rpc_${fn}_${res.status}`), { status: res.status })
  return (await res.json()) as T
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

/**
 * POST /veroid/api/analyze
 *  - titular: { token, session_id, secret }  (logo após o envio)
 *  - analista: Authorization: Bearer <JWT do Supabase> + { session_id } (reprocessar)
 */
export async function handleAnalyze(request: Request, env: Env): Promise<Json> {
  if (!env.SUPABASE_SECRET_KEY || !env.ANTHROPIC_API_KEY) {
    return { status: 'skipped', reason: 'ai_not_configured' }
  }
  const body = (await request.json().catch(() => ({}))) as { token?: string; session_id?: string; secret?: string }
  const sessionId = body.session_id
  if (!sessionId || !/^[0-9a-f-]{36}$/.test(sessionId)) throw new HttpError(400, 'invalid_request', 'session_id inválido.')

  // Autorização
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const jwt = auth.slice(7)
    const userRes = await sb(env, '/auth/v1/user', { headers: { authorization: `Bearer ${jwt}` } })
    if (!userRes.ok) throw new HttpError(401, 'unauthorized', 'Sessão inválida.')
    const user = (await userRes.json()) as { id: string }
    const s = await sb(env, `/rest/v1/verification_sessions?id=eq.${sessionId}&select=organization_id`, { secret: true })
    const [row] = (await s.json()) as Array<{ organization_id: string }>
    if (!row) throw new HttpError(404, 'not_found', 'Sessão não encontrada.')
    const m = await sb(env, `/rest/v1/memberships?organization_id=eq.${row.organization_id}&user_id=eq.${user.id}&select=role`, { secret: true })
    const [membership] = (await m.json()) as Array<{ role: string }>
    if (!membership || membership.role === 'viewer') throw new HttpError(403, 'forbidden', 'Seu papel não permite reprocessar.')
  } else {
    if (!body.token || !body.secret) throw new HttpError(401, 'unauthorized', 'Credenciais ausentes.')
    try {
      await rpc(env, 'resume_subject_session', { p_token: body.token, p_session_id: sessionId, p_secret: body.secret })
    } catch {
      throw new HttpError(401, 'unauthorized', 'Sessão inválida.')
    }
  }

  const sessRes = await sb(env, `/rest/v1/verification_sessions?id=eq.${sessionId}&select=id,status,ai_verdict`, { secret: true })
  const [session] = (await sessRes.json()) as Array<{ id: string; status: string; ai_verdict: unknown }>
  if (!session || !['submitted', 'analyzed', 'decided'].includes(session.status)) throw new HttpError(409, 'not_submitted', 'Sessão ainda não enviada.')
  if (session.ai_verdict && !auth) return { status: 'already_analyzed' }

  const limit = Number(env.AI_DAILY_LIMIT ?? 300)
  const allowed = await rpc<boolean>(env, 'consume_ai_quota', { p_limit: limit }, { secret: true })
  if (!allowed) {
    const score = await rpc<number>(env, 'apply_ai_verdict', { p_session_id: sessionId, p_verdict: uncertain('daily_cap') }, { secret: true })
    return { status: 'capped', risk_score: score }
  }

  const mediaRes = await sb(env, `/rest/v1/media_assets?session_id=eq.${sessionId}&select=kind,storage_path&order=created_at.desc`, { secret: true })
  const media = (await mediaRes.json()) as Array<{ kind: string; storage_path: string }>
  const latest = new Map<string, string>()
  for (const m of media) if (!latest.has(m.kind)) latest.set(m.kind, m.storage_path)

  const images: Array<{ kind: string; base64: string }> = []
  for (const kind of ['selfie', 'doc_front', 'doc_back']) {
    const path = latest.get(kind)
    if (!path) continue
    const obj = await sb(env, `/storage/v1/object/authenticated/media/${path}`, { secret: true })
    if (obj.ok) images.push({ kind, base64: toBase64(await obj.arrayBuffer()) })
  }
  if (!images.some((i) => i.kind === 'selfie')) {
    const score = await rpc<number>(env, 'apply_ai_verdict', { p_session_id: sessionId, p_verdict: uncertain('selfie_missing') }, { secret: true })
    return { status: 'uncertain', risk_score: score }
  }

  const model = env.AI_MODEL || 'claude-haiku-4-5-20251001'
  let verdict: AiVerdict
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(buildAnthropicBody(model, images)),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`anthropic_${res.status}`)
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? ''
    verdict = { ...parseVerdict(text, images.some((i) => i.kind !== 'selfie')), model }
  } catch (e) {
    verdict = uncertain((e as Error).name === 'TimeoutError' ? 'timeout' : 'provider_error')
  }

  const score = await rpc<number>(env, 'apply_ai_verdict', { p_session_id: sessionId, p_verdict: verdict }, { secret: true })
  return auth ? { status: 'analyzed', verdict: verdict.verdict, risk_score: score } : { status: 'analyzed' }
}
