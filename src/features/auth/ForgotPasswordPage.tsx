import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { authErrorMessage } from '@/lib/authErrors'
import { appUrl } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({ email: z.string().trim().email(t('auth.validation.emailInvalid')) })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onBlur' })

  const onSubmit = async ({ email }: Values) => {
    setServerError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl('/auth/callback?next=/nova-senha'),
    })
    // Não revela se a conta existe; só mostra erro de limite/rede.
    if (error && (error.status === 429 || /rate|fetch/i.test(error.message))) return setServerError(authErrorMessage(error, t))
    setSentTo(email)
  }

  const back = (
    <Link to="/entrar" className="inline-flex items-center gap-1.5 font-medium text-[var(--link)] underline-offset-2 hover:underline">
      <Icon name="arrowLeft" size={16} />
      {t('auth.forgot.backToSignin')}
    </Link>
  )

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.forgot.sentTitle')} subtitle={t('auth.forgot.sentBody', { email: sentTo })} footer={back}>
        <Alert variant="neutral">{t('auth.verify.spamHint')}</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} footer={back}>
      {serverError ? <Alert variant="error" live className="mb-5">{serverError}</Alert> : null}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <InputField
          label={t('auth.fields.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" block loading={formState.isSubmitting}>{t('auth.forgot.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
