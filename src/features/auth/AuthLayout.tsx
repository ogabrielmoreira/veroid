import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/Preferences'
import { Alert } from '@/components/ui/Alert'
import { env } from '@/lib/env'
import { CaptureIllustration } from './CaptureIllustration'

interface AuthLayoutProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Painel de autenticação: marca à esquerda (≥900px), formulário à direita. Sempre light. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation()
  return (
    <div data-theme="light" className="min-h-dvh bg-[var(--surface-page)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        className="relative hidden overflow-hidden bg-[var(--brand-900)] text-white lg:flex lg:flex-col"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 25%, rgba(71,86,201,.38), transparent 55%), radial-gradient(rgba(147,158,226,.14) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 22px 22px',
        }}
      >
        <div className="flex items-center justify-between px-12 pt-10">
          <Link to="/" className="rounded-md">
            <Logo inverted />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-[11px] py-[5px] t-caption text-[#DDE1F6]">
            <span className="size-1.5 rounded-full bg-[#F0C077]" />
            {t('brand.demoBadge')}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-10 px-12 py-10">
          <CaptureIllustration />
          <div className="max-w-[440px]">
            <h2 className="t-h2 text-white">{t('auth.panelTitle')}</h2>
            <p className="mt-3 t-body-lg text-[#B6BBD0]">{t('auth.panelBody')}</p>
          </div>
        </div>
        <p className="m-0 px-12 pb-8 t-caption text-[#9198B5] max-w-[560px]">{t('honesty')}</p>
      </aside>

      <main id="main" className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 pt-5 sm:px-8 lg:justify-end lg:px-12 lg:pt-10">
          <Link to="/" className="rounded-md lg:hidden">
            <Logo />
          </Link>
          <LanguageToggle />
        </header>
        <div className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 lg:items-center">
          <div className="enter w-full max-w-[400px]">
            {!env.isConfigured ? (
              <Alert variant="warning" title={t('errors.notConfiguredTitle')} className="mb-6">
                {t('errors.notConfiguredBody')}
              </Alert>
            ) : null}
            <h1 className="t-h1">{title}</h1>
            {subtitle ? <p className="mt-2 mb-0 t-body text-[var(--ink-muted)]">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 border-t border-[var(--divider)] pt-6 t-body text-[var(--ink-muted)]">{footer}</div> : null}
          </div>
        </div>
        <p className="m-0 px-5 pb-6 text-center t-caption text-[var(--ink-muted)] lg:hidden">{t('honesty')}</p>
      </main>
    </div>
  )
}
