import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'

/** Destino do link do e-mail (confirmação de cadastro e recuperação de senha, fluxo PKCE). */
export function CallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (params.get('error') || params.get('error_description') || hash.get('error')) {
      setFailed(true)
      return
    }
    const next = params.get('next')
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/nova-senha', { replace: true })
      else if (session) navigate(safeNext, { replace: true })
    })

    const code = params.get('code')
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) return navigate(safeNext, { replace: true })
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return navigate(safeNext, { replace: true })
      }
      setFailed(true)
    }, 1500)

    return () => {
      window.clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [navigate, params])

  if (failed) {
    return (
      <AuthLayout title={t('auth.callback.failedTitle')} subtitle={t('auth.callback.failedBody')}>
        <div className="mb-6 grid size-12 place-items-center rounded-full bg-[var(--risk-review-bg)] text-[var(--risk-review-ink)]">
          <Icon name="review" size={24} />
        </div>
        <ButtonLink to="/entrar" block>{t('auth.callback.retry')}</ButtonLink>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.callback.working')}>
      <div className="flex items-center gap-3 text-[var(--ink-muted)]" role="status">
        <Spinner size={24} />
        <span>{t('common.loading')}</span>
      </div>
    </AuthLayout>
  )
}
