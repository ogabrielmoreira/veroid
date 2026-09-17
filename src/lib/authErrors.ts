import type { TFunction } from 'i18next'

/** Traduz erros do Supabase Auth/PostgREST em mensagens com causa + próximo passo (§3.3, §5). */
export function authErrorMessage(error: unknown, t: TFunction): string {
  const e = error as { code?: string; message?: string; status?: number } | null
  const code = e?.code ?? ''
  const msg = (e?.message ?? '').toLowerCase()

  if (code === 'email_address_not_authorized' || msg.includes('not authorized')) return t('errors.emailNotAuthorized')
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return t('errors.invalidCredentials')
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return t('errors.emailNotConfirmed')
  if (code === 'user_already_exists' || msg.includes('already registered')) return t('errors.userExists')
  if (code === 'weak_password' || msg.includes('password should')) return t('errors.weakPassword')
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid otp') || msg.includes('token has expired'))
    return t('errors.otpInvalid')
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e?.status === 429 || msg.includes('rate limit'))
    return t('errors.rateLimit')
  if (code === 'email_address_invalid' || msg.includes('email address') && msg.includes('invalid')) return t('errors.emailInvalid')
  if (code === 'same_password') return t('errors.samePassword')
  if (msg.includes('invalid_cnpj')) return t('errors.invalidCnpj')
  if (msg.includes('org_limit_reached')) return t('errors.orgLimit')
  if (msg.includes('duplicate key') && msg.includes('cnpj')) return t('errors.cnpjTaken')
  if (msg.includes('failed to fetch') || msg.includes('network')) return t('errors.network')
  return t('errors.generic')
}
