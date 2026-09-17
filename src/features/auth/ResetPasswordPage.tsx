import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { FullPageLoader } from '@/components/FullPageLoader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/Field'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loading, clearRecovery } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({ password: z.string().min(8, t('auth.validation.passwordShort')).max(72) })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onBlur' })

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/recuperar-senha" replace />

  const onSubmit = async ({ password }: Values) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setServerError(authErrorMessage(error, t))
    clearRecovery()
    navigate('/app', { replace: true })
  }

  return (
    <AuthLayout title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      {serverError ? <Alert variant="error" live className="mb-5">{serverError}</Alert> : null}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <PasswordField
          label={t('auth.fields.newPassword')}
          autoComplete="new-password"
          help={t('auth.fields.passwordHelp')}
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" block loading={formState.isSubmitting}>{t('auth.reset.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
