import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { SegmentedFilter } from '@/components/ui/Tabs'
import { useAuth } from '@/features/auth/AuthProvider'
import { ChartCard, DataTable, fmtBrl, fmtDuration, fmtInt, fmtPct } from '@/features/dashboard/charts'
import { FraudTypes, FraudTypesTable, Funnel, FunnelTable, Heatmap, HBars, Histogram, UfMap, type TableFilter } from '@/features/dashboard/DashCharts'
import { MarketRadar } from '@/features/dashboard/MarketRadar'
import { SessionsTable } from '@/features/dashboard/SessionsTable'
import { useDashboard, PERIOD_DAYS, type DashFilters, type Period } from '@/features/dashboard/useDashboard'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import type { BrandKit } from '@/lib/brand'

export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { user } = useAuth()
  const toast = useToast()
  const { membership } = useCurrentOrg()
  const org = membership!.organization
  const [filters, setFilters] = useState<DashFilters>({ period: '30d', channel: '', band: '', decision: '' })
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null)
  const [downloadingReport, setDownloadingReport] = useState(false)
  const q = useDashboard(org.id, filters)
  const d = q.data
  const firstName = ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? '').split(/[\s@]/)[0]
  const empty = !q.isLoading && !q.isError && (d?.kpis.verifications ?? 0) === 0 && (d?.funnel[0]?.n ?? 0) === 0
  const stale = q.isFetching && q.isPlaceholderData

  const periodLabel = (() => {
    const to = new Date()
    const from = new Date(to.getTime() - PERIOD_DAYS[filters.period] * 864e5)
    const fmt = new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric' })
    return `${fmt.format(from)} – ${fmt.format(to)}`
  })()

  const handleDownloadReport = async () => {
    if (!d || downloadingReport) return
    setDownloadingReport(true)
    try {
      // Carregado sob demanda: @react-pdf/renderer é pesado e só é necessário quando o botão é clicado.
      const { downloadMonthlyReport } = await import('@/features/reports/downloadMonthlyReport')
      await downloadMonthlyReport({
        orgName: org.name,
        niche: t(`niches.${org.niche}`),
        brandKit: org.brand_kit as BrandKit,
        periodLabel: `${t(`dash.periods.${filters.period}`)} · ${periodLabel}`,
        data: d,
        lang,
      })
    } catch {
      toast.show({ tone: 'error', title: t('dash.reportError') })
    } finally {
      setDownloadingReport(false)
    }
  }

  const select = (f: TableFilter) => {
    setTableFilter(f)
    requestAnimationFrame(() => document.getElementById('sessions-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const delta = (cur: number | null | undefined, prev: number | null | undefined, invert = false, unit: 'pct' | 'abs' = 'abs') => {
    if (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0) return null
    const diff = unit === 'pct' ? cur - prev : (100 * (cur - prev)) / prev
    const good = invert ? diff < 0 : diff > 0
    return { text: `${diff > 0 ? '+' : ''}${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(diff)}${unit === 'pct' ? ' p.p.' : '%'}`, good, neutral: Math.abs(diff) < 0.05 }
  }

  const kpis = d ? [
    { key: 'kpiVerifications', value: fmtInt(d.kpis.verifications, lang), delta: delta(d.kpis.verifications, d.previous.verifications) },
    { key: 'kpiAutoApproval', value: fmtPct(d.kpis.auto_approval_rate, lang), delta: delta(d.kpis.auto_approval_rate, d.previous.auto_approval_rate, false, 'pct') },
    { key: 'kpiBlocked', value: fmtInt(d.kpis.fraud_blocked, lang), delta: delta(d.kpis.fraud_blocked, d.previous.fraud_blocked, true) },
    { key: 'kpiLosses', value: fmtBrl(d.kpis.losses_prevented, lang), delta: null, hint: t('dash.lossesHint') },
    { key: 'kpiTime', value: fmtDuration(d.kpis.avg_completion_seconds), delta: delta(d.kpis.avg_completion_seconds, d.previous.avg_completion_seconds, true) },
    { key: 'kpiQualified', value: fmtInt(d.kpis.qualified, lang), delta: null },
  ] : []

  return (
    <div className="flex flex-col gap-6">
      <section className="enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 t-overline text-[var(--ink-muted)]">{t(`app.overview.role.${membership!.role}`)}</p>
          <h1 className="mt-2 t-h1">{t('app.overview.welcome', { name: firstName })}</h1>
          <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t('app.overview.orgLine', { org: org.name, niche: t(`niches.${org.niche}`) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon="export" loading={downloadingReport} disabled={!d} onClick={() => void handleDownloadReport()}>
            {t('dash.downloadReport')}
          </Button>
          {d?.kpis.pending_review ? (
            <ButtonLink to="/app/revisao" icon="evidence">{t('dash.reviewCta', { count: d.kpis.pending_review })}</ButtonLink>
          ) : null}
        </div>
      </section>

      {membership?.role === 'owner' && !(org as unknown as { onboarding_completed_at?: string | null }).onboarding_completed_at ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-5 sm:flex-row sm:items-center sm:justify-between [[data-theme=dark]_&]:border-[#262C45] [[data-theme=dark]_&]:bg-[#151A33]">
          <div>
            <p className="m-0 text-[14px] font-semibold text-[var(--ink)]">{t('app.overview.finishSetup')}</p>
            <p className="m-0 mt-0.5 t-caption text-[var(--ink-muted)]">{t('app.overview.finishSetupBody')}</p>
          </div>
          <ButtonLink to="/app/configurar/marca" iconRight="arrowRight">{t('common.continue')}</ButtonLink>
        </div>
      ) : null}

      {/* Filtros globais: uma linha acima dos gráficos */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-1.5">
          <span className="t-label text-[var(--ink)]" id="period-label">{t('dash.period')}</span>
          <SegmentedFilter label={t('dash.period')} value={filters.period} onChange={(v) => setFilters((f) => ({ ...f, period: v as Period }))}
            options={(['7d', '30d', '90d'] as const).map((p) => ({ value: p, label: t(`dash.periods.${p}`) }))} />
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <SelectField label={t('links.fields.channel')} value={filters.channel} onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}>
            <option value="">{t('dash.all')}</option>
            {(['whatsapp', 'sms', 'email', 'qr'] as const).map((c) => <option key={c} value={c}>{t(`links.channel.${c}`)}</option>)}
          </SelectField>
          <SelectField label={t('dash.band')} value={filters.band} onChange={(e) => setFilters((f) => ({ ...f, band: e.target.value }))}>
            <option value="">{t('dash.all')}</option>
            {(['low', 'review', 'high', 'unknown'] as const).map((b) => <option key={b} value={b}>{t(`risk.${b}`)}</option>)}
          </SelectField>
          <SelectField label={t('dash.decision')} value={filters.decision} onChange={(e) => setFilters((f) => ({ ...f, decision: e.target.value }))}>
            <option value="">{t('dash.all')}</option>
            {(['pending', 'approved', 'rejected'] as const).map((b) => <option key={b} value={b}>{t(`decision.${b}`)}</option>)}
          </SelectField>
        </div>
      </div>

      {stale ? <Alert variant="neutral" live>{t('dash.updating')}</Alert> : null}
      {empty ? (
        <Alert variant="info" title={t('dash.noDataTitle')}>
          {t('dash.noDataBody')}
          <span className="mt-2 flex flex-wrap gap-2"><ButtonLink to="/app/links?novo=1" icon="plus">{t('links.new')}</ButtonLink></span>
        </Alert>
      ) : null}

      <section aria-label={t('dash.kpis')} className={`grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 ${stale ? 'opacity-[.68]' : ''}`}>
        {(q.isLoading ? Array.from({ length: 6 }).map((_, i) => ({ key: String(i), value: '', delta: null })) : kpis).map((k) => (
          <div key={k.key} className="rounded-[10px] border border-[var(--divider)] bg-[var(--n-50)] p-4 [[data-theme=dark]_&]:border-[#262C45] [[data-theme=dark]_&]:bg-[#151A33]">
            {q.isLoading ? (
              <div className="flex flex-col gap-2" aria-hidden="true"><span className="h-3 w-3/4 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse" /><span className="h-7 w-1/2 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse" /></div>
            ) : (
              <>
                <p className="m-0 t-overline text-[var(--ink-muted)]" title={'hint' in k ? (k as { hint?: string }).hint : undefined}>{t(`dash.${k.key}`)}</p>
                <p className="m-0 mt-2 tabular text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--ink)]">{k.value}</p>
                {k.delta ? (
                  <p className="m-0 mt-0.5 flex items-center gap-1 text-[12px] tabular" style={{ color: k.delta.neutral ? 'var(--ink-muted)' : k.delta.good ? 'var(--risk-low-ink)' : 'var(--risk-high-ink)' }}>
                    <Icon name={k.delta.neutral ? 'pending' : k.delta.good ? 'approved' : 'review'} size={16} />
                    {k.delta.text} <span className="text-[var(--ink-muted)]">{t('dash.vsPrevious')}</span>
                  </p>
                ) : <p className="m-0 mt-0.5 text-[12px] text-[var(--ink-muted)]">{'hint' in k ? (k as { hint?: string }).hint : ' '}</p>}
              </>
            )}
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard title={t('dash.funnelTitle')} subtitle={t('dash.funnelSubtitle')} loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()}
          empty={!!d && d.funnel[0].n === 0} table={d ? <FunnelTable data={d.funnel} /> : undefined}>
          {d ? <Funnel data={d.funnel} onSelect={select} selected={tableFilter?.kind === 'step' ? tableFilter.value : undefined} /> : null}
        </ChartCard>
        <MarketRadar niche={org.niche} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title={t('dash.fraudTitle')} subtitle={t('dash.fraudSubtitle')} loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()}
          empty={!!d && d.fraud_types.length === 0} table={d ? <FraudTypesTable data={d.fraud_types} /> : undefined}>
          {d ? <FraudTypes data={d.fraud_types} onSelect={select} /> : null}
        </ChartCard>
        <ChartCard title={t('dash.histTitle')} subtitle={t('dash.histSubtitle')} loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()}
          empty={!!d && d.histogram.every((h) => h.n === 0)}
          table={d ? <DataTable caption={t('dash.histTitle')} head={[t('dash.score'), t('dash.sessions')]} rows={d.histogram.map((h) => [`${h.bucket}–${h.bucket === 90 ? 100 : h.bucket + 9}`, fmtInt(h.n, lang)])} /> : undefined}>
          {d ? <Histogram data={d.histogram} onSelect={select} /> : null}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ChartCard title={t('dash.mapTitle')} subtitle={t('dash.mapSubtitle')} loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()}
          empty={!!d && d.by_uf.length === 0}
          table={d ? <DataTable caption={t('dash.mapTitle')} head={['UF', t('dash.sessions'), t('dash.highRisk')]} rows={[...d.by_uf].sort((a, b) => b.n - a.n).map((u) => [u.uf, fmtInt(u.n, lang), fmtPct((100 * u.high) / u.n, lang)])} /> : undefined}>
          {d ? <UfMap data={d.by_uf} onSelect={select} selected={tableFilter?.kind === 'uf' ? tableFilter.value : undefined} /> : null}
        </ChartCard>
        <ChartCard title={t('dash.heatTitle')} subtitle={t('dash.heatSubtitle')} loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()}
          empty={!!d && d.heatmap.length === 0}
          table={d ? <DataTable caption={t('dash.heatTitle')} head={[t('dash.col.day'), t('dash.col.hour'), t('dash.sessions')]} rows={[...d.heatmap].sort((a, b) => b.n - a.n).slice(0, 30).map((h) => [new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2024, 0, h.dow)), `${h.hour}h`, fmtInt(h.n, lang)])} /> : undefined}>
          {d ? <Heatmap data={d.heatmap} onSelect={select} /> : null}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title={t('dash.devicesTitle')} subtitle={t('dash.devicesSubtitle')} loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()}
          empty={!!d && d.devices.os.length === 0}
          table={d ? <DataTable caption={t('dash.devicesTitle')} head={[t('dash.col.item'), t('dash.sessions')]} rows={[...d.devices.os, ...d.devices.browser].map((r) => [r.k, fmtInt(r.n, lang)])} /> : undefined}>
          {d ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <div><p className="m-0 mb-2 t-overline text-[var(--ink-muted)]">{t('dash.os')}</p><HBars rows={d.devices.os} onSelect={(k) => select({ kind: 'os', value: k })} /></div>
              <div><p className="m-0 mb-2 t-overline text-[var(--ink-muted)]">{t('dash.browser')}</p><HBars rows={d.devices.browser} /></div>
            </div>
          ) : null}
        </ChartCard>
        <ChartCard title={t(`dash.nicheTitle.${['agro', 'automotive', 'credit'].includes(org.niche) ? org.niche : 'default'}`)} subtitle={t('dash.nicheSubtitle')}
          loading={q.isLoading} error={q.isError} onRetry={() => void q.refetch()} empty={!!d && d.niche_breakdown.length === 0}
          table={d ? <DataTable caption={t('dash.nicheSubtitle')} head={[t('dash.col.item'), t('dash.sessions'), t('dash.approvalRate')]} rows={d.niche_breakdown.map((r) => [r.k, fmtInt(r.n, lang), fmtPct((100 * r.approved) / r.n, lang)])} /> : undefined}>
          {d ? <HBars rows={d.niche_breakdown.map((r) => ({ k: org.niche === 'agro' || org.niche === 'automotive' || org.niche === 'credit' ? r.k : t(`links.channel.${r.k}`, r.k), n: r.n, sub: `${fmtPct((100 * r.approved) / r.n, lang)} ${t('dash.approvedShort')}` }))} /> : null}
        </ChartCard>
      </div>

      <SessionsTable orgId={org.id} filters={filters} tableFilter={tableFilter} onClear={() => setTableFilter(null)} title={t('dash.sessionsTitle')} />

      <Alert variant="neutral">{t('honesty')}</Alert>
    </div>
  )
}
