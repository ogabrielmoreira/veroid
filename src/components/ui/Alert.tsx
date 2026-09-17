import type { ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

type Variant = 'info' | 'warning' | 'neutral' | 'error' | 'success'

const styles: Record<Variant, { box: string; icon: IconName; ink: string }> = {
  info: { box: 'bg-[var(--brand-50)] border-[var(--brand-200)] [[data-theme=dark]_&]:bg-[#151A33] [[data-theme=dark]_&]:border-[#262C45]', icon: 'info', ink: 'text-[var(--link)]' },
  warning: { box: 'bg-[var(--risk-review-bg)] border-[rgba(176,106,0,.28)]', icon: 'review', ink: 'text-[var(--risk-review-ink)]' },
  neutral: { box: 'bg-[var(--risk-unknown-bg)] border-[rgba(16,20,43,.16)] [[data-theme=dark]_&]:border-[#262C45]', icon: 'info', ink: 'text-[var(--risk-unknown-ink)]' },
  error: { box: 'bg-[var(--risk-high-bg)] border-[rgba(179,38,30,.28)]', icon: 'rejected', ink: 'text-[var(--risk-high-ink)]' },
  success: { box: 'bg-[var(--risk-low-bg)] border-[rgba(15,122,74,.28)]', icon: 'approved', ink: 'text-[var(--risk-low-ink)]' },
}

interface AlertProps {
  variant?: Variant
  title?: ReactNode
  children?: ReactNode
  className?: string
  live?: boolean
}

export function Alert({ variant = 'info', title, children, className, live }: AlertProps) {
  const s = styles[variant]
  return (
    <div
      role={live ? (variant === 'error' ? 'alert' : 'status') : undefined}
      className={cn('flex gap-[11px] rounded-md border p-[14px] text-[13px] leading-[1.55]', s.box, className)}
    >
      <Icon name={s.icon} size={18} className={cn('mt-px shrink-0', s.ink)} />
      <div className="min-w-0 text-[var(--ink-body)]">
        {title ? <p className={cn('m-0 font-semibold', s.ink)}>{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
      </div>
    </div>
  )
}
