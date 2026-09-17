import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SkeletonBlock } from '@/features/setup/FlowEditor'
import { supabase } from '@/lib/supabase'
import { DecisionChip, RiskChip, type RiskBand } from '@/features/review/riskUi'
import type { TableFilter } from './DashCharts'
import { PERIOD_DAYS, type DashFilters } from './useDashboard'

export interface SessionRow {
  id: string; subject_name: string | null; channel: string | null; reference: string | null
  risk_score: number | null; risk_band: RiskBand | null; decision: 'pending' | 'approved' | 'rejected'; decided_by: string | null
  started_at: string; submitted_at: string | null; geo_uf: string | null; status: string; qualification_score: number | null
}

const FRAUD_CODES: Record<string, string[]> = {
  screen: ['ai_screen_replay'], printed: ['ai_printed_photo'], no_face: ['faces_none', 'ai_object_or_no_face', 'ai_animal', 'ai_mask_or_doll'],
  face_mismatch: ['ai_doc_face_mismatch', 'faces_multiple', 'ai_multiple_faces'], device: ['device_multi_cpf', 'cpf_multi_sessions', 'fast_completion', 'many_capture_attempts'],
  data: ['underage', 'cpf_name_mismatch', 'senior_remote', 'car_missing_credit', 'high_deposit_no_history'], liveness: ['liveness_failed'],
}
const PAGE = 20

