import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useCurrentOrg } from '@/features/org/useCurrentOrg'
import { SkeletonBlock } from '@/features/setup/FlowEditor'
import { supabase } from '@/lib/supabase'

const GROUPS: Record<string, string> = {
  all: '', session: 'session.', link: 'link.', member: 'member.', brand: 'brand_kit.', settings: 'settings.', bureau: 'bureau.', media: 'media.', qualified: 'qualified.',
}
const PAGE = 25

export function AuditPage() {
  const { t, i18n } = useTranslation()
  const { membership } = useCurrentOrg()
  const org = membership!.organization
  const [group, setGroup] = useState('all')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<number | null>(null)

  const q = useQuery({
    queryKey: ['audit-page', org.id, group, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from('audit_logs').select('id, action, target, before, after, actor_id, created_at', { count: 'exact' })
        .eq('organization_id', org.id).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (GROUPS[group]) query = query.like('action', `${GROUPS[group]}%`)
      const { data, error, count } = await query
      if (error) throw error
      const { data: members } = await supabase.rpc('list_org_members', { p_organization_id: org.id })
      const names = new Map(((members ?? []) as Array<{ user_id: string; full_name: string | null; email: string }>).map((m) => [m.user_id, m.full_name || m.email]))
      return { rows: (data ?? []).map((r) => ({ ...r, actor: r.actor_id ? names.get(r.actor_id) ?? t('audit.formerMember') : t('review.system') })), count: count ?? 0 }
    },
  })

  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' })
  const rows = q.data?.rows ?? []
  const total = q.data?.count ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="t-h1">{t('app.nav.audit')}</h1>
          <p className="m-0 mt-2 t-body text-[var(--ink-muted)]">{t('audit.subtitle')}</p>
        </div>
        <div className="w-full sm:w-[240px]">
          <SelectField label={t('audit.filter')} value={group} onChange={(e) => { setGroup(e.target.value); setPage(0) }}>
            {Object.keys(GROUPS).map((g) => <option key={g} value={g}>{t(`audit.groups.${g}`)}</option>)}
          </SelectField>
        </div>
      </div>

      {q.isLoading ? <SkeletonBlock /> : q.isError ? <p className="text-[var(--risk-high-ink)]">{t('errors.generic')}</p> : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]">
          {rows.length === 0 ? <p className="m-0 p-8 text-center t-caption text-[var(--ink-muted)]">{t('app.overview.auditEmpty')}</p> : (
            <ul className="m-0 list-none p-0">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-[var(--divider)] last:border-b-0">
                  <button type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}
                    className="flex min-h-[52px] w-full items-center gap-3 px-5 py-3 text-left hover:bg-[var(--n-50)] [[data-theme=dark]_&]:hover:bg-[#151A33]">
                    <Icon name="shield" size={18} className="shrink-0 text-[var(--ink-muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-[var(--ink)]">{String(t(`audit.${r.action}`, { defaultValue: r.action }))}</span>
                      <span className="block truncate t-caption text-[var(--ink-muted)]">{r.actor} · <code>{r.target}</code></span>
                    </span>
                    <time dateTime={r.created_at} className="tabular shrink-0 t-caption text-[var(--ink-muted)]">{fmt.format(new Date(r.created_at))}</time>
                    <Icon name="chevronDown" size={16} className={`shrink-0 text-[var(--ink-muted)] transition-transform ${open === r.id ? 'rotate-180' : ''}`} />
                  </button>
                  {open === r.id ? (
                    <div className="grid gap-3 px-5 pb-4 sm:grid-cols-2">
                      {(['before', 'after'] as const).map((k) => (
                        <div key={k}>
                          <p className="m-0 mb-1 t-overline text-[var(--ink-muted)]">{t(`audit.${k}`)}</p>
                          <pre className="m-0 max-h-48 overflow-auto rounded-[var(--radius-md)] bg-[#10142B] p-3 text-[12px] leading-5 text-[#DDE1F6]">{r[k] ? JSON.stringify(r[k], null, 2) : '—'}</pre>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {total > PAGE ? (
            <nav aria-label={t('links.pagination')} className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
              <span className="tabular t-caption text-[var(--ink-muted)]">{t('links.pageInfo', { from: page * PAGE + 1, to: Math.min(total, (page + 1) * PAGE), total })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" icon="arrowLeft" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('common.back')}</Button>
                <Button variant="secondary" iconRight="arrowRight" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
              </div>
            </nav>
          ) : null}
        </div>
      )}
      <p className="m-0 flex items-center gap-1.5 t-caption text-[var(--ink-muted)]"><Icon name="lock" size={16} />{t('audit.immutable')}</p>
    </div>
  )
}
