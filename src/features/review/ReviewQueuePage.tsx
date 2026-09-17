import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SegmentedFilter } from '@/components/ui/Tabs'
import { cn } from '@/components/ui/cn'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { SkeletonBlock } from '@/features/setup/FlowEditor'
import { supabase } from '@/lib/supabase'
import type { SessionRow } from '@/features/dashboard/SessionsTable'
import { BAND_META, RiskChip } from './riskUi'

const SLA_HOURS = 2

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), intervalMs); return () => window.clearInterval(id) }, [intervalMs])
  return now
}

export function ReviewQueuePage() {
  const { t, i18n } = useTranslation()
  const { membership } = useCurrentOrg()
  const org = membership!.organization
  const [band, setBand] = useState<'all' | 'high' | 'review' | 'unknown' | 'low'>('all')
  const now = useNow()

  const q = useQuery({
    queryKey: ['queue', org.id, band],
    refetchInterval: 60_000,
    queryFn: async () => {
      let query = supabase.from('sessions_view')
        .select('id, subject_name, channel, reference, risk_score, risk_band, decision, decided_by, started_at, submitted_at, geo_uf, status, qualification_score, signal_codes')
        .eq('organization_id', org.id).eq('decision', 'pending').not('submitted_at', 'is', null)
        .order('risk_score', { ascending: false, nullsFirst: false }).order('submitted_at', { ascending: true }).limit(100)
      if (band !== 'all') query = query.eq('risk_band', band)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Array<SessionRow & { signal_codes: string[] }>
    },
  })

  const rows = q.data ?? []
  const overdue = rows.filter((r) => r.submitted_at && now - new Date(r.submitted_at).getTime() > SLA_HOURS * 36e5).length

  const sla = (iso: string | null) => {
    if (!iso) return null
    const left = new Date(iso).getTime() + SLA_HOURS * 36e5 - now
    const mins = Math.round(Math.abs(left) / 60000)
    const text = mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins}min`
    return { late: left < 0, text: left < 0 ? t('review.slaLate', { time: text }) : t('review.slaLeft', { time: text }), urgent: left >= 0 && left < 30 * 60000 }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-h1">{t('app.nav.review')}</h1>
        <p className="m-0 t-body text-[var(--ink-muted)]">{t('review.subtitle', { hours: SLA_HOURS })}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedFilter label={t('dash.band')} value={band} onChange={setBand}
          options={(['all', 'high', 'review', 'unknown', 'low'] as const).map((b) => ({ value: b, label: b === 'all' ? t('dash.all') : t(`risk.${b}`) }))} />
        <p className="m-0 flex items-center gap-4 t-caption text-[var(--ink-muted)]" aria-live="polite">
          <span className="tabular">{t('review.pending', { count: rows.length })}</span>
          {overdue ? <span className="inline-flex items-center gap-1 font-medium text-[var(--risk-high-ink)]"><Icon name="review" size={16} />{t('review.overdue', { count: overdue })}</span> : null}
        </p>
      </div>

      {q.isLoading ? <SkeletonBlock /> : q.isError ? (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-6 text-[var(--risk-high-ink)]">{t('errors.generic')}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-[10px] border border-dashed border-[var(--border-strong)] bg-[var(--n-50)] px-[18px] py-[26px] text-center [[data-theme=dark]_&]:bg-transparent">
          <Icon name="approved" size={30} className="text-[var(--brand-400)]" />
          <h2 className="mt-3 font-sans text-[14px] font-medium tracking-normal">{t('review.emptyTitle')}</h2>
          <p className="m-0 mt-1 max-w-[36ch] t-caption text-[var(--ink-muted)]">{t('review.emptyBody')}</p>
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => {
            const s = sla(r.submitted_at)
            const band = r.risk_band ?? 'unknown'
            return (
              <li key={r.id}>
                <Link to={`/app/sessoes/${r.id}`}
                  className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] hover:border-[var(--border-strong)]">
                  <span aria-hidden="true" style={{ background: BAND_META[band].color }} />
                  <div className="flex min-w-0 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[15px] font-medium text-[var(--ink)]">{r.subject_name ?? '—'}</p>
                      <p className="m-0 mt-0.5 truncate t-caption text-[var(--ink-muted)]">
                        {[r.reference, r.channel && t(`links.channel.${r.channel}`), r.geo_uf, r.submitted_at && new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(r.submitted_at))].filter(Boolean).join(' · ')}
                      </p>
                      {r.signal_codes?.length ? (
                        <p className="m-0 mt-1 truncate t-caption text-[var(--ink-body)]">{r.signal_codes.slice(0, 3).map((c) => t(`signals.${c}`, c)).join(' · ')}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskChip band={r.risk_band} />
                      {s ? (
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-[11px] py-[5px] text-[12px] font-medium tabular',
                          s.late ? 'border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] text-[var(--risk-high-ink)]'
                            : s.urgent ? 'border-[rgba(176,106,0,.28)] bg-[var(--risk-review-bg)] text-[var(--risk-review-ink)]'
                            : 'border-[var(--border)] text-[var(--ink-muted)]')}>
                          <Icon name="pending" size={16} />{s.text}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-center gap-0.5 border-l border-[var(--divider)] px-5">
                    <span className="tabular text-[24px] font-semibold leading-7 tracking-[-0.02em]" style={{ color: BAND_META[band].ink }}>{r.risk_score ?? '—'}</span>
                    <span className="t-micro text-[var(--ink-muted)]">/ 100</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
