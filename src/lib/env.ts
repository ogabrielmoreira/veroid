const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined

export const env = {
  supabaseUrl: url ?? '',
  supabaseKey: key ?? '',
  turnstileSiteKey: (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '',
  loginEmailOtp: import.meta.env.VITE_LOGIN_EMAIL_OTP === 'true',
  basePath: import.meta.env.BASE_URL.replace(/\/$/, ''), // "/veroid"
  isConfigured: Boolean(url && key),
}

/** URL absoluta dentro do app, ex.: appUrl('/auth/callback') → https://gabrielmoreira.tech/veroid/auth/callback */
export function appUrl(path: string): string {
  return `${window.location.origin}${env.basePath}${path}`
}
