import { NavLink } from 'react-router'
import { cn } from './cn'

/** Abas de navegação (§3.14): ativa com traço inferior e peso 600. */
export function NavTabs({ items, label }: { items: Array<{ to: string; label: string }>; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto border-b border-[var(--border)]">
      <ul className="m-0 flex list-none gap-5 px-1 p-0">
        {items.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center whitespace-nowrap py-[11px] text-[13px]',
                  isActive
                    ? 'font-semibold text-[var(--ink)] shadow-[inset_0_-2px_0_var(--brand-primary)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
                )
              }
            >
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Filtro segmentado (botões com aria-pressed). */
export function SegmentedFilter<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; count?: number }>; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[13px]',
            value === o.value
              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
              : 'border-[var(--border-strong)] text-[var(--ink-body)] hover:border-[var(--brand-primary)]',
          )}
        >
          {o.label}
          {typeof o.count === 'number' ? <span className="tabular opacity-80">{o.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
