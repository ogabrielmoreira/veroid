import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  icon?: IconName
  iconTone?: 'brand' | 'danger' | 'warning'
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  note?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

/** Modal (§3.13): prende o foco, Esc fecha, devolve o foco ao gatilho. */
export function Modal({ open, onClose, title, icon, iconTone = 'brand', description, children, footer, note, size = 'sm' }: ModalProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement
    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
    const first = focusables().find((el) => el.dataset.autofocus !== undefined) ?? focusables()[1] ?? focusables()[0]
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab') {
        const els = focusables()
        if (!els.length) return
        const [a, z] = [els[0], els[els.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(triggerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  const tones = {
    brand: 'bg-[var(--brand-50)] text-[var(--brand-700)] [[data-theme=dark]_&]:bg-[#151A33] [[data-theme=dark]_&]:text-[var(--brand-300)]',
    danger: 'bg-[var(--risk-high-bg)] text-[var(--risk-high-ink)]',
    warning: 'bg-[var(--risk-review-bg)] text-[var(--risk-review-ink)]',
  }
  const width = { sm: 'max-w-[480px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' }[size]

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-5">
      <div className="absolute inset-0 bg-[var(--scrim)] motion-safe:animate-[fade_var(--dur-base)_var(--ease-in)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'enter relative flex max-h-[92dvh] w-full flex-col rounded-t-[var(--radius-lg)] bg-[var(--surface-raised)] shadow-[var(--shadow-modal)] sm:rounded-[var(--radius-lg)]',
          '[[data-theme=dark]_&]:border [[data-theme=dark]_&]:border-[var(--border)]',
          width,
        )}
      >
        <div className="flex items-start gap-3 p-[22px] pb-0">
          {icon ? (
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', tones[iconTone])}>
              <Icon name={icon} size={20} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="t-h4 font-sans text-[var(--ink)]">{title}</h2>
            {description ? <p id={descId} className="m-0 mt-1 text-[13px] leading-5 text-[var(--ink-muted)]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--n-100)] hover:text-[var(--ink)] lg:size-10 [[data-theme=dark]_&]:hover:bg-[#262C45]"
          >
            <Icon name="rejected" size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-[22px]">{children}</div>
        {footer ? <div className="flex flex-col-reverse gap-2.5 border-t border-[var(--divider)] p-[22px] pt-4 sm:flex-row sm:justify-end">{footer}</div> : null}
        {note ? <p className="m-0 px-[22px] pb-[22px] t-caption text-[var(--ink-muted)]">{note}</p> : null}
      </div>
    </div>,
    (document.querySelector('.brand-scope') as HTMLElement | null) ?? document.body,
  )
}
