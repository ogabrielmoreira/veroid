import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import { ChartTooltip, DataTable, fmtInt, fmtPct, Legend } from './charts'
import type { DashData } from './useDashboard'

export type TableFilter =
  | { kind: 'step'; value: string }
  | { kind: 'bucket'; value: number }
  | { kind: 'uf'; value: string }
  | { kind: 'slot'; dow: number; hour: number }
  | { kind: 'type'; value: string }
  | { kind: 'os'; value: string }

const FUNNEL_COLORS = ['var(--brand-800)', 'var(--brand-600)', 'var(--brand-500)', 'var(--brand-400)', 'var(--brand-300)', 'var(--brand-200)']

/* ---------------- Funil (§3.8): barras horizontais, etapa de câmera com contorno tracejado ---------------- */
export function Funnel({ data, onSelect, selected }: { data: DashData['funnel']; onSelect: (f: TableFilter) => void; selected?: string }) {
  const { t, i18n } = useTranslation()
  const max = Math.max(1, data[0]?.n ?? 0)
  return (
    <div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {data.map((s, i) => {
          const prev = i > 0 ? data[i - 1].n : null
          const conv = prev ? (100 * s.n) / Math.max(prev, 1) : null
          const clickable = ['submitted', 'approved'].includes(s.step)
          return (
            <li key={s.step} className="grid grid-cols-[124px_minmax(0,1fr)_72px] items-center gap-3">
              <span className="truncate text-[12px] text-[var(--ink-body)]">{t(`dash.funnel.${s.step}`)}</span>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect({ kind: 'step', value: s.step })}
                aria-label={`${t(`dash.funnel.${s.step}`)}: ${fmtInt(s.n, i18n.language)}${conv !== null ? ` (${fmtPct(conv, i18n.language)})` : ''}`}
                aria-pressed={clickable ? selected === s.step : undefined}
                className={cn('group relative h-[22px] w-full text-left disabled:cursor-default', clickable && 'cursor-pointer')}
              >
                <span
                  className={cn('block h-full rounded-[var(--radius-sm)] transition-[width] duration-[var(--dur-slow)]', s.step === 'camera' && 'outline outline-2 outline-dashed outline-offset-2 outline-[#B06A00]', clickable && 'group-hover:opacity-85')}
                  style={{ width: `${Math.max(2, (100 * s.n) / max)}%`, background: FUNNEL_COLORS[i] }}
                />
              </button>
              <span className="tabular text-right text-[12px] text-[var(--ink-muted)]">
                <span className="font-semibold text-[var(--ink)]">{fmtInt(s.n, i18n.language)}</span>
                {conv !== null ? <span className="block text-[11px]">{fmtPct(conv, i18n.language)}</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
      {data[2]?.denied ? (
        <p className="m-0 mt-3 flex items-start gap-1.5 t-caption text-[var(--risk-review-ink)]">
          <Icon name="cameraOff" size={16} className="mt-px shrink-0" />
          {t('dash.funnel.deniedNote', { count: data[2].denied })}
        </p>
      ) : null}
    </div>
  )
}

export function FunnelTable({ data }: { data: DashData['funnel'] }) {
  const { t, i18n } = useTranslation()
  return <DataTable caption={t('dash.funnelTitle')} head={[t('dash.col.step'), t('dash.col.count'), t('dash.col.conversion')]}
    rows={data.map((s, i) => [t(`dash.funnel.${s.step}`), fmtInt(s.n, i18n.language), i ? fmtPct((100 * s.n) / Math.max(1, data[i - 1].n), i18n.language) : '—'])} />
}

/* ---------------- Fraudes por tipo ao longo do tempo: colunas empilhadas, 4 tipos + Outros ---------------- */
const TYPE_ORDER = ['screen', 'printed', 'no_face', 'face_mismatch', 'device', 'data', 'liveness']
const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']

export function useFraudSeries(data: DashData['fraud_types']) {
  return useMemo(() => {
    const totals = new Map<string, number>()
    data.forEach((d) => totals.set(d.type, (totals.get(d.type) ?? 0) + d.n))
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0])).slice(0, 4).map(([k]) => k)
    // cor segue a entidade, não o ranking: ordem fixa pelo catálogo
    const keys = TYPE_ORDER.filter((k) => top.includes(k))
    const hasOther = [...totals.keys()].some((k) => !top.includes(k))
    const weeks = [...new Set(data.map((d) => d.week))].sort()
    const rows = weeks.map((w) => {
      const row: Record<string, number | string> = { week: w }
      keys.forEach((k) => (row[k] = 0))
      if (hasOther) row.other = 0
      data.filter((d) => d.week === w).forEach((d) => {
        const key = keys.includes(d.type) ? d.type : 'other'
        row[key] = (Number(row[key]) || 0) + d.n
      })
      return row
    })
    return { keys: hasOther ? [...keys, 'other'] : keys, rows, colorOf: (k: string) => SERIES[k === 'other' ? 4 : TYPE_ORDER.indexOf(k) % 4] }
  }, [data])
}

export function FraudTypes({ data, onSelect }: { data: DashData['fraud_types']; onSelect: (f: TableFilter) => void }) {
  const { t, i18n } = useTranslation()
  const { keys, rows } = useFraudSeries(data)
  const colors = keys.map((k, i) => (k === 'other' ? SERIES[4] : SERIES[i]))
  const fmtWeek = (w: string) => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit' }).format(new Date(`${w}T12:00:00`))
  return (
    <div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="week" tickFormatter={fmtWeek} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }} content={<ChartTooltip />} labelFormatter={(l) => `${t('dash.weekOf')} ${fmtWeek(String(l))}`} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} name={t(`dash.types.${k}`)} stackId="t" fill={colors[i]} maxBarSize={24} stroke="var(--chart-surface)" strokeWidth={2}
                radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} cursor={k === 'other' ? undefined : 'pointer'}
                onClick={() => k !== 'other' && onSelect({ kind: 'type', value: k })} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={keys.map((k, i) => ({ label: t(`dash.types.${k}`), color: colors[i] }))} />
    </div>
  )
}

