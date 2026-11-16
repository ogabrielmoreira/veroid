import { useTranslation } from 'react-i18next'
import { cn } from './ui/cn'

/** Seletor de idioma discreto: controle segmentado PT | EN (padrão iOS), sem bandeiras. */
export function LangPicker({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const cur = i18n.language === 'en' ? 'en' : 'pt-BR'
  const opts = [{ code: 'pt-BR', short: 'PT', label: 'Português' }, { code: 'en', short: 'EN', label: 'English' }]
  return (
    <div role="radiogroup" aria-label={t('common.language')} className={cn('inline-flex rounded-full bg-[var(--n-100)] p-0.5', className)}>
      {opts.map(({ code, short, label }) => (
        <button key={code} type="button" role="radio" aria-checked={cur === code} lang={code} title={label} aria-label={label}
          onClick={() => void i18n.changeLanguage(code)}
          className={cn('min-h-8 min-w-10 rounded-full px-3 text-[12px] font-semibold tracking-wide transition-colors',
            cur === code ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(16,20,43,.14)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]')}>
          {short}
        </button>
      ))}
    </div>
  )
}
