import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export const TOUR_STEPS = ['kpis', 'funnel', 'fraud', 'map', 'simulate'] as const
export type TourStepKey = (typeof TOUR_STEPS)[number]

/** Tour guiado opcional de 5 passos sobre o painel público (§10): realça a seção e explica, sem travar a navegação. */
export function GuidedTour({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const key = TOUR_STEPS[step]
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  // Acessibilidade (§10): como é role="dialog" aria-modal, precisa se comportar como um modal
  // de verdade — foco inicial, Esc fecha e Tab não escapa para o painel por trás (mesmo padrão do Modal).
  useEffect(() => {
    triggerRef.current = document.activeElement
    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFinish() }
      if (e.key === 'Tab') {
        const els = focusables()
        if (!els.length) return
        const [a, z] = [els[0], els[els.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      ;(triggerRef.current as HTMLElement | null)?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const target = document.querySelector(`[data-tour="${key}"]`)
    if (!target) { setRect(null); return }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const update = () => setRect(target.getBoundingClientRect())
    update()
    const id = window.setTimeout(update, 350)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [key])

  const last = step === TOUR_STEPS.length - 1
  const next = () => (last ? onFinish() : setStep((s) => s + 1))

  return (
    <div ref={panelRef} className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={t('demo.tour.title')}>
      <div className="absolute inset-0 bg-[rgba(10,12,26,.55)]" />
      {rect ? (
        <div
          className="absolute rounded-[14px] ring-4 ring-[var(--brand-400)] transition-all duration-300"
          style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16, boxShadow: '0 0 0 4000px rgba(10,12,26,.55)' }}
        />
      ) : null}
      <div
        className="enter absolute left-1/2 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-modal)]"
        style={{ top: rect ? Math.min(Math.max(rect.bottom + 16, 84), window.innerHeight - 220) : '50%' }}
      >
        <p className="m-0 t-overline text-[var(--brand-600)]">{t('demo.tour.step', { current: step + 1, total: TOUR_STEPS.length })}</p>
        <h2 className="mt-1 t-h4 font-sans text-[var(--ink)]">{t(`demo.tour.${key}.title`)}</h2>
        <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t(`demo.tour.${key}.body`)}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={onFinish} className="t-caption font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">
            {t('demo.tour.skip')}
          </button>
          <div className="flex gap-2">
            {step > 0 ? <Button variant="secondary" icon="arrowLeft" onClick={() => setStep((s) => s - 1)}>{t('common.back')}</Button> : null}
            <Button iconRight={last ? undefined : 'arrowRight'} onClick={next}>
              {last ? t('demo.tour.finish') : t('common.continue')}
            </Button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onFinish}
        aria-label={t('common.close')}
        className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-[var(--surface-raised)] text-[var(--ink)] shadow-[var(--shadow-modal)]"
      >
        <Icon name="rejected" size={18} />
      </button>
    </div>
  )
}
