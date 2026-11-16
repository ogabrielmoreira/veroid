import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LangPicker } from '@/components/LangPicker'
import { LottieIcon } from '@/components/LottieIcon'
import { Button } from '@/components/ui/Button'

export interface TourStep { key: string; tab?: string; target?: string; lottie: string }
interface Rect { top: number; left: number; width: number; height: number }

const PAD = 10
const CARD_W = 372
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Tutorial obrigatório com spotlight: o foco desliza até a função explicada, a tela rola até ela e o
 * cartão com a explicação acompanha. Sem botão de pular nem de fechar até o último passo; a pessoa
 * avança com "Próximo". Se o alvo não existe na tela (ex.: menu no celular), o passo vira um cartão central.
 */
export function SpotlightTour({ steps, index, onIndex, onFinish }: {
  steps: TourStep[]; index: number; onIndex: (i: number) => void; onFinish: () => void
}) {
  const { t } = useTranslation()
  const step = steps[index]
  const last = index === steps.length - 1
  const nextRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [card, setCard] = useState<{ top: number; left: number } | null>(null)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })

  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight })
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
    if (!el || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') { setRect(null); return }
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) { setRect(null); return }
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step.target])

  // Ao trocar de passo: espera a aba renderizar, rola até o alvo e mede.
  useEffect(() => {
    let alive = true
    const run = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (el && window.innerWidth < 640) {
        // celular: o cartão ocupa a parte de baixo, então leva o alvo para o topo da tela
        const r = el.getBoundingClientRect()
        window.scrollTo({ top: window.scrollY + r.top - 84, behavior: reduced() ? 'auto' : 'smooth' })
      } else if (el) el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
      else window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' })
      measure()
      // segue medindo enquanto a rolagem suave termina
      let n = 0
      const tick = () => { if (!alive || n++ > 24) return; measure(); requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    }
    const id = window.setTimeout(run, 80)
    return () => { alive = false; window.clearTimeout(id) }
  }, [index, step.target, measure])

  useEffect(() => {
    const on = () => measure()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true) }
  }, [measure])

  useEffect(() => { nextRef.current?.focus({ preventScroll: true }) }, [index])

  // Posição do cartão: abaixo, acima, à direita ou à esquerda do alvo; no celular, fixo embaixo.
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight ?? 300
    const mobile = vp.w < 640
    if (mobile) { setCard(null); return }
    if (!rect) { setCard({ top: Math.max(16, (vp.h - h) / 2), left: (vp.w - CARD_W) / 2 }); return }
    const gap = 16
    const clampX = (x: number) => Math.min(Math.max(16, x), vp.w - CARD_W - 16)
    const clampY = (y: number) => Math.min(Math.max(16, y), vp.h - h - 16)
    const cx = rect.left + rect.width / 2 - CARD_W / 2
    const cy = rect.top + rect.height / 2 - h / 2
    if (rect.top + rect.height + gap + h <= vp.h - 8) setCard({ top: rect.top + rect.height + gap, left: clampX(cx) })
    else if (rect.top - gap - h >= 8) setCard({ top: rect.top - gap - h, left: clampX(cx) })
    else if (rect.left + rect.width + gap + CARD_W <= vp.w - 8) setCard({ top: clampY(cy), left: rect.left + rect.width + gap })
    else if (rect.left - gap - CARD_W >= 8) setCard({ top: clampY(cy), left: rect.left - gap - CARD_W })
    else setCard({ top: clampY(vp.h - h - 24), left: clampX(cx) })
  }, [rect, vp, index])

  const mobile = vp.w < 640
  const cx = vp.w / 2, cy = vp.h / 2
  const spot = rect ?? { top: cy, left: cx, width: 0, height: 0 }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      {/* bloqueia cliques no fundo: o avanço é só pelo botão */}
      <div className="absolute inset-0" aria-hidden="true" />
      <div aria-hidden="true" className="vtour-spot pointer-events-none fixed rounded-[18px]"
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, boxShadow: '0 0 0 200vmax rgba(16,20,43,.62)' }}>
        {rect ? <span className="absolute inset-0 rounded-[18px] border-2 border-white/80" /> : null}
      </div>

      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-h" aria-describedby="tour-b"
        className="vtour-card fixed flex flex-col gap-4 rounded-[20px] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-modal)]"
        style={mobile ? { left: 12, right: 12, bottom: 12, maxHeight: '78dvh', overflowY: 'auto' } : { width: CARD_W, top: card?.top ?? 0, left: card?.left ?? 0, opacity: card ? 1 : 0 }}>
        <div key={index} className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <LottieIcon name={step.lottie} size={64} className="shrink-0" />
            <div className="min-w-0 pt-1">
              <p className="m-0 tabular t-overline text-[var(--brand-accent)]">{t('demoApp.tour.step', { current: index + 1, total: steps.length })}</p>
              <h2 id="tour-h" className="m-0 mt-1 font-display text-[21px] font-bold leading-[26px] tracking-[-0.02em]">{t(`demoApp.tour.steps.${step.key}.title`)}</h2>
            </div>
          </div>
          <p id="tour-b" className="m-0 t-body-lg text-[var(--ink-body)]">{t(`demoApp.tour.steps.${step.key}.body`)}</p>
        </div>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {steps.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === index ? 22 : 6, background: i <= index ? 'var(--brand-500)' : 'var(--n-200)' }} />)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] pt-3">
          <LangPicker />
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={index === 0} onClick={() => onIndex(index - 1)}>{t('demoApp.tour.back')}</Button>
            <Button ref={nextRef} iconRight={last ? 'check' : 'arrowRight'} onClick={() => (last ? onFinish() : onIndex(index + 1))}>
              {last ? t('demoApp.tour.finish') : t('demoApp.tour.next')}
            </Button>
          </div>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.tour.required')}</p>
      </div>
    </div>
  )
}
