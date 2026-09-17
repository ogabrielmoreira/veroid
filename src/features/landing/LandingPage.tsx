import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/Preferences'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { CaptureIllustration } from '@/features/auth/CaptureIllustration'
import { markDemoIntent } from '@/lib/demoIntent'

const PILLARS: Array<{ key: 'consent' | 'brand' | 'copilot'; icon: IconName }> = [
  { key: 'consent', icon: 'shield' },
  { key: 'brand', icon: 'settings' },
  { key: 'copilot', icon: 'liveness' },
]

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div data-theme="light" className="min-h-dvh bg-[var(--surface-page)]">
      <header className="mx-auto flex max-w-[var(--content-max)] items-center justify-between gap-3 px-[clamp(20px,5vw,64px)] py-5">
        <Link to="/" className="rounded-md"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <LanguageToggle />
          <ButtonLink to="/entrar" variant="ghost" className="hidden sm:inline-flex">{t('auth.signin.submit')}</ButtonLink>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-[var(--content-max)] items-center gap-12 px-[clamp(20px,5vw,64px)] pb-16 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-24 lg:pt-14">
          <div className="enter">
            <p className="m-0 inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-[11px] py-[5px] t-label text-[var(--brand-700)]">
              <Icon name="liveness" size={16} />
              {t('landing.eyebrow')}
            </p>
            <h1 className="mt-6 text-[clamp(34px,5.4vw,56px)] font-bold leading-[1.02] tracking-[-0.034em] text-[var(--ink)] [text-wrap:balance]">
              {t('landing.title')}
            </h1>
            <p className="m-0 mt-5 max-w-[60ch] t-body-lg text-[var(--ink-body)]">{t('landing.lead')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button iconRight="arrowRight" onClick={() => { markDemoIntent(); navigate('/criar-conta') }}>{t('landing.ctaSignup')}</Button>
              <ButtonLink to="/demo" variant="secondary" icon="chart">{t('landing.ctaExplore')}</ButtonLink>
            </div>
            <p className="m-0 mt-3 t-caption text-[var(--ink-muted)]">
              {t('landing.ctaSignin')}{' '}
              <Link to="/entrar" className="font-medium text-[var(--link)] underline-offset-2 hover:underline">{t('auth.signin.submit')}</Link>
            </p>

            <figure className="m-0 mt-12 flex max-w-[520px] items-start gap-5 border-l-[3px] border-[var(--brand-500)] pl-5">
              <p className="m-0 tabular font-display text-[40px] font-bold leading-none tracking-[-0.03em] text-[var(--brand-800)]">
                {t('landing.statValue')}
              </p>
              <figcaption>
                <p className="m-0 t-body text-[var(--ink-body)]">{t('landing.statLabel')}</p>
                <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('landing.statSource')}</p>
              </figcaption>
            </figure>
          </div>

          <div
            className="relative overflow-hidden rounded-[20px] bg-[var(--brand-900)] px-6 py-10 sm:px-10"
            style={{
              backgroundImage:
                'radial-gradient(circle at 70% 20%, rgba(71,86,201,.45), transparent 55%), radial-gradient(rgba(147,158,226,.14) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 22px 22px',
            }}
          >
            <CaptureIllustration />
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[var(--surface)]">
          <ul className="mx-auto m-0 grid max-w-[var(--content-max)] list-none gap-px p-0 md:grid-cols-3">
            {PILLARS.map((p, i) => (
              <li key={p.key} className="px-[clamp(20px,5vw,64px)] py-10 md:px-8 lg:px-10">
                <span className="tabular t-overline text-[var(--ink-muted)]">0{i + 1}</span>
                <span className="mt-4 grid size-10 place-items-center rounded-md bg-[var(--brand-50)] text-[var(--brand-700)]">
                  <Icon name={p.icon} size={20} />
                </span>
                <h2 className="mt-4 t-h4 font-sans">{t(`landing.pillars.${p.key}.title`)}</h2>
                <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t(`landing.pillars.${p.key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[var(--content-max)] flex-col gap-4 px-[clamp(20px,5vw,64px)] py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="m-0 max-w-[62ch] t-caption text-[var(--ink-muted)]">{t('honesty')}</p>
          <Link to="/privacidade" className="t-caption font-medium text-[var(--link)] underline-offset-2 hover:underline">{t('landing.privacyLink')}</Link>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">
          <a href="https://gabrielmoreira.tech" className="font-medium text-[var(--link)] underline-offset-2 hover:underline">
            Gabriel Moreira
          </a>{' '}
          · @GabrielTechDesign
        </p>
      </footer>
    </div>
  )
}
