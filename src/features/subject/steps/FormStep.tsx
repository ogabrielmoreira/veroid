import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { NicheField } from '@/config/niches/types'
import { isValidCpf, maskCep, maskCpf, maskPhoneBr, onlyDigits } from '@/lib/validators'
import { FlowAlert, FlowButton, FlowScreen } from '../FlowUi'

export const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export function maskCurrency(v: string) {
  const d = onlyDigits(v).slice(0, 12)
  if (!d) return ''
  return (Number(d) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function validateField(f: NicheField, value: string, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  const v = value.trim()
  if (!v) return f.required ? t('subject.form.errors.required', { field: f.label }) : null
  switch (f.type) {
    case 'cpf': return isValidCpf(v) ? null : t('subject.form.errors.cpf')
    case 'cep': return onlyDigits(v).length === 8 ? null : t('subject.form.errors.cep')
    case 'phone': return [10, 11].includes(onlyDigits(v).length) ? null : t('subject.form.errors.phone')
    case 'date': {
      const d = new Date(v)
      if (Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900) return t('subject.form.errors.date')
      return null
    }
    case 'number': return Number(v.replace(',', '.')) >= 0 ? null : t('subject.form.errors.number')
    default: return v.length > 200 ? t('subject.form.errors.tooLong') : null
  }
}

function mask(f: NicheField, v: string) {
  if (f.type === 'cpf') return maskCpf(v)
  if (f.type === 'cep') return maskCep(v)
  if (f.type === 'phone') return maskPhoneBr(v)
  if (f.type === 'currency') return maskCurrency(v)
  return v
}

export function FormStep({ fields, initial, onChange, onSubmit }: {
  fields: NicheField[]; initial: Record<string, string>; onChange: (d: Record<string, string>) => void; onSubmit: (d: Record<string, string>) => void
}) {
  const { t, i18n } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [address, setAddress] = useState<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => onChange(values), [values, onChange])

  const set = (f: NicheField, raw: string) => {
    const v = mask(f, raw)
    setValues((cur) => ({ ...cur, [f.key]: v }))
    if (errors[f.key]) setErrors((e) => ({ ...e, [f.key]: null }))
  }

  const blur = async (f: NicheField) => {
    const err = validateField(f, values[f.key] ?? '', t)
    setErrors((e) => ({ ...e, [f.key]: err }))
    if (f.type === 'cep' && !err && values[f.key]) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${onlyDigits(values[f.key])}/json/`, { signal: AbortSignal.timeout(6000) })
        const body = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
        if (body.erro) { setErrors((e) => ({ ...e, [f.key]: t('subject.form.errors.cepNotFound') })); setAddress(null); return }
        setAddress([body.logradouro, body.bairro, body.localidade && `${body.localidade}/${body.uf}`].filter(Boolean).join(', '))
        setValues((cur) => ({ ...cur, ...(body.uf && fields.some((x) => x.key === 'property_uf') && !cur.property_uf ? { property_uf: body.uf } : {}) }))
      } catch { setAddress(null) }
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string | null> = {}
    for (const f of fields) next[f.key] = validateField(f, values[f.key] ?? '', t)
    setErrors(next)
    const failing = fields.filter((f) => next[f.key])
    if (failing.length === 0) return onSubmit(values)
    if (failing.length > 1) { setShowSummary(true); requestAnimationFrame(() => summaryRef.current?.focus()) }
    else document.getElementById(`f-${failing[0].key}`)?.focus()
  }

  const failing = fields.filter((f) => errors[f.key])
  const control = 'block w-full min-h-11 rounded-[var(--radius-sm)] border bg-white px-3 py-[11px] text-[16px] leading-[20px] text-[#10142B] border-[#B6BBD0] focus:outline-none focus:border-[var(--brand-500)] focus:shadow-[0_0_0_3px_rgba(71,86,201,.18)] aria-[invalid=true]:border-[#B3261E]'

  return (
    <FlowScreen stepKey="form" title={t('subject.form.title')} subtitle={t('subject.form.subtitle')}>
      <form id="subject-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
        {showSummary && failing.length > 1 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-[var(--radius-md)] border border-[rgba(179,38,30,.28)] bg-[#FBE9E7] p-[14px] text-[14px]">
            <p className="m-0 font-semibold text-[#8C1D18]">{t('auth.validation.summary', { count: failing.length })}</p>
            <ul className="m-0 mt-1 pl-5">{failing.map((f) => <li key={f.key}><a href={`#f-${f.key}`} className="text-[#8C1D18] underline">{f.label}</a></li>)}</ul>
          </div>
        ) : null}
        {fields.map((f) => {
          const id = `f-${f.key}`
          const err = errors[f.key]
          const common = {
            id, name: f.key, value: values[f.key] ?? '',
            'aria-invalid': err ? true : undefined,
            'aria-describedby': err ? `${id}-err` : f.type === 'cpf' ? `${id}-help` : undefined,
            onBlur: () => void blur(f),
            className: control,
          }
          const options = f.key === 'property_uf' ? UFS : f.options
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={id} className={`text-[14px] font-medium ${err ? 'text-[#8C1D18]' : 'text-[#10142B]'}`}>
                {f.label}{!f.required ? <span className="ml-1.5 font-normal text-[#4E5573]">({t('common.optional')})</span> : null}
              </label>
              {options ? (
                <select {...common} onChange={(e) => set(f, e.target.value)}>
                  <option value="">{t('subject.form.select')}</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  {...common}
                  onChange={(e) => set(f, e.target.value)}
                  type={f.type === 'date' ? 'date' : f.type === 'phone' ? 'tel' : 'text'}
                  inputMode={['cpf', 'cep', 'currency', 'phone'].includes(f.type) ? 'numeric' : f.type === 'number' ? 'decimal' : undefined}
                  autoComplete={f.key === 'name' ? 'name' : f.type === 'cep' ? 'postal-code' : f.type === 'date' ? 'bday' : 'off'}
                  lang={f.type === 'date' ? i18n.language : undefined}
                  max={f.type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                  placeholder={f.type === 'cpf' ? '000.000.000-00' : f.type === 'cep' ? '00000-000' : f.type === 'currency' ? 'R$ 0,00' : undefined}
                />
              )}
              {err ? <p id={`${id}-err`} className="m-0 text-[13px] text-[#8C1D18]">{err}</p>
                : f.type === 'cpf' ? <p id={`${id}-help`} className="m-0 text-[13px] text-[#4E5573]">{t('subject.form.cpfHelp')}</p>
                : f.type === 'cep' && address ? <p className="m-0 text-[13px] text-[#0B5C37]">{address}</p> : null}
            </div>
          )
        })}
        {fields.length === 0 ? <FlowAlert tone="info">{t('subject.form.noFields')}</FlowAlert> : null}
        <div className="pt-4">
          <FlowButton type="submit" iconRight="arrowRight">{t('common.continue')}</FlowButton>
        </div>
      </form>
    </FlowScreen>
  )
}
