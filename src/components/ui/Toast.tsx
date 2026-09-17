import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { Icon } from './Icon'

type Tone = 'success' | 'error' | 'info'
interface ToastItem { id: number; title: string; body?: string; tone: Tone }
interface ToastApi { show: (t: Omit<ToastItem, 'id'>) => void }

const ToastContext = createContext<ToastApi | null>(null)

/** Toast (§3.10): canto inferior direito, 6s, role=status, não rouba foco. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const show = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-2), { ...t, id }])
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 6000)
  }, [])
  const api = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 left-4 z-[1000] flex flex-col items-end gap-2 sm:left-auto">
          {items.map((i) => (
            <div
              key={i.id}
              className={cn(
                'enter pointer-events-auto flex w-full gap-2.5 rounded-md border bg-[var(--surface-raised)] p-[14px] shadow-[var(--shadow-overlay)] sm:w-[360px]',
                i.tone === 'error' ? 'border-[rgba(179,38,30,.4)]' : 'border-[var(--border)]',
              )}
            >
              <Icon
                name={i.tone === 'success' ? 'approved' : i.tone === 'error' ? 'rejected' : 'info'}
                size={18}
                className={cn('mt-px shrink-0', i.tone === 'success' ? 'text-[var(--risk-low)]' : i.tone === 'error' ? 'text-[var(--risk-high)]' : 'text-[var(--link)]')}
              />
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-medium text-[var(--ink)]">{i.title}</p>
                {i.body ? <p className="m-0 mt-0.5 t-caption text-[var(--ink-muted)]">{i.body}</p> : null}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa de <ToastProvider>')
  return ctx
}
