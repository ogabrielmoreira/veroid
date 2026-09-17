import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { detectBrowser, type CameraError } from '../lib/browser'
import { FlowButton, FlowScreen } from '../FlowUi'

/** Recuperação de câmera negada/indisponível com instruções por navegador (§3.18, §6.4). */
export function CameraErrorStep({ error, onRetry, onHelp, busy }: { error: CameraError; onRetry: () => void; onHelp: () => void; busy: boolean }) {
  const { t } = useTranslation()
  const browser = detectBrowser()
  const steps = error === 'denied' ? (t(`subject.cameraError.steps.${browser}`, { returnObjects: true }) as string[]) : []
  return (
    <div className="flex flex-1 flex-col bg-[#FBF0DF]">
      <FlowScreen
        stepKey={`camera-${error}`}
        icon="cameraOff"
        iconTone="warning"
        title={t(`subject.cameraError.${error}.title`)}
        subtitle={t(`subject.cameraError.${error}.body`)}
        actions={
          <>
            <FlowButton onClick={onRetry} loading={busy} icon="refresh">{t('subject.cameraError.retry')}</FlowButton>
            <FlowButton variant="link" onClick={onHelp}>{t('subject.cameraError.assisted')}</FlowButton>
          </>
        }
      >
        {steps.length ? (
          <div className="rounded-[var(--radius-md)] border border-[rgba(176,106,0,.28)] bg-white p-4">
            <p className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[#10142B]"><Icon name="settings" size={18} />{t(`subject.cameraError.browserName.${browser}`)}</p>
            <ol className="m-0 mt-2 flex flex-col gap-1.5 pl-5 text-[14px] leading-[1.6] text-[#3C4262]">
              {steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        ) : null}
      </FlowScreen>
    </div>
  )
}
