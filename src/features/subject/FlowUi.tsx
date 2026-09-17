import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/components/ui/cn'

interface FlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'link'
  loading?: boolean
  icon?: IconName
  iconRight?: IconName
}

/** Botões do fluxo do titular: 44px, largura total, cor da marca da organização. */
export const FlowButton = forwardRef<HTMLButtonElement, FlowButtonProps>(function FlowButton(
  { variant = 'primary', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'flex min-h-11 w-full items-center justify-center gap-2 px-[18px] py-[11px] text-[15px] font-medium',
        'rounded-[var(--radius-md)] transition-[background-color,border-color] duration-[var(--dur-instant)]',
        'disabled:cursor-not-allowed disabled:border disabled:border-[#D7DAE8] disabled:bg-[#EBEDF4] disabled:text-[#6A7192]',
        variant === 'primary' && 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]',
        variant === 'secondary' && 'border border-[#B6BBD0] bg-white text-[#10142B] hover:border-[var(--brand-primary)]',
        variant === 'link' && 'min-h-11 bg-transparent text-[var(--brand-700)] underline underline-offset-2',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={18} /> : icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
      {iconRight && !loading ? <Icon name={iconRight} size={18} /> : null}
    </button>
  )
})

/** Uma decisão por tela: título focável → conteúdo → ações no fluxo (não fixas). */
export function FlowScreen({ title, subtitle, icon, iconTone = 'brand', children, actions, stepKey }: {
  title: string; subtitle?: ReactNode; icon?: IconName; iconTone?: 'brand' | 'warning' | 'success' | 'neutral'
  children?: ReactNode; actions?: ReactNode; stepKey: string
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => { ref.current?.focus({ preventScroll: false }) }, [stepKey])
  const tones = {
    brand: { background: 'var(--brand-50)', color: 'var(--brand-700)' },
    warning: { background: '#FBF0DF', color: '#7A4900' },
    success: { background: '#E6F2EB', color: '#0B5C37' },
    neutral: { background: '#EEF0F2', color: '#3D464F' },
  }
  return (
    <section className="enter flex flex-1 flex-col px-5 pb-6 pt-6" aria-labelledby={`h-${stepKey}`}>
      {icon ? (
        <span className="mb-4 grid size-12 place-items-center rounded-full" style={tones[iconTone]}><Icon name={icon} size={24} /></span>
      ) : null}
      <h1 id={`h-${stepKey}`} ref={ref} tabIndex={-1} className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[#10142B] outline-none" style={{ fontFamily: 'var(--font-display)' }}>
        {title}
      </h1>
      {subtitle ? <div className="mt-2 text-[16px] leading-[26px] text-[#3C4262]">{subtitle}</div> : null}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
      {actions ? <div className="mt-auto flex flex-col gap-2 pt-8">{actions}</div> : null}
    </section>
  )
}

export function FlowAlert({ tone = 'warning', children, title }: { tone?: 'warning' | 'error' | 'info'; children: ReactNode; title?: string }) {
  const s = {
    warning: 'bg-[#FBF0DF] border-[rgba(176,106,0,.28)] text-[#7A4900]',
    error: 'bg-[#FBE9E7] border-[rgba(179,38,30,.28)] text-[#8C1D18]',
    info: 'bg-[var(--brand-50)] border-[var(--brand-200)] text-[var(--brand-700)]',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-[11px] rounded-[var(--radius-md)] border p-[14px] text-[14px] leading-[1.55]', s)}>
      <Icon name={tone === 'info' ? 'info' : 'review'} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-[#3C4262]">{title ? <p className="m-0 font-semibold text-[#10142B]">{title}</p> : null}{children}</div>
    </div>
  )
}
