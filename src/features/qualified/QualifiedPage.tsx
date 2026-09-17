import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { toCsv } from '@/features/links/csv'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { SkeletonBlock } from '@/features/setup/FlowEditor'
import { authErrorMessage } from '@/lib/authErrors'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { maskPhoneBr } from '@/lib/validators'

interface QualifiedRow {
  subject_id: string; name: string; marketing_opt_in_at: string | null; cpf_masked: string | null; session_id: string
  qualification_score: number; risk_score: number; verified_at: string | null; geo_uf: string | null; email: string | null; phone: string | null
  channel: string | null; bureau_band: 'low' | 'medium' | 'high' | null; bureau_checked_at: string | null
}

export function QualifiedPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const toast = useToast()
  const qc = useQueryClient()
  const { membership } = useCurrentOrg()
  const org = membership!.organization
  const canAct = membership!.role !== 'viewer'
  const settings = org.settings as { qualified_min?: number; webhook_url?: string }
  const [search, setSearch] = useState('')
  const [bureauFor, setBureauFor] = useState<QualifiedRow | null>(null)

  const q = useQuery({
    queryKey: ['qualified', org.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('qualified_subjects').select('*').eq('organization_id', org.id).order('qualification_score', { ascending: false }).limit(500)
      if (error) throw error
      return (data ?? []) as QualifiedRow[]
    },
  })

  const bureau = useMutation({
    mutationFn: async (row: QualifiedRow) => {
      const { data, error } = await supabase.rpc('run_bureau_check', { p_subject_id: row.subject_id, p_purpose: 'credit_analysis' })
      if (error) throw error
      return data as string
    },
    onSuccess: (band) => { setBureauFor(null); toast.show({ tone: 'success', title: t('qualified.bureauDone', { band: t(`qualified.bands.${band}`) }) }); void qc.invalidateQueries({ queryKey: ['qualified', org.id] }) },
    onError: (e) => toast.show({ tone: 'error', title: authErrorMessage(e, t) }),
  })

  const webhook = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch(`${env.basePath}/api/webhooks/qualified`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify({ organization_id: org.id }),
      })
      const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: { message?: string } }
      if (!res.ok) throw new Error(body.error?.message ?? t('qualified.webhookFail'))
      return body.sent ?? 0
    },
    onSuccess: (n) => toast.show({ tone: 'success', title: t('qualified.webhookSent', { count: n }) }),
    onError: (e) => toast.show({ tone: 'error', title: (e as Error).message }),
  })

  const rows = (q.data ?? []).filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
  const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'short' }).format(new Date(iso)) : '—')

  const exportCsv = async () => {
    // Somente campos cobertos pelo opt-in de marketing; sem CPF, sem score de crédito.
    const csv = toCsv(rows.map((r) => ({
      nome: r.name, email: r.email ?? '', celular: r.phone ? maskPhoneBr(r.phone) : '', uf: r.geo_uf ?? '',
      score_qualificacao: String(r.qualification_score), opt_in_em: r.marketing_opt_in_at ?? '', verificado_em: r.verified_at ?? '',
    })))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `clientes-qualificados-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    await supabase.rpc('log_audit', { p_organization_id: org.id, p_action: 'qualified.exported', p_target: 'qualified_subjects', p_after: { rows: rows.length, fields: ['nome', 'email', 'celular', 'uf', 'score_qualificacao', 'opt_in_em', 'verificado_em'] } })
    toast.show({ tone: 'success', title: t('qualified.exported', { count: rows.length }) })
  }

  const bandTone = { low: 'low', medium: 'review', high: 'high' } as const
  const bandIcon = { low: 'approved', medium: 'review', high: 'rejected' } as const

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="t-h1">{t('app.nav.qualified')}</h1>
          <p className="m-0 mt-2 max-w-[70ch] t-body text-[var(--ink-muted)]">{t('qualified.subtitle', { min: settings.qualified_min ?? 60 })}</p>
        </div>
        {canAct ? (
          <div className="flex flex-wrap gap-2">
            {settings.webhook_url ? <Button variant="secondary" icon="send" loading={webhook.isPending} disabled={!rows.length} onClick={() => webhook.mutate()}>{t('qualified.sendCrm')}</Button> : null}
            <Button icon="export" disabled={!rows.length} onClick={() => void exportCsv()}>{t('qualified.export')}</Button>
          </div>
        ) : null}
      </div>

      <Alert variant="info" title={t('qualified.howTitle')}>
        {t('qualified.howBody')}
        <details className="mt-2">
          <summary className="cursor-pointer font-medium text-[var(--link)]">{t('qualified.creditWhy')}</summary>
          <p className="m-0 mt-1">{t('qualified.creditWhyBody')}</p>
        </details>
      </Alert>

      <label className="relative block max-w-[360px]">
        <span className="sr-only">{t('qualified.search')}</span>
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('qualified.search')}
          className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] pl-10 pr-3 text-[16px] text-[var(--ink)] focus:border-[var(--brand-500)] focus:outline-none lg:h-10 lg:text-[14px]" />
      </label>

      {q.isLoading ? <SkeletonBlock /> : q.isError ? <Alert variant="error">{t('errors.generic')}</Alert> : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-[10px] border border-dashed border-[var(--border-strong)] bg-[var(--n-50)] px-[18px] py-[26px] text-center [[data-theme=dark]_&]:bg-transparent">
          <Icon name="users" size={30} className="text-[var(--brand-400)]" />
          <h2 className="mt-3 font-sans text-[14px] font-medium tracking-normal">{t('qualified.emptyTitle')}</h2>
          <p className="m-0 mt-1 max-w-[40ch] t-caption text-[var(--ink-muted)]">{t('qualified.emptyBody')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]">
          <table className="hidden w-full border-collapse text-left lg:table">
            <caption className="sr-only">{t('app.nav.qualified')}</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--n-50)] [[data-theme=dark]_&]:bg-[#151A33]">
                {[t('links.col.subject'), t('qualified.col.contact'), t('qualified.col.score'), t('qualified.col.verified'), t('qualified.col.bureau'), ''].map((h, i) => (
                  <th key={i} scope="col" className={`px-5 py-2.5 t-overline text-[var(--ink-muted)] ${i === 2 ? 'text-right' : ''}`}>{h || <span className="sr-only">{t('links.col.actions')}</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subject_id} className="border-b border-[var(--divider)] last:border-b-0 hover:bg-[var(--n-50)] [[data-theme=dark]_&]:hover:bg-[#151A33]">
                  <td className="max-w-0 px-5 py-3">
                    <Link to={`/app/sessoes/${r.session_id}`} className="block truncate text-[14px] font-medium text-[var(--ink)] hover:text-[var(--link)] hover:underline">{r.name}</Link>
                    <span className="t-caption text-[var(--ink-muted)]">{[r.geo_uf, t('qualified.optInOn', { date: fmtDate(r.marketing_opt_in_at) })].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="max-w-0 px-5 py-3 text-[13px] text-[var(--ink-body)]"><span className="block truncate">{r.email ?? (r.phone ? maskPhoneBr(r.phone) : '—')}</span></td>
                  <td className="w-[150px] px-5 py-3 text-right">
                    <span className="tabular text-[15px] font-semibold text-[var(--ink)]">{r.qualification_score}</span>
                    <span className="mt-1 ml-auto block h-1.5 w-20 overflow-hidden rounded-full bg-[var(--n-100)] [[data-theme=dark]_&]:bg-[#262C45]" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${r.qualification_score}%`, background: 'var(--brand-500)' }} />
                    </span>
                  </td>
                  <td className="tabular w-[120px] px-5 py-3 text-[13px] text-[var(--ink-muted)]">{fmtDate(r.verified_at)}</td>
                  <td className="w-[170px] px-5 py-3">{r.bureau_band ? <Chip tone={bandTone[r.bureau_band]} icon={bandIcon[r.bureau_band]}>{t(`qualified.bands.${r.bureau_band}`)}</Chip> : <span className="t-caption text-[var(--ink-muted)]">{t('qualified.notChecked')}</span>}</td>
                  <td className="w-[150px] px-5 py-2 text-right">{canAct ? <Button variant="ghost" icon="bank" onClick={() => setBureauFor(r)}>{t('qualified.check')}</Button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="m-0 list-none p-0 lg:hidden">
            {rows.map((r) => (
              <li key={r.subject_id} className="flex items-center gap-3 border-b border-[var(--divider)] p-4 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <Link to={`/app/sessoes/${r.session_id}`} className="block truncate text-[15px] text-[var(--ink)]">{r.name}</Link>
                  <p className="m-0 truncate t-caption text-[var(--ink-muted)]">{r.email ?? (r.phone ? maskPhoneBr(r.phone) : '—')}</p>
                </div>
                <span className="tabular text-[20px] font-semibold text-[var(--ink)]">{r.qualification_score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={Boolean(bureauFor)} onClose={() => setBureauFor(null)} icon="bank" title={t('qualified.bureauConfirmTitle')}
        description={t('qualified.bureauConfirmBodyName', { name: bureauFor?.name })}
        footer={<>
          <Button variant="secondary" onClick={() => setBureauFor(null)}>{t('common.cancel')}</Button>
          <Button loading={bureau.isPending} onClick={() => bureauFor && bureau.mutate(bureauFor)}>{t('qualified.runBureauConfirm')}</Button>
        </>} note={t('qualified.bureauNote')} />
    </div>
  )
}
