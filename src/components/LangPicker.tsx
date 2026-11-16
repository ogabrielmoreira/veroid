import { useTranslation } from 'react-i18next'
import { cn } from './ui/cn'

function FlagBR() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true" className="rounded-[3px]">
      <rect width="28" height="20" fill="#009C3B" />
      <path d="M14 3 25 10 14 17 3 10Z" fill="#FFDF00" />
      <circle cx="14" cy="10" r="4.2" fill="#002776" />
      <path d="M10 9.2c2.6-.6 5.6-.2 8 1.4" stroke="#fff" strokeWidth=".9" fill="none" />
    </svg>
  )
}
function FlagUS() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true" className="rounded-[3px]">
      <rect width="28" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(i * 20) / 13} width="28" height={20 / 13} fill="#B22234" />)}
      <rect width="12.5" height="10.8" fill="#3C3B6E" />
      {[2, 5, 8, 11].map((x) => [2, 5, 8].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r=".6" fill="#fff" />))}
    </svg>
  )
}

/** Seletor de idioma com bandeiras (Brasil / Estados Unidos). */
export function LangPicker({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const cur = i18n.language === 'en' ? 'en' : 'pt-BR'
  const opts = [{ code: 'pt-BR', label: 'Português', Flag: FlagBR }, { code: 'en', label: 'English', Flag: FlagUS }]
  return (
    <div role="group" aria-label={t('common.language')} className={cn('inline-flex gap-1.5', className)}>
      {opts.map(({ code, label, Flag }) => (
        <button key={code} type="button" lang={code} aria-pressed={cur === code} onClick={() => void i18n.changeLanguage(code)}
          className={cn('inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors',
            cur === code ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]' : 'border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--border-strong)]')}>
          <Flag />{label}
        </button>
      ))}
    </div>
  )
}
