import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Chip, type ChipTone } from '@/components/ui/Chip'
import { InputField } from '@/components/ui/Field'
import { Icon, type IconName } from '@/components/ui/Icon'
import { brandCssVars } from '@/lib/brand'
import { checkContrast, formatRatio, normalizeHex } from '@/lib/color'
import { DemoCharts } from './DemoCharts'
import { fakeHost, OnboardingSimulator } from './OnboardingSimulator'
import { SpotlightTour, type TourStep } from './SpotlightTour'

/**
 * Portal de demonstração do Vero ID. Tudo aqui é fictício e roda só no navegador:
 * não há câmera, foto, documento, envio de mensagens, backend nem coleta de dados pessoais.
 * As únicas coisas que a pessoa altera (nome e cor da marca) ficam no armazenamento local do navegador.
 */
type Tab = 'overview' | 'links' | 'leads' | 'review' | 'simulator' | 'settings'

const TABS: Array<{ k: Tab; icon: IconName }> = [
  { k: 'overview', icon: 'dashboard' }, { k: 'links', icon: 'link' }, { k: 'leads', icon: 'personSearch' },
  { k: 'review', icon: 'factCheck' }, { k: 'simulator', icon: 'phone' }, { k: 'settings', icon: 'settings' },
]
const TOUR: TourStep[] = [
  { key: 'welcome', tab: 'overview', lottie: 'wave' },
  { key: 'nav', tab: 'overview', target: 'nav', lottie: 'bulb' },
  { key: 'customize', tab: 'overview', target: 'tenant', lottie: 'party' },
  { key: 'overview', tab: 'overview', target: 'kpis', lottie: 'chart' },
  { key: 'linksForm', tab: 'links', target: 'link-form', lottie: 'bulb' },
  { key: 'linksOff', tab: 'links', target: 'send-off', lottie: 'lock' },
  { key: 'leads', tab: 'leads', target: 'leads', lottie: 'bulb' },
  { key: 'review', tab: 'review', target: 'review', lottie: 'check' },
  { key: 'simulator', tab: 'simulator', target: 'phone', lottie: 'rocket' },
  { key: 'settings', tab: 'settings', target: 'settings', lottie: 'check' },
  { key: 'official', tab: 'overview', lottie: 'lock' },
]

const LS_NAME = 'veroid.demo.name'
const LS_COLOR = 'veroid.demo.color'
const read = (k: string, fb: string, s = localStorage) => { try { return s.getItem(k) ?? fb } catch { return fb } }
const write = (k: string, v: string, s = localStorage) => { try { s.setItem(k, v) } catch { /* modo privado */ } }

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•'

