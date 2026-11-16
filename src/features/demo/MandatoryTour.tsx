import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LangPicker } from '@/components/LangPicker'
import { Button } from '@/components/ui/Button'

export interface TourStep { key: string; tab?: string }

/**
 * Tutorial obrigatório: sem botão de pular nem fechar até o último passo. A pessoa precisa ler cada
 * mensagem e clicar em "Próximo". Cada passo pode trocar a aba do portal para mostrar o que explica.
 */
export function MandatoryTour({ steps, index, onIndex, onFinish }: {
  steps: TourStep[]; index: number; onIndex: (i: number) => void; onFinish: () => void
}) {
  const { t } = useTranslation()
  const nextRef = useRef<HTMLButtonElement>(null)
  const last = index === steps.length - 1
  const step = steps[index]
  useEffect(() => { nextRef.current?.focus() }, [index])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-h" className="flex w-full max-w-[520px] flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-modal)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="t-caption text-[var(--ink-muted)]">{t('demoApp.tour.language')}</span>
          <LangPicker />
        </div>
        <p className="m-0 tabular t-overline text-[var(--brand-accent)]">{t('demoApp.tour.step', { current: index + 1, total: steps.length })}</p>
        <h2 id="tour-h" className="m-0 t-h3 font-sans">{t(`demoApp.tour.steps.${step.key}.title`)}</h2>
        <p className="m-0 t-body text-[var(--ink-body)]">{t(`demoApp.tour.steps.${step.key}.body`)}</p>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--brand-100)]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--brand-500)] transition-[width]" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={index === 0} onClick={() => onIndex(index - 1)}>{t('demoApp.tour.back')}</Button>
          <Button ref={nextRef} iconRight={last ? 'check' : 'arrowRight'} onClick={() => (last ? onFinish() : onIndex(index + 1))}>
            {last ? t('demoApp.tour.finish') : t('demoApp.tour.next')}
          </Button>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.tour.required')}</p>
      </div>
    </div>
  )
}
