import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'
import { Icon } from './ui/Icon'
import { cn } from './ui/cn'

const pill =
  'inline-flex min-h-11 lg:min-h-10 items-center gap-1.5 rounded-full border px-3 t-label ' +
  'border-[var(--border-strong)] text-[var(--ink)] hover:border-[var(--brand-primary)]'

export function LanguageToggle({ className, inverted }: { className?: string; inverted?: boolean }) {
  const { i18n, t } = useTranslation()
  const next = i18n.language === 'en' ? 'pt-BR' : 'en'
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      className={cn(pill, inverted && 'border-white/25 text-white hover:border-white/60', className)}
      aria-label={`${t('common.language')}: ${i18n.language === 'en' ? 'English' : 'Português'}`}
    >
      <Icon name="globe" size={16} />
      <span lang={next}>{next === 'en' ? 'EN' : 'PT'}</span>
    </button>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || readTheme())
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(pill, 'px-0 w-11 lg:w-10 justify-center', className)}
      aria-label={`${t('common.theme')}: ${theme === 'dark' ? t('common.themeDark') : t('common.themeLight')}`}
      aria-pressed={theme === 'dark'}
    >
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
    </button>
  )
}
