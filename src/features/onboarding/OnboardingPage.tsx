import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import { FEATURED_NICHES, NICHES, TEMPLATE_NICHES, flowPayload, type NicheConfig, type NicheSlug } from '@/config/niches'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'
import { OnboardingLayout } from './OnboardingLayout'
import { setStoredOrgId } from '@/features/org/useCurrentOrg'
import { isValidCnpj, maskCnpj, onlyDigits } from '@/lib/validators'
import { clearDemoIntent, hasDemoIntent } from '@/lib/demoIntent'
import { useToast } from '@/components/ui/Toast'

const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [step, setStep] = useState<0 | 1>(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const [seedingDemo, setSeedingDemo] = useState(false)
  const [lookup, setLookup] = useState<{ state: 'idle' | 'loading' | 'found' | 'fail'; name?: string }>({ state: 'idle' })
  const headingRef = useRef<HTMLHeadingElement>(null)

  const schema = z.object({
    name: z.string().trim().min(2, t('onboarding.company.nameRequired')).max(120),
    cnpj: z
      .string()
      .optional()
      .refine((v) => !v || onlyDigits(v).length === 0 || isValidCnpj(v), t('errors.invalidCnpj')),
    website: z.string().trim().max(200).optional(),
    size: z.enum(SIZES).optional().or(z.literal('')),
    niche: z.string().optional(),
    subniche: z.string().optional(),
  })
  type Values = z.infer<typeof schema>

  const { register, control, handleSubmit, trigger, watch, setValue, getValues, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { name: '', cnpj: '', website: '', size: '', niche: '', subniche: '' },
  })
  const { errors, isSubmitting } = formState
  const niche = watch('niche') as NicheSlug | ''
  const selected: NicheConfig | undefined = niche ? NICHES[niche] : undefined
  const [nicheError, setNicheError] = useState<string | null>(null)

  const goTo = (s: 0 | 1) => {
    setStep(s)
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  const next = async () => {
    if (await trigger(['name', 'cnpj', 'website', 'size'])) goTo(1)
  }

  const lookupCnpj = async () => {
    const digits = onlyDigits(getValues('cnpj') ?? '')
    if (!isValidCnpj(digits)) return void trigger('cnpj')
    setLookup({ state: 'loading' })
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { razao_social?: string; nome_fantasia?: string }
      const name = body.nome_fantasia || body.razao_social
      if (!name) throw new Error('empty')
      if (!getValues('name')) setValue('name', name, { shouldValidate: true })
      setLookup({ state: 'found', name })
    } catch {
      setLookup({ state: 'fail' })
    }
  }

  const onSubmit = async (values: Values) => {
    if (!values.niche) return setNicheError(t('onboarding.niche.required'))
    setServerError(null)
    const config = NICHES[values.niche as NicheSlug]
    const { data: orgId, error } = await supabase.rpc('create_organization', {
      p_name: values.name,
      p_niche: values.niche,
      p_cnpj: values.cnpj ? onlyDigits(values.cnpj) : null,
      p_website: values.website || null,
      p_size: values.size || null,
      p_subniche: values.subniche || null,
      p_flow: flowPayload(config),
    })
    if (error) return setServerError(authErrorMessage(error, t))
    setStoredOrgId(orgId as string)
    await queryClient.invalidateQueries({ queryKey: ['memberships'] })

    if (hasDemoIntent()) {
      clearDemoIntent()
      setSeedingDemo(true)
      const { error: seedError } = await supabase.rpc('seed_demo_data', { p_organization_id: orgId })
      setSeedingDemo(false)
      if (seedError) {
        toast.show({ tone: 'error', title: authErrorMessage(seedError, t) })
        return navigate('/app/configurar/marca', { replace: true })
      }
      toast.show({ tone: 'success', title: t('onboarding.demoSeeded') })
      return navigate('/app', { replace: true })
    }
    navigate('/app/configurar/marca', { replace: true })
  }

  return (
    <OnboardingLayout step={step}>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="">
          {step === 0 ? (
            <section className="enter" aria-labelledby="ob-title">
              <h1 id="ob-title" ref={headingRef} tabIndex={-1} className="t-h1 outline-none">{t('onboarding.company.title')}</h1>
              <p className="mt-2 mb-0 t-body text-[var(--ink-muted)]">{t('onboarding.company.subtitle')}</p>

              <div className="mt-8 grid gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-[22px] sm:p-6">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <Controller
                    control={control}
                    name="cnpj"
                    render={({ field }) => (
                      <InputField
                        id="ob-cnpj"
                        label={t('onboarding.company.cnpj')}
                        optional
                        inputMode="numeric"
                        placeholder="00.000.000/0000-00"
                        help={t('onboarding.company.cnpjHelp')}
                        error={errors.cnpj?.message}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(e) => { field.onChange(maskCnpj(e.target.value)); setLookup({ state: 'idle' }) }}
                        className="tabular"
                      />
                    )}
                  />
                  <Button variant="secondary" icon="search" loading={lookup.state === 'loading'} onClick={lookupCnpj} className="sm:mt-6">
                    {t('onboarding.company.lookup')}
                  </Button>
                </div>
                {lookup.state === 'found' ? <Alert variant="success" live>{t('onboarding.company.lookupFound', { name: lookup.name })}</Alert> : null}
                {lookup.state === 'fail' ? <Alert variant="warning" live>{t('onboarding.company.lookupFail')}</Alert> : null}

                <InputField id="ob-name" label={t('onboarding.company.name')} autoComplete="organization" error={errors.name?.message} {...register('name')} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <InputField id="ob-website" label={t('onboarding.company.website')} optional type="url" inputMode="url" placeholder="https://" autoComplete="url" {...register('website')} />
                  <SelectField id="ob-size" label={t('onboarding.company.size')} optional {...register('size')}>
                    <option value="">{t('onboarding.company.sizePlaceholder')}</option>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SelectField>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button onClick={next} iconRight="arrowRight">{t('common.continue')}</Button>
              </div>
            </section>
          ) : (
            <section className="enter" aria-labelledby="ob-niche-title">
              <h1 id="ob-niche-title" ref={headingRef} tabIndex={-1} className="t-h1 outline-none">{t('onboarding.niche.title')}</h1>
              <p className="mt-2 mb-0 t-body text-[var(--ink-muted)]">{t('onboarding.niche.subtitle')}</p>

              {serverError ? <Alert variant="error" live className="mt-6">{serverError}</Alert> : null}

              <fieldset className="m-0 mt-8 border-0 p-0" aria-describedby={nicheError ? 'niche-error' : undefined}>
                <legend className="t-overline text-[var(--ink-muted)]">{t('onboarding.niche.featured')}</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {FEATURED_NICHES.map((n) => (
                    <NicheCard key={n.slug} niche={n} checked={niche === n.slug} onSelect={() => { setValue('niche', n.slug); setValue('subniche', ''); setNicheError(null) }} />
                  ))}
                </div>
                <details className="group mt-6">
                  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 t-label text-[var(--link)]">
                    <Icon name="chevronDown" size={16} className="transition-transform duration-[var(--dur-fast)] group-open:rotate-180" />
                    {t('onboarding.niche.templates')}
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {TEMPLATE_NICHES.map((n) => (
                      <NicheCard key={n.slug} niche={n} compact checked={niche === n.slug} onSelect={() => { setValue('niche', n.slug); setValue('subniche', ''); setNicheError(null) }} />
                    ))}
                  </div>
                </details>
                {nicheError ? (
                  <p id="niche-error" role="alert" className="m-0 mt-3 flex items-center gap-1.5 t-caption text-[var(--risk-high-ink)]">
                    <Icon name="review" size={16} />{nicheError}
                  </p>
                ) : null}
              </fieldset>

              {selected?.subniches?.length ? (
                <div className="mt-6 max-w-[360px]">
                  <SelectField id="ob-subniche" label={t('onboarding.niche.subniche')} optional {...register('subniche')}>
                    <option value="">—</option>
                    {selected.subniches.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SelectField>
                </div>
              ) : null}

              
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button variant="secondary" icon="arrowLeft" onClick={() => goTo(0)}>{t('common.back')}</Button>
                <Button type="submit" loading={isSubmitting || seedingDemo}>
                  {seedingDemo ? t('onboarding.seedingDemo') : isSubmitting ? t('onboarding.creating') : t('onboarding.submit')}
                </Button>
              </div>
            </section>
          )}
        </form>
    </OnboardingLayout>
  )
}

