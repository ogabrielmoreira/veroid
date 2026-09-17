import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { NICHES } from '@/config/niches'
import type { FlowStep, NicheField } from '@/config/niches/types'
import type { Organization } from '@/features/org/useMemberships'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'

const ALL_STEPS: FlowStep[] = ['intro', 'consent', 'tutorial', 'capture', 'document', 'form', 'review', 'done']
/** Etapas que garantem consentimento e prova de vida não podem ser desligadas. */
const LOCKED: FlowStep[] = ['intro', 'consent', 'tutorial', 'capture', 'review', 'done']

interface FlowRow { id: string; steps: FlowStep[]; fields: Array<NicheField & { enabled?: boolean }>; consent_version: string }

export function useFlow(orgId: string) {
  return useQuery({
    queryKey: ['flow', orgId],
    queryFn: async (): Promise<FlowRow | null> => {
      const { data, error } = await supabase
        .from('flow_templates').select('id, steps, fields, consent_version')
        .eq('organization_id', orgId).eq('is_active', true).order('created_at').limit(1).maybeSingle()
      if (error) throw error
      return data as FlowRow | null
    },
  })
}

export function FlowEditor({ org, canEdit, submitLabel, onSaved, secondaryAction }: {
  org: Organization; canEdit: boolean; submitLabel?: string; onSaved?: () => void; secondaryAction?: ReactNode
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useFlow(org.id)
  const niche = NICHES[org.niche]
  const [steps, setSteps] = useState<FlowStep[]>([])
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setSteps(data.steps?.length ? data.steps : niche.flowSteps)
    const map: Record<string, boolean> = {}
    for (const f of niche.fields) {
      const saved = data.fields?.find((x) => x.key === f.key)
      map[f.key] = f.required ? true : saved ? saved.enabled !== false : true
    }
    setEnabledFields(map)
  }, [data, niche])

  if (isLoading) return <SkeletonBlock />
  if (isError || !data) {
    return (
      <Alert variant="error" title={t('errors.generic')}>
        <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>{t('common.retry')}</Button>
      </Alert>
    )
  }

  const toggleStep = (s: FlowStep) =>
    setSteps((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : ALL_STEPS.filter((x) => cur.includes(x) || x === s)))

  const save = async () => {
    setSaving(true)
    setError(null)
    const fields = niche.fields.map((f) => ({ ...f, enabled: f.required || enabledFields[f.key] !== false }))
    const { error: err } = await supabase.from('flow_templates').update({ steps, fields, risk_rules: niche.riskRules }).eq('id', data.id)
    setSaving(false)
    if (err) return setError(authErrorMessage(err, t))
    await qc.invalidateQueries({ queryKey: ['flow', org.id] })
    toast.show({ tone: 'success', title: t('flow.saved') })
    onSaved?.()
  }

  const formEnabled = steps.includes('form')

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="error" live>{error}</Alert> : null}
      {!canEdit ? <Alert variant="neutral">{t('brand.readOnly')}</Alert> : null}

      <fieldset disabled={!canEdit} className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-2 lg:items-start">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
          <h2 className="t-h4 font-sans">{t('flow.steps')}</h2>
          <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('flow.stepsHelp')}</p>
          <ol className="m-0 mt-4 flex list-none flex-col p-0">
            {ALL_STEPS.map((s, i) => {
              const on = steps.includes(s)
              const locked = LOCKED.includes(s)
              return (
                <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < ALL_STEPS.length - 1 ? <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-[var(--border)]" aria-hidden="true" /> : null}
                  <span className={cn('z-[1] grid size-8 shrink-0 place-items-center rounded-full border text-[12px] font-semibold tabular',
                    on ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)]' : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink-muted)]')}>
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <p className={cn('m-0 text-[14px] font-medium', on ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] line-through')}>{t(`flow.step.${s}`)}</p>
                      <p className="m-0 t-caption text-[var(--ink-muted)]">{t(`flow.stepHelp.${s}`)}</p>
                    </div>
                    {locked ? (
                      <span className="inline-flex shrink-0 items-center gap-1 t-caption text-[var(--ink-muted)]"><Icon name="lock" size={16} />{t('common.required')}</span>
                    ) : (
                      <Switch checked={on} onChange={() => toggleStep(s)} label={t(`flow.step.${s}`)} />
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
          <h2 className="t-h4 font-sans">{t('flow.fields', { niche: t(`niches.${org.niche}`) })}</h2>
          <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('flow.fieldsHelp')}</p>
          {!formEnabled ? <Alert variant="neutral" className="mt-4">{t('flow.formOff')}</Alert> : null}
          <ul className={cn('m-0 mt-4 flex list-none flex-col p-0', !formEnabled && 'opacity-60')}>
            {niche.fields.map((f) => (
              <li key={f.key} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[var(--divider)] py-2 last:border-b-0">
                <div className="min-w-0">
                  <p className="m-0 text-[14px] text-[var(--ink)]">{f.label}</p>
                  <p className="m-0 t-caption text-[var(--ink-muted)]">{t(`flow.fieldType.${f.type}`)}</p>
                </div>
                {f.required ? (
                  <span className="inline-flex shrink-0 items-center gap-1 t-caption text-[var(--ink-muted)]"><Icon name="lock" size={16} />{t('common.required')}</span>
                ) : (
                  <Switch disabled={!formEnabled} checked={enabledFields[f.key] !== false} onChange={() => setEnabledFields((m) => ({ ...m, [f.key]: !(m[f.key] !== false) }))} label={f.label} />
                )}
              </li>
            ))}
          </ul>

          {niche.riskRules.length ? (
            <>
              <h3 className="mt-6 font-sans text-[14px] font-semibold tracking-normal">{t('flow.rules')}</h3>
              <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                {niche.riskRules.map((r) => (
                  <li key={r.code} className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="flex items-start gap-2"><Icon name="review" size={16} className="mt-0.5 shrink-0 text-[var(--risk-review)]" />{r.label}</span>
                    <span className="tabular shrink-0 t-caption text-[var(--ink-muted)]">+{r.weight}{r.forces ? ` · ${t('flow.forcesReview')}` : ''}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3 t-caption text-[var(--ink-muted)]">{t('flow.rulesNote')}</p>
            </>
          ) : null}
        </section>
      </fieldset>

      {canEdit ? (
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          {secondaryAction ?? <span />}
          <Button onClick={save} loading={saving}>{submitLabel ?? t('common.save')}</Button>
        </div>
      ) : null}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="group grid min-h-11 min-w-11 shrink-0 place-items-center disabled:cursor-not-allowed lg:min-h-10"
    >
      <span className={cn('relative h-6 w-10 rounded-full transition-colors duration-[var(--dur-instant)]', checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--n-300)] [[data-theme=dark]_&]:bg-[#4E5573]')}>
        <span className={cn('absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-[var(--shadow-raised)] transition-transform duration-[var(--dur-fast)]', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}

export function SkeletonBlock() {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]" aria-hidden="true">
      {['70%', '92%', '48%', '80%'].map((w, i) => <span key={i} className="h-3 rounded-sm bg-[var(--n-100)] motion-safe:animate-pulse [[data-theme=dark]_&]:bg-[#262C45]" style={{ width: w }} />)}
    </div>
  )
}
