import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from './ui/Spinner'

/** Nada abaixo de 300ms; indicador só depois disso (§3.17). */
export function FullPageLoader() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 300)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--surface-page)] text-[var(--ink-muted)]">
      {show ? <Spinner size={24} label={t('common.loading')} /> : null}
    </div>
  )
}