export function FraudTypesTable({ data }: { data: DashData['fraud_types'] }) {
  const { t } = useTranslation()
  const { keys, rows } = useFraudSeries(data)
  return <DataTable caption={t('dash.fraudTitle')} head={[t('dash.col.week'), ...keys.map((k) => t(`dash.types.${k}`))]}
    rows={rows.map((r) => [String(r.week), ...keys.map((k) => String(r[k] ?? 0))])} />
}

/* ---------------- Histograma do Score de Risco com faixas de decisão ---------------- */
export function Histogram({ data, onSelect }: { data: DashData['histogram']; onSelect: (f: TableFilter) => void }) {
  const { t } = useTranslation()
  const color = (b: number) => (b < 30 ? 'var(--risk-low)' : b < 70 ? 'var(--risk-review)' : 'var(--risk-high)')
  const rows = data.map((d) => ({ ...d, label: d.bucket === 90 ? '90–100' : `${d.bucket}–${d.bucket + 9}` }))
  return (
    <div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }} content={<ChartTooltip />} labelFormatter={(l) => `${t('dash.score')} ${l}`} />
            <Bar dataKey="n" name={t('dash.sessions')} radius={[4, 4, 0, 0]} maxBarSize={24} cursor="pointer" onClick={(d) => onSelect({ kind: 'bucket', value: (d as unknown as { bucket: number }).bucket })}>
              {rows.map((r) => <Cell key={r.bucket} fill={color(r.bucket)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="m-0 mt-3 grid list-none grid-cols-3 gap-2 p-0 text-[12px]">
        {[
          { k: 'low', icon: 'approved' as const, range: '0–30', color: 'var(--risk-low)' },
          { k: 'review', icon: 'review' as const, range: '31–70', color: 'var(--risk-review)' },
          { k: 'high', icon: 'rejected' as const, range: '71–100', color: 'var(--risk-high)' },
        ].map((b) => (
          <li key={b.k} className="flex items-center gap-1.5 text-[var(--ink-muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: b.color }} aria-hidden="true" />
            <Icon name={b.icon} size={16} className="shrink-0" />
            <span>{t(`risk.${b.k}`)} <span className="tabular">{b.range}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Mapa do Brasil em grade de UFs (cartograma de ladrilhos) ---------------- */
const UF_GRID: Array<[string, number, number]> = [
  ['RR', 2, 0], ['AP', 4, 0],
  ['AM', 1, 1], ['PA', 3, 1], ['MA', 4, 1], ['CE', 5, 1], ['RN', 6, 1],
  ['AC', 0, 2], ['RO', 1, 2], ['MT', 2, 2], ['TO', 3, 2], ['PI', 4, 2], ['PE', 5, 2], ['PB', 6, 2],
  ['MS', 2, 3], ['GO', 3, 3], ['DF', 4, 3], ['BA', 5, 3], ['AL', 6, 3],
  ['PR', 2, 4], ['SP', 3, 4], ['MG', 4, 4], ['ES', 5, 4], ['SE', 6, 4],
  ['SC', 2, 5], ['RJ', 4, 5],
  ['RS', 2, 6],
]
const SEQ = ['var(--brand-100)', 'var(--brand-200)', 'var(--brand-400)', 'var(--brand-600)', 'var(--brand-800)']

export function UfMap({ data, onSelect, selected }: { data: DashData['by_uf']; onSelect: (f: TableFilter) => void; selected?: string }) {
  const { t, i18n } = useTranslation()
  const map = new Map(data.map((d) => [d.uf, d]))
  const max = Math.max(1, ...data.map((d) => d.n))
  const step = (n: number) => (n === 0 ? -1 : Math.min(4, Math.floor((n / max) * 4.999)))
  return (
    <div>
      <div className="mx-auto grid max-w-[340px] grid-cols-7 gap-[3px]" role="group" aria-label={t('dash.mapTitle')}>
        {Array.from({ length: 7 * 7 }).map((_, idx) => {
          const col = idx % 7
          const row = Math.floor(idx / 7)
          const cell = UF_GRID.find(([, c, r]) => c === col && r === row)
          if (!cell) return <span key={idx} aria-hidden="true" />
          const uf = cell[0]
          const d = map.get(uf)
          const s = step(d?.n ?? 0)
          const dark = s >= 3
          const rate = d && d.n ? (100 * d.high) / d.n : null
          return (
            <button
              key={uf}
              type="button"
              disabled={!d}
              onClick={() => onSelect({ kind: 'uf', value: uf })}
              aria-pressed={selected === uf}
              aria-label={`${uf}: ${fmtInt(d?.n ?? 0, i18n.language)} ${t('dash.sessions')}${rate !== null ? `, ${fmtPct(rate, i18n.language)} ${t('dash.highRisk')}` : ''}`}
              title={`${uf} · ${fmtInt(d?.n ?? 0, i18n.language)}${rate !== null ? ` · ${fmtPct(rate, i18n.language)} ${t('dash.highRisk')}` : ''}`}
              className={cn('grid aspect-square place-items-center rounded-[var(--radius-sm)] text-[11px] font-semibold disabled:cursor-default',
                selected === uf && 'outline outline-2 outline-offset-1 outline-[var(--ink)]')}
              style={{ background: s < 0 ? 'var(--n-100)' : SEQ[s], color: dark ? '#FFFFFF' : 'var(--ink)' }}
            >
              {uf}
              {rate !== null && rate >= 20 ? <span className="sr-only">!</span> : null}
            </button>
          )
        })}
      </div>
      <div className="mx-auto mt-3 flex max-w-[340px] items-center gap-2 t-micro text-[var(--ink-muted)]" aria-hidden="true">
        <span>{t('dash.less')}</span>
        {SEQ.map((c) => <span key={c} className="h-2 flex-1 rounded-[2px]" style={{ background: c }} />)}
        <span>{t('dash.more')}</span>
      </div>
    </div>
  )
}

/* ---------------- Heatmap dia × hora ---------------- */
export function Heatmap({ data, onSelect }: { data: DashData['heatmap']; onSelect: (f: TableFilter) => void }) {
  const { i18n } = useTranslation()
  const max = Math.max(1, ...data.map((d) => d.n))
  const get = (dow: number, hour: number) => data.find((d) => d.dow === dow && d.hour === hour)?.n ?? 0
  const days = [1, 2, 3, 4, 5, 6, 7]
  const dayName = (d: number) => new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2024, 0, d))
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[520px] grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px]">
        <span />
        {Array.from({ length: 24 }).map((_, h) => <span key={h} className="text-center t-micro text-[var(--ink-muted)]">{h % 3 === 0 ? h : ''}</span>)}
        {days.map((dow) => (
          <div key={dow} className="contents">
            <span className="self-center t-micro capitalize text-[var(--ink-muted)]">{dayName(dow)}</span>
            {Array.from({ length: 24 }).map((_, hour) => {
              const n = get(dow, hour)
              const s = n === 0 ? -1 : Math.min(4, Math.floor((n / max) * 4.999))
              return (
                <button key={hour} type="button" disabled={!n} onClick={() => onSelect({ kind: 'slot', dow, hour })}
                  aria-label={`${dayName(dow)} ${hour}h: ${n}`} title={`${dayName(dow)} ${hour}h · ${n}`}
                  className="aspect-square min-h-3 rounded-[2px] disabled:cursor-default"
                  style={{ background: s < 0 ? 'var(--n-50)' : SEQ[s] }} />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Barras horizontais de uma série (dispositivo, nicho) ---------------- */
export function HBars({ rows, onSelect, format }: { rows: Array<{ k: string; n: number; sub?: string }>; onSelect?: (k: string) => void; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.slice(0, 6).map((r) => (
        <li key={r.k}>
          <button type="button" disabled={!onSelect} onClick={() => onSelect?.(r.k)} className="grid w-full grid-cols-[96px_minmax(0,1fr)_56px] items-center gap-3 text-left disabled:cursor-default">
            <span className="truncate text-[12px] text-[var(--ink-body)]">{r.k}</span>
            <span className="h-3 overflow-hidden rounded-r-[4px] bg-transparent">
              <span className="block h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (100 * r.n) / max)}%`, background: 'var(--series-1)' }} />
            </span>
            <span className="tabular text-right text-[12px] text-[var(--ink)]">{format ? format(r.n) : r.n}{r.sub ? <span className="block text-[11px] text-[var(--ink-muted)]">{r.sub}</span> : null}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
