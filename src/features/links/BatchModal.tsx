import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import type { Organization } from '@/features/org/useMemberships'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'
import { maskPhoneBr, onlyDigits } from '@/lib/validators'
import { CSV_TEMPLATE, parseCsv, toCsv, validateRows, type BatchRow } from './csv'
import { EXPIRY_OPTIONS, linkErrorMessage, linkUrl, smsMessage, validityLabel, type Channel } from './linkUtils'

const MAX_ROWS = 200
interface Result { index: number; name: string; url?: string; error?: string }

function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function BatchModal({ open, onClose, org }: { open: boolean; onClose: () => void; org: Organization }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<BatchRow[]>([])
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [hours, setHours] = useState(24)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)

  const parsed = useMemo(() => validateRows(rows, channel), [rows, channel])
  const valid = parsed.filter((r) => r.errors.length === 0)
  const invalid = parsed.length - valid.length

  const reset = () => { setFileName(null); setRows([]); setError(null); setResults(null) }
  const close = () => { reset(); onClose() }

  const onFile = async (file: File) => {
    reset()
    if (file.size > 1024 * 1024) return setError(t('links.batchErrors.fileSize'))
    const text = await file.text()
    const { rows: r, missingName } = parseCsv(text)
    if (missingName) return setError(t('links.batchErrors.missingName'))
    if (r.length === 0) return setError(t('links.batchErrors.empty'))
    if (r.length > MAX_ROWS) return setError(t('links.batchErrors.tooMany', { max: MAX_ROWS, count: r.length }))
    setFileName(file.name)
    setRows(r)
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const payload = valid.map((r) => ({ name: r.name, phone: onlyDigits(r.phone) || null, email: r.email || null, reference: r.reference || null }))
    const { data, error: err } = await supabase.rpc('create_verification_links_batch', { p_organization_id: org.id, p_rows: payload, p_channel: channel, p_expires_hours: hours })
    setSubmitting(false)
    if (err) return setError(linkErrorMessage(err, t) ?? authErrorMessage(err, t))
    const out = (data as Array<{ row_index: number; token: string | null; error: string | null }>).map((d) => ({
      index: valid[d.row_index].index,
      name: valid[d.row_index].name,
      url: d.token ? linkUrl(d.token) : undefined,
      error: d.error ? (linkErrorMessage({ message: d.error }, t) ?? t('errors.generic')) : undefined,
    }))
    setResults(out)
    void qc.invalidateQueries({ queryKey: ['links', org.id] })
  }

  const downloadResults = () => {
    if (!results) return
    download(`veroid-links-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(results.map((r) => {
      const src = parsed[r.index]
      return {
        nome: r.name, celular: src.phone, email: src.email, referencia: src.reference,
        link: r.url ?? '', mensagem: r.url ? smsMessage({ org: org.name, name: r.name, niche: org.niche, url: r.url, hours, t }) : '', erro: r.error ?? '',
      }
    })))
  }

  const ok = results?.filter((r) => r.url).length ?? 0

  return (
    <Modal open={open} onClose={close} size="lg" icon="upload"
      title={results ? t('links.batchDoneTitle', { count: ok }) : t('links.batch')}
      description={results ? t('links.batchDoneBody') : t('links.batchHelp', { max: MAX_ROWS })}
      footer={results ? (
        <>
          <Button variant="secondary" onClick={close}>{t('common.close')}</Button>
          <Button icon="export" onClick={downloadResults}>{t('links.downloadResults')}</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={close}>{t('common.cancel')}</Button>
          <Button icon="send" loading={submitting} disabled={valid.length === 0} onClick={submit}>{t('links.batchSubmit', { count: valid.length })}</Button>
        </>
      )}
      note={results ? t('links.tokenOnce') : valid.length === 0 && rows.length > 0 ? t('links.batchNoValid') : undefined}
    >
      {results ? (
        <div className="max-h-[50vh] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[var(--n-50)] [[data-theme=dark]_&]:bg-[#151A33]">
              <tr>
                <th className="px-4 py-2.5 t-overline text-[var(--ink-muted)]">#</th>
                <th className="px-4 py-2.5 t-overline text-[var(--ink-muted)]">{t('links.col.subject')}</th>
                <th className="px-4 py-2.5 t-overline text-[var(--ink-muted)]">{t('links.col.result')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.index} className="border-t border-[var(--divider)]">
                  <td className="tabular px-4 py-2.5 text-[var(--ink-muted)]">{r.index + 2}</td>
                  <td className="px-4 py-2.5 text-[var(--ink)]">{r.name}</td>
                  <td className="px-4 py-2.5">
                    {r.url ? <span className="inline-flex items-center gap-1.5 text-[var(--risk-low-ink)]"><Icon name="approved" size={16} />{t('links.batchCreated')}</span>
                      : <span className="inline-flex items-center gap-1.5 text-[var(--risk-high-ink)]"><Icon name="rejected" size={16} />{r.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error ? <Alert variant="error" live>{error}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--n-50)] p-4 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus-ring)] [[data-theme=dark]_&]:bg-transparent">
              <Icon name="upload" size={24} className="text-[var(--brand-400)]" />
              <span className="text-[14px] font-medium text-[var(--ink)]">{fileName ?? t('links.chooseCsv')}</span>
              <span className="t-caption text-[var(--ink-muted)]">{t('links.csvColumns')}</span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
            </label>
            <Button variant="ghost" icon="export" onClick={() => download('modelo-veroid.csv', CSV_TEMPLATE)} className="self-center">{t('links.template')}</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={t('links.fields.channel')} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {(['whatsapp', 'sms', 'email', 'qr'] as const).map((c) => <option key={c} value={c}>{t(`links.channel.${c}`)}</option>)}
            </SelectField>
            <SelectField label={t('links.fields.expires')} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map((h) => <option key={h} value={h}>{validityLabel(h, t)}</option>)}
            </SelectField>
          </div>

          {parsed.length > 0 ? (
            <div>
              <p className="m-0 mb-2 flex flex-wrap gap-3 text-[13px]" aria-live="polite">
                <span className="inline-flex items-center gap-1.5 text-[var(--risk-low-ink)]"><Icon name="approved" size={16} />{t('links.validRows', { count: valid.length })}</span>
                {invalid ? <span className="inline-flex items-center gap-1.5 text-[var(--risk-high-ink)]"><Icon name="review" size={16} />{t('links.invalidRows', { count: invalid })}</span> : null}
              </p>
              <div className="max-h-[36vh] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                <table className="w-full border-collapse text-left text-[13px]">
                  <caption className="sr-only">{t('links.previewRows')}</caption>
                  <thead className="sticky top-0 bg-[var(--n-50)] [[data-theme=dark]_&]:bg-[#151A33]">
                    <tr>
                      {['#', t('links.col.subject'), t('links.fields.phone'), t('auth.fields.email'), t('links.col.check')].map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 t-overline text-[var(--ink-muted)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr key={r.index} className="border-t border-[var(--divider)] align-top">
                        <td className="tabular px-3 py-2 text-[var(--ink-muted)]">{r.index + 2}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-[var(--ink)]">{r.name || '—'}</td>
                        <td className="tabular whitespace-nowrap px-3 py-2">{r.phone ? maskPhoneBr(r.phone) : '—'}</td>
                        <td className="max-w-[180px] truncate px-3 py-2">{r.email || '—'}</td>
                        <td className="px-3 py-2">
                          {r.errors.length === 0
                            ? <span className="inline-flex items-center gap-1 text-[var(--risk-low-ink)]"><Icon name="approved" size={16} />{t('links.ok')}</span>
                            : <span className="flex flex-col gap-0.5 text-[var(--risk-high-ink)]">{r.errors.map((e) => <span key={e} className="inline-flex items-start gap-1"><Icon name="review" size={16} className="shrink-0" />{t(e)}</span>)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
