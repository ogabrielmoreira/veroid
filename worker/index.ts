/**
 * Vero ID — Cloudflare Worker
 *
 * Montado em gabrielmoreira.tech/veroid*:
 *   /veroid/api/*  → rotas da API (segredos ficam só aqui)
 *   /veroid/*      → SPA (arquivos de dist/veroid, com fallback para index.html)
 *
 * Fase 1: health check + keep-alive diário do Supabase.
 * As rotas de links, sessão pública, Copiloto etc. entram nas fases 3–5.
 */

import { handleAnalyze, HttpError } from './analyze'
import { runRetentionCron } from './retention'
import { handleWebhook } from './webhooks'

export interface Env {
  ASSETS: Fetcher
  APP_MODE: 'demo' | 'live'
  BASE_PATH: string
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  /** segredos (wrangler secret put) */
  SUPABASE_SECRET_KEY?: string
  ANTHROPIC_API_KEY?: string
  AI_MODEL?: string
  AI_DAILY_LIMIT?: string
}

const CSP_BASE_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://viacep.com.br https://brasilapi.com.br https://storage.googleapis.com",
  // 'self' além do Turnstile: /demo embute /v/:token no próprio domínio (SimulateOnboardingModal).
  "frame-src 'self' https://challenges.cloudflare.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

/**
 * `/v/:token` é a única página que precisa poder ser embutida — pelo próprio app, no mesmo
 * domínio, dentro do modal "Simular onboarding" (§10). Sem essa exceção, `frame-ancestors 'none'`
 * bloquearia esse iframe mesmo sendo same-origin, quebrando a demo pública. Todo o resto
 * (painel autenticado, landing, etc.) continua com a proteção máxima contra clickjacking.
 */
function securityHeaders(path: string): Record<string, string> {
  const embeddable = path === '/v' || path.startsWith('/v/')
  return {
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': embeddable ? 'SAMEORIGIN' : 'DENY',
    'Content-Security-Policy': [...CSP_BASE_DIRECTIVES, `frame-ancestors ${embeddable ? "'self'" : "'none'"}`].join('; '),
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function apiError(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status)
}

function withHeaders(res: Response, path: string): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(securityHeaders(path))) out.headers.set(k, v)
  return out
}

async function pingSupabase(env: Env): Promise<{ ok: boolean; at?: string }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ping_heartbeat`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!res.ok) return { ok: false }
  return { ok: true, at: (await res.json()) as string }
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/health' && request.method === 'GET') {
    return json({ ok: true, mode: env.APP_MODE, ai: Boolean(env.ANTHROPIC_API_KEY && env.SUPABASE_SECRET_KEY), time: new Date().toISOString() })
  }
  if ((path === '/api/webhooks/test' || path === '/api/webhooks/qualified') && request.method === 'POST') {
    try {
      return json(await handleWebhook(request, env, path.endsWith('test') ? 'test' : 'qualified'))
    } catch (e) {
      if (e instanceof HttpError) return apiError(e.code, e.message, e.status)
      return apiError('internal_error', 'Não foi possível enviar agora.', 500)
    }
  }
  if (path === '/api/analyze' && request.method === 'POST') {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return apiError('forbidden', 'Origem não permitida.', 403)
    try {
      return json(await handleAnalyze(request, env))
    } catch (e) {
      if (e instanceof HttpError) return apiError(e.code, e.message, e.status)
      return apiError('internal_error', 'Não foi possível analisar agora. A sessão segue para revisão manual.', 500)
    }
  }
  return apiError('not_found', 'Rota não encontrada.', 404)
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const base = env.BASE_PATH || '/veroid'

    // /veroid → /veroid/
    if (url.pathname === base) {
      return Response.redirect(`${url.origin}${base}/${url.search}`, 301)
    }

    if (!url.pathname.startsWith(`${base}/`)) {
      // Fora do escopo do app: deixa a origem (GitHub Pages) responder.
      return fetch(request)
    }

    const path = url.pathname.slice(base.length) // começa com "/"

    if (path.startsWith('/api/')) {
      try {
        return await handleApi(request, env, path)
      } catch {
        return apiError('internal_error', 'Erro inesperado. Tente novamente.', 500)
      }
    }

    // Arquivos estáticos
    const asset = await env.ASSETS.fetch(request)
    if (asset.status !== 404) return withHeaders(asset, path)

    // Fallback de SPA: rotas internas (F5 em /veroid/app/...) recebem o index.html
    const accept = request.headers.get('accept') ?? ''
    if ((request.method === 'GET' || request.method === 'HEAD') && accept.includes('text/html')) {
      const index = await env.ASSETS.fetch(new Request(`${url.origin}${base}/`, { method: request.method, headers: request.headers }))
      return withHeaders(new Response(index.body, { status: 200, headers: index.headers }), path)
    }
    return asset
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        pingSupabase(env),
        // Fase 9: retenção automática — mídia vencida (normal ou por exclusão a pedido
        // do titular) e links expirados, todo dia (ver wrangler.jsonc [triggers]).
        runRetentionCron(env).catch((e) => console.error('retention cron failed', e)),
      ]).then(() => undefined),
    )
  },
} satisfies ExportedHandler<Env>
