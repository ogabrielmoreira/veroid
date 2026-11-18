import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/Preferences'
import { Button, ButtonLink } from '@/components/ui/Button'
import { markDemoIntent } from '@/lib/demoIntent'
import { env } from '@/lib/env'
import { ConsentPhone } from './ConsentPhone'

const HERO_BG =
  'radial-gradient(900px 520px at 88% 8%, rgba(124,58,237,.42), transparent 60%), radial-gradient(700px 480px at 72% 96%, rgba(224,51,138,.24), transparent 60%), linear-gradient(165deg, #232C6B 0%, #1C2459 45%, #151A43 100%)'

const BRANDS = [
  { name: 'Aurora Digital', ini: 'AD', color: '#232C6B' },
  { name: 'Verde Bank', ini: 'VB', color: '#0B6B4D' },
  { name: 'Brasa Seguros', ini: 'BS', color: '#B4232A' },
  { name: 'Onda Telecom', ini: 'OT', color: '#7A2BD9' },
]

function ratio(hex: string) {
  const c = [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return 1.05 / (l + 0.05)
}

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const demo = env.maintenance // vitrine: sem criar conta, sem câmera
  const [brand, setBrand] = useState(BRANDS[0])
  const wrap = 'mx-auto max-w-[var(--content-max)] px-[clamp(20px,5vw,64px)]'
  const eyebrow = 't-overline text-[var(--brand-accent)]'
  const h2 = 'mt-3 max-w-[18ch] text-[clamp(32px,4.4vw,56px)] font-bold leading-[1.03] tracking-[-0.03em]'
  const whiteBtn = '!bg-white !text-[#232C6B] hover:!bg-[#F0F2FB]'

  return (
    <div data-theme="light" className="min-h-dvh overflow-x-clip bg-[var(--surface-page)]">
      <section className="relative overflow-hidden text-white" style={{ background: HERO_BG }}>
        <header className={`${wrap} flex items-center justify-between gap-3 py-5`}>
          <Link to="/" className="rounded-md"><Logo inverted /></Link>
          <div className="flex items-center gap-2">
            <LanguageToggle inverted />
            {!demo ? <ButtonLink to="/entrar" variant="ghost" className="hidden !text-white hover:!bg-white/10 sm:inline-flex">{t('home.ctaSignin')}</ButtonLink> : null}
          </div>
        </header>

        <main id="main" className={`${wrap} grid items-center gap-10 pb-16 pt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-24 lg:pt-14`}>
          <div className="enter">
            <p className="m-0 t-overline text-white/80">{t('home.eyebrow')}</p>
            <h1 className="mt-4 whitespace-pre-line text-[clamp(44px,7vw,92px)] font-bold leading-[0.98] tracking-[-0.035em] text-white">{t('home.h1')}</h1>
            <p className="m-0 mt-6 max-w-[34ch] text-[clamp(18px,1.9vw,24px)] leading-[1.45] text-white/90">{t('home.lead')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {demo ? (
                <ButtonLink to="/demo" iconRight="arrowRight" className={whiteBtn}>{t('home.ctaDemo')}</ButtonLink>
              ) : (
                <>
                  <Button iconRight="arrowRight" className={whiteBtn} onClick={() => { markDemoIntent(); navigate('/criar-conta') }}>{t('home.ctaSignup')}</Button>
                  <ButtonLink to="/demo" variant="ghost" icon="chart" className="!border !border-white/50 !text-white hover:!bg-white/10">{t('home.ctaDemo')}</ButtonLink>
                </>
              )}
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-[560px] justify-center pb-10 lg:pb-14" aria-hidden="true">
            <div className="w-[46%] max-w-[250px]"><ConsentPhone screen="intro" /></div>
            <div className="-ml-[6%] mt-10 w-[46%] max-w-[250px]"><ConsentPhone screen="alert" /></div>
          </div>
        </main>
      </section>

      <section className="py-[clamp(64px,8vw,112px)]">
        <div className={wrap}>
          <p className={eyebrow}>{t('home.how.eyebrow')}</p>
          <h2 className={h2}>{t('home.how.title')}</h2>
          <p className="m-0 mt-4 max-w-[62ch] t-body-lg text-[var(--ink-body)]">{t('home.how.lead')}</p>
          <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-3">
            {(['s1', 's2', 's3'] as const).map((k, i) => (
              <li key={k} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
                <span className="tabular font-display text-[30px] font-bold leading-none text-[var(--brand-800)]">{i + 1}</span>
                <h3 className="m-0 font-sans t-h4">{t(`home.how.${k}.t`)}</h3>
                <p className="m-0 t-body text-[var(--ink-body)]">{t(`home.how.${k}.p`)}</p>
                <div className="mt-auto pt-4" aria-hidden="true">
                  {i === 0 ? (
                    <div className="flex flex-col gap-2">
                      {[['MS', 'Mariana S.', 'WhatsApp'], ['RC', 'Rafael C.', 'SMS'], ['LP', 'Letícia P.', 'QR']].map(([a, n, c]) => (
                        <div key={a} className="flex items-center gap-3 rounded-[12px] bg-[var(--n-50)] px-3.5 py-2.5 text-[14px]">
                          <span className="grid size-[30px] place-items-center rounded-full bg-[var(--brand-100)] text-[12px] font-bold text-[var(--brand-800)]">{a}</span>
                          <b className="flex-1 font-semibold text-[var(--ink)]">{n}</b>
                          <span className="rounded-full bg-[var(--brand-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--brand-800)]">{c}</span>
                        </div>
                      ))}
                    </div>
                  ) : i === 1 ? (
                    <div className="flex flex-wrap gap-2 text-[13px] font-medium">
                      {([['Consent', 1], ['Camera', 1], ['Selfie', 2], ['Document', 0], ['Form', 0]] as const).map(([l, s]) => (
                        <span key={l} className={`rounded-full px-3.5 py-2 ${s === 1 ? 'bg-[var(--risk-low-bg)] text-[var(--risk-low-ink)]' : s === 2 ? 'bg-[var(--brand-800)] text-white' : 'bg-[var(--n-100)] text-[var(--n-600)]'}`}>{l}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {([['#4821', 84, 'high'], ['#4817', 52, 'review'], ['#4809', 12, 'low']] as const).map(([id, v, tone]) => (
                        <div key={id} className="flex items-center gap-3 rounded-[12px] bg-[var(--n-50)] px-3.5 py-2.5 text-[14px]">
                          <b className="tabular w-11 font-semibold text-[var(--ink)]">{id}</b>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--n-100)]"><span className="block h-full rounded-full bg-[var(--brand-500)]" style={{ width: `${v}%` }} /></span>
                          <span className="tabular rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: `var(--risk-${tone}-bg)`, color: `var(--risk-${tone}-ink)` }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[var(--surface)] py-[clamp(64px,8vw,112px)]">
        <div className={wrap}>
          <p className={eyebrow}>{t('home.wl.eyebrow')}</p>
          <h2 className={h2}>{t('home.wl.title')}</h2>
          <p className="m-0 mt-4 max-w-[62ch] t-body-lg text-[var(--ink-body)]">{t('home.wl.lead')}</p>
          <div className="mt-10 grid items-center gap-8 rounded-[var(--radius-lg)] bg-[var(--n-50)] p-6 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:p-10">
            <div className="mx-auto w-full max-w-[250px]"><ConsentPhone screen="intro" org={brand.name} initials={brand.ini} accent={brand.color} /></div>
            <div>
              <div role="group" aria-label="Brand" className="flex flex-wrap gap-2.5">
                {BRANDS.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    aria-pressed={brand.name === b.name}
                    onClick={() => setBrand(b)}
                    className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-[var(--surface)] py-2 pl-2.5 pr-4 text-[14px] font-semibold text-[var(--ink)] shadow-[0_0_0_1px_var(--border)] aria-pressed:shadow-[0_0_0_2px_var(--ink)]"
                  >
                    <i className="size-[22px] rounded-full" style={{ background: b.color }} />{b.name}
                  </button>
                ))}
              </div>
              <p className="m-0 mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3.5 py-2 font-mono text-[12.5px] text-[var(--ink-body)]">
                {t('home.wl.contrast')} <b className="text-[var(--risk-low-ink)]">{ratio(brand.color).toFixed(1)}:1 · AA ✓</b>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-[clamp(64px,8vw,112px)]">
        <div className={`${wrap} grid items-center gap-10 lg:grid-cols-2`}>
          <div>
            <p className={eyebrow}>{t('home.decision.eyebrow')}</p>
            <h2 className={`${h2} max-w-[14ch]`}>{t('home.decision.title')}</h2>
            <p className="m-0 mt-4 max-w-[52ch] t-body-lg text-[var(--ink-body)]">{t('home.decision.p')}</p>
          </div>
          <div className="mx-auto flex w-full max-w-[560px] justify-center" aria-hidden="true">
            <div className="w-[46%] max-w-[250px]"><ConsentPhone screen="allow" /></div>
            <div className="-ml-[4%] mt-8 w-[46%] max-w-[250px]"><ConsentPhone screen="alert" /></div>
          </div>
        </div>
      </section>

      <section className="text-white" style={{ background: HERO_BG }}>
        <div className={`${wrap} flex flex-col items-center py-[clamp(72px,9vw,120px)] text-center`}>
          <Logo inverted className="mb-6" />
          <h2 className="m-0 text-[clamp(32px,4.6vw,56px)] font-bold leading-[1.04] tracking-[-0.03em] !text-white">{t('home.end.title')}</h2>
          <p className="m-0 mt-4 max-w-[52ch] text-[18px] leading-[1.6] text-white/85">{t('home.end.p')}</p>
          <div className="mt-8"><ButtonLink to="/demo" iconRight="arrowRight" className={whiteBtn}>{t('home.ctaDemo')}</ButtonLink></div>
        </div>
      </section>

      <footer className={`${wrap} flex flex-col gap-4 py-10 md:flex-row md:items-start md:justify-between`}>
        <div className="flex flex-col gap-2">
          <p className="m-0 max-w-[62ch] t-caption text-[var(--ink-muted)]">{t('honesty')}</p>
          <Link to="/privacidade" className="t-caption font-medium text-[var(--link)] underline-offset-2 hover:underline">{t('landing.privacyLink')}</Link>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">
          <a href="https://gabrielmoreira.tech" className="font-medium text-[var(--link)] underline-offset-2 hover:underline">Gabriel Moreira</a>{' '}· @GabrielTechDesign
        </p>
      </footer>
    </div>
  )
}
