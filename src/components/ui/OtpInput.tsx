import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from './cn'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  label: string
  error?: string
  disabled?: boolean
  onComplete?: (value: string) => void
}

/**
 * Código de 6 dígitos. Um input por dígito para leitura visual, mas com
 * autocomplete="one-time-code" no primeiro (iOS/Android sugerem o código) e colar em qualquer caixa.
 */
export function OtpInput({ value, onChange, length = 6, label, error, disabled, onComplete }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const setAt = (index: number, digit: string) => {
    const next = digits.slice()
    next[index] = digit
    const joined = next.join('').slice(0, length)
    onChange(joined)
    if (joined.length === length && !joined.includes('')) onComplete?.(joined)
  }

  const fill = (raw: string, from = 0) => {
    const clean = raw.replace(/\D/g, '').slice(0, length - from)
    if (!clean) return
    const next = digits.slice()
    clean.split('').forEach((d, i) => (next[from + i] = d))
    const joined = next.join('')
    onChange(joined)
    const focusIndex = Math.min(from + clean.length, length - 1)
    refs.current[focusIndex]?.focus()
    if (joined.length === length) onComplete?.(joined)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      setAt(i - 1, '')
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault()
    fill(e.clipboardData.getData('text'), i)
  }

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="t-label mb-1.5 text-[var(--ink)]">{label}</legend>
      <div className="flex gap-2" role="group">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            value={d}
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? length : 1}
            aria-label={`${label} — ${i + 1}/${length}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'otp-error' : undefined}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '')
              if (v.length > 1) return fill(v, i)
              setAt(i, v)
              if (v && i < length - 1) refs.current[i + 1]?.focus()
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            onFocus={(e) => e.target.select()}
            className={cn(
              'tabular h-14 w-full min-w-0 max-w-12 rounded-sm border bg-[var(--input-bg)] text-center',
              'font-semibold text-[22px] text-[var(--ink)] border-[var(--input-border)]',
              'focus:outline-none focus:border-[var(--brand-500)] focus:shadow-[0_0_0_3px_rgba(71,86,201,.18)]',
              'aria-[invalid=true]:border-[var(--risk-high)]',
            )}
          />
        ))}
      </div>
      {error ? (
        <p id="otp-error" className="m-0 mt-1.5 t-caption text-[var(--risk-high-ink)]">{error}</p>
      ) : null}
    </fieldset>
  )
}
