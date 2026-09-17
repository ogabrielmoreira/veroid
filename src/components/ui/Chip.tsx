import type { ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

export type ChipTone = 'low' | 'review' | 'high' | 'unknown' | 'info' | 'neutral'

const tones: Record<ChipTone, string> = {
  low: 'bg-[var(--risk-low-bg)] text-[var(--risk-low-ink)] border-[rgba(15,122,74,.28)]',
  review: 'bg-[var(--risk-review-bg)] text-[var(--risk-review-ink)] border-[rgba(176,106,0,.28)]',
  high: 'bg-[var(--risk-high-bg)] text-[var(--risk-high-ink)] border-[rgba(179,38,30,.28)]',
  unknown: 'bg-[var(--risk-unknown-bg)] text-[var(--risk-unknown-ink)] border-[rgba(90,101,112,.28)]',
  info: 'bg-[var(--brand-50)] text-[var(--brand-700)] border-[var(--brand-200)] [[data-theme=dark]_&]:bg-[#151A33] [[data-theme=dark]_&]:text-[var(--brand-300)] [[data-theme=dark]_&]:border-[#262C45]',
  neutral: 'bg-[var(--surface)] text-[var(--ink-body)] border-[var(--border)]',
}

/** Chip (§3.5): sempre ícone + palavra; cor nunca é o único indicador. */
export function Chip({ tone, icon, children, className }: { tone: ChipTone; icon: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[11px] py-[5px] text-[12px] font-medium leading-4', tones[tone], className)}>
      <Icon name={icon} size={16} className="-ml-0.5" />
      {children}
    </span>
  )
}
