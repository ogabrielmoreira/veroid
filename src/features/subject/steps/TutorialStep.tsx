import { useTranslation } from 'react-i18next'
import { TapAllowTutorial } from '@/components/TapAllowTutorial'
import { FlowAlert, FlowButton, FlowScreen } from '../FlowUi'

/** Explica o pedido de câmera ANTES do navegador perguntar (§6.3). A permissão só é pedida no toque. */
export function TutorialStep({ busy, onAllow, simpleMode }: { busy: boolean; onAllow: () => void; simpleMode?: boolean }) {
  const { t } = useTranslation()
  return (
    <FlowScreen
      stepKey="tutorial"
      title={t('subject.tutorial.title')}
      subtitle={t('subject.tutorial.subtitle')}
      actions={
        <>
          <FlowButton onClick={onAllow} loading={busy} icon="capture">{t('subject.tutorial.allow')}</FlowButton>
          <p className="m-0 text-center text-[13px] text-[#4E5573]">{t('subject.tutorial.promptHint')}</p>
        </>
      }
    >
      <div className="rounded-[18px] border border-[var(--border)] bg-white px-3 py-5"><TapAllowTutorial /></div>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px] leading-6 text-[#3C4262]">
        {['tip1', 'tip2', 'tip3'].map((k, i) => (
          <li key={k} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular" style={{ background: 'var(--brand-primary)', color: 'white' }}>{i + 1}</span>
            {t(`subject.tutorial.${k}`)}
          </li>
        ))}
      </ol>
      {simpleMode ? <FlowAlert tone="info">{t('subject.tutorial.simpleMode')}</FlowAlert> : null}
    </FlowScreen>
  )
}
