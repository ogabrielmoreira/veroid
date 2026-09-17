import { useTranslation } from 'react-i18next'
import type { NicheField } from '@/config/niches/types'
import { Icon } from '@/components/ui/Icon'
import { FlowAlert, FlowButton, FlowScreen } from '../FlowUi'

export function ReviewStep({ fields, values, selfieUrl, hasDocument, busy, error, onEdit, onSubmit }: {
  fields: NicheField[]; values: Record<string, string>; selfieUrl: string | null; hasDocument: boolean
  busy: boolean; error: string | null; onEdit: (step: 'capture' | 'document' | 'form') => void; onSubmit: () => void
}) {
  const { t } = useTranslation()
  const shown = (f: NicheField, v: string) =>
    f.type === 'cpf' ? v.replace(/^(\d{3})\.(\d{3})/, '***.***')
      : f.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/')
      : v
  return (
    <FlowScreen stepKey="review" title={t('subject.review.title')} subtitle={t('subject.review.subtitle')}
      actions={
        <>
          {error ? <FlowAlert tone="error">{error}</FlowAlert> : null}
          <FlowButton onClick={onSubmit} loading={busy} icon="send">{t('subject.review.submit')}</FlowButton>
          <p className="m-0 text-center text-[13px] text-[#4E5573]">{t('subject.review.note')}</p>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[#D7DAE8] p-3">
        {selfieUrl ? <img src={selfieUrl} alt={t('subject.review.selfieAlt')} className="size-16 -scale-x-100 rounded-[var(--radius-sm)] object-cover" />
          : <span className="grid size-16 place-items-center rounded-[var(--radius-sm)] bg-[#E6F2EB] text-[#0B5C37]"><Icon name="approved" size={24} /></span>}
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] font-medium text-[#10142B]">{t('subject.review.selfie')}</p>
          <p className="m-0 text-[13px] text-[#4E5573]">{t('subject.review.selfieOk')}</p>
        </div>
        <button type="button" onClick={() => onEdit('capture')} className="min-h-11 px-2 text-[14px] font-medium text-[var(--brand-700)] underline">{t('subject.review.redo')}</button>
      </div>
      {hasDocument ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[#D7DAE8] p-3">
          <span className="grid size-16 place-items-center rounded-[var(--radius-sm)] bg-[#E6F2EB] text-[#0B5C37]"><Icon name="evidence" size={24} /></span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[15px] font-medium text-[#10142B]">{t('subject.review.document')}</p>
            <p className="m-0 text-[13px] text-[#4E5573]">{t('subject.review.documentOk')}</p>
          </div>
          <button type="button" onClick={() => onEdit('document')} className="min-h-11 px-2 text-[14px] font-medium text-[var(--brand-700)] underline">{t('subject.review.redo')}</button>
        </div>
      ) : null}
      {fields.length ? (
        <div className="rounded-[var(--radius-md)] border border-[#D7DAE8]">
          <div className="flex items-center justify-between border-b border-[#EBEDF4] px-3 py-2">
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[.1em] text-[#4E5573]">{t('subject.review.data')}</p>
            <button type="button" onClick={() => onEdit('form')} className="min-h-11 px-2 text-[14px] font-medium text-[var(--brand-700)] underline">{t('subject.review.edit')}</button>
          </div>
          <dl className="m-0 px-3 py-1">
            {fields.filter((f) => values[f.key]).map((f) => (
              <div key={f.key} className="flex justify-between gap-3 border-b border-[#EBEDF4] py-2 last:border-b-0">
                <dt className="text-[14px] text-[#4E5573]">{f.label}</dt>
                <dd className="m-0 text-right text-[14px] font-medium text-[#10142B] tabular">{shown(f, values[f.key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </FlowScreen>
  )
}
