import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { Icon } from './Icon'

const control =
  'block w-full min-h-11 lg:min-h-10 rounded-sm border bg-[var(--input-bg)] px-3 py-[11px] ' +
  'text-[16px] lg:text-[14px] leading-[18px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
  'border-[var(--input-border)] transition-[border-color,box-shadow] duration-[var(--dur-instant)] ' +
  'focus:outline-none focus:border-[var(--brand-500)] focus:shadow-[0_0_0_3px_rgba(71,86,201,.18)] ' +
  'aria-[invalid=true]:border-[var(--risk-high)] disabled:bg-[var(--n-100)] disabled:text-[var(--n-500)]'

interface FieldShellProps {
  id: string
  label: ReactNode
  help?: ReactNode
  error?: string
  optional?: boolean
  children: ReactNode
  className?: string
}

export function FieldShell({ id, label, help, error, optional, children, className }: FieldShellProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('t-label text-[var(--ink)]', error && 'text-[var(--risk-high-ink)]')}>
        {label}
        {optional ? <span className="ml-1.5 font-normal text-[var(--ink-muted)]">({t('common.optional')})</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 flex items-start gap-1.5 t-caption text-[var(--risk-high-ink)]">
          <Icon name="review" size={16} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="m-0 t-caption text-[var(--ink-muted)]">
          {help}
        </p>
      ) : null}
    </div>
  )
}

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  help?: ReactNode
  error?: string
  optional?: boolean
  trailing?: ReactNode
  wrapperClassName?: string
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, help, error, optional, trailing, id, className, wrapperClassName, ...rest },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const describedBy = error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined
  return (
    <FieldShell id={fieldId} label={label} help={help} error={error} optional={optional} className={wrapperClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(control, trailing ? 'pr-12' : undefined, className)}
          {...rest}
        />
        {trailing ? <div className="absolute inset-y-0 right-0 flex items-center pr-0.5">{trailing}</div> : null}
      </div>
    </FieldShell>
  )
})

export const PasswordField = forwardRef<HTMLInputElement, Omit<InputFieldProps, 'type' | 'trailing'>>(
  function PasswordField(props, ref) {
    const { t } = useTranslation()
    const [visible, setVisible] = useState(false)
    return (
      <InputField
        ref={ref}
        type={visible ? 'text' : 'password'}
        spellCheck={false}
        {...props}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
            aria-pressed={visible}
            className="grid size-11 lg:size-10 place-items-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
          </button>
        }
      />
    )
  },
)

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  help?: ReactNode
  error?: string
  optional?: boolean
  children: ReactNode
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, help, error, optional, id, className, children, ...rest },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} help={help} error={error} optional={optional}>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}
          className={cn(control, 'appearance-none pr-10', className)}
          {...rest}
        >
          {children}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
      </div>
    </FieldShell>
  )
})

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  badge?: ReactNode
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, badge, error, id, className, ...rest },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="mt-0.5 size-[18px] shrink-0 accent-[var(--brand-800)] [[data-theme=dark]_&]:accent-[var(--brand-300)]"
          {...rest}
        />
        <label htmlFor={fieldId} className="text-[13px] leading-[1.5] text-[var(--ink-body)]">
          {label}
          {badge ? <span className="ml-2 align-middle">{badge}</span> : null}
        </label>
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="m-0 mt-1.5 ml-7 flex items-start gap-1.5 t-caption text-[var(--risk-high-ink)]">
          <Icon name="review" size={16} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
})
