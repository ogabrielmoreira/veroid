import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/Preferences'
import { cn } from '@/components/ui/cn'

export const STEP_KEYS = ['company', 'niche', 'brand', 'flow', 'team', 'done'] as const

export function OnboardingLayout({ step, children, wide, style }: { step: number; children: ReactNode; wide?: boolean; style?: React.CSSProperties }) {
  const { t } = useTranslation()
  const label = t('onboarding.step', { current: step + 1, total: STEP_KEYS.length })
  return (
    <div className="brand-scope min-h-dvh bg-[var(--surface-page)]" style={style}>
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[var(--content-max)] items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <LanguageToggle />
        </div>
      </header>
      <main id="main" className={cn('mx-auto px-5 py-10 sm:px-8 lg:py-14', wide ? 'max-w-[1160px]' : 'max-w-[760px]')}>
        <p className="m-0 t-overline text-[var(--ink-muted)]">{label}</p>
        <ol className="m-0 mt-3 grid list-none grid-cols-6 gap-1.5 p-0" aria-label={label}>
          {STEP_KEYS.map((k, i) => (
            <li key={k} className="min-w-0" aria-current={i === step ? 'step' : undefined}>
              <span className={cn('block h-1 rounded-full',
                i < step ? 'bg-[var(--brand-500)]' : i === step ? 'bg-[var(--brand-primary)]' : 'bg-[var(--n-200)] [[data-theme=dark]_&]:bg-[#262C45]')} />
              <span className={cn('mt-2 hidden truncate t-caption sm:block', i === step ? 'font-medium text-[var(--ink)]' : 'text-[var(--ink-muted)]')}>
                {t(`onboarding.steps.${k}`)}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  )
}
