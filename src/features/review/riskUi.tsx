import { useTranslation } from 'react-i18next'
import { Chip, type ChipTone } from '@/components/ui/Chip'
import type { IconName } from '@/components/ui/Icon'

export type RiskBand = 'low' | 'review' | 'high' | 'unknown'
export const BAND_META: Record<RiskBand, { tone: ChipTone; icon: IconName; color: string; ink: string }> = {
  low: { tone: 'low', icon: 'approved', color: 'var(--risk-low)', ink: 'var(--risk-low-ink)' },
  review: { tone: 'review', icon: 'review', color: 'var(--risk-review)', ink: 'var(--risk-review-ink)' },
  high: { tone: 'high', icon: 'rejected', color: 'var(--risk-high)', ink: 'var(--risk-high-ink)' },
  unknown: { tone: 'unknown', icon: 'unknown', color: 'var(--risk-unknown)', ink: 'var(--risk-unknown-ink)' },
}

export function RiskChip({ band }: { band: RiskBand | null }) {
  const { t } = useTranslation()
  if (!band) return <Chip tone="neutral" icon="pending">{t('risk.pending')}</Chip>
  const m = BAND_META[band]
  return <Chip tone={m.tone} icon={m.icon}>{t(`risk.${band}`)}</Chip>
}

export function DecisionChip({ decision, auto }: { decision: 'pending' | 'approved' | 'rejected'; auto?: boolean }) {
  const { t } = useTranslation()
  if (decision === 'approved') return <Chip tone="low" icon="approved">{auto ? t('decision.autoApproved') : t('decision.approved')}</Chip>
  if (decision === 'rejected') return <Chip tone="high" icon="rejected">{t('decision.rejected')}</Chip>
  return <Chip tone="info" icon="pending">{t('decision.pending')}</Chip>
}

/** Barra de score (§3.6) */
export function ScoreBar({ score, band }: { score: number | null; band: RiskBand | null }) {
  const { t } = useTranslation()
  const ink = band ? BAND_META[band].ink : 'var(--ink-muted)'
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="t-overline text-[var(--ink-muted)]">{t('dash.riskScore')}</span>
        <span className="tabular text-[24px] font-semibold tracking-[-0.02em]" style={{ color: ink }}>
          {score ?? '—'} <span className="text-[14px] font-medium text-[var(--ink-muted)]">/ 100</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#0F7A4A 0 30%,#B06A00 30% 70%,#B3261E 70% 100%)' }}
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined} aria-label={t('dash.riskScore')}>
        {score !== null ? <span className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-[2px] bg-[var(--ink)] transition-[left] duration-[var(--dur-slow)]" style={{ left: `${score}%` }} /> : null}
      </div>
      <div className="relative mt-1 h-3.5 t-micro text-[var(--ink-muted)] tabular" aria-hidden="true">
        <span className="absolute left-0">0 {t('dash.auto')}</span>
        <span className="absolute left-[30%] -translate-x-1/2">30</span>
        <span className="absolute left-[70%] -translate-x-1/2">70</span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  )
}
