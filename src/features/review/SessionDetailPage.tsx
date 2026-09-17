import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Field'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Menu } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/features/auth/AuthProvider'
import { linkUrl, smsMessage } from '@/features/links/linkUtils'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { CopyField } from '@/features/setup/TeamEditor'
import { SkeletonBlock } from '@/features/setup/FlowEditor'
import { authErrorMessage } from '@/lib/authErrors'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { BAND_META, DecisionChip, RiskChip, ScoreBar, type RiskBand } from './riskUi'

interface Detail {
  can_review: boolean
  session: { id: string; status: string; decision: 'pending' | 'approved' | 'rejected'; decision_reason: string | null; decided_at: string | null; decided_by: string | null
    risk_score: number | null; risk_band: RiskBand | null; qualification_score: number | null; analysis_source: 'rules' | 'rules+ai' | null
    ai_verdict: { verdict: string; confidence: number; explanation_pt?: string; reason?: string; model?: string } | null
    started_at: string; submitted_at: string | null; geo_uf: string | null; capture_attempts: number; user_agent: string | null; consent_version: string | null }
  link: { id: string; channel: string; reference: string | null; subject_name: string; created_at: string; phone_masked: string | null } | null
  subject: { id: string; name: string; data: Record<string, string>; marketing_opt_in: boolean; marketing_opt_in_at: string | null } | null
  signals: Array<{ code: string; label: string; weight: number; source: 'browser' | 'ai' | 'data'; forces_review: boolean }>
  events: Array<{ type: string; payload: Record<string, unknown>; at: string }>
  consents: Array<{ type: string; version: string; at: string }>
  media: Array<{ kind: 'selfie' | 'doc_front' | 'doc_back'; path: string; delete_after: string }>
  notes: Array<{ id: string; body: string; at: string; author: string | null }>
  audit: Array<{ action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; at: string; actor: string | null }>
  bureau: { band: 'low' | 'medium' | 'high'; at: string } | null
}

