import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * Simulador de onboarding num "iPhone": medidas em pontos reais (tela 393×852, Dynamic Island, barra de
 * status, indicador de início) e pop-up de permissão no estilo do sistema. É só um desenho na página:
 * nenhuma câmera, permissão do navegador ou rede é usada. Segue as diretrizes iOS (HIG): alerta só para a
 * decisão crítica, alvos de 44 pt, fonte do sistema, cores semânticas.
 */
type Screen = 'home' | 'welcome' | 'pre' | 'alert' | 'cam' | 'doc' | 'result' | 'denied'
const FLOW: Screen[] = ['home', 'welcome', 'pre', 'alert', 'cam', 'doc', 'result']
const SCALE = 0.8
const W = 393, H = 852, BEZEL = 12
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif'
const BLUE = '#007AFF', GREEN = '#34C759', SEP = 'rgba(60,60,67,.29)', SECOND = 'rgba(60,60,67,.6)'

export function OnboardingSimulator({ name }: { name: string }) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<Screen>('home')
  const [phase, setPhase] = useState(0)
  const [log, setLog] = useState<Array<{ at: number; key: string }>>([])
  const t0 = useRef(0)

  const push = useCallback((key: string) => {
    if (!t0.current) t0.current = Date.now()
    setLog((l) => [...l, { at: Math.round((Date.now() - t0.current) / 1000), key }])
  }, [])
  const go = (s: Screen) => { setScreen(s); setPhase(0) }
  const restart = () => { setScreen('home'); setPhase(0); setLog([]); t0.current = 0 }

  // Linha do tempo simples da câmera e do documento (sem animação de varredura).
  useEffect(() => {
    if (screen !== 'cam' && screen !== 'doc') return
    if (screen === 'cam' && phase === 0) push('liveness_started')
    const id = window.setTimeout(() => {
      if (screen === 'cam') {
        if (phase < 3) { setPhase(phase + 1); if (phase === 2) push('liveness_passed') } else go('doc')
      } else if (phase < 3) { setPhase(phase + 1); if (phase === 2) push('document_read') } else { push('decision'); go('result') }
    }, phase === 3 ? 1000 : 1700)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, phase])

  const idx = Math.max(0, FLOW.indexOf(screen === 'denied' ? 'alert' : screen))
  const dark = screen === 'cam'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•'

  const Primary = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} style={{ height: 50, borderRadius: 14, background: 'var(--brand-600)', color: '#fff', fontSize: 17, fontWeight: 600, width: '100%' }}>{children}</button>
  )
  const Tick = ({ done, active }: { done: boolean; active: boolean }) => (
    <span style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', background: done ? GREEN : 'transparent', border: done ? 'none' : `1.5px solid ${active ? BLUE : '#C7C7CC'}`, color: '#fff' }}>
      {done ? <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
    </span>
  )

  const content = () => {
    switch (screen) {
      case 'home':
        return (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg,#5B7DB8 0%,#9A8CC7 55%,#E7A9A0 100%)', paddingTop: 110 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '26px 0', padding: '0 20px', justifyItems: 'center' }}>
              {([['#34C759', 'users'], ['#0A84FF', 'mail'], ['#FFD60A', 'evidence'], ['#8E8E93', 'settings'], ['#FF9F0A', 'chat'], ['#5E5CE6', 'chart'], ['#FF375F', 'health']] as Array<[string, IconName]>).map(([c, ic], i) => (
                <div key={i} style={{ textAlign: 'center', width: 74 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: c, display: 'grid', placeItems: 'center', color: '#fff', margin: '0 auto' }}><Icon name={ic} size={24} /></div>
                  <div style={{ marginTop: 5, color: '#fff', fontSize: 11 }}>{['Phone', 'Mail', 'Notes', 'Settings', 'Chat', 'Stats', 'Health'][i]}</div>
                </div>
              ))}
              <button type="button" onClick={() => { push('app_open'); go('welcome') }} aria-label={t('demoApp.sim.home.openApp', { org: name })} style={{ textAlign: 'center', width: 74 }}>
                <div style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--brand-600)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 auto', boxShadow: '0 0 0 3px rgba(255,255,255,.55)' }}>{initials}</div>
                <div style={{ marginTop: 5, color: '#fff', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              </button>
            </div>
            <div style={{ position: 'absolute', left: 14, right: 14, bottom: 30, height: 96, borderRadius: 34, background: 'rgba(255,255,255,.25)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 12px' }}>
              {['#34C759', '#0A84FF', '#FF9F0A', '#8E8E93'].map((c) => <div key={c} style={{ width: 60, height: 60, borderRadius: 14, background: c }} />)}
            </div>
          </div>
        )
      case 'welcome':
        return (
          <Page>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--brand-600)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700 }}>{initials}</div>
            <h3 style={{ margin: '20px 0 8px', fontSize: 34, fontWeight: 700, lineHeight: '41px', letterSpacing: '.01em' }}>{t('demoApp.sim.welcome.title')}</h3>
            <p style={{ margin: 0, fontSize: 17, lineHeight: '22px', color: SECOND }}>{t('demoApp.sim.welcome.body', { org: name })}</p>
            <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, background: '#fff', borderRadius: 12 }}>
              {(['b1', 'b2', 'b3'] as const).map((k, i) => (
                <li key={k} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: i ? `0.5px solid ${SEP}` : 'none', fontSize: 17 }}><span style={{ color: 'var(--brand-600)' }}><Icon name={(['liveness', 'contract', 'shield'] as IconName[])[i]} size={24} /></span>{t(`demoApp.sim.welcome.${k}`)}</li>
              ))}
            </ul>
            <Bottom><Primary onClick={() => { push('consent_shown'); go('pre') }}>{t('demoApp.sim.welcome.cta')}</Primary></Bottom>
          </Page>
        )
      case 'pre':
      case 'alert':
        return (
          <>
            <Page>
              <div style={{ marginTop: 60, display: 'grid', placeItems: 'center', width: 88, height: 88, borderRadius: 44, background: 'rgba(0,122,255,.12)', color: BLUE }}><Icon name="capture" size={30} /></div>
              <h3 style={{ margin: '24px 0 8px', fontSize: 28, fontWeight: 700, lineHeight: '34px' }}>{t('demoApp.sim.pre.title')}</h3>
              <p style={{ margin: 0, fontSize: 17, lineHeight: '22px', color: SECOND }}>{t('demoApp.sim.pre.body')}</p>
              <p style={{ margin: '16px 0 0', fontSize: 13, lineHeight: '18px', color: SECOND }}>{t('demoApp.sim.pre.demo')}</p>
              <Bottom><Primary onClick={() => { push('permission_prompt'); setScreen('alert') }}>{t('demoApp.sim.pre.cta')}</Primary></Bottom>
            </Page>
            {screen === 'alert' ? (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center' }} role="alertdialog" aria-modal="true" aria-labelledby="ios-alert-t">
                <div style={{ width: 270, borderRadius: 14, background: 'rgba(242,242,247,.94)', backdropFilter: 'blur(30px)', overflow: 'hidden', textAlign: 'center' }}>
                  <div style={{ padding: '20px 16px 16px' }}>
                    <p id="ios-alert-t" style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: '22px' }}>{t('demoApp.sim.alert.title', { org: name })}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: '18px' }}>{t('demoApp.sim.alert.message')}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `0.5px solid ${SEP}` }}>
                    <button type="button" onClick={() => { push('camera_denied'); go('denied') }} style={{ height: 44, fontSize: 17, color: BLUE, borderRight: `0.5px solid ${SEP}` }}>{t('demoApp.sim.alert.deny')}</button>
                    <button type="button" onClick={() => { push('camera_allowed'); go('cam') }} style={{ height: 44, fontSize: 17, fontWeight: 600, color: BLUE }}>{t('demoApp.sim.alert.ok')}</button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )
      case 'denied':
        return (
          <Page>
            <div style={{ marginTop: 60, display: 'grid', placeItems: 'center', width: 88, height: 88, borderRadius: 44, background: 'rgba(60,60,67,.1)', color: SECOND }}><Icon name="cameraOff" size={30} /></div>
            <h3 style={{ margin: '24px 0 8px', fontSize: 28, fontWeight: 700, lineHeight: '34px' }}>{t('demoApp.sim.denied.title')}</h3>
            <p style={{ margin: 0, fontSize: 17, lineHeight: '22px', color: SECOND }}>{t('demoApp.sim.denied.text')}</p>
            <Bottom><Primary onClick={() => go('pre')}>{t('demoApp.sim.denied.cta')}</Primary></Bottom>
          </Page>
        )
      case 'cam':
        return (
          <div style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', paddingTop: 60 }}>
            <div style={{ padding: '0 16px', fontSize: 17, color: '#0A84FF' }}>{t('demoApp.sim.cam.cancel')}</div>
            <h3 style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 17, fontWeight: 600 }}>{t('demoApp.sim.cam.title')}</h3>
            <div style={{ margin: '28px auto 0', width: 230, height: 296, borderRadius: '50%', background: '#1C1C1E', border: `4px solid ${phase === 3 ? GREEN : '#fff'}`, position: 'relative', overflow: 'hidden' }} aria-hidden="true">
              <svg viewBox="0 0 100 130" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}><circle cx="50" cy="52" r="22" fill="#2C2C2E" /><path d="M12 130c0-26 17-40 38-40s38 14 38 40Z" fill="#2C2C2E" /></svg>
            </div>
            <p style={{ margin: '28px 0 0', textAlign: 'center', fontSize: 20, fontWeight: 600 }} aria-live="polite">{t(`demoApp.sim.cam.steps.${['find', 'blink', 'turn', 'done'][phase]}`)}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }} aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: phase > i ? GREEN : 'rgba(255,255,255,.3)' }} />)}</div>
            <p style={{ position: 'absolute', bottom: 56, left: 0, right: 0, margin: 0, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{t('demoApp.sim.cam.hint')}</p>
          </div>
        )
      case 'doc':
        return (
          <Page>
            <h3 style={{ margin: '56px 0 4px', fontSize: 34, fontWeight: 700, lineHeight: '41px' }}>{t('demoApp.sim.doc.title')}</h3>
            <p style={{ margin: 0, fontSize: 17, color: SECOND }}>{t('demoApp.sim.doc.intro')}</p>
            <div style={{ margin: '20px 0 0', height: 150, borderRadius: 12, background: '#E5E5EA', display: 'grid', placeItems: 'center', color: SECOND }}><Icon name="contract" size={30} /></div>
            <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, background: '#fff', borderRadius: 12 }}>
              {(['name', 'id', 'birth'] as const).map((k, i) => (
                <li key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: i ? `0.5px solid ${SEP}` : 'none', fontSize: 17 }}>{t(`demoApp.sim.doc.fields.${k}`)}<Tick done={phase > i} active={phase === i} /></li>
              ))}
            </ul>
            <p style={{ margin: '16px 0 0', fontSize: 13, color: SECOND }}>{t('demoApp.sim.doc.hint')}</p>
          </Page>
        )
      case 'result':
        return (
          <Page>
            <div style={{ marginTop: 90, width: 88, height: 88, borderRadius: 44, background: GREEN, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="check" size={30} /></div>
            <h3 style={{ margin: '24px 0 8px', fontSize: 28, fontWeight: 700, lineHeight: '34px' }}>{t('demoApp.sim.result.title')}</h3>
            <p style={{ margin: 0, fontSize: 17, color: SECOND }}>{t('demoApp.sim.result.score')}: <strong style={{ color: '#000' }}>91/100</strong> · {t('demoApp.sim.result.decision')}</p>
            <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: '20px', color: SECOND }}>{t('demoApp.sim.result.text')}</p>
            <Bottom><Primary onClick={restart}>{t('demoApp.sim.result.cta')}</Primary></Bottom>
          </Page>
        )
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="mx-auto flex flex-col items-center gap-3">
        <div data-tour="phone" style={{ width: (W + BEZEL * 2) * SCALE, height: (H + BEZEL * 2) * SCALE }}>
          <div style={{ width: W + BEZEL * 2, height: H + BEZEL * 2, transform: `scale(${SCALE})`, transformOrigin: 'top left', borderRadius: 68, background: '#1C1C1E', padding: BEZEL, boxShadow: '0 0 0 2px #3A3A3C, 0 24px 48px rgba(16,20,43,.28)', position: 'relative' }}>
            <div style={{ position: 'relative', width: W, height: H, borderRadius: 56, overflow: 'hidden', background: '#fff', fontFamily: SF, color: '#000', WebkitFontSmoothing: 'antialiased' }}>
              {content()}
              {/* barra de status e Dynamic Island */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, color: dark || screen === 'home' ? '#fff' : '#000', pointerEvents: 'none' }} aria-hidden="true">
                <span style={{ position: 'absolute', left: 52, top: 18, fontSize: 17, fontWeight: 600 }}>9:41</span>
                <svg style={{ position: 'absolute', right: 28, top: 20 }} width="68" height="14" viewBox="0 0 68 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1" /><rect x="5" y="6" width="3" height="8" rx="1" /><rect x="10" y="3" width="3" height="11" rx="1" /><rect x="15" y="0" width="3" height="14" rx="1" /><path d="M29 12.5a1.4 1.4 0 100-2.8 1.4 1.4 0 000 2.8zM24.6 7.4a6.2 6.2 0 018.8 0l-1.3 1.3a4.4 4.4 0 00-6.2 0zM22 4.8a9.9 9.9 0 0114 0l-1.3 1.3a8.1 8.1 0 00-11.4 0z" /><rect x="42" y="1" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".45" /><rect x="44" y="3" width="18" height="8" rx="2" /><rect x="65" y="5" width="1.8" height="4" rx=".9" fillOpacity=".5" /></svg>
              </div>
              <div style={{ position: 'absolute', top: 11, left: '50%', width: 126, height: 37, marginLeft: -63, borderRadius: 19, background: '#000' }} aria-hidden="true" />
              <div style={{ position: 'absolute', bottom: 8, left: '50%', width: 134, height: 5, marginLeft: -67, borderRadius: 3, background: dark || screen === 'home' ? '#fff' : '#000' }} aria-hidden="true" />
            </div>
          </div>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.sim.progress', { n: idx + 1, total: FLOW.length })} · {t('demoApp.sim.drawn')}</p>
        <Button variant="ghost" icon="refresh" onClick={restart}>{t('demoApp.sim.restart')}</Button>
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

/** Tela de app no estilo iOS: fundo agrupado, margens de 20 pt, abaixo da barra de status. */
function Page({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, background: '#F2F2F7', padding: '70px 20px 0' }}>{children}</div>
}
function Bottom({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', left: 20, right: 20, bottom: 44 }}>{children}</div>
}
