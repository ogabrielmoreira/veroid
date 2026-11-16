import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, fmtBrl, fmtDuration, fmtInt, fmtPct } from '@/features/dashboard/charts'
import { FraudTypes, FraudTypesTable, Funnel, FunnelTable, Heatmap, HBars, Histogram, UfMap } from '@/features/dashboard/DashCharts'
import { useDemoStats } from './useDemoStats'

/** KPIs e gráficos do painel de demonstração (dados fictícios). Reusado no portal protegido por senha. */
export function DemoCharts() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const q = useDemoStats()
  const d = q.data
  const kpis = d ? [
    { key: 'kpiVerifications', value: fmtInt(d.kpis.verifications, lang) },
    { key: 'kpiAutoApproval', value: fmtPct(d.kpis.auto_approval_rate, lang) },
    { key: 'kpiBlocked', value: fmtInt(d.kpis.fraud_blocked, lang) },
    { key: 'kpiLosses', value: fmtBrl(d.kpis.losses_prevented, lang) },
    { key: 'kpiTime', value: fmtDuration(d.kpis.avg_completion_seconds) },
    { key: 'kpiQualified', value: fmtInt(d.kpis.qualified, lang) },
  ] : []

  return (
    <>
        <section data-tour="kpis" aria-label={t('dash.kpis')} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {(q.isLoading ? Array.from({ length: 6 }).map((_, i) => ({ key: String(i), value: '' })) : kpis).map((k) => (
            <div key={k.key} className="rounded-[10px] border border-[var(--divider)] bg-[var(--n-50)] p-4">
              {q.isLoading ? (
                <div className="flex flex-col gap-2" aria-hidden="true"><span className="h-3 w-3/4 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse" /><span className="h-7 w-1/2 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse" /></div>
              ) : (
                <>
                  <p className="m-0 t-overline text-[var(--ink-muted)]">{t(`dash.${k.key}`)}</p>
                  <p className="m-0 mt-2 tabular text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--ink)]">{k.value}</p>
                </>
              )}
            </div>
          ))}
        </section>

        <div data-tour="funnel" className="grid gap-6 xl:grid-cols-2">
          <ChartCardStatic title={t('dash.funnelTitle')} subtitle={t('dash.funnelSubtitle')} loading={q.isLoading} error={q.isError}
            table={d ? <FunnelTable data={d.funnel} /> : undefined}>
            {d ? <Funnel data={d.funnel} onSelect={() => {}} /> : null}
          </ChartCardStatic>
          <ChartCardStatic title={t('dash.histTitle')} subtitle={t('dash.histSubtitle')} loading={q.isLoading} error={q.isError}
            table={d ? <DataTable caption={t('dash.histTitle')} head={[t('dash.score'), t('dash.sessions')]} rows={d.histogram.map((h) => [`${h.bucket}–${h.bucket === 90 ? 100 : h.bucket + 9}`, fmtInt(h.n, lang)])} /> : undefined}>
            {d ? <Histogram data={d.histogram} onSelect={() => {}} /> : null}
          </ChartCardStatic>
        </div>

        <div data-tour="fraud" className="grid gap-6 xl:grid-cols-2">
          <ChartCardStatic title={t('dash.fraudTitle')} subtitle={t('dash.fraudSubtitle')} loading={q.isLoading} error={q.isError}
            table={d ? <FraudTypesTable data={d.fraud_types} /> : undefined}>
            {d ? <FraudTypes data={d.fraud_types} onSelect={() => {}} /> : null}
          </ChartCardStatic>
          <ChartCardStatic title={t('dash.devicesTitle')} subtitle={t('dash.devicesSubtitle')} loading={q.isLoading} error={q.isError}
            table={d ? <DataTable caption={t('dash.devicesTitle')} head={[t('dash.col.item'), t('dash.sessions')]} rows={[...d.devices.os, ...d.devices.browser].map((r) => [r.k, fmtInt(r.n, lang)])} /> : undefined}>
            {d ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div><p className="m-0 mb-2 t-overline text-[var(--ink-muted)]">{t('dash.os')}</p><HBars rows={d.devices.os} /></div>
                <div><p className="m-0 mb-2 t-overline text-[var(--ink-muted)]">{t('dash.browser')}</p><HBars rows={d.devices.browser} /></div>
              </div>
            ) : null}
          </ChartCardStatic>
        </div>

        <div data-tour="map" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <ChartCardStatic title={t('dash.mapTitle')} subtitle={t('dash.mapSubtitle')} loading={q.isLoading} error={q.isError}
            table={d ? <DataTable caption={t('dash.mapTitle')} head={['UF', t('dash.sessions'), t('dash.highRisk')]} rows={[...d.by_uf].sort((a, b) => b.n - a.n).map((u) => [u.uf, fmtInt(u.n, lang), fmtPct((100 * u.high) / u.n, lang)])} /> : undefined}>
            {d ? <UfMap data={d.by_uf} onSelect={() => {}} /> : null}
          </ChartCardStatic>
          <ChartCardStatic title={t('dash.heatTitle')} subtitle={t('dash.heatSubtitle')} loading={q.isLoading} error={q.isError}
            table={d ? <DataTable caption={t('dash.heatTitle')} head={[t('dash.col.day'), t('dash.col.hour'), t('dash.sessions')]} rows={[...d.heatmap].sort((a, b) => b.n - a.n).slice(0, 30).map((h) => [new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2024, 0, h.dow)), `${h.hour}h`, fmtInt(h.n, lang)])} /> : undefined}>
            {d ? <Heatmap data={d.heatmap} onSelect={() => {}} /> : null}
          </ChartCardStatic>
        </div>
    </>
  )
}

/** Variante somente-leitura do ChartCard (sem clique-para-filtrar, painel público). */
function ChartCardStatic({ title, subtitle, children, table, loading, error }: {
  title: string; subtitle?: string; children: React.ReactNode; table?: React.ReactNode; loading?: boolean; error?: boolean
}) {
  const { t } = useTranslation()
  const [showTable, setShowTable] = useState(false)
  return (
    <section className="flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] font-semibold leading-5 tracking-normal text-[var(--ink)]">{title}</h2>
          {subtitle ? <p className="m-0 mt-0.5 t-caption text-[var(--ink-muted)]">{subtitle}</p> : null}
        </div>
        {table && !loading && !error ? (
          <button type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[12px] font-medium text-[var(--link)] hover:bg-[var(--brand-50)]">
            {showTable ? t('dash.showChart') : t('dash.showTable')}
          </button>
        ) : null}
      </header>
      <div className="mt-4 min-h-[180px] flex-1">
        {loading ? (
          <div className="flex h-full min-h-[180px] flex-col justify-end gap-2" aria-hidden="true">
            {['70%', '92%', '48%', '80%'].map((w, i) => <span key={i} className="h-3 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse" style={{ width: w }} />)}
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-4 text-center">
            <p className="m-0 text-[14px] font-semibold text-[var(--risk-high-ink)]">{t('dash.errorTitle')}</p>
          </div>
        ) : showTable && table ? table : children}
      </div>
    </section>
  )
}
