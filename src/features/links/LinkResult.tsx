import { QRCodeSVG } from 'qrcode.react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { Organization } from '@/features/org/useMemberships'
import { CopyField } from '@/features/setup/TeamEditor'
import { supabase } from '@/lib/supabase'
import { formatPhone, smsMessage, whatsappHref, type Channel } from './linkUtils'

export interface CreatedLink { id: string; url: string; expiresAt: string; hours: number; name: string; phone: string | null; email: string | null; channel: Channel }

export function LinkResult({ link, org }: { link: CreatedLink; org: Organization }) {
  const { t, i18n } = useTranslation()
  const qrRef = useRef<HTMLDivElement>(null)
  const message = smsMessage({ org: org.name, name: link.name, niche: org.niche, url: link.url, hours: link.hours, t })
  const shared = () => void supabase.rpc('mark_link_shared', { p_link_id: link.id })

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `veroid-${link.name.split(' ')[0].toLowerCase()}.svg`
    a.click()
    URL.revokeObjectURL(a.href)
    shared()
  }

  const expires = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(link.expiresAt))

  return (
    <div className="flex flex-col gap-5">
      <CopyField label={t('links.url')} value={link.url} onCopied={shared} />
      <p className="m-0 -mt-3 t-caption text-[var(--ink-muted)]">{t('links.expiresAt', { date: expires })}</p>

      {link.channel === 'whatsapp' ? (
        <a href={whatsappHref(link.phone, message)} target="_blank" rel="noopener noreferrer" onClick={shared}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0F7A4A] px-[18px] text-[13px] font-medium text-white hover:bg-[#0B5C37]">
          <Icon name="chat" size={18} />
          {t('links.openWhatsapp', { phone: formatPhone(link.phone) })}
        </a>
      ) : null}

      {link.channel === 'qr' ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-5">
          <div ref={qrRef}><QRCodeSVG value={link.url} size={196} level="M" marginSize={2} title={t('links.qrTitle', { name: link.name })} /></div>
          <Button variant="secondary" icon="export" onClick={downloadQr}>{t('links.downloadQr')}</Button>
        </div>
      ) : null}

      <div>
        <p className="m-0 t-overline text-[var(--ink-muted)]">
          {link.channel === 'email' ? t('links.previewEmail', { email: link.email }) : link.channel === 'sms' ? t('links.previewSms', { phone: formatPhone(link.phone) }) : t('links.previewMessage')}
        </p>
        <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-[14px] text-[13px] leading-[1.55] text-[var(--ink-body)] [[data-theme=dark]_&]:border-[#262C45] [[data-theme=dark]_&]:bg-[#0C1024]">
          {message}
        </div>
        {link.channel === 'sms' || link.channel === 'email' ? (
          <p className="m-0 mt-2 flex items-center gap-1.5 t-caption text-[var(--ink-muted)]"><Icon name="info" size={16} />{t('links.simulatedSent')}</p>
        ) : null}
      </div>
    </div>
  )
}
