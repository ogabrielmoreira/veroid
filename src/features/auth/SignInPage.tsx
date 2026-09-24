import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField, PasswordField } from '@/components/ui/Field'
import { authErrorMessage } from '@/lib/authErrors'
import { appUrl, env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'

export function SignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'
  const { setPendingOtp } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = z.object({
    email: z.string().trim().email(t('auth.validation.emailInvalid')),
    password: z.string().min(1, t('auth.validation.passwordShort')),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = formState

  const onSubmit = async ({ email, password }: Values) => {
    setServerError(null)
    // Marca o login como pendente ANTES de autenticar: o Supabase emite SIGNED_IN já no
    // signInWithPassword, e sem isso o RequireGuest levaria para /app e desmontaria esta
    // tela antes do pedido do código — o e-mail com o token nunca era enviado (§5.1).
    if (env.loginEmailOtp) setPendingOtp(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setPendingOtp(false)
      if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
        await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl('/auth/callback') } })
        return navigate('/verificar', { state: { email, mode: 'signup', notice: 'emailNotConfirmed' } })
      }
      return setServerError(authErrorMessage(error, t))
    }

    if (env.loginEmailOtp) {
      // 2º fator por e-mail: senha confere → encerra a sessão local e exige o código (§5.1)
      await supabase.auth.signOut({ scope: 'local' })
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: appUrl('/auth/callback') },
      })
      if (otpError) {
        setPendingOtp(false)
        return setServerError(authErrorMessage(otpError, t))
      }
      return navigate('/verificar', { state: { email, mode: 'login', from } })
    }

    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title={t('auth.signin.title')}
      subtitle={t('auth.signin.subtitle')}
      footer={
        <>
          {t('auth.signin.noAccount')}{' '}
          <Link to="/criar-conta" className="font-medium text-[var(--link)] underline-offset-2 hover:underline">
            {t('auth.signin.toSignup')}
          </Link>
        </>
      }
    >
      {serverError ? <Alert variant="error" live className="mb-5">{serverError}</Alert> : null}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <InputField
          id="signin-email"
          label={t('auth.fields.email')}
          type="email"
          inputMode="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            id="signin-password"
            label={t('auth.fields.password')}
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Link to="/recuperar-senha" className="self-start t-label text-[var(--link)] underline-offset-2 hover:underline py-1">
            {t('auth.signin.forgot')}
          </Link>
        </div>
        <Button type="submit" block loading={isSubmitting} iconRight="arrowRight">
          {t('auth.signin.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
