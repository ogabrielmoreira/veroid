import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import type { OrgRole, Organization } from '@/features/org/useMemberships'
import { authErrorMessage } from '@/lib/authErrors'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { Switch } from './FlowEditor'

interface Settings { auto_approve?: boolean; qualified_min?: number; deposit_limit?: number; avg_ticket?: number; webhook_url?: string; dpo_email?: string; retention_days?: number }

export function RulesEditor({ org, role }: { org: Organization; role: OrgRole }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const s = org.settings as Settings
  const canEdit = role === 'owner'
  const [form, setForm] = useState({
    auto_approve: Boolean(s.auto_approve),
    qualified_min: String(s.qualified_min ?? 60),
    deposit_limit: String(s.deposit_limit ?? 10000),
    avg_ticket: String(s.avg_ticket ?? 2500),
    webhook_url: s.webhook_url ?? '',
    dpo_email: s.dpo_email ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const impact = useQuery({
    queryKey: ['impact', org.id],
    queryFn: async () => {
      const { data, error: err } = await supabase.rpc('auto_approve_impact', { p_organization_id: org.id })
      if (err) throw err
      return data as { total: number; low: number; review: number; high: number }
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const qmin = Number(form.qualified_min)
      if (!Number.isInteger(qmin) || qmin < 0 || qmin > 100) throw new Error(t('rules.errors.qualifiedMin'))
      if (form.webhook_url && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(form.webhook_url)) throw new Error(t('rules.errors.webhook'))
      const patch = {
        auto_approve: form.auto_approve, qualified_min: qmin,
        deposit_limit: Number(form.deposit_limit.replace(/\D/g, '')) || 0, avg_ticket: Number(form.avg_ticket.replace(/\D/g, '')) || 0,
        webhook_url: form.webhook_url.trim(), dpo_email: form.dpo_email.trim(),
      }
      const { error: err } = await supabase.rpc('update_org_settings', { p_organization_id: org.id, p_patch: patch })
      if (err) throw err
    },
    onSuccess: () => { setError(null); toast.show({ tone: 'success', title: t('rules.saved') }); void qc.invalidateQueries({ queryKey: ['memberships'] }) },
    onError: (e) => setError((e as Error).message && !(e as { code?: string }).code ? (e as Error).message : authErrorMessage(e, t)),
  })

  const test = useMutation({
    mutationFn: async () => {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch(`${env.basePath}/api/webhooks/test`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${sess.session?.access_token}` },
        body: JSON.stringify({ organization_id: org.id }),
      })
      const body = (await res.json().catch(() => ({}))) as { status?: number; error?: { message?: string } }
      if (!res.ok) throw new Error(body.error?.message ?? t('rules.testFail'))
      return body.status
    },
    onSuccess: (status) => toast.show({ tone: 'success', title: t('rules.testOk', { status }) }),
    onError: (e) => toast.show({ tone: 'error', title: (e as Error).message }),
  })

  const pct = (n: number) => (impact.data?.total ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format((100 * n) / impact.data.total) : '—')

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="error" live>{error}</Alert> : null}
      {!canEdit ? <Alert variant="neutral">{t('brand.readOnly')}</Alert> : null}
      <fieldset disabled={!canEdit} className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-2 lg:items-start">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
          <h2 className="t-h4 font-sans">{t('rules.decisionTitle')}</h2>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[14px] font-medium text-[var(--ink)]">{t('rules.autoApprove')}</p>
              <p className="m-0 mt-0.5 t-caption text-[var(--ink-muted)]">{t('rules.autoApproveHelp')}</p>
            </div>
            <Switch checked={form.auto_approve} onChange={() => setForm((f) => ({ ...f, auto_approve: !f.auto_approve }))} label={t('rules.autoApprove')} />
          </div>
          <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--n-50)] p-3 text-[13px] [[data-theme=dark]_&]:bg-[#0C1024]" aria-live="polite">
            {impact.data?.total ? (
              <p className="m-0 text-[var(--ink-body)]">{t(form.auto_approve ? 'rules.impactOn' : 'rules.impactOff', { low: pct(impact.data.low), review: pct(impact.data.review + impact.data.high), total: impact.data.total })}</p>
            ) : <p className="m-0 text-[var(--ink-muted)]">{t('rules.impactEmpty')}</p>}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InputField label={t('rules.avgTicket')} help={t('rules.avgTicketHelp')} inputMode="numeric" value={form.avg_ticket} onChange={(e) => setForm((f) => ({ ...f, avg_ticket: e.target.value }))} />
            {org.niche === 'automotive' ? (
              <InputField label={t('rules.depositLimit')} help={t('rules.depositLimitHelp')} inputMode="numeric" value={form.deposit_limit} onChange={(e) => setForm((f) => ({ ...f, deposit_limit: e.target.value }))} />
            ) : null}
          </div>
          <p className="m-0 mt-4 t-caption text-[var(--ink-muted)]">{t('rules.bandsNote')}</p>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
          <h2 className="t-h4 font-sans">{t('rules.qualifiedTitle')}</h2>
          <div className="mt-4 grid gap-4">
            <InputField label={t('rules.qualifiedMin')} help={t('rules.qualifiedMinHelp')} type="number" min={0} max={100} value={form.qualified_min} onChange={(e) => setForm((f) => ({ ...f, qualified_min: e.target.value }))} />
            <InputField label={t('rules.webhook')} optional help={t('rules.webhookHelp')} type="url" inputMode="url" placeholder="https://" value={form.webhook_url} onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))} />
            {s.webhook_url ? <Button variant="secondary" icon="send" loading={test.isPending} onClick={() => test.mutate()} className="self-start">{t('rules.testWebhook')}</Button> : null}
            <InputField label={t('rules.dpo')} optional help={t('rules.dpoHelp')} type="email" value={form.dpo_email} onChange={(e) => setForm((f) => ({ ...f, dpo_email: e.target.value }))} />
          </div>
        </section>
      </fieldset>
      {canEdit ? <div className="flex justify-end border-t border-[var(--border)] pt-6"><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></div> : null}
    </div>
  )
}
