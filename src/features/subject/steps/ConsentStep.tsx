import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { FlowAlert, FlowButton, FlowScreen } from '../FlowUi'

export function ConsentStep({ orgName, purpose, retentionDays, busy, error, onAccept }: {
  orgName: string; purpose: string; retentionDays: number; busy: boolean; error: string | null
  onAccept: (marketing: boolean) => void
}) {
  const { t } = useTranslation()
  const [biometric, setBiometric] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const retention = retentionDays <= 1 ? t('subject.consent.retentionDemo') : t('subject.consent.retentionDays', { count: retentionDays })

  return (
    <FlowScreen
      stepKey="consent"
      title={t('subject.consent.title')}
      subtitle={t('subject.consent.subtitle', { org: orgName })}
      actions={
        <>
          {error ? <FlowAlert tone="error">{error}</FlowAlert> : null}
          <FlowButton onClick={() => onAccept(marketing)} disabled={!biometric} loading={busy} iconRight="arrowRight">{t('subject.consent.accept')}</FlowButton>
          {!biometric ? <p className="m-0 text-center text-[13px] text-[#4E5573]" id="consent-hint">{t('subject.consent.needBiometric')}</p> : null}
        </>
      }
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {[
          { icon: 'capture' as const, title: t('subject.consent.whatTitle'), body: t('subject.consent.whatBody') },
          { icon: 'shield' as const, title: t('subject.consent.whyTitle'), body: t('subject.consent.whyBody', { purpose, org: orgName }) },
          { icon: 'pending' as const, title: t('subject.consent.howLongTitle'), body: retention },
        ].map((i) => (
          <li key={i.icon} className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name={i.icon} size={20} /></span>
            <div>
              <p className="m-0 text-[15px] font-semibold leading-6 text-[#10142B]">{i.title}</p>
              <p className="m-0 text-[14px] leading-[1.55] text-[#3C4262]">{i.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <details className="group rounded-[var(--radius-md)] border border-[#D7DAE8] px-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-medium text-[var(--brand-700)]">
          {t('subject.consent.fullText')}
          <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="pb-4 text-[13px] leading-[1.6] text-[#3C4262]">
          <p className="m-0">{t('subject.consent.legal1', { org: orgName, purpose })}</p>
          <p className="m-0 mt-2">{t('subject.consent.legal2')}</p>
          <p className="m-0 mt-2">{t('subject.consent.legal3')}</p>
        </div>
      </details>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--brand-200)] bg-[var(--brand-50)] p-[14px]">
          <input type="checkbox" checked={biometric} onChange={(e) => setBiometric(e.target.checked)} aria-describedby={!biometric ? 'consent-hint' : undefined}
            className="mt-0.5 size-[18px] shrink-0" style={{ accentColor: 'var(--brand-primary)' }} />
          <span className="text-[14px] leading-[1.5] text-[#3C4262]">
            {t('subject.consent.biometric')}
            <span className="ml-2 inline-flex rounded-full border border-[#B6BBD0] bg-white px-2 py-0.5 align-middle text-[11px] font-semibold text-[#10142B]">{t('common.required')}</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[#D7DAE8] p-[14px]">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-[18px] shrink-0" style={{ accentColor: 'var(--brand-primary)' }} />
          <span className="text-[14px] leading-[1.5] text-[#3C4262]">
            {t('subject.consent.marketing', { org: orgName })}
            <span className="ml-2 inline-flex rounded-full border border-[#D7DAE8] px-2 py-0.5 align-middle text-[11px] text-[#4E5573]">{t('common.optional')}</span>
          </span>
        </label>
      </div>
    </FlowScreen>
  )
}
