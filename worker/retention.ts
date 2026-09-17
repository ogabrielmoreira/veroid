import { rpc, sb } from './analyze'
import type { Env } from './index'

interface ExpiredMedia { id: string; storage_path: string }

/**
 * Fase 9 — cron de retenção (§8): apaga do Storage a mídia marcada por
 * `list_expired_media()` (retenção normal ou exclusão a pedido do titular),
 * confirma com `purge_media_records`, e marca links vencidos como expirados.
 * Só usa a chave de serviço — nunca é alcançável por anon/authenticated.
 */
export async function runRetentionCron(env: Env): Promise<{ purged: number; linksExpired: number }> {
  if (!env.SUPABASE_SECRET_KEY) return { purged: 0, linksExpired: 0 }

  let purged = 0
  // list_expired_media() devolve até 500 por chamada; repete até esvaziar (ou um teto de segurança).
  for (let i = 0; i < 20; i++) {
    const expired = await rpc<ExpiredMedia[]>(env, 'list_expired_media', {}, { secret: true })
    if (expired.length === 0) break

    const prefixes = expired.map((m) => m.storage_path)
    const del = await sb(env, '/storage/v1/object/media', {
      method: 'DELETE',
      secret: true,
      body: JSON.stringify({ prefixes }),
    })
    if (!del.ok) {
      // Mesmo se o Storage falhar (ex.: objeto já não existe), seguimos e limpamos o
      // registro: o objetivo do cron é não deixar referências penduradas no banco.
      console.error('retention: storage delete failed', del.status, await del.text().catch(() => ''))
    }

    const ids = expired.map((m) => m.id)
    const n = await rpc<number>(env, 'purge_media_records', { p_ids: ids }, { secret: true })
    purged += n
    if (expired.length < 500) break
  }

  const linksExpired = await rpc<number>(env, 'expire_stale_links', {}, { secret: true })
  return { purged, linksExpired }
}
