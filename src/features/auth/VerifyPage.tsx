import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { OtpInput } from '@/components/ui/OtpInput'
import { authErrorMessage } from '@/lib/authErrors'
import { appUrl } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'

type Mode = 'signup' | 'login'
interface VerifyState { email?: string; mode?: Mode; from?: string; notice?: string }

const RESEND_COOLDOWN = 60

export function VerifyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as VerifyState
  const email = state.email
  const mode: Mode = state.mode ?? 'signup'

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(state.notice ? t(`errors.${state.notice}`) : null)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  if (!email) return <Navigate to="/entrar" replace />

  const verify = async (token: string) => {
    if (!/^\d{6}$/.test(token)) return setError(t('auth.validation.codeInvalid'))
    setError(null)
    setSubmitting(true)
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setSubmitting(false)
    if (err) return setError(authErrorMessage(err, t))
    navigate(state.from ?? '/app', { replace: true })
  }

  const resend = async () => {
    setError(null)
    setInfo(null)
    const { error: err } =
      mode === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl('/auth/callback') } })
        : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (err) return setError(authErrorMessage(err, t))
    setInfo(t('auth.verify.resent'))
    setCooldown(RESEND_COOLDOWN)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void verify(code)
  }

  return (
    <AuthLayout
      title={t('auth.verify.title')}
      subtitle={t(mode === 'login' ? 'auth.verify.subtitleLogin' : 'auth.verify.subtitle', { email })}
      footer={
        <Link to={mode === 'login' ? '/entrar' : '/criar-conta'} className="inline-flex items-center gap-1.5 font-medium text-[var(--link)] underline-offset-2 hover:underline">
          <Icon name="arrowLeft" size={16} />
          {t('auth.verify.wrongEmail')}
        </Link>
      }
    >
      <div className="mb-6 grid size-12 place-items-center rounded-full bg-[var(--brand-50)] text-[var(--brand-700)]">
        <Icon name="mail" size={24} />
      </div>
      {error ? <Alert variant="error" live className="mb-5">{error}</Alert> : null}
      {info ? <Alert variant="info" live className="mb-5">{info}</Alert> : null}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <OtpInput
          label={t('auth.verify.codeLabel')}
          value={code}
          onChange={(v) => { setCode(v); if (error) setError(null) }}
          onComplete={(v) => void verify(v)}
          disabled={submitting}
        />
        <Button type="submit" block loading={submitting} disabled={code.length !== 6 && !submitting}>
          {t('auth.verify.submit')}
        </Button>
        <div className="flex flex-col items-start gap-1">
          <Button variant="ghost" onClick={resend} disabled={cooldown > 0} className="-ml-3 disabled:bg-transparent disabled:border-0">
            <span className="tabular">{cooldown > 0 ? t('auth.verify.resendIn', { seconds: cooldown }) : t('auth.verify.resend')}</span>
          </Button>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('auth.verify.spamHint')}</p>
        </div>
      </form>
    </AuthLayout>
  )
}