export function DemoWorkspace() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('overview')
  const [drawer, setDrawer] = useState(false)
  const [name, setName] = useState(() => read(LS_NAME, 'Lorem Ipsum S.A.'))
  const [color, setColor] = useState(() => read(LS_COLOR, '#3F4FB8'))
  const [tourOpen, setTourOpen] = useState(true) // o tutorial abre a cada acesso
  const [tourIdx, setTourIdx] = useState(0)

  useEffect(() => { write(LS_NAME, name) }, [name])
  useEffect(() => { write(LS_COLOR, color) }, [color])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])
  const vars = useMemo(() => brandCssVars({ primary: normalizeHex(color) ?? '#3F4FB8', accent: normalizeHex(color) ?? '#3F4FB8' }), [color])

  const goTour = (i: number) => { setTourIdx(i); const tb = TOUR[i].tab as Tab | undefined; if (tb) setTab(tb) }
  const finishTour = () => { setTourOpen(false); setTab('overview') }
  const restart = () => { setDrawer(false); goTour(0); setTourOpen(true) }
  const pick = (k: Tab) => { setTab(k); setDrawer(false) }

  const nav = (
    <nav aria-label={t('demoApp.title')} className="flex flex-col gap-1">
      {TABS.map(({ k, icon }) => (
        <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} onClick={() => pick(k)}
          className={`group relative flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 text-left text-[15px] font-medium transition-colors ${tab === k ? 'bg-[var(--brand-600)] text-white' : 'text-[var(--ink-body)] hover:bg-[var(--n-100)]'}`}>
          <Icon name={icon} size={20} />{t(`demoApp.tabs.${k}`)}
        </button>
      ))}
    </nav>
  )

  return (
    <div data-theme="light" style={{ ...vars, ['--surface-page' as string]: '#F4F3EF' }} className="min-h-dvh bg-[var(--surface-page)] lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* menu lateral (desktop) */}
      <aside data-tour="nav" className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-[var(--border)] bg-[var(--surface)] p-5 lg:flex">
        <Logo />
        <div data-tour="tenant" className="flex items-center gap-3 rounded-[14px] bg-[var(--n-50)] p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] font-display text-[15px] font-bold text-white" style={{ background: 'var(--brand-600)' }} aria-hidden="true">{initialsOf(name)}</span>
          <span className="min-w-0"><span className="block truncate text-[14px] font-semibold text-[var(--ink)]">{name}</span><span className="block t-caption text-[var(--ink-muted)]">{t('demoApp.tenant')}</span></span>
        </div>
        {nav}
        <div className="mt-auto flex flex-col gap-3">
          <Button variant="secondary" icon="help" onClick={restart} block>{t('demoApp.tour.restart')}</Button>
          <p className="m-0 text-[11px] leading-4 text-[var(--ink-subtle)]">{t('demoApp.credits')}</p>
        </div>
      </aside>

      {/* barra superior + gaveta (celular/tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3"><button type="button" aria-label={t('demoApp.menu')} aria-expanded={drawer} onClick={() => setDrawer(true)} className="grid size-11 place-items-center rounded-full hover:bg-[var(--n-100)]"><Icon name="dashboard" size={24} /></button><Logo /></div>
      </header>
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('demoApp.menu')}>
          <button type="button" aria-label={t('demoApp.menuClose')} className="absolute inset-0 bg-black/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col gap-5 bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)]">
            <div className="flex items-center justify-between"><Logo /><button type="button" aria-label={t('demoApp.menuClose')} onClick={() => setDrawer(false)} className="grid size-11 place-items-center rounded-full hover:bg-[var(--n-100)]"><Icon name="close" size={24} /></button></div>
            {nav}
            <div className="mt-auto flex flex-col gap-3"><Button variant="secondary" icon="help" onClick={restart} block>{t('demoApp.tour.restart')}</Button><p className="m-0 text-[11px] leading-4 text-[var(--ink-subtle)]">{t('demoApp.credits')}</p></div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <div data-tour="notice" className="flex items-start gap-3 bg-[var(--brand-900)] px-[clamp(16px,4vw,48px)] py-3 text-white">
          <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-[#9FE8C2]" />
          <p className="m-0 text-[13px] leading-5"><strong className="font-semibold">{t('demoApp.safeTitle')}.</strong> {t('demoApp.strip')}</p>
        </div>
        <main id="main" className="mx-auto flex max-w-[1120px] flex-col gap-6 px-[clamp(16px,4vw,48px)] py-8 pb-16">
          <header className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display text-[clamp(26px,3.4vw,34px)] font-bold leading-[1.1] tracking-[-0.03em]">{t(`demoApp.tabs.${tab}`)}</h1>
            <p className="m-0 max-w-[68ch] t-body-lg text-[var(--ink-muted)]">{t(`demoApp.notes.${tab}`)}</p>
          </header>

          {tab === 'overview' ? <DemoCharts /> : null}
          {tab === 'links' ? <LinksTab name={name} /> : null}
          {tab === 'leads' ? <LeadsTab /> : null}
          {tab === 'review' ? <ReviewTab /> : null}
          {tab === 'simulator' ? <SimulatorTab name={name} /> : null}
          {tab === 'settings' ? <SettingsTab name={name} setName={setName} color={color} setColor={setColor} /> : null}
        </main>
      </div>

      {tourOpen ? <SpotlightTour steps={TOUR} index={tourIdx} onIndex={goTour} onFinish={finishTour}
        extra={(key) => key === 'customize' ? <TourCustomize name={name} setName={setName} color={color} setColor={setColor} /> : null} /> : null}
    </div>
  )
}

/** Botão desativado com motivo visível (não só tooltip). */
function Off({ icon, children }: { icon: IconName; children: ReactNode }) {
  const { t } = useTranslation()
  return <Button variant="secondary" icon={icon} disabled title={t('demoApp.disabledHint')} aria-label={`${String(children)} (${t('demoApp.disabledHint')})`}>{children}</Button>
}
function OffBadge() {
  const { t } = useTranslation()
  return <Chip tone="neutral" icon="lock">{t('demoApp.disabledBadge')}</Chip>
}

/* ───────────── Links ───────────── */
interface FakeLink { id: string; label: string; expires: string }
const maskToken = () => 'demo-••••••••'

function LinksTab({ name }: { name: string }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const [validity, setValidity] = useState('48')
  const [links, setLinks] = useState<FakeLink[]>([
    { id: 'seed1', label: 'Lorem Ipsum 01', expires: '+48 h' },
    { id: 'seed2', label: 'Dolor Sit 02', expires: '+24 h' },
  ])
  const create = (e: FormEvent) => {
    e.preventDefault()
    setLinks((l) => [{ id: String(Date.now()), label: label.trim() || `Lorem Ipsum ${String(l.length + 1).padStart(2, '0')}`, expires: `+${validity} h` }, ...l])
    setLabel('')
  }
  return (
    <section className="flex flex-col gap-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <form data-tour="link-form" onSubmit={create} className="flex h-fit flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
          <h2 className="font-sans text-[15px] font-semibold text-[var(--ink)]">{t('demoApp.links.new')}</h2>
          <InputField id="lk-label" label={t('demoApp.links.label')} help={t('demoApp.links.labelHelp')} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lk-val" className="t-label text-[var(--ink)]">{t('demoApp.links.validity')}</label>
            <select id="lk-val" value={validity} onChange={(e) => setValidity(e.target.value)} className="min-h-11 rounded-sm border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-[16px] lg:text-[14px]">
              {['24', '48', '168'].map((v) => <option key={v} value={v}>{t('demoApp.links.hours', { n: v })}</option>)}
            </select>
          </div>
          <Button type="submit" icon="link">{t('demoApp.links.generate')}</Button>
          <div data-tour="send-off" className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
            <p className="m-0 t-label text-[var(--ink)]">{t('demoApp.links.sendVia')} <OffBadge /></p>
            <div className="flex flex-wrap gap-2">
              <Off icon="chat">WhatsApp</Off><Off icon="signal">SMS</Off><Off icon="mail">E-mail</Off><Off icon="qr">QR Code</Off>
            </div>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 font-sans text-[15px] font-semibold text-[var(--ink)]">{t('demoApp.links.list')}</h2>
            <div className="flex flex-wrap gap-2"><Off icon="plus">{t('demoApp.links.batch')}</Off><Off icon="export">{t('demoApp.links.export')}</Off></div>
          </div>
          {links.map((l) => (
            <article key={l.id} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4">
              <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-center gap-2 font-semibold text-[var(--ink)]">{l.label} <Chip tone="neutral" icon="info">{t('demoApp.links.simulated')}</Chip></p>
                <p className="m-0 mt-1 font-mono text-[12px] text-[var(--ink-muted)]" aria-label={t('demoApp.links.tokenHidden')}>https://{fakeHost(name)}/v/{maskToken()}</p>
                <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('demoApp.links.expires', { when: l.expires })} · {t('demoApp.links.tokenHidden')}</p>
              </div>
              <div className="flex flex-wrap gap-2"><Off icon="copy">{t('demoApp.links.copy')}</Off><Off icon="chat">WhatsApp</Off><Off icon="qr">QR Code</Off></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────── Leads ───────────── */
const LEADS: Array<{ id: string; name: string; origin: 'auto' | 'manual'; score: number; status: 'qualified' | 'analysis' | 'notQualified' }> = [
  { id: 'L-001', name: 'Lorem Ipsum 01', origin: 'auto', score: 92, status: 'qualified' },
  { id: 'L-002', name: 'Dolor Sit 02', origin: 'auto', score: 88, status: 'qualified' },
  { id: 'L-003', name: 'Amet Consectetur 03', origin: 'manual', score: 74, status: 'analysis' },
  { id: 'L-004', name: 'Adipiscing Elit 04', origin: 'auto', score: 81, status: 'qualified' },
  { id: 'L-005', name: 'Sed Do 05', origin: 'manual', score: 47, status: 'notQualified' },
  { id: 'L-006', name: 'Eiusmod Tempor 06', origin: 'auto', score: 69, status: 'analysis' },
  { id: 'L-007', name: 'Incididunt Ut 07', origin: 'auto', score: 95, status: 'qualified' },
]
const LEAD_TONE: Record<string, ChipTone> = { qualified: 'low', analysis: 'review', notQualified: 'high' }
const LEAD_ICON: Record<string, IconName> = { qualified: 'approved', analysis: 'review', notQualified: 'rejected' }

function LeadsTab() {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2"><Off icon="export">{t('demoApp.leads.export')}</Off><Off icon="plus">{t('demoApp.leads.import')}</Off></div>
      <div data-tour="leads" className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
          <caption className="sr-only">{t('demoApp.tabs.leads')}</caption>
          <thead><tr className="border-b border-[var(--divider)] t-overline text-[var(--ink-muted)]">
            {['lead', 'doc', 'origin', 'score', 'status'].map((c) => <th key={c} scope="col" className="px-4 py-3 font-medium">{t(`demoApp.leads.cols.${c}`)}</th>)}
          </tr></thead>
          <tbody>
            {LEADS.map((r) => (
              <tr key={r.id} className="border-b border-[var(--divider)] last:border-0">
                <td className="px-4 py-3"><span className="font-mono text-[12px] text-[var(--ink-muted)]">{r.id}</span> {r.name}</td>
                <td className="px-4 py-3 font-mono text-[var(--ink-muted)]">•••.•••.•••-••</td>
                <td className="px-4 py-3">{t(`demoApp.leads.origin.${r.origin}`)}</td>
                <td className="px-4 py-3 tabular">{r.score}</td>
                <td className="px-4 py-3"><Chip tone={LEAD_TONE[r.status]} icon={LEAD_ICON[r.status]}>{t(`demoApp.leads.status.${r.status}`)}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.leads.note')}</p>
    </section>
  )
}

/* ───────────── Fila de revisão ───────────── */
type Decision = 'pending' | 'approved' | 'rejected'
const REVIEW = [
  { id: 'S-0412', score: 61, signal: 'lowLight' }, { id: 'S-0413', score: 52, signal: 'device' },
  { id: 'S-0414', score: 58, signal: 'doc' }, { id: 'S-0415', score: 66, signal: 'lowLight' },
]

function ReviewTab() {
  const { t } = useTranslation()
  const [sel, setSel] = useState(REVIEW[0].id)
  const [dec, setDec] = useState<Record<string, Decision>>({})
  const cur = REVIEW.find((r) => r.id === sel)!
  const d = dec[sel] ?? 'pending'
  return (
    <section className="flex flex-col gap-4">
      <div data-tour="review" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {REVIEW.map((r) => {
            const rd = dec[r.id] ?? 'pending'
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setSel(r.id)} aria-pressed={sel === r.id}
                  className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] border p-4 text-left ${sel === r.id ? 'border-[var(--brand-500)] bg-[var(--brand-50)]' : 'border-[var(--border)] bg-[var(--surface-raised)]'}`}>
                  <span><span className="font-mono">{r.id}</span> <span className="t-caption text-[var(--ink-muted)]">· {t('demoApp.review.score')} {r.score}</span></span>
                  <Chip tone={rd === 'approved' ? 'low' : rd === 'rejected' ? 'high' : 'review'} icon={rd === 'approved' ? 'approved' : rd === 'rejected' ? 'rejected' : 'review'}>{t(`demoApp.review.state.${rd}`)}</Chip>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-20 shrink-0 place-items-center rounded-full bg-[var(--n-100)] text-[var(--ink-muted)]" aria-hidden="true"><Icon name="subject" size={30} /></span>
            <div>
              <p className="m-0 font-mono text-[15px] font-semibold">{cur.id}</p>
              <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('demoApp.review.noFace')}</p>
            </div>
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 t-body">
            <dt className="text-[var(--ink-muted)]">{t('demoApp.review.score')}</dt><dd className="m-0 tabular">{cur.score}/100</dd>
            <dt className="text-[var(--ink-muted)]">{t('demoApp.review.signal')}</dt><dd className="m-0">{t(`demoApp.review.signals.${cur.signal}`)}</dd>
            <dt className="text-[var(--ink-muted)]">{t('demoApp.review.token')}</dt><dd className="m-0 font-mono text-[var(--ink-muted)]">demo-••••••••</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button icon="approved" onClick={() => setDec((x) => ({ ...x, [sel]: 'approved' }))}>{t('demoApp.review.approve')}</Button>
            <Button variant="secondary" icon="rejected" onClick={() => setDec((x) => ({ ...x, [sel]: 'rejected' }))}>{t('demoApp.review.reject')}</Button>
            {d !== 'pending' ? <Button variant="ghost" onClick={() => setDec((x) => ({ ...x, [sel]: 'pending' }))}>{t('demoApp.review.undo')}</Button> : null}
          </div>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.review.note')}</p>
        </div>
      </div>
    </section>
  )
}

/* ───────────── Simulador de onboarding (animação, sem câmera) ───────────── */
function SimulatorTab({ name }: { name: string }) {
  return (
    <section className="flex flex-col gap-5">
      <OnboardingSimulator name={name} />
    </section>
  )
}

/* ───────────── Configurações: só nome e cor ───────────── */
function SettingsTab({ name, setName, color, setColor }: { name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void }) {
  const { t } = useTranslation()
  const c = normalizeHex(color) ?? '#3F4FB8'
  const check = checkContrast(c, '#FFFFFF')
  return (
    <section className="flex flex-col gap-4">
      <div data-tour="settings" className="flex max-w-[460px] flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
        <InputField id="br-name" label={t('demoApp.settings.name')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="br-color" className="t-label text-[var(--ink)]">{t('demoApp.settings.color')}</label>
          <div className="flex items-center gap-2">
            <input id="br-color" type="color" value={c} onChange={(e) => setColor(e.target.value)} className="size-11 cursor-pointer rounded-sm border border-[var(--input-border)] bg-transparent p-1" />
            <input aria-label={t('demoApp.settings.color')} value={color} onChange={(e) => setColor(e.target.value)} className="min-h-11 w-32 rounded-sm border border-[var(--input-border)] bg-[var(--input-bg)] px-3 font-mono text-[14px]" />
          </div>
          <p className={`m-0 t-caption ${check.passes ? 'text-[var(--risk-low-ink)]' : 'text-[var(--risk-high-ink)]'}`}>
            {check.passes ? t('demoApp.settings.contrastOk', { r: formatRatio(check.ratio) }) : t('demoApp.settings.contrastBad', { r: formatRatio(check.ratio), hex: check.suggestion?.hex ?? '' })}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="m-0 t-label text-[var(--ink)]">{t('demoApp.settings.logo')} <OffBadge /></p>
          <div className="grid h-12 w-40 place-items-center rounded-sm border border-dashed border-[var(--border-strong)] font-semibold text-[var(--ink-muted)]">Lorem</div>
          <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.settings.logoOff')}</p>
        </div>
        <p className="m-0 t-caption text-[var(--ink-muted)]">{t('demoApp.settings.local')}</p>
      </div>
    </section>
  )
}

/** Personalização dentro do tutorial: nome e cor da empresa, aplicados ao vivo. Fica só no navegador. */
function TourCustomize({ name, setName, color, setColor }: { name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void }) {
  const { t } = useTranslation()
  const c = normalizeHex(color) ?? '#3F4FB8'
  return (
    <div className="flex flex-col gap-3 rounded-[14px] bg-[var(--n-50)] p-3">
      <InputField id="tour-name" label={t('demoApp.settings.name')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      <div className="flex items-center gap-2">
        <label htmlFor="tour-color" className="t-label text-[var(--ink)]">{t('demoApp.settings.color')}</label>
        <input id="tour-color" type="color" value={c} onChange={(e) => setColor(e.target.value)} className="size-10 cursor-pointer rounded-sm border border-[var(--input-border)] bg-transparent p-1" />
        <span className="font-mono text-[13px] text-[var(--ink-muted)]">{c.toUpperCase()}</span>
      </div>
    </div>
  )
}
