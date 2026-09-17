import { HttpError } from './analyze'
import type { Env } from './index'

/** Webhook para CRM (§5.7). Usa o JWT do usuário: RLS decide o que ele pode ler. */
async function userRest(env: Env, jwt: string, path: string) {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${jwt}` } })
  if (res.status === 401) throw new HttpError(401, 'unauthorized', 'Sessão inválida.')
  if (!res.ok) throw new HttpError(502, 'upstream_error', 'Não foi possível consultar os dados.')
  return res.json()
}

export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return false
  return h.includes('.')
}

async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function handleWebhook(request: Request, env: Env, kind: 'test' | 'qualified') {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'unauthorized', 'Faça login para continuar.')
  const jwt = auth.slice(7)
  const { organization_id: orgId } = (await request.json().catch(() => ({}))) as { organization_id?: string }
  if (!orgId || !/^[0-9a-f-]{36}$/.test(orgId)) throw new HttpError(400, 'invalid_request', 'Organização inválida.')

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: auth } })
  if (!userRes.ok) throw new HttpError(401, 'unauthorized', 'Sessão inválida.')
  const user = (await userRes.json()) as { id: string }

  const [membership] = (await userRest(env, jwt, `/rest/v1/memberships?organization_id=eq.${orgId}&user_id=eq.${user.id}&select=role`)) as Array<{ role: string }>
  if (!membership || (kind === 'test' ? membership.role !== 'owner' : membership.role === 'viewer')) throw new HttpError(403, 'forbidden', 'Seu papel não permite esta ação.')

  const [org] = (await userRest(env, jwt, `/rest/v1/organizations?id=eq.${orgId}&select=id,name,settings`)) as Array<{ id: string; name: string; settings: { webhook_url?: string } }>
  const url = org?.settings?.webhook_url
  if (!url || !isSafeWebhookUrl(url)) throw new HttpError(400, 'webhook_not_configured', 'Configure uma URL HTTPS pública nas Configurações.')
  // A assinatura só protege o CRM se a chave usada for realmente secreta. SUPABASE_PUBLISHABLE_KEY
  // é pública por design (vai no bundle do front) — usá-la aqui deixaria qualquer pessoa forjar
  // uma assinatura válida. Exige a chave de serviço (nunca enviada a lugar nenhum, só usada como
  // material de HMAC) só para este passo de assinatura.
  if (!env.SUPABASE_SECRET_KEY) throw new HttpError(500, 'webhook_signing_not_configured', 'Este deploy não tem a chave de assinatura configurada (SUPABASE_SECRET_KEY).')

  let payload: Record<string, unknown>
  let sent = 0
  if (kind === 'test') {
    payload = { event: 'veroid.test', organization: org.name, sent_at: new Date().toISOString(), mode: env.APP_MODE }
  } else {
    const rows = (await userRest(env, jwt, `/rest/v1/qualified_subjects?organization_id=eq.${orgId}&select=name,email,phone,geo_uf,qualification_score,marketing_opt_in_at,verified_at&order=qualification_score.desc&limit=500`)) as unknown[]
    sent = rows.length
    // Só campos cobertos pelo opt-in de marketing; sem CPF e sem score de crédito
    payload = { event: 'veroid.qualified_customers', organization: org.name, sent_at: new Date().toISOString(), count: sent, customers: rows }
  }

  const body = JSON.stringify(payload)
  const signature = await hmac(`${orgId}:${env.SUPABASE_SECRET_KEY}`, body)
  let status: number
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'VeroID-Webhook/1.0', 'x-veroid-event': String(payload.event), 'x-veroid-signature': `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: 'manual',
    })
    status = res.status
  } catch {
    throw new HttpError(502, 'webhook_unreachable', 'O endereço do webhook não respondeu em 10 segundos.')
  }
  if (status >= 400) throw new HttpError(502, 'webhook_rejected', `O webhook respondeu com HTTP ${status}.`)

  await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/log_audit`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ p_organization_id: orgId, p_action: kind === 'test' ? 'webhook.tested' : 'qualified.sent_to_crm', p_target: 'webhook', p_after: { status, rows: sent } }),
  }).catch(() => undefined)

  return { ok: true, status, sent }
}
