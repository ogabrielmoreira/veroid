import { useEffect, useRef } from 'react'
import type { FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

interface Props {
  errors: FieldErrors
  submitCount: number
  labels: Record<string, string>
  idPrefix: string
}

/** Sumário focável no topo quando o submit falha com 2+ campos (§4). */
export function ErrorSummary({ errors, submitCount, labels, idPrefix }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const keys = Object.keys(errors).filter((k) => labels[k])

  useEffect(() => {
    if (submitCount > 0 && keys.length > 1) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount])

  if (keys.length < 2) return null
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mb-6 rounded-md border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-[14px] text-[13px]"
    >
      <p className="m-0 font-semibold text-[var(--risk-high-ink)]">{t('auth.validation.summary', { count: keys.length })}</p>
      <ul className="m-0 mt-1.5 pl-5">
        {keys.map((k) => (
          <li key={k}>
            <a href={`#${idPrefix}-${k}`} className="text-[var(--risk-high-ink)] underline underline-offset-2">
              {labels[k]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
