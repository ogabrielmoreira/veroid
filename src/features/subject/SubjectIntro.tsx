import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { resolveBrand, type BrandKit } from '@/lib/brand'
import { BrandMark } from './BrandMark'

interface SubjectIntroProps {
  orgName: string
  kit: BrandKit | null | undefined
  firstName?: string
  purpose: string
  onStart?: () => void
  preview?: boolean
  startDisabledReason?: string
}

/**
 * Tela 1 do fluxo do titular (§6.1): marca da organização, pedido, finalidade, tempo e selo.
 * Mobile-first, uma decisão por tela, sempre light. Usada também no preview do Brand Kit.
 */
export function SubjectIntro({ orgName, kit, firstName, purpose, onStart, preview, startDisabledReason }: SubjectIntroProps) {
  const { t } = useTranslation()
  const tone = resolveBrand(kit).tone
  const name = firstName || t('subject.intro.you')
  return (
    <div className="flex min-h-full flex-col bg-white text-[#3C4262]">
      <header className="flex items-center gap-3 px-5 pt-6">
        <BrandMark name={orgName} kit={kit} size={36} />
        <span className="truncate text-[15px] font-semibold text-[#10142B]">{orgName}</span>
      </header>

      <main className={`flex flex-1 flex-col px-5 pb-6 ${preview ? 'pt-5' : 'pt-8'}`}>
        <h1 className={`${preview ? 'text-[21px]' : 'text-[26px]'} font-bold leading-[1.15] tracking-[-0.02em] text-[#10142B]`} style={{ fontFamily: 'var(--font-display)' }}>
          {t(tone === 'formal' ? 'subject.intro.titleFormal' : 'subject.intro.titleFriendly', { name, org: orgName })}
        </h1>
        <p className="m-0 mt-3 t-body-lg">{t('subject.intro.purpose', { purpose })}</p>

        <ul className={`m-0 flex list-none flex-col p-0 ${preview ? 'mt-4 gap-2' : 'mt-6 gap-3'}`}>
          {[
            { icon: 'pending' as const, text: t('subject.intro.time') },
            { icon: 'capture' as const, text: t('subject.intro.camera') },
            { icon: 'lock' as const, text: t('subject.intro.privacy') },
          ].map((i) => (
            <li key={i.icon} className="flex items-center gap-3 text-[15px] leading-6">
              <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}>
                <Icon name={i.icon} size={18} />
              </span>
              {i.text}
            </li>
          ))}
        </ul>

        <div className={`mt-auto ${preview ? 'pt-4' : 'pt-8'}`}>
          <button
            type="button"
            onClick={onStart}
            disabled={preview || Boolean(startDisabledReason)}
            tabIndex={preview ? -1 : undefined}
            className="flex min-h-11 w-full items-center justify-center gap-2 px-[18px] py-[11px] text-[15px] font-medium text-white disabled:cursor-default"
            style={{ background: 'var(--brand-primary)', borderRadius: 'var(--radius-md)' }}
          >
            {t('subject.intro.start')}
            <Icon name="arrowRight" size={18} />
          </button>
          {startDisabledReason ? <p className="m-0 mt-2 text-center text-[13px] text-[#4E5573]">{startDisabledReason}</p> : null}
          <p className="m-0 mt-4 flex items-center justify-center gap-1.5 text-[12px] text-[#4E5573]">
            <Icon name="shield" size={16} />
            {t('subject.intro.poweredBy')}
          </p>
        </div>
      </main>
    </div>
  )
}
