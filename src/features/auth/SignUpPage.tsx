import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { ErrorSummary } from '@/components/ErrorSummary'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox, InputField, PasswordField } from '@/components/ui/Field'
import { authErrorMessage } from '@/lib/authErrors'
import { appUrl } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { passwordStrength } from '@/lib/validators'
import { AuthLayout } from './AuthLayout'

export function SignUpPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = z.object({
    fullName: z.string().trim().min(3, t('auth.validation.nameRequired')).max(120),
    email: z.string().trim().email(t('auth.validation.emailInvalid')),
    password: z.string().min(8, t('auth.validation.passwordShort')).max(72),
    terms: z.boolean().refine((v) => v, t('auth.signup.termsHelp')),
  })
  type Values = z.infer<typeof schema>

  const { register, handleSubmit, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { fullName: '', email: '', password: '', terms: false },
  })
  const { errors, isSubmitting, submitCount } = formState
  const pw = watch('password')
  const strength = passwordStrength(pw ?? '')

  const onSubmit = async (values: Values) => {
    setServerError(null)
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: appUrl('/auth/callback'),
        data: { full_name: values.fullName, locale: i18n.language === 'en' ? 'en' : 'pt-BR' },
      },
    })
    if (error) return setServerError(authErrorMessage(error, t))
    // Supabase devolve usuário sem identities quando o e-mail já existe (proteção contra enumeração)
    if (data.user && data.user.identities?.length === 0) return setServerError(t('errors.userExists'))
    if (data.session) return navigate('/app', { replace: true })
    navigate('/verificar', { state: { email: values.email, mode: 'signup' } })
  }

  const labels = { fullName: t('auth.fields.fullName'), email: t('auth.fields.email'), password: t('auth.fields.password'), terms: t('auth.signup.terms') }
  const strengthColor = ['var(--risk-high)', 'var(--risk-high)', 'var(--risk-review)', 'var(--risk-low)', 'var(--risk-low)'][strength]

  return (
    <AuthLayout
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.hasAccount')}{' '}
          <Link to="/entrar" className="font-medium text-[var(--link)] underline-offset-2 hover:underline">
            {t('auth.signup.toSignin')}
          </Link>
        </>
      }
    >
      <ErrorSummary errors={errors} submitCount={submitCount} labels={labels} idPrefix="signup" />
      {serverError ? <Alert variant="error" live className="mb-5">{serverError}</Alert> : null}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <InputField
          id="signup-fullName"
          label={labels.fullName}
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <InputField
          id="signup-email"
          label={labels.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          help={t('auth.fields.emailHelp')}
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <PasswordField
            id="signup-password"
            label={labels.password}
            autoComplete="new-password"
            help={t('auth.fields.passwordHelp')}
            error={errors.password?.message}
            {...register('password')}
          />
          {pw ? (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full bg-[var(--n-100)] transition-colors duration-[var(--dur-fast)]"
                    style={i < strength ? { background: strengthColor } : undefined}
                  />
                ))}
              </div>
              <span className="t-caption text-[var(--ink-muted)] min-w-[72px] text-right">{t(`auth.strength.${strength}`)}</span>
            </div>
          ) : null}
        </div>
        <div className="rounded-md border border-[var(--brand-200)] bg-[var(--brand-50)] p-[14px]">
          <Checkbox id="signup-terms" label={t('auth.signup.terms')} error={errors.terms?.message} {...register('terms')} />
        </div>
        <Button type="submit" block loading={isSubmitting} iconRight="arrowRight">
          {t('auth.signup.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
