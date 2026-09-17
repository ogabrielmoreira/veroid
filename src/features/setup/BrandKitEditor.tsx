import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { NICHES } from '@/config/niches'
import type { Organization } from '@/features/org/useMemberships'
import { SubjectIntro } from '@/features/subject/SubjectIntro'
import { authErrorMessage } from '@/lib/authErrors'
import { brandCssVars, FONT_OPTIONS, loadBrandFonts, RADIUS_SETS, resolveBrand, type BrandKit, type RadiusSet } from '@/lib/brand'
import { checkContrast, formatRatio, generateScale, normalizeHex, SCALE_STEPS } from '@/lib/color'
import { supabase } from '@/lib/supabase'

interface Props {
  org: Organization
  canEdit: boolean
  submitLabel?: string
  onSaved?: () => void
  secondaryAction?: ReactNode
}

const MAX_LOGO = 512 * 1024

export function BrandKitEditor({ org, canEdit, submitLabel, onSaved, secondaryAction }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const initial = useMemo(() => resolveBrand(org.brand_kit as BrandKit), [org.brand_kit])
  const [kit, setKit] = useState<BrandKit>({ ...initial, logo_light_url: (org.brand_kit as BrandKit)?.logo_light_url, logo_dark_url: (org.brand_kit as BrandKit)?.logo_dark_url })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'light' | 'dark' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewTab, setPreviewTab] = useState<'phone' | 'panel'>('phone')

  const b = resolveBrand(kit)
  useEffect(() => loadBrandFonts([b.font_display, b.font_text]), [b.font_display, b.font_text])

  const primaryCheck = checkContrast(b.primary, '#FFFFFF', 4.5)
  const accentCheck = checkContrast(b.accent, '#FFFFFF', 3)
  const secondaryCheck = checkContrast(b.secondary, '#FFFFFF', 3)
  const dirty = JSON.stringify(kit) !== JSON.stringify({ ...initial, logo_light_url: (org.brand_kit as BrandKit)?.logo_light_url, logo_dark_url: (org.brand_kit as BrandKit)?.logo_dark_url })
  const blockReason = !primaryCheck.passes ? t('brand.blockPrimary') : null

  const set = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => setKit((k) => ({ ...k, [key]: value }))

  const upload = async (variant: 'light' | 'dark', file: File) => {
    setError(null)
    if (!['image/svg+xml', 'image/png', 'image/webp'].includes(file.type)) return setError(t('brand.logoType'))
    if (file.size > MAX_LOGO) return setError(t('brand.logoSize'))
    setUploading(variant)
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `${org.id}/logo-${variant}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('brand').upload(path, file, { contentType: file.type, upsert: false })
    setUploading(null)
    if (upErr) return setError(authErrorMessage(upErr, t))
    const { data } = supabase.storage.from('brand').getPublicUrl(path)
    set(variant === 'light' ? 'logo_light_url' : 'logo_dark_url', data.publicUrl)
  }

  const save = async () => {
    if (blockReason) return
    setSaving(true)
    setError(null)
    const clean = Object.fromEntries(Object.entries(kit).filter(([, v]) => v !== undefined && v !== ''))
    const { error: err } = await supabase.from('organizations').update({ brand_kit: clean }).eq('id', org.id)
    setSaving(false)
    if (err) return setError(authErrorMessage(err, t))
    await qc.invalidateQueries({ queryKey: ['memberships'] })
    toast.show({ tone: 'success', title: t('brand.saved') })
    onSaved?.()
  }

  const purpose = NICHES[org.niche]?.consentCopy.purpose ?? ''

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
      <div className="flex flex-col gap-6">
        {error ? <Alert variant="error" live>{error}</Alert> : null}
        {!canEdit ? <Alert variant="neutral">{t('brand.readOnly')}</Alert> : null}

        <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
          <Section title={t('brand.logos')} help={t('brand.logosHelp')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <LogoInput label={t('brand.logoLight')} url={kit.logo_light_url} busy={uploading === 'light'} onFile={(f) => upload('light', f)} onClear={() => set('logo_light_url', undefined)} />
              <LogoInput label={t('brand.logoDark')} url={kit.logo_dark_url} dark busy={uploading === 'dark'} onFile={(f) => upload('dark', f)} onClear={() => set('logo_dark_url', undefined)} />
            </div>
          </Section>

          <Section title={t('brand.colors')} help={t('brand.colorsHelp')}>
            <div className="flex flex-col gap-4">
              <ColorInput label={t('brand.primary')} value={b.primary} onChange={(v) => set('primary', v)} check={primaryCheck} min="4.5:1" usage={t('brand.primaryUsage')} onUseSuggestion={(hex) => set('primary', hex)} />
              <ColorInput label={t('brand.secondary')} value={b.secondary} onChange={(v) => set('secondary', v)} check={secondaryCheck} min="3:1" usage={t('brand.secondaryUsage')} onUseSuggestion={(hex) => set('secondary', hex)} />
              <ColorInput label={t('brand.accent')} value={b.accent} onChange={(v) => set('accent', v)} check={accentCheck} min="3:1" usage={t('brand.accentUsage')} onUseSuggestion={(hex) => set('accent', hex)} />
              <div>
                <p className="m-0 t-overline text-[var(--ink-muted)]">{t('brand.scale')}</p>
                <div className="mt-2 grid grid-cols-10 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)]" aria-label={t('brand.scale')}>
                  {SCALE_STEPS.map((s) => {
                    const hex = generateScale(b.primary)[s]
                    return <span key={s} title={`${s} · ${hex}`} className="h-8" style={{ background: hex }} />
                  })}
                </div>
                <div className="mt-1 grid grid-cols-10 text-center t-micro text-[var(--ink-muted)]">
                  {SCALE_STEPS.map((s) => <span key={s} className="tabular">{s}</span>)}
                </div>
              </div>
            </div>
          </Section>

          <Section title={t('brand.typography')} help={t('brand.typographyHelp')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={t('brand.fontDisplay')} value={b.font_display} onChange={(e) => set('font_display', e.target.value as BrandKit['font_display'])}>
                {FONT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
              </SelectField>
              <SelectField label={t('brand.fontText')} value={b.font_text} onChange={(e) => set('font_text', e.target.value as BrandKit['font_text'])}>
                {FONT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
              </SelectField>
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="m-0 text-[22px] font-bold leading-7 tracking-[-0.02em] text-[var(--ink)]" style={{ fontFamily: `'${b.font_display}', system-ui` }}>
                {t('brand.specimenTitle')}
              </p>
              <p className="m-0 mt-1 text-[14px] leading-[22px]" style={{ fontFamily: `'${b.font_text}', system-ui` }}>
                {t('brand.specimenBody')} <span className="tabular">R$ 12.480,00 · 84/100</span>
              </p>
            </div>
          </Section>

          <Section title={t('brand.radius')}>
            <RadioCards
              name="radius"
              value={b.radius}
              onChange={(v) => set('radius', v as RadiusSet)}
              options={(Object.keys(RADIUS_SETS) as RadiusSet[]).map((r) => ({
                value: r,
                label: t(`brand.radius_${r}`),
                visual: <span className="block h-7 w-12 border-2 border-[var(--brand-primary)]" style={{ borderRadius: RADIUS_SETS[r].md }} />,
              }))}
            />
          </Section>

          <Section title={t('brand.tone')} help={t('brand.toneHelp')}>
            <RadioCards
              name="tone"
              value={b.tone}
              onChange={(v) => set('tone', v as 'formal' | 'friendly')}
              options={[
                { value: 'friendly', label: t('brand.tone_friendly'), visual: <span className="t-caption text-[var(--ink-muted)]">“{t('subject.intro.titleFriendly', { name: 'Ana', org: org.name })}”</span> },
                { value: 'formal', label: t('brand.tone_formal'), visual: <span className="t-caption text-[var(--ink-muted)]">“{t('subject.intro.titleFormal', { name: 'Ana', org: org.name })}”</span> },
              ]}
            />
          </Section>
        </fieldset>

        {canEdit ? (
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {secondaryAction ?? <span />}
              <Button onClick={save} loading={saving} disabled={Boolean(blockReason)}>
                {submitLabel ?? t('common.save')}
              </Button>
            </div>
            {blockReason ? <p className="m-0 text-right t-caption text-[var(--risk-review-ink)]">{blockReason}</p> : dirty ? <p className="m-0 text-right t-caption text-[var(--ink-muted)]">{t('brand.unsaved')}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Preview ao vivo */}
      <aside aria-label={t('brand.preview')} className="lg:sticky lg:top-24">
        <div className="mb-3 flex items-center justify-between">
          <p className="m-0 t-overline text-[var(--ink-muted)]">{t('brand.preview')}</p>
          <div role="group" aria-label={t('brand.preview')} className="flex rounded-full border border-[var(--border-strong)] p-0.5">
            {(['phone', 'panel'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={previewTab === v} onClick={() => setPreviewTab(v)}
                className={cn('min-h-9 rounded-full px-3 text-[12px]', previewTab === v ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-muted)]')}>
                {t(`brand.preview_${v}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="brand-scope" data-theme="light" style={brandCssVars(kit)}>
          {previewTab === 'phone' ? (
            <div className="mx-auto w-[300px] rounded-[38px] border-[10px] border-[#10142B] bg-[#10142B] shadow-[var(--shadow-modal)]">
              <div className="relative h-[600px] overflow-hidden rounded-[28px] bg-white" inert>
                <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#10142B]" />
                <div className="flex h-full flex-col overflow-hidden pt-4 [&>div]:flex-1">
                  <SubjectIntro orgName={org.name} kit={kit} firstName="Ana" purpose={purpose} preview />
                </div>
              </div>
            </div>
          ) : (
            <PanelPreview orgName={org.name} />
          )}
        </div>
      </aside>
    </div>
  )
}