const REJECT_REASONS = ['screen', 'face', 'data', 'mule', 'other'] as const
const SOURCE_ICON: Record<string, IconName> = { browser: 'capture', ai: 'sparkle', data: 'evidence' }

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const toast = useToast()
  const qc = useQueryClient()
  const { membership } = useCurrentOrg()
  const org = membership!.organization

  const q = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_session_detail', { p_session_id: id })
      if (error) throw error
      return data as Detail
    },
  })

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [reasonText, setReasonText] = useState('')
  const [ackAgainst, setAckAgainst] = useState(false)
  const [note, setNote] = useState('')
  const [recapture, setRecapture] = useState<string | null>(null)
  const [bureauOpen, setBureauOpen] = useState(false)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['session', id] })
    void qc.invalidateQueries({ queryKey: ['queue'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['sessions'] })
  }
  const onErr = (e: unknown) => toast.show({ tone: 'error', title: authErrorMessage(e, t) })

  const decide = useMutation({
    mutationFn: async ({ decision, why }: { decision: 'approved' | 'rejected'; why: string | null }) => {
      const { error } = await supabase.rpc('decide_session', { p_session_id: id, p_decision: decision, p_reason: why })
      if (error) throw error
      return decision
    },
    onSuccess: (decision) => {
      setApproveOpen(false); setRejectOpen(false); setReason(''); setReasonText(''); setAckAgainst(false)
      toast.show({ tone: 'success', title: t(decision === 'approved' ? 'review.approvedToast' : 'review.rejectedToast') })
      refresh()
    },
    onError: onErr,
  })
  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('add_session_note', { p_session_id: id, p_body: note })
      if (error) throw error
    },
    onSuccess: () => { setNote(''); refresh() },
    onError: onErr,
  })
  const newCapture = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('request_new_capture', { p_session_id: id })
      if (error) throw error
      return (data as Array<{ token: string }>)[0].token
    },
    onSuccess: (token) => { setRecapture(linkUrl(token)); refresh() },
    onError: onErr,
  })
  const reanalyze = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reanalyze_session', { p_session_id: id })
      if (error) throw error
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch(`${env.basePath}/api/analyze`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify({ session_id: id }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      return res as { status?: string } | null
    },
    onSuccess: (r) => {
      toast.show({ tone: 'info', title: r?.status === 'analyzed' ? t('review.reanalyzedAi') : t('review.reanalyzedRules') })
      refresh()
    },
    onError: onErr,
  })
  const bureau = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('run_bureau_check', { p_subject_id: q.data!.subject!.id, p_purpose: 'credit_analysis' })
      if (error) throw error
      return data as string
    },
    onSuccess: () => { setBureauOpen(false); refresh() },
    onError: onErr,
  })

  if (q.isLoading) return <div className="flex flex-col gap-4"><SkeletonBlock /><SkeletonBlock /></div>
  if (q.isError || !q.data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-6">
        <Icon name="rejected" size={24} className="text-[var(--risk-high-ink)]" />
        <p className="m-0 text-[14px] font-semibold text-[var(--risk-high-ink)]">{t('review.notFound')}</p>
        <Link to="/app/revisao" className="text-[13px] font-medium text-[var(--link)] underline">{t('review.backToQueue')}</Link>
      </div>
    )
  }

  const d = q.data
  const s = d.session
  const band = s.risk_band
  const data = d.subject?.data ?? {}
  const age = data.birth_date ? Math.floor((Date.now() - new Date(data.birth_date).getTime()) / 3.15576e10) : null
  const fmt = (iso: string) => new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const decided = s.decision !== 'pending'
  const againstAi = band === 'high'
  const reasonLabel = reason === 'other' ? reasonText.trim() : reason ? t(`review.reasons.${reason}`) : ''
  const canReject = Boolean(reason) && (reason !== 'other' || reasonText.trim().length >= 3)

  const checks: Array<{ ok: boolean | null; label: string }> = [
    { ok: data.cpf_masked ? true : null, label: data.cpf_masked ? t('review.checks.cpfValid', { cpf: data.cpf_masked }) : t('review.checks.cpfMissing') },
    { ok: age === null ? null : age >= 18, label: age === null ? t('review.checks.ageUnknown') : t('review.checks.age', { age }) },
    { ok: !d.signals.some((x) => x.code === 'cpf_name_mismatch'), label: t('review.checks.nameConsistent') },
    { ok: !d.signals.some((x) => x.code === 'device_multi_cpf'), label: t('review.checks.device') },
    { ok: d.consents.some((c) => c.type === 'biometric'), label: t('review.checks.consent', { version: s.consent_version ?? '—' }) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t('review.breadcrumb')} className="t-caption text-[var(--ink-muted)]">
        <Link to="/app/revisao" className="inline-flex min-h-10 items-center gap-1 hover:text-[var(--ink)] hover:underline"><Icon name="arrowLeft" size={16} />{t('app.nav.review')}</Link>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 t-overline text-[var(--ink-muted)]">{t('review.session')} · {s.submitted_at ? fmt(s.submitted_at) : '—'}</p>
          <h1 className="mt-1 break-words t-h1">{d.subject?.name ?? d.link?.subject_name ?? '—'}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <RiskChip band={band} />
            <DecisionChip decision={s.decision} auto={s.decision === 'approved' && !s.decided_by} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-[11px] py-[5px] text-[12px] text-[var(--ink-muted)]">
              <Icon name={s.analysis_source === 'rules+ai' ? 'sparkle' : 'evidence'} size={16} />{t(`review.source.${s.analysis_source ?? 'rules'}`)}
            </span>
          </div>
        </div>
        {d.can_review ? (
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="secondary" icon="rejected" onClick={() => setRejectOpen(true)}>{decided && s.decision === 'rejected' ? t('review.rejectAgain') : t('review.reject')}</Button>
            <Button icon="approved" onClick={() => setApproveOpen(true)} disabled={s.decision === 'approved'}>{t('review.approve')}</Button>
            <Menu label={t('review.moreActions')} items={[
              { label: t('review.newCapture'), icon: 'capture', onSelect: () => newCapture.mutate() },
              { label: t('review.reanalyze'), icon: 'refresh', onSelect: () => reanalyze.mutate() },
            ]} />
          </div>
        ) : null}
      </header>

      {decided ? (
        <Alert variant={s.decision === 'approved' ? 'success' : 'error'} title={t(`review.decidedTitle.${s.decision}`, { who: s.decided_by ?? t('review.autoRule'), date: s.decided_at ? fmt(s.decided_at) : '' })}>
          {s.decision_reason ?? (s.decided_by ? t('review.noReason') : t('review.autoBody'))}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title={t('review.evidence')} icon="capture">
            {!d.can_review ? <Alert variant="neutral">{t('review.viewerMedia')}</Alert>
              : d.media.length === 0 ? <p className="m-0 t-caption text-[var(--ink-muted)]">{t('review.noMedia')}</p>
              : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['selfie', 'doc_front', 'doc_back'] as const).map((kind) => {
                    const m = d.media.find((x) => x.kind === kind)
                    return m ? <SignedImage key={kind} sessionId={id} kind={kind} path={m.path} deleteAfter={m.delete_after} /> : null
                  })}
                </div>
              )}
            <p className="m-0 mt-3 t-caption text-[var(--ink-muted)]">{t('review.mediaNote')}</p>
          </Card>

          <Card title={t('review.timeline')} icon="pending">
            <ol className="m-0 flex list-none flex-col p-0">
              {d.events.map((e, i) => (
                <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < d.events.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-[var(--border)]" aria-hidden="true" /> : null}
                  <span className={cn('z-[1] mt-1 size-[15px] shrink-0 rounded-full border-2',
                    /denied|failed|not_found|not_readable|unavailable/.test(e.type) ? 'border-[var(--risk-review)] bg-[var(--risk-review-bg)]'
                      : e.type === 'submitted' ? 'border-[var(--risk-low)] bg-[var(--risk-low-bg)]' : 'border-[var(--brand-400)] bg-[var(--surface)]')} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] text-[var(--ink)]">{t(`events.${e.type}`, { defaultValue: e.type, ...stringifyPayload(e.payload) })}</p>
                    <time dateTime={e.at} className="tabular t-caption text-[var(--ink-muted)]">{new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(e.at))}</time>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="copilot-title" className="rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] p-[22px]"
            style={{ borderColor: band ? `color-mix(in oklab, ${BAND_META[band].color} 35%, transparent)` : 'var(--border)' }}>
            <h2 id="copilot-title" className="flex items-center gap-2 t-h4 font-sans"><Icon name="sparkle" size={20} className="text-[var(--brand-500)]" />{t('review.copilot')}</h2>
            <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('review.copilotHint')}</p>
            <div className="mt-4"><ScoreBar score={s.risk_score} band={band} /></div>
            {s.ai_verdict ? (
              <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--n-50)] p-3 [[data-theme=dark]_&]:bg-[#0C1024]">
                <p className="m-0 text-[13px] font-semibold text-[var(--ink)]">
                  {t(`review.verdict.${s.ai_verdict.verdict}`, s.ai_verdict.verdict)}
                  <span className="ml-2 tabular font-normal text-[var(--ink-muted)]">{t('review.confidence', { value: Math.round((s.ai_verdict.confidence ?? 0) * 100) })}</span>
                </p>
                {s.ai_verdict.explanation_pt ? <p className="m-0 mt-1 text-[13px] leading-[1.55] text-[var(--ink-body)]">{s.ai_verdict.explanation_pt}</p> : null}
              </div>
            ) : null}
            <h3 className="mt-5 font-sans text-[13px] font-semibold tracking-normal text-[var(--ink)]">{t('review.signals')}</h3>
            {d.signals.filter((x) => x.weight > 0 || x.code === 'ai_not_run').length === 0 ? (
              <p className="m-0 mt-2 t-caption text-[var(--ink-muted)]">{t('review.noSignals')}</p>
            ) : (
              <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                {d.signals.map((x) => (
                  <li key={x.code} className="flex items-start gap-2.5 text-[13px]">
                    <Icon name={SOURCE_ICON[x.source]} size={16} className="mt-0.5 shrink-0 text-[var(--ink-muted)]" label={t(`review.sourceShort.${x.source}`)} />
                    <span className="min-w-0 flex-1 text-[var(--ink-body)]">
                      {t(`signals.${x.code}`, x.label)}
                      {x.forces_review ? <span className="ml-1.5 t-caption text-[var(--risk-review-ink)]">· {t('flow.forcesReview')}</span> : null}
                    </span>
                    <span className="tabular shrink-0 font-semibold text-[var(--ink)]">{x.weight > 0 ? `+${Math.round(x.weight * 100)}` : '0'}</span>
                  </li>
                ))}
              </ul>
            )}
            <Alert variant="neutral" className="mt-4">{t('review.humanDecides')} {t('honesty')}</Alert>
          </section>

          <Card title={t('review.dataChecks')} icon="subject">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-[13px] text-[var(--ink-body)]">
                  <Icon name={c.ok === null ? 'unknown' : c.ok ? 'approved' : 'review'} size={16}
                    className={cn('mt-0.5 shrink-0', c.ok === null ? 'text-[var(--risk-unknown)]' : c.ok ? 'text-[var(--risk-low)]' : 'text-[var(--risk-review)]')} />
                  {c.label}
                </li>
              ))}
            </ul>
            {d.can_review ? (
              <dl className="m-0 mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 border-t border-[var(--divider)] pt-3 text-[13px]">
                {Object.entries(data).filter(([k]) => !['cpf_masked'].includes(k)).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="py-1 text-[var(--ink-muted)]">{t(`fieldLabels.${k}`, k)}</dt>
                    <dd className="m-0 break-words py-1 text-right text-[var(--ink)] tabular">{k === 'birth_date' ? new Date(`${v}T12:00:00`).toLocaleDateString(lang) : v}</dd>
                  </div>
                ))}
                <dt className="py-1 text-[var(--ink-muted)]">{t('review.channel')}</dt>
                <dd className="m-0 py-1 text-right text-[var(--ink)]">{d.link ? t(`links.channel.${d.link.channel}`) : '—'}{d.link?.phone_masked ? ` · ${d.link.phone_masked}` : ''}</dd>
                <dt className="py-1 text-[var(--ink-muted)]">UF</dt>
                <dd className="m-0 py-1 text-right text-[var(--ink)]">{s.geo_uf ?? '—'}</dd>
                <dt className="py-1 text-[var(--ink-muted)]">{t('review.marketing')}</dt>
                <dd className="m-0 py-1 text-right text-[var(--ink)]">{d.subject?.marketing_opt_in ? t('review.optInYes') : t('review.optInNo')}</dd>
              </dl>
            ) : null}
          </Card>

          {d.can_review && d.subject && s.decision === 'approved' ? (
            <Card title={t('qualified.bureauTitle')} icon="bank">
              {d.bureau ? (
                <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-[var(--ink-body)]">
                  {t('qualified.bureauResult')} <strong className="text-[var(--ink)]">{t(`qualified.bands.${d.bureau.band}`)}</strong>
                  <span className="t-caption text-[var(--ink-muted)]">· {fmt(d.bureau.at)}</span>
                </p>
              ) : <p className="m-0 t-caption text-[var(--ink-muted)]">{t('qualified.bureauNone')}</p>}
              <Button variant="secondary" className="mt-3" icon="bank" onClick={() => setBureauOpen(true)}>{t('qualified.runBureau')}</Button>
            </Card>
          ) : null}

          {d.can_review ? (
            <Card title={t('review.notes')} icon="evidence">
              {d.notes.length ? (
                <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0">
                  {d.notes.map((n) => (
                    <li key={n.id} className="rounded-[var(--radius-md)] bg-[var(--n-50)] p-3 text-[13px] [[data-theme=dark]_&]:bg-[#0C1024]">
                      <p className="m-0 whitespace-pre-wrap text-[var(--ink-body)]">{n.body}</p>
                      <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{n.author ?? '—'} · {fmt(n.at)}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label htmlFor="note" className="t-label text-[var(--ink)]">{t('review.addNote')}</label>
              <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
                className="mt-1.5 block w-full rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-[14px] text-[var(--ink)] focus:border-[var(--brand-500)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(71,86,201,.18)]" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="tabular t-caption text-[var(--ink-muted)]">{note.length}/1000</span>
                <Button variant="secondary" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>{t('review.saveNote')}</Button>
              </div>
            </Card>
          ) : null}

          {d.can_review && d.audit.length ? (
            <Card title={t('review.audit')} icon="shield">
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {d.audit.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 border-b border-[var(--divider)] pb-2 text-[13px] last:border-b-0 last:pb-0">
                    <span className="min-w-0 text-[var(--ink-body)]">
                      <strong className="font-medium text-[var(--ink)]">{a.actor ?? t('review.system')}</strong> · {t(`audit.${a.action}`, a.action)}
                      {a.after && 'reason' in a.after && a.after.reason ? <span className="block t-caption text-[var(--ink-muted)]">“{String(a.after.reason)}”</span> : null}
                    </span>
                    <time dateTime={a.at} className="tabular shrink-0 t-caption text-[var(--ink-muted)]">{fmt(a.at)}</time>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} icon="approved" title={t('review.approveTitle')}
        description={againstAi ? t('review.approveAgainst', { score: s.risk_score }) : t('review.approveBody')}
        footer={<>
          <Button variant="secondary" onClick={() => setApproveOpen(false)}>{t('common.cancel')}</Button>
          <Button icon="approved" loading={decide.isPending} disabled={againstAi && !ackAgainst}
            onClick={() => decide.mutate({ decision: 'approved', why: reasonText.trim() || null })}>{t('review.approve')}</Button>
        </>}
        note={againstAi && !ackAgainst ? t('review.ackNeeded') : t('review.auditNote')}>
        <div className="flex flex-col gap-4">
          {againstAi ? <Checkbox label={t('review.ackAgainst')} checked={ackAgainst} onChange={(e) => setAckAgainst(e.target.checked)} /> : null}
          <label className="flex flex-col gap-1.5">
            <span className="t-label text-[var(--ink)]">{t('review.approveNote')} <span className="font-normal text-[var(--ink-muted)]">({t('common.optional')})</span></span>
            <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={2} maxLength={300}
              className="block w-full rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-[14px] text-[var(--ink)] focus:border-[var(--brand-500)] focus:outline-none" />
          </label>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} icon="rejected" iconTone="danger" title={t('review.rejectTitle')} description={t('review.rejectBody')}
        footer={<>
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" loading={decide.isPending} disabled={!canReject} onClick={() => decide.mutate({ decision: 'rejected', why: reasonLabel })}>{t('review.reject')}</Button>
        </>}
        note={canReject ? t('review.auditNote') : t('review.reasonNeeded')}>
        <fieldset className="m-0 border-0 p-0">
          <legend className="t-label mb-2 text-[var(--ink)]">{t('links.cancelReasonLabel')}</legend>
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2 hover:bg-[var(--n-50)] [[data-theme=dark]_&]:hover:bg-[#262C45]">
              <input type="radio" name="reject-reason" checked={reason === r} onChange={() => setReason(r)} className="size-[18px] accent-[var(--brand-800)]" />
              <span className="text-[14px] text-[var(--ink-body)]">{t(`review.reasons.${r}`)}</span>
            </label>
          ))}
          {reason === 'other' ? (
            <textarea aria-label={t('review.reasons.other')} value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={2} maxLength={300} autoFocus
              className="mt-2 block w-full rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-[14px] text-[var(--ink)] focus:border-[var(--brand-500)] focus:outline-none" />
          ) : null}
        </fieldset>
      </Modal>

      <Modal open={Boolean(recapture)} onClose={() => setRecapture(null)} icon="capture" title={t('review.newCaptureTitle')} description={t('review.newCaptureBody')}
        footer={<Button onClick={() => setRecapture(null)}>{t('common.done')}</Button>} note={t('links.tokenOnce')}>
        {recapture ? (
          <div className="flex flex-col gap-4">
            <CopyField label={t('links.url')} value={recapture} />
            <div className="rounded-[var(--radius-md)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-[14px] text-[13px] text-[var(--ink-body)] [[data-theme=dark]_&]:border-[#262C45] [[data-theme=dark]_&]:bg-[#0C1024]">
              {smsMessage({ org: org.name, name: d.link?.subject_name ?? '', niche: org.niche, url: recapture, hours: 24, t })}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={bureauOpen} onClose={() => setBureauOpen(false)} icon="bank" title={t('qualified.bureauConfirmTitle')} description={t('qualified.bureauConfirmBody')}
        footer={<>
          <Button variant="secondary" onClick={() => setBureauOpen(false)}>{t('common.cancel')}</Button>
          <Button loading={bureau.isPending} onClick={() => bureau.mutate()}>{t('qualified.runBureauConfirm')}</Button>
        </>} note={t('qualified.bureauNote')} />
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
      <h2 className="mb-4 flex items-center gap-2 t-h4 font-sans"><Icon name={icon} size={20} className="text-[var(--ink-muted)]" />{title}</h2>
      {children}
    </section>
  )
}

function stringifyPayload(p: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]))
}

/** Imagem por URL assinada de 5 minutos, com marca d'água do analista e registro de visualização (§5.6). */
function SignedImage({ sessionId, kind, path, deleteAfter }: { sessionId: string; kind: string; path: string; deleteAfter: string }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!revealed) return
    let timer: number | undefined
    const load = async () => {
      const { data, error: err } = await supabase.storage.from('media').createSignedUrl(path, 300)
      if (err || !data) { setError(true); return }
      setUrl(data.signedUrl)
      timer = window.setTimeout(() => setUrl(null), 290_000)
    }
    void load()
    void supabase.rpc('log_media_view', { p_session_id: sessionId, p_kind: kind })
    return () => window.clearTimeout(timer)
  }, [revealed, path, sessionId, kind])

  const who = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''
  const stamp = `${who} · ${new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`

  return (
    <figure className="m-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] bg-[#10142B]">
        {!revealed ? (
          <button type="button" onClick={() => setRevealed(true)} className="grid h-full w-full place-items-center p-4 text-center text-[#DDE1F6]">
            <span><Icon name="eye" size={24} className="mx-auto" /><span className="mt-2 block text-[13px] font-medium">{t('review.reveal')}</span><span className="mt-1 block t-caption text-[#9198B5]">{t('review.revealNote')}</span></span>
          </button>
        ) : error ? (
          <p className="m-0 grid h-full place-items-center p-4 text-center text-[13px] text-[#FFB4AC]">{t('review.mediaError')}</p>
        ) : url ? (
          <>
            <img src={url} alt={t(`review.media.${kind}`)} className={cn('h-full w-full object-cover', kind === 'selfie' && '-scale-x-100')} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-around overflow-hidden opacity-40">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="-rotate-[24deg] whitespace-nowrap text-center text-[12px] font-semibold text-white [text-shadow:0_0_2px_#000]">{stamp} · {stamp}</span>
              ))}
            </div>
          </>
        ) : (
          <button type="button" onClick={() => { setRevealed(false); requestAnimationFrame(() => setRevealed(true)) }} className="grid h-full w-full place-items-center text-[13px] text-[#DDE1F6]">
            {t('review.expiredUrl')}
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 flex justify-between gap-2 t-caption text-[var(--ink-muted)]">
        <span>{t(`review.media.${kind}`)}</span>
        <span>{t('review.deletesOn', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(new Date(deleteAfter)) })}</span>
      </figcaption>
    </figure>
  )
}
