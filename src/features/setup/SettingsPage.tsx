import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { NavTabs } from '@/components/ui/Tabs'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { BrandKitEditor } from './BrandKitEditor'
import { FlowEditor } from './FlowEditor'
import { TeamEditor } from './TeamEditor'
import { RulesEditor } from './RulesEditor'

export function SettingsPage() {
  const { t } = useTranslation()
  const { tab = 'marca' } = useParams()
  const { membership, isLoading } = useCurrentOrg()
  if (isLoading) return <FullPageLoader />
  if (!membership) return <Navigate to="/app" replace />
  const org = membership.organization
  const canEdit = membership.role === 'owner'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="t-h1">{t('app.nav.settings')}</h1>
        <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{org.name}</p>
      </div>
      <NavTabs label={t('app.nav.settings')} items={[
        { to: '/app/configuracoes/marca', label: t('onboarding.steps.brand') },
        { to: '/app/configuracoes/fluxo', label: t('onboarding.steps.flow') },
        { to: '/app/configuracoes/equipe', label: t('onboarding.steps.team') },
        { to: '/app/configuracoes/regras', label: t('rules.tab') },
      ]} />
      {tab === 'marca' ? <BrandKitEditor key={org.id} org={org} canEdit={canEdit} />
        : tab === 'fluxo' ? <FlowEditor org={org} canEdit={canEdit} />
        : tab === 'equipe' ? <TeamEditor org={org} myRole={membership.role} />
        : tab === 'regras' ? <RulesEditor key={JSON.stringify(org.settings)} org={org} role={membership.role} />
        : <Navigate to="/app/configuracoes/marca" replace />}
    </div>
  )
}
