import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { Menu } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { SegmentedFilter } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { SkeletonBlock } from '@/features/setup/FlowEditor'
import { authErrorMessage } from '@/lib/authErrors'
import { supabase } from '@/lib/supabase'
import { BatchModal } from './BatchModal'
import { LinkResult, type CreatedLink } from './LinkResult'
import { NewLinkModal } from './NewLinkModal'
import { CHANNEL_ICON, formatPhone, linkErrorMessage, linkUrl, STATUS_META, type LinkRow, type LinkStatus } from './linkUtils'

type Filter = 'all' | 'active' | 'opened' | 'completed' | 'expired' | 'canceled'
const FILTER_STATUSES: Record<Filter, LinkStatus[] | null> = {
  all: null, active: ['created', 'sent'], opened: ['opened', 'in_progress'], completed: ['completed'], expired: ['expired'], canceled: ['canceled'],
}
const PAGE = 20
const CANCEL_REASONS = ['mistake', 'gaveUp', 'wrongData', 'other'] as const

export function LinksPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { membership } = useCurrentOrg()
  const org = membership!.organization
  const canSend = membership!.role !== 'viewer'

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [newOpen, setNewOpen] = useState(params.get('novo') === '1')
  const [batchOpen, setBatchOpen] = useState(false)
  const [resent, setResent] = useState<CreatedLink | null>(null)
  const [canceling, setCanceling] = useState<LinkRow | null>(null)
  const [reason, setReason] = useState<string>('')

  useEffect(() => { const id = window.setTimeout(() => setDebounced(search.trim()), 300); return () => window.clearTimeout(id) }, [search])
  useEffect(() => setPage(0), [filter, debounced])

  const links = useQuery({
    queryKey: ['links', org.id, filter, debounced, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('verification_links_view')
        .select('id, organization_id, subject_name, phone, email, channel, reference, status, expires_at, created_at, sent_at, opened_at, resend_count', { count: 'exact' })
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1)
      const statuses = FILTER_STATUSES[filter]
      if (statuses) q = q.in('status', statuses)
      if (debounced) {
        const s = debounced.replace(/[%,()]/g, ' ')
        q = q.or(`subject_name.ilike.%${s}%,reference.ilike.%${s}%`)
      }
      const { data, error, count } = await q
      if (error) throw error
      return { rows: (data ?? []) as LinkRow[], count: count ?? 0 }
    },
  })

  const resend = useMutation({
    mutationFn: async (row: LinkRow) => {
      const { data, error } = await supabase.rpc('resend_verification_link', { p_link_id: row.id, p_expires_hours: 24 })
      if (error) throw error
      const r = (data as Array<{ link_id: string; token: string; expires_at: string }>)[0]
      return { id: r.link_id, url: linkUrl(r.token), expiresAt: r.expires_at, hours: 24, name: row.subject_name, phone: row.phone, email: row.email, channel: row.channel } satisfies CreatedLink
    },
    onSuccess: (link) => { setResent(link); void qc.invalidateQueries({ queryKey: ['links', org.id] }) },
    onError: (e) => toast.show({ tone: 'error', title: linkErrorMessage(e, t) ?? authErrorMessage(e, t) }),
  })

  const cancel = useMutation({
    mutationFn: async ({ row, why }: { row: LinkRow; why: string }) => {
      const { error } = await supabase.rpc('cancel_verification_link', { p_link_id: row.id, p_reason: why })
      if (error) throw error
    },
    onSuccess: () => {
      setCanceling(null); setReason('')
      toast.show({ tone: 'success', title: t('links.canceled') })
      void qc.invalidateQueries({ queryKey: ['links', org.id] })
    },
    onError: (e) => toast.show({ tone: 'error', title: linkErrorMessage(e, t) ?? authErrorMessage(e, t) }),
  })

  const simulate = useMutation({
    mutationFn: async () => {
      const win = window.open('about:blank', '_blank')
      const name = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split('@')[0] || 'Recrutador'
      const { data, error } = await supabase.rpc('create_verification_link', {
        p_organization_id: org.id, p_subject_name: name, p_channel: 'qr', p_reference: t('links.simulationRef'), p_expires_hours: 1,
      })
      if (error) { win?.close(); throw error }
      const r = (data as Array<{ link_id: string; token: string }>)[0]
      await supabase.rpc('mark_link_shared', { p_link_id: r.link_id })
      if (win) win.location.href = linkUrl(r.token)
      else window.location.href = linkUrl(r.token)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['links', org.id] }),
    onError: (e) => toast.show({ tone: 'error', title: linkErrorMessage(e, t) ?? authErrorMessage(e, t) }),
  })

  useEffect(() => {
    if (params.get('simular') === '1' && canSend) {
      setParams({}, { replace: true })
      simulate.mutate()
    }
    if (params.get('novo') === '1') setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), [i18n.language])
  const rel = (iso: string) => {
    const diffH = (new Date(iso).getTime() - Date.now()) / 36e5
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
    return Math.abs(diffH) < 1 ? rtf.format(Math.round(diffH * 60), 'minute') : Math.abs(diffH) < 48 ? rtf.format(Math.round(diffH), 'hour') : rtf.format(Math.round(diffH / 24), 'day')
  }

  const rows = links.data?.rows ?? []
  const total = links.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))

  const actionsFor = (row: LinkRow) => [
    { label: t('links.actions.resend'), icon: 'refresh' as const, onSelect: () => resend.mutate(row), disabled: !canSend || row.status === 'completed' || row.status === 'canceled' },
    { label: t('links.actions.cancel'), icon: 'rejected' as const, destructive: true, dividerBefore: true, onSelect: () => setCanceling(row), disabled: !canSend || ['completed', 'canceled', 'expired'].includes(row.status) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="t-h1">{t('app.nav.links')}</h1>
          <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t('links.subtitle')}</p>
        </div>
        {canSend ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" icon="capture" loading={simulate.isPending} onClick={() => simulate.mutate()}>{t('setup.pronto.simulate')}</Button>
            <Button variant="secondary" icon="upload" onClick={() => setBatchOpen(true)}>{t('links.batch')}</Button>
            <Button icon="plus" onClick={() => setNewOpen(true)}>{t('links.new')}</Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedFilter label={t('links.filterLabel')} value={filter} onChange={setFilter}
          options={(Object.keys(FILTER_STATUSES) as Filter[]).map((f) => ({ value: f, label: t(`links.filter.${f}`) }))} />
        <label className="relative block lg:w-[280px]">
          <span className="sr-only">{t('links.search')}</span>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('links.search')}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] pl-10 pr-3 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] focus:border-[var(--brand-500)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(71,86,201,.18)] lg:h-10 lg:text-[14px]" />
        </label>
      </div>

      {links.isLoading ? <SkeletonBlock /> : links.isError ? (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(179,38,30,.28)] bg-[var(--risk-high-bg)] p-6">
          <Icon name="rejected" size={24} className="text-[var(--risk-high-ink)]" />
          <p className="m-0 mt-2 text-[14px] font-semibold text-[var(--risk-high-ink)]">{t('links.loadError')}</p>
          <p className="m-0 mt-1 t-caption text-[var(--ink-body)]">{t('errors.network')}</p>
          <Button variant="secondary" className="mt-3" icon="refresh" onClick={() => void links.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-[10px] border border-dashed border-[var(--border-strong)] bg-[var(--n-50)] px-[18px] py-[26px] text-center [[data-theme=dark]_&]:bg-transparent">
          <Icon name="link" size={30} className="text-[var(--brand-400)]" />
          <h2 className="mt-3 font-sans text-[14px] font-medium leading-5 tracking-normal">{filter === 'all' && !debounced ? t('links.emptyTitle') : t('links.emptyFilteredTitle')}</h2>
          <p className="m-0 mt-1 max-w-[36ch] t-caption text-[var(--ink-muted)]">{filter === 'all' && !debounced ? t('links.emptyBody') : t('links.emptyFilteredBody')}</p>
          {canSend && filter === 'all' && !debounced ? <Button className="mt-4" icon="plus" onClick={() => setNewOpen(true)}>{t('links.new')}</Button>
            : <Button variant="secondary" className="mt-4" onClick={() => { setFilter('all'); setSearch('') }}>{t('links.clearFilters')}</Button>}
        </div>
      ) : (
        <div className={cn('overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] transition-opacity', links.isFetching && 'opacity-70')}>
          {/* Tabela ≥900px */}
          <table className="hidden w-full border-collapse text-left lg:table">
            <caption className="sr-only">{t('app.nav.links')}</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--n-50)] [[data-theme=dark]_&]:bg-[#151A33]">
                {[t('links.col.subject'), t('links.col.channel'), t('links.col.status'), t('links.col.created'), t('links.col.expires'), ''].map((h, i) => (
                  <th key={i} scope="col" className="px-5 py-2.5 t-overline text-[var(--ink-muted)]">{h ? h : <span className="sr-only">{t('links.col.actions')}</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--divider)] last:border-b-0 hover:bg-[var(--n-50)] [[data-theme=dark]_&]:hover:bg-[#151A33]">
                  <td className="max-w-0 px-5 py-3">
                    <p className="m-0 truncate text-[14px] text-[var(--ink)]">{r.subject_name}</p>
                    <p className="m-0 truncate t-caption text-[var(--ink-muted)]">{[r.reference, formatPhone(r.phone), r.email].filter(Boolean).join(' · ') || '—'}</p>
                  </td>
                  <td className="w-[130px] px-5 py-3 text-[13px]"><span className="inline-flex items-center gap-1.5"><Icon name={CHANNEL_ICON[r.channel]} size={18} className="text-[var(--ink-muted)]" />{t(`links.channel.${r.channel}`)}</span></td>
                  <td className="w-[150px] px-5 py-3"><Chip tone={STATUS_META[r.status].tone} icon={STATUS_META[r.status].icon}>{t(`links.status.${r.status}`)}</Chip></td>
                  <td className="tabular w-[132px] whitespace-nowrap px-5 py-3 text-[13px] text-[var(--ink-muted)]"><time dateTime={r.created_at}>{fmt.format(new Date(r.created_at))}</time></td>
                  <td className="tabular w-[132px] whitespace-nowrap px-5 py-3 text-[13px] text-[var(--ink-muted)]"><time dateTime={r.expires_at}>{['completed', 'canceled'].includes(r.status) ? '—' : rel(r.expires_at)}</time></td>
                  <td className="w-[72px] px-5 py-2 text-right"><Menu label={t('links.actions.label', { name: r.subject_name })} items={actionsFor(r)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cards <900px */}
          <ul className="m-0 list-none p-0 lg:hidden">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-b border-[var(--divider)] p-4 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[15px] text-[var(--ink)]">{r.subject_name}</p>
                  <p className="m-0 mt-0.5 flex items-center gap-1.5 t-caption text-[var(--ink-muted)]">
                    <Icon name={CHANNEL_ICON[r.channel]} size={16} />{t(`links.channel.${r.channel}`)} · <time dateTime={r.created_at} className="tabular">{fmt.format(new Date(r.created_at))}</time>
                  </p>
                  <div className="mt-2"><Chip tone={STATUS_META[r.status].tone} icon={STATUS_META[r.status].icon}>{t(`links.status.${r.status}`)}</Chip></div>
                </div>
                <Menu label={t('links.actions.label', { name: r.subject_name })} items={actionsFor(r)} />
              </li>
            ))}
          </ul>

          {pages > 1 ? (
            <nav aria-label={t('links.pagination')} className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
              <span className="tabular t-caption text-[var(--ink-muted)]">{t('links.pageInfo', { from: page * PAGE + 1, to: Math.min(total, (page + 1) * PAGE), total })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" icon="arrowLeft" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('common.back')}</Button>
                <Button variant="secondary" iconRight="arrowRight" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
              </div>
            </nav>
          ) : null}
        </div>
      )}

      {canSend ? <NewLinkModal open={newOpen} onClose={() => setNewOpen(false)} org={org} /> : null}
      {canSend ? <BatchModal open={batchOpen} onClose={() => setBatchOpen(false)} org={org} /> : null}

      <Modal open={Boolean(resent)} onClose={() => setResent(null)} icon="refresh" size="md" title={t('links.resentTitle')} description={t('links.resentBody')}
        footer={<Button onClick={() => setResent(null)}>{t('common.done')}</Button>} note={t('links.tokenOnce')}>
        {resent ? <LinkResult link={resent} org={org} /> : null}
      </Modal>

      <Modal open={Boolean(canceling)} onClose={() => { setCanceling(null); setReason('') }} icon="rejected" iconTone="danger"
        title={t('links.cancelTitle')} description={t('links.cancelBody', { name: canceling?.subject_name })}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCanceling(null); setReason('') }}>{t('common.back')}</Button>
            <Button variant="destructive" disabled={!reason} loading={cancel.isPending} onClick={() => canceling && cancel.mutate({ row: canceling, why: t(`links.cancelReason.${reason}`) })}>
              {t('links.cancelConfirm')}
            </Button>
          </>
        }
        note={reason ? t('links.cancelNote') : t('links.cancelNeedsReason')}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="t-label mb-2 text-[var(--ink)]">{t('links.cancelReasonLabel')}</legend>
          <div className="flex flex-col gap-1">
            {CANCEL_REASONS.map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2 hover:bg-[var(--n-50)] [[data-theme=dark]_&]:hover:bg-[#262C45]">
                <input type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-[18px] accent-[var(--brand-800)]" />
                <span className="text-[14px] text-[var(--ink-body)]">{t(`links.cancelReason.${r}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Modal>
      {!canSend ? <Alert variant="neutral">{t('links.viewerNote')}</Alert> : null}
    </div>
  )
}
