import type { TFunction } from 'i18next'
import type { ChipTone } from '@/components/ui/Chip'
import type { IconName } from '@/components/ui/Icon'
import { NICHES, type NicheSlug } from '@/config/niches'
import { appUrl } from '@/lib/env'
import { maskPhoneBr } from '@/lib/validators'

export type LinkStatus = 'created' | 'sent' | 'opened' | 'in_progress' | 'completed' | 'expired' | 'canceled'
export type Channel = 'whatsapp' | 'sms' | 'email' | 'qr'
export const EXPIRY_OPTIONS = [1, 24, 72, 168] as const

export interface LinkRow {
  id: string
  organization_id: string
  subject_name: string
  phone: string | null
  email: string | null
  channel: Channel
  reference: string | null
  status: LinkStatus
  expires_at: string
  created_at: string
  sent_at: string | null
  opened_at: string | null
  resend_count: number
}

export const STATUS_META: Record<LinkStatus, { tone: ChipTone; icon: IconName }> = {
  created: { tone: 'neutral', icon: 'pending' },
  sent: { tone: 'info', icon: 'send' },
  opened: { tone: 'info', icon: 'link' },
  in_progress: { tone: 'review', icon: 'capture' },
  completed: { tone: 'low', icon: 'approved' },
  expired: { tone: 'unknown', icon: 'pending' },
  canceled: { tone: 'unknown', icon: 'rejected' },
}

export const CHANNEL_ICON: Record<Channel, IconName> = { whatsapp: 'chat', sms: 'chat', email: 'mail', qr: 'qr' }

export function linkUrl(token: string) {
  return appUrl(`/v/${token}`)
}

/** Mensagem padrão (§5): nunca inclui dado sensível. */
export function smsMessage(opts: { org: string; name: string; niche: NicheSlug; url: string; hours: number; t: TFunction }) {
  const first = opts.name.trim().split(/\s+/)[0]
  const purpose = NICHES[opts.niche]?.consentCopy.purpose ?? opts.t('links.defaultPurpose')
  return opts.t('links.message', { org: opts.org, name: first, purpose, url: opts.url, validity: validityLabel(opts.hours, opts.t) })
}

export function validityLabel(hours: number, t: TFunction) {
  return hours >= 24 ? t('links.validityDays', { count: hours / 24 }) : t('links.validityHours', { count: hours })
}

export function whatsappHref(phoneDigits: string | null, text: string) {
  const phone = phoneDigits ? `55${phoneDigits}` : ''
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export function formatPhone(d: string | null) {
  return d ? maskPhoneBr(d) : null
}

export function linkErrorMessage(e: unknown, t: TFunction): string | null {
  const m = (e as { message?: string })?.message ?? ''
  if (m.includes('link_daily_limit')) return t('links.errors.dailyLimit')
  if (m.includes('verification_links_contact')) return t('links.errors.contact')
  if (m.includes('resend_limit')) return t('links.errors.resendLimit')
  if (m.includes('link_closed')) return t('links.errors.closed')
  if (m.includes('reason_required')) return t('links.errors.reason')
  if (m.includes('batch_too_large')) return t('links.errors.batchTooLarge')
  if (m.includes('forbidden')) return t('links.errors.forbidden')
  return null
}
