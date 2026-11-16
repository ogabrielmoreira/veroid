import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * Simulador de onboarding: o cliente abre o link recebido no Safari do iPhone (não é um aplicativo).
 * Medidas em pontos reais (tela 393×852, Dynamic Island, barra de status, barra de endereço do Safari) e
 * pop-up de permissão no estilo do sistema. É só um desenho na página: o endereço é falso e nenhuma câmera,
 * permissão do navegador ou rede é usada. Segue as diretrizes iOS (HIG): alerta só para a decisão crítica,
 * alvos de 44 pt, fonte do sistema, cores semânticas.
 */
type Screen = 'welcome' | 'pre' | 'alert' | 'cam' | 'doc' | 'result' | 'denied'
const FLOW: Screen[] = ['welcome', 'pre', 'alert', 'cam', 'doc', 'result']
const BAR = 112 // altura da barra inferior do Safari (endereço + ferramentas)

/** Endereço falso, derivado do nome da empresa. O domínio não existe de verdade. */
export function fakeHost(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26).replace(/-+$/g, '')
  return `${slug || 'your-company'}.onboard-test.com`
}
const SCALE = 0.8
const W = 393, H = 852, BEZEL = 12
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif'
const BLUE = '#007AFF', SEP = 'rgba(60,60,67,.29)'

