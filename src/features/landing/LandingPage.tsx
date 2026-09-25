import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/Preferences'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import heroBiometric from '@/assets/hero-biometric.webp'
import { markDemoIntent } from '@/lib/demoIntent'

const PILLARS: Array<{ key: 'consent' | 'brand' | 'copilot'; icon: IconName }> = [
  { key: 'consent', icon: 'shield' },
  { key: 'brand', icon: 'settings' },
  { key: 'copilot', icon: 'liveness' },
]

const NAV_LINKS: Array<'identity' | 'biometry' | 'security'> = ['identity', 'biometry', 'security']

const CHECKLIST: Array<{ key: 'liveness' | 'biometrics' | 'document'; done: boolean }> = [
  { key: 'liveness', done: true },
  { key: 'biometrics', done: true },
  { key: 'document', done: false },
]

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div data-theme="light" className="min-h-dvh overflow-x-clip bg-[var(--surface-page)]">
      <header className="mx-auto flex max-w-[var(--content-max)] items-center justify-between gap-3 px-[clamp(20px,5vw,64px)] py-5">
        <Link to="/" className="rounded-md"><Logo /></Link>
        <nav aria-label={t('landing.nav.label')} className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((key) => (
            <a
              key={key}
              href="#recursos"
              className="t-overline text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              {t(`landing.nav.${key}`)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ButtonLink to="/entrar" variant="ghost" className="hidden sm:inline-flex">{t('auth.signin.submit')}</ButtonLink>
        </div>
      </header>

      <main id="main">
        <section className="relative mx-auto max-w-[var(--content-max)] px-[clamp(20px,5vw,64px)] pb-16 pt-4 lg:pb-28 lg:pt-6">
          <p className="pointer-events-none absolute right-[clamp(20px,5vw,64px)] top-0 hidden max-w-[190px] text-right t-overline text-[var(--ink-subtle)] xl:block">
            <span className="mr-1.5 text-[var(--border-strong)]">—</span>{t('landing.corner.tech')}
          </p>

          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="enter">
              <p className="m-0 flex items-center gap-2.5 tabular t-overline text-[var(--ink-subtle)]">
                <span className="text-[var(--brand-accent)]">{t('landing.step.current')}</span>
                <span className="h-px w-6 bg-[var(--border-strong)]" aria-hidden="true" />
                <span>{t('landing.step.total')}</span>
              </p>
              <h1 className="mt-4 text-[clamp(34px,5.4vw,56px)] font-bold leading-[1.02] tracking-[-0.034em] text-[var(--ink)] [text-wrap:balance]">
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
                </figcaption>
              </figure>
            </div>

            <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:ml-auto">
              <div
                aria-hidden="true"
                className="absolute -inset-x-8 -inset-y-8 hidden rounded-full border border-dashed border-[var(--border)] lg:block"
              />
              <img
                src={heroBiometric}
                alt={t('landing.heroAlt')}
                width={1040}
                height={966}
                className="relative z-0 block w-full select-none"
                draggable={false}
              />

              <div className="absolute right-0 top-[6%] w-[172px] rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-overlay)] sm:w-[194px] sm:p-3.5">
                <p className="m-0 t-overline text-[var(--brand-accent)]">{t('landing.hero.analyzing')}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--brand-100)]">
                  <div className="h-full w-2/3 rounded-full bg-[var(--brand-500)]" />
                </div>
                <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                  {CHECKLIST.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 t-caption text-[var(--ink-body)]">
                      <span
                        aria-hidden="true"
                        className={
                          c.done
                            ? 'grid size-[18px] shrink-0 place-items-center rounded-full bg-[var(--brand-500)] text-white'
                            : 'size-[18px] shrink-0 rounded-full border-[1.5px] border-[var(--border-strong)]'
                        }
                      >
                        {c.done ? <Icon name="check" size={16} /> : null}
                      </span>
                      {t(`landing.hero.checklist.${c.key}`)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="absolute bottom-[8%] right-[-4%] flex items-center gap-3 rounded-[14px] bg-[var(--brand-900)] px-4 py-3 text-white shadow-[var(--shadow-overlay)] sm:right-[-10%]">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
                  <Icon name="shield" size={18} />
                </span>
                <div>
                  <p className="m-0 t-overline text-white">{t('landing.hero.verifying')}</p>
                  <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full w-2/3 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="pointer-events-none absolute bottom-0 left-[clamp(20px,5vw,64px)] hidden max-w-[220px] t-overline text-[var(--ink-subtle)] xl:block">
            <span className="mr-1.5 text-[var(--border-strong)]">—</span>{t('landing.corner.protection')}
          </p>
          <p className="pointer-events-none absolute bottom-0 right-[clamp(20px,5vw,64px)] hidden max-w-[220px] text-right t-overline text-[var(--ink-subtle)] xl:block">
            {t('landing.corner.identity')}<span className="ml-1.5 text-[var(--border-strong)]">|</span>
          </p>
        </section>

        <section id="recursos" className="border-y border-[var(--border)] bg-[var(--surface)]">
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
