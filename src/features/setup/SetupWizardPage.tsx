import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { OnboardingLayout } from '@/features/onboarding/OnboardingLayout'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { brandCssVars, loadBrandFonts, resolveBrand, type BrandKit } from '@/lib/brand'
import { supabase } from '@/lib/supabase'
import { BrandKitEditor } from './BrandKitEditor'
import { FlowEditor } from './FlowEditor'
import { TeamEditor } from './TeamEditor'

const STEPS = ['marca', 'fluxo', 'equipe', 'pronto'] as const
type Step = (typeof STEPS)[number]
const STEP_INDEX: Record<Step, number> = { marca: 2, fluxo: 3, equipe: 4, pronto: 5 }

export function SetupWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { step = 'marca' } = useParams()
  const { membership, isLoading } = useCurrentOrg()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => { headingRef.current?.focus() }, [step])
  useEffect(() => {
    const k = membership?.organization.brand_kit as BrandKit | undefined
    const b = resolveBrand(k)
    loadBrandFonts([b.font_display, b.font_text])
  }, [membership])

  if (isLoading) return <FullPageLoader />
  if (!membership) return <Navigate to="/app/onboarding" replace />
  if (!STEPS.includes(step as Step)) return <Navigate to="/app/configurar/marca" replace />
  if (membership.role !== 'owner') return <Navigate to="/app" replace />

  const org = membership.organization
  const current = step as Step
  const go = async (next: Step) => {
    const idx = STEP_INDEX[next] + 1
    if ((org as unknown as { onboarding_step?: number }).onboarding_step !== undefined) {
      await supabase.from('organizations').update({ onboarding_step: Math.min(6, idx) }).eq('id', org.id)
    }
    navigate(`/app/configurar/${next}`)
  }
  const skip = (next: Step) => (
    <Button variant="ghost" onClick={() => void go(next)}>{t('setup.skip')}</Button>
  )

  const finish = async (to: string) => {
    setFinishing(true)
    await supabase.from('organizations').update({ onboarding_step: 6, onboarding_completed_at: new Date().toISOString() }).eq('id', org.id)
    await qc.invalidateQueries({ queryKey: ['memberships'] })
    navigate(to, { replace: true })
  }

  const header = (
    <div className="mb-8">
      <h1 ref={headingRef} tabIndex={-1} className="t-h1 outline-none">{t(`setup.${current}.title`)}</h1>
      <p className="m-0 mt-2 max-w-[70ch] t-body text-[var(--ink-muted)]">{t(`setup.${current}.subtitle`, { org: org.name })}</p>
    </div>
  )

  return (
    <OnboardingLayout step={STEP_INDEX[current]} wide={current === 'marca' || current === 'fluxo'} style={brandCssVars(org.brand_kit as BrandKit)}>
      <div className="enter" key={current}>
        {header}
        {current === 'marca' ? (
          <BrandKitEditor org={org} canEdit submitLabel={t('setup.saveContinue')} onSaved={() => void go('fluxo')} secondaryAction={skip('fluxo')} />
        ) : current === 'fluxo' ? (
          <FlowEditor org={org} canEdit submitLabel={t('setup.saveContinue')} onSaved={() => void go('equipe')}
            secondaryAction={<div className="flex gap-2"><Button variant="secondary" icon="arrowLeft" onClick={() => navigate('/app/configurar/marca')}>{t('common.back')}</Button>{skip('equipe')}</div>} />
        ) : current === 'equipe' ? (
          <TeamEditor org={org} myRole="owner" footer={
            <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-between">
              <Button variant="secondary" icon="arrowLeft" onClick={() => navigate('/app/configurar/fluxo')}>{t('common.back')}</Button>
              <Button iconRight="arrowRight" onClick={() => void go('pronto')}>{t('common.continue')}</Button>
            </div>
          } />
        ) : (
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--risk-low-bg)] text-[var(--risk-low-ink)]">
              <Icon name="approved" size={30} />
            </span>
            <h2 className="mt-4 t-h3">{t('setup.pronto.card')}</h2>
            <p className="mx-auto m-0 mt-2 max-w-[48ch] t-body text-[var(--ink-muted)]">{t('setup.pronto.cardBody')}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button icon="send" loading={finishing} onClick={() => void finish('/app/links?novo=1')}>{t('setup.pronto.sendFirst')}</Button>
              <Button variant="secondary" icon="capture" disabled={finishing} onClick={() => void finish('/app/links?simular=1')}>{t('setup.pronto.simulate')}</Button>
            </div>
            <p className="m-0 mt-4 t-caption text-[var(--ink-muted)]">{t('setup.pronto.simulateNote')}</p>
            <ButtonLink to="/app" variant="ghost" className="mt-2" onClick={() => void finish('/app')}>{t('setup.pronto.goDashboard')}</ButtonLink>
          </section>
        )}
      </div>
    </OnboardingLayout>
  )
}
