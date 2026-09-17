import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Icon, type IconName } from '@/components/ui/Icon'
import { BrandMark } from './BrandMark'
import { Spinner } from '@/components/ui/Spinner'
import { NICHES, type NicheSlug } from '@/config/niches'
import { brandCssVars, loadBrandFonts, resolveBrand, type BrandKit } from '@/lib/brand'
import { supabase } from '@/lib/supabase'
import { SubjectIntro } from './SubjectIntro'
import { SubjectFlow } from './SubjectFlow'
import type { FlowStep, NicheField } from '@/config/niches/types'
import { loadStoredSession } from './lib/api'

interface PublicLink {
  status: 'not_found' | 'created' | 'sent' | 'opened' | 'in_progress' | 'completed' | 'expired' | 'canceled'
  organization?: { name: string; niche: NicheSlug; brand_kit: BrandKit }
  subject_first_name?: string
  expires_at?: string
  flow?: { steps: FlowStep[]; fields: Array<NicheField & { enabled?: boolean }>; consent_version: string } | null
  retention_days?: number
}

/** /v/:token — fluxo do titular (mobile-first, sempre light, com a marca da organização). */
export function SubjectLinkPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [started, setStarted] = useState(() => Boolean(loadStoredSession(token)))

  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
  }, [])

  const q = useQuery({
    queryKey: ['public-link', token],
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<PublicLink> => {
      const { data, error } = await supabase.rpc('get_public_link', { p_token: token })
      if (error) throw error
      return data as PublicLink
    },
  })

  const kit = q.data?.organization?.brand_kit
  useEffect(() => {
    if (!kit) return
    const b = resolveBrand(kit)
    loadBrandFonts([b.font_display, b.font_text])
    const orgName = q.data?.organization?.name
    if (orgName) document.title = `${orgName} · ${t('subject.docTitle')}`
  }, [kit, q.data, t])

  const shell = (children: React.ReactNode) => (
    <div className="brand-scope min-h-dvh bg-[#F5F6FA]" data-theme="light" style={brandCssVars(kit)}>
      <div className="mx-auto flex min-h-dvh max-w-[var(--flow-max)] flex-col bg-white sm:my-6 sm:min-h-[calc(100dvh-48px)] sm:rounded-[var(--radius-lg)] sm:border sm:border-[#D7DAE8] [&>div]:flex-1">
        {children}
      </div>
    </div>
  )

  if (q.isLoading) {
    return shell(<div className="grid flex-1 place-items-center text-[#4E5573]"><Spinner size={24} label={t('common.loading')} /></div>)
  }

  if (q.isError) {
    return shell(
      <StateScreen icon="review" tone="warning" title={t('subject.errorTitle')} body={t('subject.errorBody')}
        action={<button type="button" onClick={() => void q.refetch()} className="min-h-11 w-full rounded-[var(--radius-md)] bg-[#232C6B] px-4 text-[15px] font-medium text-white">{t('common.retry')}</button>} />,
    )
  }

  const data = q.data!
  if (data.status === 'not_found') return shell(<StateScreen icon="unknown" title={t('subject.notFoundTitle')} body={t('subject.notFoundBody')} />)
  if (data.status === 'expired') return shell(<StateScreen icon="pending" title={t('subject.expiredTitle')} body={t('subject.expiredBody', { org: data.organization?.name })} />)
  if (data.status === 'canceled') return shell(<StateScreen icon="rejected" title={t('subject.canceledTitle')} body={t('subject.canceledBody', { org: data.organization?.name })} />)
  if (data.status === 'completed') return shell(<StateScreen icon="approved" tone="success" title={t('subject.completedTitle')} body={t('subject.completedBody', { org: data.organization?.name })} />)

  const org = data.organization!
  const purpose = NICHES[org.niche]?.consentCopy.purpose ?? ''

  if (started && data.flow) {
    return shell(
      <>
        <header className="flex items-center gap-3 border-b border-[#EBEDF4] px-5 py-3">
          <BrandMark name={org.name} kit={org.brand_kit} size={28} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#10142B]">{org.name}</span>
        </header>
        <SubjectFlow token={token} orgName={org.name} purpose={purpose} retentionDays={data.retention_days ?? 1} flow={data.flow} />
        <p className="m-0 flex items-center justify-center gap-1.5 border-t border-[#EBEDF4] px-5 py-3 text-[12px] text-[#4E5573]">
          <Icon name="shield" size={16} />{t('subject.intro.poweredBy')}
        </p>
      </>,
    )
  }

  return shell(<SubjectIntro orgName={org.name} kit={org.brand_kit} firstName={data.subject_first_name} purpose={purpose} onStart={() => setStarted(true)} />)
}

function StateScreen({ icon, title, body, action, tone = 'neutral' }: { icon: IconName; title: string; body: string; action?: React.ReactNode; tone?: 'neutral' | 'warning' | 'success' }) {
  const tones = { neutral: 'bg-[#EEF0F2] text-[#3D464F]', warning: 'bg-[#FBF0DF] text-[#7A4900]', success: 'bg-[#E6F2EB] text-[#0B5C37]' }
  return (
    <main className="flex flex-1 flex-col px-5 py-10 text-[#3C4262]">
      <span className={`grid size-12 place-items-center rounded-full ${tones[tone]}`}><Icon name={icon} size={24} /></span>
      <h1 className="mt-5 text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[#10142B]">{title}</h1>
      <p className="m-0 mt-2 text-[15px] leading-6">{body}</p>
      {action ? <div className="mt-auto pt-8">{action}</div> : null}
    </main>
  )
}
