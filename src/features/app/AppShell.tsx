import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { LanguageToggle, ThemeToggle } from '@/components/Preferences'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/features/auth/AuthProvider'
import { setStoredOrgId, useCurrentOrg } from '@/features/org/useCurrentOrg'
import { brandCssVars, loadBrandFonts, resolveBrand, type BrandKit } from '@/lib/brand'
import { useQueryClient } from '@tanstack/react-query'
import { BrandMark } from '@/features/subject/BrandMark'
import { supabase } from '@/lib/supabase'
import { applyTheme, readTheme } from '@/lib/theme'

const NAV: Array<{ key: string; to: string; icon: IconName; ready: boolean }> = [
  { key: 'overview', to: '/app', icon: 'home', ready: true },
  { key: 'links', to: '/app/links', icon: 'link', ready: true },
  { key: 'review', to: '/app/revisao', icon: 'evidence', ready: true },
  { key: 'qualified', to: '/app/clientes-qualificados', icon: 'users', ready: true },
  { key: 'audit', to: '/app/auditoria', icon: 'shield', ready: true },
  { key: 'reports', to: '/app/relatorios', icon: 'chart', ready: false },
  { key: 'settings', to: '/app/configuracoes', icon: 'settings', ready: true },
]

export function AppShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { membership, memberships } = useCurrentOrg()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [drawer, setDrawer] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const org = membership?.organization
  const kit = org?.brand_kit as BrandKit | undefined
  useEffect(() => {
    const b = resolveBrand(kit)
    loadBrandFonts([b.font_display, b.font_text])
  }, [kit])
  const titleKey = pathname.startsWith('/app/links') ? 'links' : pathname.startsWith('/app/configuracoes') ? 'settings'
    : pathname.startsWith('/app/revisao') || pathname.startsWith('/app/sessoes') ? 'review' : pathname.startsWith('/app/clientes') ? 'qualified'
    : pathname.startsWith('/app/auditoria') ? 'audit' : 'overview'

  // Dark mode só no painel
  useEffect(() => {
    applyTheme(readTheme())
    return () => { document.documentElement.dataset.theme = 'light' }
  }, [])

  // Após troca de rota, foco no conteúdo principal (§3.14)
  useEffect(() => {
    setDrawer(false)
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/entrar', { replace: true })
  }

  const sidebar = (
    <nav aria-label="Principal" className="flex h-full flex-col px-3 py-4">
      <div className="px-2.5 pb-5">
        <Logo />
        {org ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2">
            <BrandMark name={org.name} kit={kit} size={28} />
            {memberships.length > 1 ? (
              <select
                aria-label={t('app.switchOrg')}
                value={org.id}
                onChange={(e) => { setStoredOrgId(e.target.value); void qc.invalidateQueries({ queryKey: ['memberships'] }); navigate('/app') }}
                className="min-w-0 flex-1 truncate bg-transparent text-[13px] font-medium text-[var(--ink)]"
              >
                {memberships.map((m) => <option key={m.organization.id} value={m.organization.id}>{m.organization.name}</option>)}
              </select>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]" title={org.name}>{org.name}</span>
            )}
          </div>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {NAV.map((item) => (
          <li key={item.key}>
            {item.ready ? (
              <NavLink
                to={item.to}
                end={item.to === '/app'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 lg:min-h-10 items-center gap-2.5 rounded-md px-2.5 py-[9px] text-[13px]',
                    isActive
                      ? 'bg-[var(--brand-800)] text-white shadow-[inset_3px_0_0_#939EE2] [[data-theme=dark]_&]:bg-[#151A33]'
                      : 'text-[var(--ink-body)] hover:bg-[var(--n-100)] [[data-theme=dark]_&]:hover:bg-[#151A33]',
                  )
                }
              >
                <Icon name={item.icon} size={18} />
                {t(`app.nav.${item.key}`)}
              </NavLink>
            ) : (
              <span aria-disabled="true" className="flex min-h-11 lg:min-h-10 items-center gap-2.5 rounded-md px-2.5 py-[9px] text-[13px] text-[var(--ink-muted)]">
                <Icon name={item.icon} size={18} />
                <span className="min-w-0 flex-1 truncate">{t(`app.nav.${item.key}`)}</span>
                <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] px-1.5 text-[10px] leading-4">{t('app.soon')}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-[var(--border)] px-2.5 pt-4">
        <p className="m-0 truncate t-caption text-[var(--ink-muted)]" title={user?.email}>{user?.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="-mx-2.5 mt-2 flex min-h-11 lg:min-h-10 w-[calc(100%+20px)] items-center gap-2.5 rounded-md px-2.5 text-[13px] text-[var(--ink-body)] hover:bg-[var(--n-100)] [[data-theme=dark]_&]:hover:bg-[#151A33]"
        >
          <Icon name="logout" size={18} />
          {t('common.signOut')}
        </button>
      </div>
    </nav>
  )

  return (
    <div className="brand-scope min-h-dvh bg-[var(--surface-page)] text-[var(--ink-body)]" style={brandCssVars(kit)}>
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[1000] rounded-md bg-[var(--surface)] px-3 py-2 t-label text-[var(--ink)]">
        {t('common.skipToContent')}
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] border-r border-[var(--border)] bg-[var(--n-50)] [[data-theme=dark]_&]:bg-[#0C1024] lg:block">
        {sidebar}
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-[var(--scrim)]" onClick={() => setDrawer(false)} />
          <aside className="enter absolute inset-y-0 left-0 w-[272px] max-w-[85vw] bg-[var(--surface-page)] shadow-[var(--shadow-modal)]">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3 lg:px-5 lg:py-4">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md border border-[var(--border-strong)] lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" /></svg>
          </button>
          <p className="m-0 flex-1 truncate font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {t(`app.nav.${titleKey}`)}
          </p>
          <span className="hidden items-center gap-1.5 rounded-full border border-[rgba(176,106,0,.28)] bg-[var(--risk-review-bg)] px-[11px] py-[5px] t-caption font-medium text-[var(--risk-review-ink)] sm:inline-flex">
            <Icon name="info" size={16} />
            {t('brand.demoBadge')}
          </span>
          <LanguageToggle />
          <ThemeToggle />
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[var(--content-max)] px-[clamp(20px,5vw,48px)] py-8 outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
