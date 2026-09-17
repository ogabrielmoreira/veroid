import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'

/** Cartão de gráfico: título, alternativa em tabela e os cinco estados (§3.18, §7). */
export function ChartCard({
  title, subtitle, children, table, loading, empty, error, onRetry, className, action,
}: {
  title: string; subtitle?: string; children: ReactNode; table?: ReactNode; loading?: boolean; empty?: boolean; error?: boolean
  onRetry?: () => void; className?: string; action?: ReactNode
}) {
  const { t } = useTranslation()
  const [showTable, setShowTable] = useState(false)
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="font-sans text-[15px] font-semibold leading-5 tracking-normal text-[var(--ink)]">{title}</h2>
          {subtitle ? <p className="m-0 mt-0.5 t-caption text-[var(--ink-muted)]">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && !loading && !empty && !error ? (
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[12px] font-medium text-[var(--link)] hover:bg-[var(--brand-50)] [[data-theme=dark]_&]:hover:bg-[#262C45]">
              <Icon name={showTable ? 'chart' : 'evidence'} size={16} />
              {showTable ? t('dash.showChart') : t('dash.showTable')}
            </button>
          ) : null}
        </div>
      </header>
      <div className="mt-4 min-h-[180px] flex-1">
        {loading ? (
          <div className="flex h-full min-h-[180px] flex-col justify-end gap-2" aria-hidden="true">
            {['70%', '92%', '48%', '80%'].map((w, i) => <span key={i} className="h-3 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse [[data-theme=dark]_&]:bg-[#262C45]" style={{ width: w }} />)}
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[180px] flex-col items-start justify-center rounded-[var(--radius-md)] border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-4">
            <Icon name="rejected" size={24} className="text-[var(--risk-high-ink)]" />
            <p className="m-0 mt-2 text-[14px] font-semibold text-[var(--risk-high-ink)]">{t('dash.errorTitle')}</p>
            <p className="m-0 t-caption text-[var(--ink-body)]">{t('errors.network')}</p>
            {onRetry ? <button type="button" onClick={onRetry} className="mt-2 min-h-10 text-[13px] font-medium text-[var(--link)] underline">{t('common.retry')}</button> : null}
          </div>
        ) : empty ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--border-strong)] px-[18px] text-center">
            <Icon name="chart" size={24} className="text-[var(--brand-400)]" />
            <p className="m-0 mt-2 text-[14px] font-medium text-[var(--ink)]">{t('dash.emptyTitle')}</p>
            <p className="m-0 mt-0.5 max-w-[36ch] t-caption text-[var(--ink-muted)]">{t('dash.emptyBody')}</p>
          </div>
        ) : showTable ? (
          <div className="max-h-[320px] overflow-auto">{table}</div>
        ) : children}
      </div>
    </section>
  )
}

export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-[var(--border)]">
          {head.map((h, i) => <th key={i} scope="col" className={cn('py-2 pr-3 t-overline text-[var(--ink-muted)]', i > 0 && 'text-right')}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-[var(--divider)] last:border-b-0">
            {r.map((c, j) => <td key={j} className={cn('py-2 pr-3 text-[var(--ink-body)]', j > 0 && 'tabular text-right')}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Legend({ items }: { items: Array<{ label: string; color: string; pattern?: boolean }> }) {
  return (
    <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 t-caption text-[var(--ink-muted)]">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string; payload?: Record<string, unknown> }>
  label?: ReactNode; formatter?: (v: number, name: string) => ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[var(--radius-md)] bg-[#10142B] px-[11px] py-[9px] text-[12px] leading-[1.5] text-[#DDE1F6] shadow-[var(--shadow-overlay)]">
      {label !== undefined ? <p className="m-0 mb-1 font-semibold text-white">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="m-0 flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular font-semibold text-white">{formatter ? formatter(Number(p.value), String(p.name)) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export const fmtInt = (n: number | null | undefined, lang: string) => (n === null || n === undefined ? '—' : new Intl.NumberFormat(lang).format(n))
export const fmtPct = (n: number | null | undefined, lang: string) => (n === null || n === undefined ? '—' : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n)}%`)
export const fmtBrl = (n: number | null | undefined, lang: string) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat(lang, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, notation: n >= 1e6 ? 'compact' : 'standard' }).format(n)
export const fmtDuration = (s: number | null | undefined) => (s === null || s === undefined ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`)
