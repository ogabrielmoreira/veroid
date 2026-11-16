import { useTranslation } from 'react-i18next'
import { Funnel } from '@/features/dashboard/DashCharts'
import { fmtBrl, fmtInt, fmtPct } from '@/features/dashboard/charts'
import { demoSnapshot } from '@/features/demo/demoSnapshot'

/** Prévia do painel na página inicial (modo demonstração): só números fictícios, nenhuma imagem de pessoa. */
export default function LandingPeek() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const k = demoSnapshot.kpis
  const cards = [
    { key: 'kpiVerifications', v: fmtInt(k.verifications, lang) },
    { key: 'kpiAutoApproval', v: fmtPct(k.auto_approval_rate, lang) },
    { key: 'kpiBlocked', v: fmtInt(k.fraud_blocked, lang) },
    { key: 'kpiLosses', v: fmtBrl(k.losses_prevented, lang) },
  ]
  return (
    <div className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-overlay)]">
      <p className="m-0 mb-3 inline-flex items-center gap-2 t-overline text-[var(--brand-accent)]">
        <span className="size-1.5 rounded-full bg-[#F0C077]" aria-hidden="true" />{t('landing.demo.peekLabel')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div key={c.key} className="rounded-[10px] border border-[var(--divider)] bg-[var(--n-50)] p-3">
            <p className="m-0 t-overline text-[var(--ink-muted)]">{t(`dash.${c.key}`)}</p>
            <p className="m-0 mt-1 tabular text-[20px] font-semibold leading-7 text-[var(--ink)]">{c.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4"><Funnel data={demoSnapshot.funnel} onSelect={() => {}} /></div>
    </div>
  )
}
