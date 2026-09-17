import { cn } from './ui/cn'

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <ellipse cx="16" cy="15.5" rx="7" ry="9" fill="none" stroke="#939EE2" strokeWidth="2" />
      <path d="M12.5 16.2l2.4 2.4 4.8-5.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={inverted ? 'text-[var(--brand-600)]' : 'text-[var(--brand-800)] [[data-theme=dark]_&]:text-[var(--brand-600)]'} />
      <span
        className={cn(
          'font-display text-[19px] font-bold tracking-[-0.02em]',
          inverted ? 'text-white' : 'text-[var(--ink)]',
        )}
      >
        Vero ID
      </span>
    </span>
  )
}
