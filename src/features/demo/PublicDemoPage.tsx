import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/Preferences'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { GuidedTour } from './GuidedTour'
import { SimulateOnboardingModal } from './SimulateOnboardingModal'
import { DemoCharts } from './DemoCharts'
import { demoSnapshot } from './demoSnapshot'
import { markDemoIntent } from '@/lib/demoIntent'
import { env } from '@/lib/env'

/** /demo — "Explorar sem cadastro": painel público somente leitura, sem exigir login (§10). */
export function PublicDemoPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [simulateOpen, setSimulateOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)

  return (
    <div data-theme="light" className="min-h-dvh bg-[var(--surface-page)]">
      <header className="mx-auto flex max-w-[var(--content-max)] items-center justify-between gap-3 px-[clamp(20px,5vw,64px)] py-5">
        <Link to="/" className="rounded-md"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <LanguageToggle />
          <Button variant="ghost" onClick={() => { markDemoIntent(); navigate('/criar-conta') }}>{t('demo.ctaCreate')}</Button>
        </nav>
      </header>

      <main id="main" className="mx-auto flex max-w-[var(--content-max)] flex-col gap-6 px-[clamp(20px,5vw,64px)] pb-16">
        <section className="enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="m-0 inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-[11px] py-[5px] t-label text-[var(--brand-700)]">
              {t('demo.badge')}
            </p>
            <h1 className="mt-3 t-h1">{t('demo.title', { org: demoSnapshot.organization.name })}</h1>
            <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t('demo.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="sparkle" onClick={() => setTourOpen(true)}>{t('demo.startTour')}</Button>
            <Button icon="capture" data-tour="simulate" onClick={() => setSimulateOpen(true)}>{t('demo.simulate.cta')}</Button>
          </div>
        </section>

        {env.maintenance ? <Alert variant="info" title={t('maintenance.title')}>{t('maintenance.demoBanner')}</Alert> : null}

        <DemoCharts />

        <Alert variant="neutral">{t('honesty')}</Alert>

        <section className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-8 text-center">
          <h2 className="m-0 t-h3 font-sans">{t('demo.footerCtaTitle')}</h2>
          <p className="m-0 max-w-[52ch] t-body text-[var(--ink-body)]">{t('demo.footerCtaBody')}</p>
          <ButtonLink to="/criar-conta" onClick={() => markDemoIntent()} iconRight="arrowRight" className="mt-2">{t('landing.ctaSignup')}</ButtonLink>
        </section>
      </main>

      <SimulateOnboardingModal open={simulateOpen} onClose={() => setSimulateOpen(false)} />
      {tourOpen ? <GuidedTour onFinish={() => setTourOpen(false)} /> : null}
    </div>
  )
}