export function SessionsTable({ orgId, filters, tableFilter, onClear, title }: {
  orgId: string; filters: DashFilters; tableFilter: TableFilter | null; onClear: () => void; title: string
}) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const q = useQuery({
    queryKey: ['sessions', orgId, filters, tableFilter, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = new Date(Date.now() - PERIOD_DAYS[filters.period] * 864e5).toISOString()
      let query = supabase.from('sessions_view')
        .select('id, subject_name, channel, reference, risk_score, risk_band, decision, decided_by, started_at, submitted_at, geo_uf, status, qualification_score', { count: 'exact' })
        .eq('organization_id', orgId).gte('started_at', from).not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (filters.channel) query = query.eq('channel', filters.channel)
      if (filters.band) query = query.eq('risk_band', filters.band)
      if (filters.decision) query = query.eq('decision', filters.decision)
      const f = tableFilter
      if (f?.kind === 'uf') query = query.eq('geo_uf', f.value)
      if (f?.kind === 'bucket') query = query.gte('risk_score', f.value).lte('risk_score', f.value === 90 ? 100 : f.value + 9)
      if (f?.kind === 'slot') query = query.eq('dow', f.dow).eq('hour', f.hour)
      if (f?.kind === 'os') query = query.eq('device_os', f.value)
      if (f?.kind === 'type') query = query.overlaps('signal_codes', FRAUD_CODES[f.value] ?? [])
      if (f?.kind === 'step' && f.value === 'approved') query = query.eq('decision', 'approved')
      const { data, error, count } = await query
      if (error) throw error
      return { rows: (data ?? []) as SessionRow[], count: count ?? 0 }
    },
  })

  const fmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const filterLabel = !tableFilter ? null
    : tableFilter.kind === 'uf' ? `UF ${tableFilter.value}`
    : tableFilter.kind === 'bucket' ? `${t('dash.score')} ${tableFilter.value}–${tableFilter.value === 90 ? 100 : tableFilter.value + 9}`
    : tableFilter.kind === 'slot' ? `${new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(new Date(2024, 0, tableFilter.dow))} ${tableFilter.hour}h`
    : tableFilter.kind === 'type' ? t(`dash.types.${tableFilter.value}`)
    : tableFilter.kind === 'os' ? tableFilter.value
    : t(`dash.funnel.${tableFilter.value}`)
  const rows = q.data?.rows ?? []
  const total = q.data?.count ?? 0

  return (
    <section aria-labelledby="sessions-title" className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 id="sessions-title" className="font-sans text-[15px] font-semibold tracking-normal text-[var(--ink)]">{title}</h2>
        {filterLabel ? (
          <button type="button" onClick={() => { setPage(0); onClear() }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 text-[12px] font-medium text-[var(--brand-700)] [[data-theme=dark]_&]:border-[#262C45] [[data-theme=dark]_&]:bg-[#151A33] [[data-theme=dark]_&]:text-[var(--brand-300)]"
            aria-label={t('dash.clearFilter', { filter: filterLabel })}>
            <Icon name="filter" size={16} />{filterLabel}<Icon name="rejected" size={16} />
          </button>
        ) : <span className="t-caption text-[var(--ink-muted)]">{t('dash.clickHint')}</span>}
      </header>
      {q.isLoading ? <div className="px-5 pb-5"><SkeletonBlock /></div> : q.isError ? (
        <p className="m-0 px-5 pb-5 text-[13px] text-[var(--risk-high-ink)]">{t('errors.generic')}</p>
      ) : rows.length === 0 ? (
        <p className="m-0 border-t border-[var(--divider)] px-5 py-8 text-center t-caption text-[var(--ink-muted)]">{t('dash.noSessions')}</p>
      ) : (
        <>
          <table className="hidden w-full border-collapse text-left lg:table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-y border-[var(--border)] bg-[var(--n-50)] [[data-theme=dark]_&]:bg-[#151A33]">
                {[t('links.col.subject'), t('dash.col.received'), 'UF', t('dash.col.score'), t('dash.col.state')].map((h, i) => (
                  <th key={h} scope="col" className={`px-5 py-2.5 t-overline text-[var(--ink-muted)] ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--divider)] last:border-b-0 hover:bg-[var(--n-50)] [[data-theme=dark]_&]:hover:bg-[#151A33]">
                  <td className="max-w-0 px-5 py-3">
                    <Link to={`/app/sessoes/${r.id}`} className="block truncate text-[14px] font-medium text-[var(--ink)] hover:text-[var(--link)] hover:underline">{r.subject_name ?? '—'}</Link>
                    <span className="block truncate t-caption text-[var(--ink-muted)]">{[r.reference, r.channel && t(`links.channel.${r.channel}`)].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="tabular w-[130px] whitespace-nowrap px-5 py-3 text-[13px] text-[var(--ink-muted)]">{r.submitted_at ? fmt.format(new Date(r.submitted_at)) : '—'}</td>
                  <td className="w-[64px] px-5 py-3 text-[13px]">{r.geo_uf ?? '—'}</td>
                  <td className="tabular w-[84px] px-5 py-3 text-right text-[15px] font-semibold" style={{ color: r.risk_band ? `var(--risk-${r.risk_band === 'unknown' ? 'unknown' : r.risk_band}-ink)` : undefined }}>{r.risk_score ?? '—'}</td>
                  <td className="w-[200px] px-5 py-3"><div className="flex flex-wrap gap-1.5"><RiskChip band={r.risk_band} />{r.decision !== 'pending' ? <DecisionChip decision={r.decision} auto={r.decision === 'approved' && !r.decided_by} /> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="m-0 list-none border-t border-[var(--divider)] p-0 lg:hidden">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-[var(--divider)] last:border-b-0">
                <Link to={`/app/sessoes/${r.id}`} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[15px] text-[var(--ink)]">{r.subject_name ?? '—'}</p>
                    <div className="mt-1.5"><RiskChip band={r.risk_band} /></div>
                  </div>
                  <span className="tabular text-[20px] font-semibold text-[var(--ink)]">{r.risk_score ?? '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
          {total > PAGE ? (
            <nav aria-label={t('links.pagination')} className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
              <span className="tabular t-caption text-[var(--ink-muted)]">{t('links.pageInfo', { from: page * PAGE + 1, to: Math.min(total, (page + 1) * PAGE), total })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" icon="arrowLeft" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('common.back')}</Button>
                <Button variant="secondary" iconRight="arrowRight" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </section>
  )
}
