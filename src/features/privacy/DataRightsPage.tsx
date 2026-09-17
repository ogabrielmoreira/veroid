import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox, InputField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { OtpInput } from '@/components/ui/OtpInput'
import { SegmentedFilter } from '@/components/ui/Tabs'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'
import { isValidCpf, maskCpf, onlyDigits } from '@/lib/validators'
import { AuthLayout } from '@/features/auth/AuthLayout'

type Kind = 'access' | 'deletion'
interface CreateResult { request_id: string; expires_in_minutes: number; matches: number; demo_otp?: string }
interface AccessResult { organization: string; niche: string; name: string; marketing_opt_in: boolean; verifications: number; last_verified_at: string | null }
interface DeletionResult { organization: string; status: string }
interface VerifyResult { kind: Kind; results: Array<AccessResult | DeletionResult> }

/** /privacidade — direitos do titular (LGPD, §8): acesso ou exclusão dos próprios dados, sem exigir login. */
export function DataRightsPage() {
  const { t, i18n } = useTranslation()
  const [stage, setStage] = useState<'form' | 'otp' | 'done'>('form')
  const [kind, setKind] = useState<Kind>('access')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [confirmDeletion, setConfirmDeletion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<CreateResult | null>(null)
  const [otp, setOtp] = useState('')
  const [result, setResult] = useState<VerifyResult | null>(null)

  const cpfDigits = onlyDigits(cpf)
  const canSubmit = isValidCpf(cpfDigits) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && name.trim().length >= 2 && (kind === 'access' || confirmDeletion)

  const submitRequest = async () => {
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    const { data, error: err } = await supabase.rpc('create_data_request', {
      p_cpf: cpfDigits, p_email: email.trim(), p_full_name: name.trim(), p_kind: kind,
    })
    setSubmitting(false)
    if (err) return setError(authErrorMessage(err, t))
    setCreated(data as CreateResult)
    setStage('otp')
  }

  const verify = async (code: string) => {
    if (!/^\d{6}$/.test(code) || !created) return
    setError(null)
    setSubmitting(true)
    const { data, error: err } = await supabase.rpc('verify_data_request', { p_request_id: created.request_id, p_otp: code })
    setSubmitting(false)
    if (err) return setError(authErrorMessage(err, t))
    setResult(data as VerifyResult)
    setStage('done')
  }

  const fmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <AuthLayout title={t('privacy.title')} subtitle={t('privacy.subtitle')}>
      {stage === 'form' ? (
        <div className="flex flex-col gap-5">
          <SegmentedFilter
            label={t('privacy.kindLabel')}
            value={kind}
            onChange={(v) => { setKind(v); setConfirmDeletion(false) }}
            options={[{ value: 'access', label: t('privacy.kind.access') }, { value: 'deletion', label: t('privacy.kind.deletion') }]}
          />
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t(`privacy.kind.${kind}Help`)}</p>
          {error ? <Alert variant="error" live>{error}</Alert> : null}
          <InputField id="dr-name" label={t('privacy.fields.name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <InputField id="dr-cpf" label={t('privacy.fields.cpf')} inputMode="numeric" placeholder="000.000.000-00" value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))} error={cpf && !isValidCpf(cpfDigits) ? t('subject.form.errors.cpf') : undefined} />
          <InputField id="dr-email" label={t('privacy.fields.email')} type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} help={t('privacy.fields.emailHelp')} />
          {kind === 'deletion' ? (
            <Checkbox id="dr-confirm" label={t('privacy.confirmDeletion')} checked={confirmDeletion} onChange={(e) => setConfirmDeletion(e.target.checked)} />
          ) : null}
          <Button block loading={submitting} disabled={!canSubmit} onClick={submitRequest}>{t('privacy.submit')}</Button>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('privacy.rateLimitHint')}</p>
        </div>
      ) : stage === 'otp' && created ? (
        <div className="flex flex-col gap-5">
          <Alert variant="info">
            {created.matches === 0
              ? t('privacy.matchesNone')
              : created.matches === 1
                ? t('privacy.matchesFoundOne')
                : t('privacy.matchesFoundMany', { count: created.matches })}
          </Alert>
          {created.demo_otp ? (
            <Alert variant="warning" title={t('privacy.demoOtpTitle')}>
              {t('privacy.demoOtpBody', { code: created.demo_otp })}
            </Alert>
          ) : null}
          {error ? <Alert variant="error" live>{error}</Alert> : null}
          <OtpInput label={t('privacy.otpLabel')} value={otp} onChange={(v) => { setOtp(v); if (error) setError(null) }} onComplete={(v) => void verify(v)} disabled={submitting} />
          <Button block loading={submitting} disabled={otp.length !== 6} onClick={() => void verify(otp)}>{t('privacy.verify')}</Button>
        </div>
      ) : result ? (
        <div className="flex flex-col gap-5">
          <div className="grid size-12 place-items-center rounded-full bg-[var(--brand-50)] text-[var(--brand-700)]">
            <Icon name={result.kind === 'deletion' ? 'trash' : 'evidence'} size={24} />
          </div>
          <h2 className="m-0 t-h3 font-sans">{t(result.kind === 'deletion' ? 'privacy.doneDeletionTitle' : 'privacy.doneAccessTitle')}</h2>
          {result.results.length === 0 ? (
            <Alert variant="info">{t('privacy.noMatches')}</Alert>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {result.results.map((r, i) => (
                <li key={i} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  {result.kind === 'access' ? (
                    <>
                      <p className="m-0 text-[14px] font-semibold text-[var(--ink)]">{(r as AccessResult).organization}</p>
                      <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">
                        {t('privacy.accessLine', {
                          count: (r as AccessResult).verifications,
                          date: (r as AccessResult).last_verified_at ? fmt.format(new Date((r as AccessResult).last_verified_at!)) : '—',
                        })}
                      </p>
                      <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">
                        {t('privacy.marketingLine', { status: t((r as AccessResult).marketing_opt_in ? 'common.yes' : 'common.no') })}
                      </p>
                    </>
                  ) : (
                    <p className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
                      <Icon name="approved" size={16} className="text-[var(--risk-low-ink)]" />
                      {(r as DeletionResult).organization} — {t('privacy.erased')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link to="/" className="inline-flex items-center gap-1.5 font-medium text-[var(--link)] underline-offset-2 hover:underline">
            <Icon name="arrowLeft" size={16} />{t('privacy.backHome')}
          </Link>
        </div>
      ) : null}
    </AuthLayout>
  )
}
