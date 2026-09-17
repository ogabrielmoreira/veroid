import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useMemberships } from './useMemberships'
import { PENDING_INVITE_KEY } from './InvitePage'

/** Sem organização → onboarding. Com organização → painel. */
export function OrgGate() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useMemberships()
  const { pathname } = useLocation()
  const onOnboarding = pathname === '/app/onboarding'

  if (isLoading) return <FullPageLoader />
  if (isError) {
    return (
      <div className="grid min-h-dvh place-items-center p-5">
        <div className="w-full max-w-[420px] rounded-lg border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-6">
          <Icon name="rejected" size={24} className="text-[var(--risk-high-ink)]" />
          <p className="m-0 mt-3 text-[14px] font-semibold text-[var(--risk-high-ink)]">{t('errors.generic')}</p>
          <p className="m-0 mt-1 t-caption text-[var(--ink-body)]">{t('errors.network')}</p>
          <Button variant="secondary" className="mt-4" onClick={() => void refetch()}>{t('common.continue')}</Button>
        </div>
      </div>
    )
  }
  let pendingInvite: string | null = null
  try { pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY) } catch { /* ignora */ }
  if (pendingInvite) return <Navigate to={`/convite/${pendingInvite}`} replace />
  const hasOrg = (data?.length ?? 0) > 0
  if (!hasOrg && !onOnboarding) return <Navigate to="/app/onboarding" replace />
  if (hasOrg && onOnboarding) return <Navigate to="/app" replace />
  return <Outlet />
}
