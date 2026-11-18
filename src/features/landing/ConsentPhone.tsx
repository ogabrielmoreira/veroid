import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { TapAllowTutorial } from '@/components/TapAllowTutorial'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * iPhone da landing: as duas telas do consentimento de câmera ("Vamos confirmar que é você" e "Toque em Permitir"),
 * com a marca da empresa (nome, iniciais e cor). Só desenho, aria-hidden: nada aqui é interativo.
 * O aparelho é desenhado em 320×660 e escalado para a largura do contêiner.
 */
export type PhoneScreen = 'intro' | 'allow' | 'alert'

const INK = '#10142B'

export function ConsentPhone({ screen, org = 'Aurora Digital', initials = 'AD', accent = '#232C6B' }: { screen: PhoneScreen; org?: string; initials?: string; accent?: string }) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / 320)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const host = org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.com.br'
  const accentVars = { '--acc': accent } as CSSProperties
  const info: Array<{ icon: IconName; t: string; d: string }> = [
    { icon: 'capture', t: t('home.phone.i1t'), d: t('home.phone.i1d') },
    { icon: 'lock', t: t('home.phone.i2t'), d: t('home.phone.i2d') },
    { icon: 'shield', t: t('home.phone.i3t'), d: t('home.phone.i3d') },
  ]
  const dots = (n: number) => (
    <div style={{ display: 'flex', gap: 5, margin: '2px 0 14px' }}>
      {[0, 1, 2, 3].map((i) => <i key={i} style={{ width: 20, height: 3, borderRadius: 2, background: i < n ? 'var(--acc)' : '#E4E7EC', transition: 'background .3s' }} />)}
    </div>
  )

  return (
    <div ref={box} aria-hidden="true" className="relative w-full select-none" style={{ aspectRatio: '320 / 660', ...accentVars }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 320, height: 660, transformOrigin: '0 0', transform: `scale(${scale})`, background: '#0B0C0F', borderRadius: 52, padding: 10, boxShadow: '0 0 0 1.5px #24262B, 0 30px 70px -20px rgba(8,10,30,.55)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-text), sans-serif', color: INK }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#F5F6FA', borderRadius: 42, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <span style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 92, height: 26, background: '#0B0C0F', borderRadius: 99, zIndex: 3 }} />
          <div style={{ height: 46, padding: '18px 26px 0', display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600 }}><span>9:41</span><span style={{ letterSpacing: 2 }}>▮▮▮ ▰</span></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 22px 20px', fontSize: 13.5 }}>
            <div style={{ height: 30, display: 'flex', alignItems: 'center', color: 'var(--acc)', fontSize: 15 }}>{t('home.phone.back')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, background: 'var(--acc)', color: '#fff', fontSize: 12, fontWeight: 700, transition: 'background .3s' }}>{initials}</span>{org}
            </div>
            {screen === 'intro' ? (
              <>
                {dots(1)}
                <h4 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25, fontFamily: 'inherit', color: INK }}>{t('home.phone.title')}</h4>
                <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: '#5A6070' }}>{t('home.phone.sub')}</p>
                {info.map((i) => (
                  <div key={i.t} style={{ display: 'flex', gap: 12, padding: '10px 0', alignItems: 'flex-start' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 11, flex: 'none', background: '#EBEDF4', color: 'var(--acc)', display: 'grid', placeItems: 'center' }}><Icon name={i.icon} size={18} /></span>
                    <div><b style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>{i.t}</b><span style={{ display: 'block', fontSize: 13, color: '#5A6070', lineHeight: 1.45 }}>{i.d}</span></div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {dots(2)}
                <h4 style={{ margin: '0 0 10px', fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25, fontFamily: 'inherit', color: INK }}>{t('home.phone.allowTitle')}</h4>
                <div style={{ background: '#fff', border: '1px solid #E4E7EC', borderRadius: 18, padding: '14px 12px 10px', marginBottom: 10 }}>
                  <TapAllowTutorial compact />
                  <p style={{ margin: '10px auto 0', maxWidth: 220, fontSize: 12.5, color: '#5A6070', textAlign: 'center', lineHeight: 1.45 }}><Trans i18nKey="home.phone.allowCap" components={{ b: <b style={{ color: INK }} /> }} /></p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: '#5A6070', padding: '7px 10px', background: '#EBEDF4', borderRadius: 10 }}><Icon name="lock" size={16} /><span><Trans i18nKey="home.phone.priv" components={{ b: <b style={{ color: INK }} /> }} /></span></div>
              </>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ height: 48, borderRadius: 14, background: 'var(--acc)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 600, transition: 'background .3s' }}>{t('home.phone.cta')}</div>
          </div>
          {screen === 'alert' ? (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,14,20,.42)', display: 'grid', placeItems: 'center', zIndex: 4, borderRadius: 42 }}>
              <div style={{ width: 216, background: 'rgba(247,247,249,.97)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 50px rgba(10,12,18,.3)', textAlign: 'center' }}>
                <div style={{ padding: '16px 15px 13px' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{t('home.phone.alertTitle', { host })}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#5A6070', lineHeight: 1.35 }}>{t('home.phone.alertMsg')}</p>
                </div>
                <div style={{ display: 'flex', borderTop: '.5px solid rgba(60,60,67,.29)', fontSize: 14.5 }}>
                  <span style={{ flex: 1, padding: '11px 0' }}>{t('tapAllow.deny')}</span>
                  <span style={{ flex: 1, padding: '11px 0', fontWeight: 600, borderLeft: '.5px solid rgba(60,60,67,.29)' }}>{t('tapAllow.allow')}</span>
                </div>
              </div>
            </div>
          ) : null}
          <span style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', width: 104, height: 4, borderRadius: 3, background: INK, opacity: 0.85, zIndex: 5 }} />
        </div>
      </div>
    </div>
  )
}
