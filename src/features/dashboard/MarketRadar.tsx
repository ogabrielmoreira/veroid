import { useTranslation } from 'react-i18next'
import radar from '@/data/market-radar.json'
import { Icon } from '@/components/ui/Icon'

export function MarketRadar({ niche }: { niche: string }) {
  const { t, i18n } = useTranslation()
  const items = radar.items.filter((i) => i.niches.includes(niche)).concat(radar.items.filter((i) => !i.niches.includes(niche) && i.niches.includes('*'))).slice(0, 4)
  const fmt = (d: string) => new Intl.DateTimeFormat(i18n.language, { month: 'short', year: 'numeric' }).format(new Date(`${d}-15T12:00:00`))
  return (
    <section aria-labelledby="radar-title" className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
      <h2 id="radar-title" className="flex items-center gap-2 font-sans text-[15px] font-semibold tracking-normal text-[var(--ink)]">
        <Icon name="signal" size={18} className="text-[var(--brand-500)]" />{t('dash.radarTitle')}
      </h2>
      <p className="m-0 mt-0.5 t-caption text-[var(--ink-muted)]">{t('dash.radarSubtitle')}</p>
      <ul className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
        {items.map((i) => (
          <li key={i.id} className="border-l-2 border-[var(--brand-300)] pl-3">
            <p className="m-0 tabular font-display text-[20px] font-bold leading-6 tracking-[-0.02em] text-[var(--ink)]">{i.value}</p>
            <p className="m-0 mt-0.5 text-[13px] leading-[1.5] text-[var(--ink-body)]">{i18n.language === 'en' ? i.text_en : i.text_pt}</p>
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 t-caption text-[var(--link)] underline-offset-2 hover:underline">
              {i.source} · {fmt(i.date)}<span className="sr-only"> ({t('common.newTab')})</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
