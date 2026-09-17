import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/components/ui/cn'
import type { Organization } from '@/features/org/useMemberships'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'
import { maskPhoneBr, onlyDigits } from '@/lib/validators'
import { CHANNEL_ICON, EXPIRY_OPTIONS, linkErrorMessage, linkUrl, validityLabel, type Channel } from './linkUtils'
import { LinkResult, type CreatedLink } from './LinkResult'

export function NewLinkModal({ open, onClose, org, prefill }: {
  open: boolean; onClose: () => void; org: Organization; prefill?: { name?: string; email?: string; reference?: string; channel?: Channel }
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [created, setCreated] = useState<CreatedLink | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = z.object({
    name: z.string().trim().min(2, t('links.validation.name')).max(120),
    channel: z.enum(['whatsapp', 'sms', 'email', 'qr']),
    phone: z.string().optional(),
    email: z.string().trim().optional(),
    reference: z.string().trim().max(80).optional(),
    expires: z.string(),
  }).superRefine((v, ctx) => {
    const d = onlyDigits(v.phone ?? '')
    if ((v.channel === 'whatsapp' || v.channel === 'sms') && d.length < 10) ctx.addIssue({ code: 'custom', path: ['phone'], message: t('links.validation.phone') })
    if (d.length > 0 && (d.length < 10 || d.length > 11)) ctx.addIssue({ code: 'custom', path: ['phone'], message: t('links.validation.phone') })
    if (v.channel === 'email' && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: t('links.validation.emailRequired') })
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: t('auth.validation.emailInvalid') })
  })
  type Values = z.infer<typeof schema>

  const { register, control, handleSubmit, watch, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { name: prefill?.name ?? '', channel: prefill?.channel ?? 'whatsapp', phone: '', email: prefill?.email ?? '', reference: prefill?.reference ?? '', expires: '24' },
  })
  const channel = watch('channel')
  const { errors, isSubmitting } = formState

  const close = () => {
    setCreated(null)
    setServerError(null)
    reset()
    onClose()
  }

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const hours = Number(v.expires)
    const { data, error } = await supabase.rpc('create_verification_link', {
      p_organization_id: org.id,
      p_subject_name: v.name,
      p_channel: v.channel,
      p_phone: onlyDigits(v.phone ?? '') || null,
      p_email: v.email || null,
      p_reference: v.reference || null,
      p_expires_hours: hours,
    })
    if (error) return setServerError(linkErrorMessage(error, t) ?? authErrorMessage(error, t))
    const row = (data as Array<{ link_id: string; token: string; expires_at: string }>)[0]
    setCreated({ id: row.link_id, url: linkUrl(row.token), expiresAt: row.expires_at, hours, name: v.name, phone: onlyDigits(v.phone ?? '') || null, email: v.email || null, channel: v.channel })
    void qc.invalidateQueries({ queryKey: ['links', org.id] })
  }

  const channels: Channel[] = ['whatsapp', 'sms', 'email', 'qr']

  return (
    <Modal open={open} onClose={close} icon={created ? 'approved' : 'send'} size="md"
      title={created ? t('links.createdTitle') : t('links.new')}
      description={created ? t('links.createdBody', { name: created.name.split(' ')[0] }) : t('links.newHelp')}
      footer={created ? <Button onClick={close}>{t('common.done')}</Button> : (
        <>
          <Button variant="secondary" onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" form="new-link-form" loading={isSubmitting} icon="send">{t('links.submit')}</Button>
        </>
      )}
      note={created ? t('links.tokenOnce') : undefined}
    >
      {created ? <LinkResult link={created} org={org} /> : (
        <form id="new-link-form" noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {serverError ? <Alert variant="error" live>{serverError}</Alert> : null}
          <InputField label={t('links.fields.name')} autoComplete="off" error={errors.name?.message} data-autofocus {...register('name')} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="t-label mb-1.5 text-[var(--ink)]">{t('links.fields.channel')}</legend>
            <Controller control={control} name="channel" render={({ field }) => (
              <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {channels.map((c) => (
                  <label key={c} className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border px-2 text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]',
                    field.value === c ? 'border-[var(--brand-primary)] font-medium text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--brand-primary)]' : 'border-[var(--border-strong)] text-[var(--ink-body)]',
                  )}>
                    <input type="radio" className="sr-only" name={field.name} value={c} checked={field.value === c} onChange={() => field.onChange(c)} />
                    <Icon name={CHANNEL_ICON[c]} size={18} />
                    {t(`links.channel.${c}`)}
                  </label>
                ))}
              </div>
            )} />
            {channel === 'sms' || channel === 'email' ? <p className="m-0 mt-2 t-caption text-[var(--ink-muted)]">{t('links.simulatedChannel')}</p> : null}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller control={control} name="phone" render={({ field }) => (
              <InputField label={t('links.fields.phone')} optional={channel === 'email' || channel === 'qr'} type="tel" inputMode="tel" autoComplete="off"
                placeholder="(11) 98765-4321" error={errors.phone?.message} value={field.value} onBlur={field.onBlur}
                onChange={(e) => field.onChange(maskPhoneBr(e.target.value))} className="tabular" />
            )} />
            <InputField label={t('auth.fields.email')} optional={channel !== 'email'} type="email" inputMode="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <InputField label={t('links.fields.reference')} optional help={t('links.fields.referenceHelp')} {...register('reference')} />
            <SelectField label={t('links.fields.expires')} {...register('expires')}>
              {EXPIRY_OPTIONS.map((h) => <option key={h} value={h}>{validityLabel(h, t)}</option>)}
            </SelectField>
          </div>
        </form>
      )}
    </Modal>
  )
}
