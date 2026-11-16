import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * Simulador de onboarding "como um aplicativo": splash, slides, pedido de câmera fictício, validação
 * facial ANIMADA (silhueta genérica, sem câmera, sem rosto de ninguém), leitura de documento fictícia
 * e resultado. Nada aqui chama a câmera, o navegador ou a rede. É só animação.
 */
type Screen = 'splash' | 'slides' | 'perm' | 'face' | 'doc' | 'result'
const ORDER: Screen[] = ['splash', 'slides', 'perm', 'face', 'doc', 'result']

const CSS = `
@keyframes vscan{0%{top:6%}50%{top:90%}100%{top:6%}}
@keyframes vpulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes vturn{0%,100%{transform:translateX(0)}30%{transform:translateX(-14px)}70%{transform:translateX(14px)}}
@keyframes vblink{0%,40%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}
.v-scan{animation:vscan 2.2s ease-in-out infinite}.v-pulse{animation:vpulse 1.4s ease-in-out infinite}
.v-turn{animation:vturn 2.4s ease-in-out infinite}.v-blink{animation:vblink 1.6s ease-in-out infinite;transform-origin:center}
@media (prefers-reduced-motion:reduce){.v-scan,.v-pulse,.v-turn,.v-blink{animation:none}}
`

export function OnboardingSimulator({ name }: { name: string }) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<Screen>('splash')
  const [slide, setSlide] = useState(0)
  const [phase, setPhase] = useState(0) // face: 0 procurar, 1 piscar, 2 virar, 3 ok | doc: 0..3
  const [score, setScore] = useState(0)
  const [log, setLog] = useState<Array<{ at: number; key: string }>>([])
  const t0 = useRef(0)

  const push = useCallback((key: string) => {
    if (!t0.current) t0.current = Date.now()
    setLog((l) => [...l, { at: Math.round((Date.now() - t0.current) / 1000), key }])
  }, [])
  const go = (s: Screen) => { setScreen(s); setPhase(0) }
  const restart = () => { setScreen('splash'); setSlide(0); setPhase(0); setScore(0); setLog([]); t0.current = 0 }

  // Linha do tempo das animações (face e documento).
  useEffect(() => {
    if (screen !== 'face' && screen !== 'doc') return
    if (screen === 'face' && phase === 0) push('liveness_started')
    const id = window.setTimeout(() => {
      if (screen === 'face') {
        if (phase < 3) { setPhase(phase + 1); if (phase === 2) push('liveness_passed') } else go('doc')
      } else if (phase < 3) { setPhase(phase + 1); if (phase === 2) push('document_read') } else { push('decision'); go('result') }
    }, phase === 3 ? 1100 : 1900)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, phase])

  // Contagem do score no resultado.
  useEffect(() => {
    if (screen !== 'result') return
    let n = 0
    const id = window.setInterval(() => { n += 4; setScore(Math.min(91, n)); if (n >= 91) window.clearInterval(id) }, 30)
    return () => window.clearInterval(id)
  }, [screen])

  const slides = [0, 1, 2]
  const idx = ORDER.indexOf(screen)

  const Btn = ({ onClick, children, ghost }: { onClick: () => void; children: ReactNode; ghost?: boolean }) => (
    <button type="button" onClick={onClick} className={`min-h-11 w-full rounded-[12px] px-4 text-[15px] font-semibold ${ghost ? 'text-[var(--brand-700)]' : 'text-white'}`} style={ghost ? undefined : { background: 'var(--brand-600)' }}>{children}</button>
  )
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•'
  const checkItem = (done: boolean, active: boolean, label: string) => (
    <li className={`flex items-center gap-2 text-[13px] ${done ? 'text-[#0F7A4A]' : active ? 'font-semibold text-[#10142B]' : 'text-[#8A8FA8]'}`}>
      <span className={`grid size-5 place-items-center rounded-full border ${done ? 'border-[#0F7A4A] bg-[#0F7A4A] text-white' : active ? 'border-[var(--brand-500)] v-pulse' : 'border-[#C9CCDB]'}`}>{done ? <Icon name="check" size={16} /> : null}</span>{label}
    </li>
  )

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
      <style>{CSS}</style>
      <div data-tour="phone" className="relative mx-auto w-[290px] overflow-hidden rounded-[34px] border-[9px] border-[#14162B] bg-[#14162B] shadow-[var(--shadow-modal)]" style={{ aspectRatio: '9/18' }}>
        <span className="absolute left-1/2 top-1.5 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-black/60" aria-hidden="true" />
        <div className="relative flex size-full flex-col items-center gap-4 rounded-[24px] bg-white p-5 pt-8 text-center text-[#10142B]" aria-live="polite">
          {screen === 'splash' ? (
            <>
              <div className="mt-10 grid size-20 place-items-center rounded-[22px] text-[28px] font-bold text-white" style={{ background: 'var(--brand-600)' }}>{initials}</div>
              <h3 className="m-0 text-[18px] font-bold">{name}</h3>
              <p className="m-0 text-[13px] text-[#3C4262]">{t('demoApp.sim.splashHint')}</p>
              <div className="mt-auto w-full"><Btn onClick={() => { push('app_open'); go('slides') }}>{t('demoApp.sim.open')}</Btn></div>
            </>
          ) : null}

          {screen === 'slides' ? (
            <>
              <Icon name={(['shield', 'liveness', 'lock'] as IconName[])[slide]} size={30} className="mt-8 text-[var(--brand-600)]" />
              <h3 className="m-0 text-[17px] font-bold leading-6">{t(`demoApp.sim.slides.${slide}.title`, { org: name })}</h3>
              <p className="m-0 text-[13px] leading-5 text-[#3C4262]">{t(`demoApp.sim.slides.${slide}.text`)}</p>
              <div className="flex gap-1.5" aria-hidden="true">{slides.map((s) => <span key={s} className="size-2 rounded-full" style={{ background: s === slide ? 'var(--brand-600)' : '#D5D8E6' }} />)}</div>
              <div className="mt-auto w-full"><Btn onClick={() => { if (slide < 2) setSlide(slide + 1); else { push('consent_shown'); go('perm') } }}>{slide < 2 ? t('demoApp.sim.next') : t('demoApp.sim.startBtn')}</Btn></div>
            </>
          ) : null}

          {screen === 'perm' ? (
            <>
              <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
              <div className="relative z-10 mt-14 flex w-full flex-col gap-2 rounded-[16px] border border-[#E3E5EF] bg-white p-4 shadow-lg">
                <Icon name="capture" size={24} className="mx-auto text-[var(--brand-600)]" />
                <h3 className="m-0 text-[15px] font-bold leading-5">{t('demoApp.sim.permTitle', { org: name })}</h3>
                <p className="m-0 text-[12px] leading-4 text-[#3C4262]">{t('demoApp.sim.permText')}</p>
                <Btn onClick={() => { push('camera_asked'); push('camera_allowed'); go('face') }}>{t('demoApp.sim.allow')}</Btn>
                <Btn ghost onClick={() => { push('camera_asked'); push('camera_denied'); go('face') }}>{t('demoApp.sim.deny')}</Btn>
              </div>
            </>
          ) : null}

          {screen === 'face' ? (
            <>
              <h3 className="m-0 text-[15px] font-bold">{t('demoApp.sim.face.title')}</h3>
              <div className="relative h-[190px] w-[150px] shrink-0 overflow-hidden rounded-[50%] border-[3px] bg-[#F1F2F7]" style={{ borderColor: phase === 3 ? '#0F7A4A' : 'var(--brand-500)' }} aria-hidden="true">
                {/* silhueta genérica abstrata: sem traços reais */}
                <svg viewBox="0 0 100 130" className={`absolute inset-0 size-full ${phase === 2 ? 'v-turn' : ''}`}>
                  <circle cx="50" cy="52" r="22" fill="#D5D8E6" />
                  <path d="M12 130c0-26 17-40 38-40s38 14 38 40Z" fill="#D5D8E6" />
                  {phase === 1 ? <g className="v-blink"><rect x="38" y="48" width="8" height="3" rx="1.5" fill="#B7BBD0" /><rect x="54" y="48" width="8" height="3" rx="1.5" fill="#B7BBD0" /></g> : null}
                </svg>
                {phase < 3 ? <span className="v-scan absolute inset-x-0 h-0.5" style={{ background: 'var(--brand-500)', boxShadow: '0 0 10px var(--brand-500)' }} /> : null}
                {phase === 3 ? <span className="absolute inset-0 grid place-items-center bg-[#0F7A4A]/15 text-[#0F7A4A]"><Icon name="approved" size={30} /></span> : null}
              </div>
              <p className="m-0 min-h-10 text-[14px] font-semibold">{t(`demoApp.sim.face.steps.${['find', 'blink', 'turn', 'done'][phase]}`)}</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-left">
                {checkItem(phase > 0, phase === 0, t('demoApp.sim.face.steps.find'))}
                {checkItem(phase > 1, phase === 1, t('demoApp.sim.face.steps.blink'))}
                {checkItem(phase > 2, phase === 2, t('demoApp.sim.face.steps.turn'))}
              </ul>
              <p className="mt-auto m-0 text-[11px] text-[#6B7194]">{t('demoApp.sim.face.hint')}</p>
            </>
          ) : null}

          {screen === 'doc' ? (
            <>
              <h3 className="m-0 text-[15px] font-bold">{t('demoApp.sim.doc.title')}</h3>
              <div className="relative flex h-[110px] w-full flex-col justify-center gap-2 overflow-hidden rounded-[10px] border border-dashed border-[#B7BBD0] bg-[#F1F2F7] p-3" aria-hidden="true">
                {[70, 90, 55].map((w, i) => <span key={i} className="h-2 rounded-full bg-[#D5D8E6]" style={{ width: `${w}%` }} />)}
                {phase < 3 ? <span className="v-scan absolute inset-x-0 h-0.5" style={{ background: 'var(--brand-500)' }} /> : null}
              </div>
              <ul className="m-0 flex w-full list-none flex-col gap-1.5 p-0 text-left">
                {checkItem(phase > 0, phase === 0, t('demoApp.sim.doc.fields.name'))}
                {checkItem(phase > 1, phase === 1, t('demoApp.sim.doc.fields.id'))}
                {checkItem(phase > 2, phase === 2, t('demoApp.sim.doc.fields.birth'))}
              </ul>
              <p className="mt-auto m-0 text-[11px] text-[#6B7194]">{t('demoApp.sim.doc.hint')}</p>
            </>
          ) : null}

          {screen === 'result' ? (
            <>
              <Icon name="approved" size={30} className="mt-6 text-[#0F7A4A]" />
              <h3 className="m-0 text-[17px] font-bold">{t('demoApp.sim.result.title')}</h3>
              <p className="m-0 text-[12px] text-[#3C4262]">{t('demoApp.sim.result.score')}</p>
              <p className="m-0 tabular text-[40px] font-bold leading-none" style={{ color: 'var(--brand-700)' }}>{score}<span className="text-[16px] text-[#6B7194]">/100</span></p>
              <p className="m-0 text-[13px] font-semibold text-[#0F7A4A]">{t('demoApp.sim.result.decision')}</p>
              <p className="m-0 text-[12px] leading-4 text-[#3C4262]">{t('demoApp.sim.result.text')}</p>
              <div className="mt-auto w-full"><Btn onClick={restart}>{t('demoApp.sim.restart')}</Btn></div>
            </>
          ) : null}
          <p className="m-0 text-[10px] text-[#8A8FA8]">{t('demoApp.sim.progress', { n: idx + 1, total: ORDER.length })}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Alert variant="warning" title={t('demoApp.sim.offTitle')}>{t('demoApp.sim.offBody')}</Alert>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-5">
          <h3 className="m-0 font-sans text-[15px] font-semibold text-[var(--ink)]">{t('demoApp.sim.log.title')}</h3>
          {log.length === 0 ? <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t('demoApp.sim.log.empty')}</p> : (
            <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
              {log.map((e, i) => (
                <li key={i} className="flex gap-3 font-mono text-[12px] text-[var(--ink-body)]"><span className="tabular text-[var(--ink-muted)]">+{String(e.at).padStart(2, '0')}s</span>{t(`demoApp.sim.log.events.${e.key}`)}</li>
              ))}
            </ol>
          )}
          <p className="m-0 mt-3 t-caption text-[var(--ink-muted)]">{t('demoApp.sim.log.note')}</p>
        </div>
      </div>
    </div>
  )
}
