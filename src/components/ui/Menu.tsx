import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

export interface MenuItem { label: string; icon: IconName; onSelect: () => void; destructive?: boolean; disabled?: boolean; dividerBefore?: boolean }

/** Dropdown de ações (§3.11) com navegação por setas e Esc. */
export function Menu({ label, items, trigger }: { label: string; items: MenuItem[]; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    const first = list.current?.querySelector<HTMLButtonElement>('button:not([disabled])')
    first?.focus()
    const onDoc = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
    const idx = els.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(idx + 1) % els.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(idx - 1 + els.length) % els.length]?.focus() }
    if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className="relative inline-block" onKeyDown={onKey}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-md border border-[var(--border-strong)] text-[var(--ink-body)] hover:border-[var(--brand-primary)] lg:size-10"
      >
        {trigger ?? (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="4.5" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="15.5" r="1.5" /></svg>
        )}
      </button>
      {open ? (
        <ul
          ref={list}
          id={id}
          role="menu"
          className="enter absolute right-0 top-full z-40 m-0 mt-1.5 w-[240px] list-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-overlay)]"
        >
          {items.map((it) => (
            <li key={it.label} role="none">
              {it.dividerBefore ? <hr className="mx-1 my-[5px] border-0 border-t border-[var(--divider)]" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onSelect() }}
                className={cn(
                  'flex min-h-10 w-full items-center gap-[9px] rounded-md px-2.5 py-[9px] text-left text-[13px]',
                  'hover:bg-[var(--brand-50)] focus:bg-[var(--brand-50)] focus:outline-none [[data-theme=dark]_&]:hover:bg-[#262C45] [[data-theme=dark]_&]:focus:bg-[#262C45]',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  it.destructive ? 'text-[var(--risk-high-ink)]' : 'text-[var(--ink)]',
                )}
              >
                <Icon name={it.icon} size={16} />
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
