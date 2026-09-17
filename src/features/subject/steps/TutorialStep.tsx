import { useTranslation } from 'react-i18next'
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
      <div className="relative mx-auto aspect-square w-full max-w-[240px]" aria-hidden="true">
        <svg viewBox="0 0 240 240" className="h-full w-full">
          <rect x="8" y="8" width="224" height="224" rx="28" fill="var(--brand-50)" />
          <ellipse cx="120" cy="114" rx="62" ry="80" fill="white" stroke="var(--brand-500)" strokeWidth="3" />
          <g className="veroid-tut-face">
            <ellipse cx="120" cy="114" rx="40" ry="52" fill="var(--brand-100)" />
            <circle cx="104" cy="104" r="4" fill="var(--brand-800)" className="veroid-tut-eye" />
            <circle cx="136" cy="104" r="4" fill="var(--brand-800)" className="veroid-tut-eye" />
            <path d="M106 134 q14 10 28 0" stroke="var(--brand-800)" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
          <path d="M62 214h116" stroke="var(--brand-200)" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .veroid-tut-face { animation: veroid-tut 3.6s var(--ease-in) infinite; transform-origin: 120px 114px; }
            .veroid-tut-eye { animation: veroid-blink 3.6s steps(1) infinite; transform-origin: center; transform-box: fill-box; }
            @keyframes veroid-tut { 0%,20% { transform: scale(.8) translateY(18px); opacity:.6 } 45%,100% { transform: scale(1) translateY(0); opacity:1 } }
            @keyframes veroid-blink { 0%,70% { transform: scaleY(1) } 72%,76% { transform: scaleY(.1) } 78%,100% { transform: scaleY(1) } }
          }
        `}</style>
      </div>
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
