import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md t-label whitespace-nowrap select-none ' +
  'min-h-11 lg:min-h-10 px-[18px] py-[11px] ' +
  'transition-[background-color,border-color,color] duration-[var(--dur-instant)] ' +
  'disabled:cursor-not-allowed disabled:bg-[var(--n-100)] disabled:text-[var(--n-500)] disabled:border disabled:border-[var(--n-200)]'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)] hover:bg-[var(--brand-primary-hover)]',
  secondary:
    'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-strong)] hover:border-[var(--brand-primary)]',
  ghost: 'bg-transparent text-[var(--link)] px-3 hover:bg-[var(--brand-50)] [[data-theme=dark]_&]:hover:bg-[#151A33]',
  destructive:
    'bg-[var(--risk-high)] text-white hover:bg-[var(--risk-high-ink)] focus-visible:outline-[#10142B]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: IconName
  iconRight?: IconName
  block?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, icon, iconRight, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner size={18} /> : icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
      {iconRight && !loading ? <Icon name={iconRight} size={18} /> : null}
    </button>
  )
})

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  icon?: IconName
  iconRight?: IconName
  block?: boolean
}

export function ButtonLink({ variant = 'primary', icon, iconRight, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], block && 'w-full', className)} {...rest}>
      {icon ? <Icon name={icon} size={18} /> : null}
      <span>{children as ReactNode}</span>
      {iconRight ? <Icon name={iconRight} size={18} /> : null}
    </Link>
  )
}