export function OnboardingSimulator({ name }: { name: string }) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [phase, setPhase] = useState(0)
  const [log, setLog] = useState<Array<{ at: number; key: string }>>([])
  const t0 = useRef(0)

  const push = useCallback((key: string) => {
    if (!t0.current) t0.current = Date.now()
    setLog((l) => [...l, { at: Math.round((Date.now() - t0.current) / 1000), key }])
  }, [])
  const go = (s: Screen) => { setScreen(s); setPhase(0) }
  const restart = () => { setScreen('welcome'); setPhase(0); t0.current = 0; setLog([{ at: 0, key: 'link_opened' }]) }
  const host = fakeHost(name)
  useEffect(() => { t0.current = Date.now(); setLog([{ at: 0, key: 'link_opened' }]) }, [])

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

  // A página dentro do Safari segue o design system da Vero ID (tokens var(--...)); só a moldura do iPhone, o Safari e o alerta são iOS.
  const Primary = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="w-full font-semibold text-white" style={{ height: 52, borderRadius: 12, background: 'var(--brand-600)', fontSize: 16, fontFamily: 'var(--font-text)' }}>{children}</button>
  )
  const Tick = ({ done, active }: { done: boolean; active: boolean }) => (
    <span style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', background: done ? 'var(--risk-low)' : 'transparent', border: done ? 'none' : `1.5px solid ${active ? 'var(--brand-500)' : 'var(--n-300)'}` }}>
      {done ? <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
    </span>
  )
  const Title = ({ children }: { children: ReactNode }) => <h3 style={{ margin: '24px 0 8px', fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, lineHeight: '34px', letterSpacing: '-0.025em', color: 'var(--ink)' }}>{children}</h3>
  const Body = ({ children }: { children: ReactNode }) => <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', color: 'var(--ink-body)' }}>{children}</p>
  const Small = ({ children }: { children: ReactNode }) => <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: '18px', color: 'var(--ink-muted)' }}>{children}</p>
  const Badge = ({ icon, tone }: { icon: IconName; tone: 'brand' | 'low' | 'neutral' }) => (
    <div style={{ marginTop: 28, display: 'grid', placeItems: 'center', width: 72, height: 72, borderRadius: 36, background: tone === 'low' ? 'var(--risk-low-bg)' : tone === 'brand' ? 'var(--brand-50)' : 'var(--n-100)', color: tone === 'low' ? 'var(--risk-low)' : tone === 'brand' ? 'var(--brand-600)' : 'var(--n-600)' }}><Icon name={icon} size={30} /></div>
  )

  const chip = (i: number, label: string) => {
    const done = phase > i, active = phase === i
    return (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, background: done ? 'var(--risk-low-bg)' : active ? 'var(--brand-50)' : 'var(--n-100)', color: done ? 'var(--risk-low-ink)' : active ? 'var(--brand-700)' : 'var(--n-600)' }}>
        {done ? <Icon name="check" size={16} /> : null}{label}
      </span>
    )
  }

  const content = () => {
    switch (screen) {
      case 'welcome':
        return (
          <Page>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-600)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{initials}</div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
            </div>
            <Title>{t('demoApp.sim.welcome.title')}</Title>
            <Body>{t('demoApp.sim.welcome.body', { org: name })}</Body>
            <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}>
              {(['b1', 'b2', 'b3'] as const).map((k, i) => (
                <li key={k} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderTop: i ? '1px solid var(--divider)' : 'none', fontSize: 15, color: 'var(--ink)' }}><span style={{ color: 'var(--brand-600)' }}><Icon name={(['liveness', 'contract', 'shield'] as IconName[])[i]} size={24} /></span>{t(`demoApp.sim.welcome.${k}`)}</li>
              ))}
            </ul>
            <Bottom><Primary onClick={() => { push('consent_shown'); go('pre') }}>{t('demoApp.sim.welcome.cta')}</Primary></Bottom>
          </Page>
        )
      case 'pre':
      case 'alert':
        return (
          <Page>
            <Badge icon="capture" tone="brand" />
            <Title>{t('demoApp.sim.pre.title')}</Title>
            <Body>{t('demoApp.sim.pre.body')}</Body>
            <Small>{t('demoApp.sim.pre.demo')}</Small>
            <Bottom><Primary onClick={() => { push('permission_prompt'); setScreen('alert') }}>{t('demoApp.sim.pre.cta')}</Primary></Bottom>
          </Page>
        )
      case 'denied':
        return (
          <Page>
            <Badge icon="cameraOff" tone="neutral" />
            <Title>{t('demoApp.sim.denied.title')}</Title>
            <Body>{t('demoApp.sim.denied.text')}</Body>
            <Bottom><Primary onClick={() => go('pre')}>{t('demoApp.sim.denied.cta')}</Primary></Bottom>
          </Page>
        )
      case 'cam': {
        const ring = phase === 3 ? '#7FDCAE' : phase > 0 ? 'var(--brand-300)' : '#fff'
        return (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--n-900)', fontFamily: 'var(--font-text)' }}>
            <h3 style={{ margin: 0, padding: '64px 20px 12px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff' }}>{t('demoApp.sim.cam.title')}</h3>
            <div style={{ position: 'relative', height: 376, background: 'linear-gradient(180deg,#1B2146 0%,#10142B 100%)' }} aria-hidden="true">
              <svg viewBox="0 0 393 376" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <defs><mask id="sim-oval"><rect width="393" height="376" fill="#fff" /><ellipse cx="196" cy="186" rx="116" ry="150" fill="#000" /></mask></defs>
                <ellipse cx="196" cy="186" rx="116" ry="150" fill="#232A52" />
                <circle cx="196" cy="150" r="46" fill="#2E3668" /><path d="M96 330c0-52 44-86 100-86s100 34 100 86z" fill="#2E3668" />
                <rect width="393" height="376" fill="rgba(16,20,43,.62)" mask="url(#sim-oval)" />
                <ellipse cx="196" cy="186" rx="116" ry="150" fill="none" stroke={ring} strokeWidth="4" />
              </svg>
              <span style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(255,255,255,.75)', background: 'rgba(255,255,255,.12)', borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>{t('demoApp.sim.cam.hint')}</span>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 0', minHeight: 232 }}>
              <p style={{ margin: 0, minHeight: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 500, lineHeight: '26px', color: 'var(--ink)' }} aria-live="polite">
                <span style={{ color: phase === 3 ? 'var(--risk-low)' : 'var(--brand-700)', display: 'inline-flex' }}><Icon name={phase === 3 ? 'approved' : 'info'} size={24} /></span>
                {t(`demoApp.sim.cam.steps.${['find', 'blink', 'turn', 'done'][phase]}`)}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {chip(0, t('demoApp.sim.cam.chips.find'))}{chip(1, t('demoApp.sim.cam.chips.blink'))}{chip(2, t('demoApp.sim.cam.chips.turn'))}
              </div>
              <p style={{ margin: '16px 0 0', fontSize: 13, lineHeight: '18px', color: 'var(--ink-muted)' }}>{t('demoApp.sim.cam.auto')}</p>
            </div>
          </div>
        )
      }
      case 'doc':
        return (
          <Page>
            <Title>{t('demoApp.sim.doc.title')}</Title>
            <Body>{t('demoApp.sim.doc.intro')}</Body>
            <div style={{ margin: '20px 0 0', height: 140, borderRadius: 12, background: 'var(--n-100)', border: '1px dashed var(--n-300)', display: 'grid', placeItems: 'center', color: 'var(--n-500)' }}><Icon name="contract" size={30} /></div>
            <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}>
              {(['name', 'id', 'birth'] as const).map((k, i) => (
                <li key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: i ? '1px solid var(--divider)' : 'none', fontSize: 15, color: 'var(--ink)' }}>{t(`demoApp.sim.doc.fields.${k}`)}<Tick done={phase > i} active={phase === i} /></li>
              ))}
            </ul>
            <Small>{t('demoApp.sim.doc.hint')}</Small>
          </Page>
        )
      case 'result':
        return (
          <Page>
            <Badge icon="approved" tone="low" />
            <Title>{t('demoApp.sim.result.title')}</Title>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 999, background: 'var(--risk-low-bg)', color: 'var(--risk-low-ink)', fontSize: 13, fontWeight: 600 }}><Icon name="approved" size={16} />{t('demoApp.sim.result.decision')} · 91/100</div>
            <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: '22px', color: 'var(--ink-body)' }}>{t('demoApp.sim.result.text')}</p>
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
              <div style={{ position: 'absolute', inset: `0 0 ${BAR}px 0`, overflow: 'hidden' }}>{content()}</div>
              {/* barra inferior do Safari: endereço e ferramentas */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR, background: 'rgba(249,249,249,.96)', borderTop: `0.5px solid ${SEP}` }}>
                <div style={{ margin: '10px 16px 0', height: 44, borderRadius: 14, background: 'rgba(118,118,128,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', fontSize: 16 }}>
                  <span style={{ fontSize: 14, color: '#000' }} aria-hidden="true">aA</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }} aria-label={t('demoApp.sim.fakeAddress', { host })}>
                    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" fill="#000" opacity=".7"><path d="M3 5V3.7A3 3 0 019 3.7V5h.7c.7 0 1.3.6 1.3 1.3v5.4c0 .7-.6 1.3-1.3 1.3H2.3C1.6 13 1 12.4 1 11.7V6.3C1 5.6 1.6 5 2.3 5zM4.3 5h3.4V3.7a1.7 1.7 0 00-3.4 0z" /></svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{host}</span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".7"><path d="M20 12a8 8 0 11-2.6-5.9M20 4v4.5h-4.5" /></svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: 44, marginTop: 4, color: BLUE }} aria-hidden="true">
                  {['arrowLeft', 'arrowRight', 'send', 'book', 'dashboard'].map((ic, i) => <span key={ic} style={{ opacity: i === 1 ? 0.35 : 1 }}><Icon name={ic as IconName} size={24} /></span>)}
                </div>
              </div>
              {screen === 'alert' ? (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center' }} role="alertdialog" aria-modal="true" aria-labelledby="ios-alert-t">
                  <div style={{ width: 270, borderRadius: 14, background: 'rgba(242,242,247,.94)', backdropFilter: 'blur(30px)', overflow: 'hidden', textAlign: 'center' }}>
                    <div style={{ padding: '20px 16px 16px' }}>
                      <p id="ios-alert-t" style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: '22px' }}>{t('demoApp.sim.alert.title', { host })}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: '18px' }}>{t('demoApp.sim.alert.message')}</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `0.5px solid ${SEP}` }}>
                      <button type="button" onClick={() => { push('camera_denied'); go('denied') }} style={{ height: 44, fontSize: 17, color: BLUE, borderRight: `0.5px solid ${SEP}` }}>{t('demoApp.sim.alert.deny')}</button>
                      <button type="button" onClick={() => { push('camera_allowed'); go('cam') }} style={{ height: 44, fontSize: 17, fontWeight: 600, color: BLUE }}>{t('demoApp.sim.alert.ok')}</button>
                    </div>
                  </div>
                </div>
              ) : null}
              {/* barra de status e Dynamic Island */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, color: dark ? '#fff' : '#000', pointerEvents: 'none' }} aria-hidden="true">
                <span style={{ position: 'absolute', left: 52, top: 18, fontSize: 17, fontWeight: 600 }}>9:41</span>
                <svg style={{ position: 'absolute', right: 28, top: 20 }} width="68" height="14" viewBox="0 0 68 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1" /><rect x="5" y="6" width="3" height="8" rx="1" /><rect x="10" y="3" width="3" height="11" rx="1" /><rect x="15" y="0" width="3" height="14" rx="1" /><path d="M29 12.5a1.4 1.4 0 100-2.8 1.4 1.4 0 000 2.8zM24.6 7.4a6.2 6.2 0 018.8 0l-1.3 1.3a4.4 4.4 0 00-6.2 0zM22 4.8a9.9 9.9 0 0114 0l-1.3 1.3a8.1 8.1 0 00-11.4 0z" /><rect x="42" y="1" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".45" /><rect x="44" y="3" width="18" height="8" rx="2" /><rect x="65" y="5" width="1.8" height="4" rx=".9" fillOpacity=".5" /></svg>
              </div>
              <div style={{ position: 'absolute', top: 11, left: '50%', width: 126, height: 37, marginLeft: -63, borderRadius: 19, background: '#000' }} aria-hidden="true" />
              <div style={{ position: 'absolute', bottom: 8, left: '50%', width: 134, height: 5, marginLeft: -67, borderRadius: 3, background: '#000' }} aria-hidden="true" />
            </div>
          </div>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.sim.progress', { n: idx + 1, total: FLOW.length })} · {t('demoApp.sim.drawn')}</p>
        <p className="m-0 max-w-[330px] text-center t-caption text-[var(--ink-muted)]">{t('demoApp.sim.fakeLink', { host })}</p>
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

/** Página web do cliente (design system da Vero ID): fundo branco, margens de 20 pt, abaixo da barra de status. */
function Page({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, background: '#fff', padding: '64px 20px 0', fontFamily: 'var(--font-text)' }}>{children}</div>
}
function Bottom({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', left: 20, right: 20, bottom: 24 }}>{children}</div>
}