function Section({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
      <h2 className="t-h4 font-sans">{title}</h2>
      {help ? <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{help}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ColorInput({ label, value, onChange, check, min, usage, onUseSuggestion }: {
  label: string; value: string; onChange: (v: string) => void; check: ReturnType<typeof checkContrast>; min: string; usage: string; onUseSuggestion: (hex: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = (raw: string) => {
    const hex = normalizeHex(raw)
    if (hex) onChange(hex)
    else setText(value)
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={id} className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <span className="t-label text-[var(--ink)]">{label}</span>
          <span className="t-caption text-[var(--ink-muted)]">{usage}</span>
        </label>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} — seletor`}
          className="h-11 w-11 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-transparent p-1 lg:h-10 lg:w-10"
        />
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(text) } }}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          className="tabular h-11 w-[108px] rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-[14px] uppercase text-[var(--ink)] focus:border-[var(--brand-500)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(71,86,201,.18)] lg:h-10"
        />
        <span
          className={cn(
            'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-[11px] text-[12px] font-medium',
            check.passes ? 'border-[rgba(15,122,74,.28)] bg-[var(--risk-low-bg)] text-[var(--risk-low-ink)]' : 'border-[rgba(176,106,0,.28)] bg-[var(--risk-review-bg)] text-[var(--risk-review-ink)]',
          )}
        >
          <Icon name={check.passes ? 'approved' : 'review'} size={16} />
          <span className="tabular">{formatRatio(check.ratio)}</span>
          <span className="sr-only">{check.passes ? t('brand.passes', { min }) : t('brand.fails', { min })}</span>
        </span>
      </div>
      {!check.passes ? (
        <Alert variant="warning">
          {t('brand.contrastWarning', { ratio: formatRatio(check.ratio), min })}
          {check.suggestion ? (
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-block size-5 rounded-[4px] border border-black/10" style={{ background: check.suggestion.hex }} aria-hidden="true" />
              <button type="button" onClick={() => onUseSuggestion(check.suggestion!.hex)} className="font-medium text-[var(--link)] underline underline-offset-2">
                {t('brand.useSuggestion', { hex: check.suggestion.hex, step: check.suggestion.step, ratio: formatRatio(check.suggestion.ratio) })}
              </button>
            </span>
          ) : null}
        </Alert>
      ) : null}
    </div>
  )
}

function LogoInput({ label, url, dark, busy, onFile, onClear }: { label: string; url?: string; dark?: boolean; busy: boolean; onFile: (f: File) => void; onClear: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="t-label text-[var(--ink)]">{label}</span>
      <div className={cn('grid h-24 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-3', dark ? 'bg-[#0C1024]' : 'bg-white')}>
        {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : <Icon name="image" size={24} className={dark ? 'text-[#6A7192]' : 'text-[var(--n-400)]'} />}
      </div>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={id} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 text-[13px] font-medium text-[var(--ink)] hover:border-[var(--brand-primary)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus-ring)]">
          <Icon name="upload" size={16} />
          {busy ? t('common.loading') : url ? t('brand.replace') : t('brand.upload')}
          <input id={id} type="file" accept="image/svg+xml,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        </label>
        {url ? <Button variant="ghost" onClick={onClear}>{t('brand.remove')}</Button> : null}
      </div>
      <p className="m-0 t-caption text-[var(--ink-muted)]">{t('brand.logoReq')}</p>
    </div>
  )
}

function RadioCards({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string; visual: ReactNode }> }) {
  return (
    <div role="radiogroup" className="grid gap-3 sm:grid-cols-3 [&:has(>label:nth-child(2):last-child)]:sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.value} className={cn(
          'flex cursor-pointer flex-col gap-2 rounded-[var(--radius-md)] border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]',
          value === o.value ? 'border-[var(--brand-primary)] shadow-[inset_0_0_0_1px_var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]',
        )}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.visual}
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)]">
            {value === o.value ? <Icon name="approved" size={16} className="text-[var(--brand-primary)]" /> : null}
            {o.label}
          </span>
        </label>
      ))}
    </div>
  )
}

function PanelPreview({ orgName }: { orgName: string }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[#D7DAE8] bg-[#F5F6FA] text-[#3C4262] shadow-[var(--shadow-raised)]" inert>
      <div className="flex">
        <div className="w-[118px] shrink-0 border-r border-[#D7DAE8] p-2.5">
          <p className="m-0 truncate px-1 text-[11px] font-semibold text-[#10142B]">{orgName}</p>
          {['home', 'link', 'evidence', 'users'].map((ic, i) => (
            <div key={ic} className="mt-1.5 flex items-center gap-1.5 px-1.5 py-1.5 text-[11px]"
              style={i === 0 ? { background: 'var(--brand-primary)', color: '#fff', borderRadius: 'var(--radius-md)', boxShadow: 'inset 3px 0 0 var(--brand-300)' } : undefined}>
              <Icon name={ic as 'home'} size={16} />
              <span className="h-1.5 flex-1 rounded-full" style={{ background: i === 0 ? 'rgba(255,255,255,.55)' : '#D7DAE8' }} />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-white p-4">
          <p className="m-0 text-[16px] font-bold text-[#10142B]" style={{ fontFamily: 'var(--font-display)' }}>{t('app.nav.links')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {['—', '92%'].map((v) => (
              <div key={v} className="border border-[#EBEDF4] bg-[#F5F6FA] p-2" style={{ borderRadius: 'var(--radius-md)' }}>
                <span className="block h-1.5 w-12 rounded-full bg-[#D7DAE8]" />
                <span className="mt-1.5 block text-[16px] font-semibold text-[#10142B] tabular">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(15,122,74,.28)] bg-[#E6F2EB] px-2 py-0.5 text-[10px] font-medium text-[#0B5C37]"><Icon name="approved" size={16} />Aprovado</span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-200)' }}><Icon name="link" size={16} />Link aberto</span>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="inline-flex min-h-8 items-center px-3 text-[11px] font-medium text-white" style={{ background: 'var(--brand-primary)', borderRadius: 'var(--radius-md)' }}>{t('links.new')}</span>
            <span className="inline-flex min-h-8 items-center border px-3 text-[11px] font-medium text-[#10142B]" style={{ borderColor: '#B6BBD0', borderRadius: 'var(--radius-md)' }}>{t('links.batch')}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EBEDF4]"><div className="h-full w-2/3" style={{ background: 'var(--brand-accent)' }} /></div>
        </div>
      </div>
    </div>
  )
}
