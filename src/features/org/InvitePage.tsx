import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { setStoredOrgId } from './useCurrentOrg'

export const PENDING_INVITE_KEY = 'veroid.invite'

export function InvitePage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    try { sessionStorage.setItem(PENDING_INVITE_KEY, token) } catch { /* ignora */ }
  }, [token])

  const info = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invitation', { p_token: token })
      if (error) throw error
      return (data as Array<{ organization_name: string; role: string; email: string; status: string }>)[0] ?? null
    },
  })

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
      if (error) throw error
      return data as string
    },
    onSuccess: async (orgId) => {
      try { sessionStorage.removeItem(PENDING_INVITE_KEY) } catch { /* ignora */ }
      setStoredOrgId(orgId)
      await qc.invalidateQueries({ queryKey: ['memberships'] })
      navigate('/app', { replace: true })
    },
  })

  if (loading || info.isLoading) {
    return <AuthLayout title={t('invite.loading')}><Spinner size={24} label={t('common.loading')} /></AuthLayout>
  }

  const inv = info.data
  if (!inv || inv.status !== 'pending') {
    try { sessionStorage.removeItem(PENDING_INVITE_KEY) } catch { /* ignora */ }
    const key = !inv ? 'notFound' : inv.status
    return (
      <AuthLayout title={t(`invite.${key}Title`)} subtitle={t(`invite.${key}Body`)}>
        <ButtonLink to={user ? '/app' : '/entrar'} block>{t('common.continue')}</ButtonLink>
      </AuthLayout>
    )
  }

  const errMsg = accept.error ? (() => {
    const m = (accept.error as { message?: string }).message ?? ''
    if (m.includes('invite_email_mismatch')) return t('invite.mismatch', { email: inv.email })
    return t('errors.generic')
  })() : null

  return (
    <AuthLayout
      title={t('invite.title', { org: inv.organization_name })}
      subtitle={t('invite.subtitle', { role: t(`app.overview.role.${inv.role}`), email: inv.email })}
    >
      <div className="mb-6 grid size-12 place-items-center rounded-full bg-[var(--brand-50)] text-[var(--brand-700)]"><Icon name="users" size={24} /></div>
      {errMsg ? <Alert variant="error" live className="mb-5">{errMsg}</Alert> : null}
      {user ? (
        <div className="flex flex-col gap-3">
          <Button block loading={accept.isPending} onClick={() => accept.mutate()}>{t('invite.accept')}</Button>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('invite.signedAs', { email: user.email })}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ButtonLink to="/criar-conta" block>{t('auth.signup.title')}</ButtonLink>
          <ButtonLink to="/entrar" state={{ from: `/convite/${token}` }} variant="secondary" block>{t('auth.signin.submit')}</ButtonLink>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('invite.useSameEmail', { email: inv.email })}</p>
        </div>
      )}
    </AuthLayout>
  )
}