function NicheCard({ niche, checked, onSelect, compact }: { niche: NicheConfig; checked: boolean; onSelect: () => void; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <label
      className={cn(
        'relative flex cursor-pointer gap-3 rounded-lg border bg-[var(--surface)] p-4 transition-[border-color,box-shadow] duration-[var(--dur-instant)]',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]',
        checked
          ? 'border-[var(--brand-primary)] shadow-[inset_0_0_0_1px_var(--brand-primary)]'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]',
      )}
    >
      <input type="radio" name="niche" value={niche.slug} checked={checked} onChange={onSelect} className="sr-only" />
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-md',
          checked ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]' : 'bg-[var(--brand-50)] text-[var(--brand-700)] [[data-theme=dark]_&]:bg-[#151A33] [[data-theme=dark]_&]:text-[var(--brand-300)]',
        )}
      >
        <Icon name={niche.icon} size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-5 text-[var(--ink)]">{t(`niches.${niche.slug}`, niche.label)}</span>
        {!compact ? <span className="mt-1 block t-caption text-[var(--ink-muted)]">{niche.description}</span> : null}
        {!compact ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {niche.examples.map((e) => (
              <span key={e} className="rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-2 py-0.5 text-[11px] leading-4 text-[var(--brand-700)] [[data-theme=dark]_&]:border-[#262C45] [[data-theme=dark]_&]:bg-transparent [[data-theme=dark]_&]:text-[var(--brand-300)]">
                {e}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {checked ? <Icon name="approved" size={18} className="absolute right-3 top-3 text-[var(--brand-primary)]" label="✓" /> : null}
    </label>
  )
}
