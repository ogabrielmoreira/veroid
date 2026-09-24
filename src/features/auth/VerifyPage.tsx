import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { authErrorMessage } from '@/lib/authErrors'
import { appUrl } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'

type Mode = 'signup' | 'login'
interface VerifyState { email?: string; mode?: Mode; from?: string; notice?: string }

const RESEND_COOLDOWN = 60

export function VerifyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const state = (useLocation().state ?? {}) as VerifyState
  const email = state.email
  const mode: Mode = state.mode ?? 'signup'

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(state.notice ? t(`errors.${state.notice}`) : null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  // O e-mail (template padrão do Supabase, sem SMTP próprio — ver DECISIONS.md) só traz um link,
  // nunca o código em texto: não há como digitar um token que o usuário nunca vê. O cliente do
  // Supabase sincroniza a sessão entre abas da mesma origem via localStorage, então quando o link
  // é aberto em outra aba deste navegador, o `user` do AuthProvider muda aqui também — sem polling.
  useEffect(() => {
    if (user) navigate(state.from ?? '/app', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (!email) return <Navigate to="/entrar" replace />

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
      <div className="flex flex-col gap-5">
        <p className="m-0 t-caption text-[var(--ink-muted)]" aria-live="polite">{t('auth.verify.waitingHint')}</p>
        <div className="flex flex-col items-start gap-1">
          <Button variant="ghost" onClick={resend} disabled={cooldown > 0} className="-ml-3 disabled:bg-transparent disabled:border-0">
            <span className="tabular">{cooldown > 0 ? t('auth.verify.resendIn', { seconds: cooldown }) : t('auth.verify.resend')}</span>
          </Button>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('auth.verify.spamHint')}</p>
        </div>
      </div>
    </AuthLayout>
  )
}
