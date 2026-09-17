import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import type { OrgRole, Organization } from '@/features/org/useMemberships'
import { authErrorMessage } from '@/lib/authErrors'
import { appUrl } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { SkeletonBlock } from './FlowEditor'

interface Member { user_id: string; full_name: string | null; email: string; role: OrgRole; created_at: string }
interface Invite { id: string; email: string; role: OrgRole; expires_at: string; accepted_at: string | null; created_at: string }

export function TeamEditor({ org, myRole, footer }: { org: Organization; myRole: OrgRole; footer?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const isOwner = myRole === 'owner'
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('analyst')
  const [formError, setFormError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<{ url: string; email: string } | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)

  const members = useQuery({
    queryKey: ['members', org.id],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc('list_org_members', { p_organization_id: org.id })
      if (error) throw error
      return data as Member[]
    },
  })
  const invites = useQuery({
    queryKey: ['invites', org.id],
    enabled: isOwner,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase.from('invitations').select('id, email, role, expires_at, accepted_at, created_at')
        .eq('organization_id', org.id).is('accepted_at', null).order('created_at', { ascending: false })
      if (error) throw error
      return data as Invite[]
    },
  })

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('invite_member', { p_organization_id: org.id, p_email: email, p_role: role })
      if (error) throw error
      return (data as Array<{ token: string }>)[0]
    },
    onSuccess: (row) => {
      setInviteLink({ url: appUrl(`/convite/${row.token}`), email })
      setEmail('')
      void qc.invalidateQueries({ queryKey: ['invites', org.id] })
    },
    onError: (e) => setFormError(inviteError(e, t)),
  })

  const changeRole = useMutation({
    mutationFn: async ({ userId, next }: { userId: string; next: OrgRole }) => {
      const { error } = await supabase.from('memberships').update({ role: next }).eq('organization_id', org.id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => { toast.show({ tone: 'success', title: t('team.roleChanged') }); void qc.invalidateQueries({ queryKey: ['members', org.id] }) },
    onError: (e) => toast.show({ tone: 'error', title: inviteError(e, t) }),
  })

  const remove = useMutation({
    mutationFn: async (m: Member) => {
      const { error } = await supabase.from('memberships').delete().eq('organization_id', org.id).eq('user_id', m.user_id)
      if (error) throw error
    },
    onSuccess: () => { setRemoving(null); toast.show({ tone: 'success', title: t('team.removed') }); void qc.invalidateQueries({ queryKey: ['members', org.id] }) },
    onError: (e) => toast.show({ tone: 'error', title: inviteError(e, t) }),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invites', org.id] }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setFormError(t('auth.validation.emailInvalid'))
    invite.mutate()
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' })

  return (
    <div className="flex flex-col gap-6">
      {isOwner ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-[22px]">
          <h2 className="t-h4 font-sans">{t('team.inviteTitle')}</h2>
          <p className="m-0 mt-1 t-caption text-[var(--ink-muted)]">{t('team.inviteHelp')}</p>
          {formError ? <Alert variant="error" live className="mt-4">{formError}</Alert> : null}
          <form noValidate onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-start">
            <InputField label={t('auth.fields.email')} type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            <SelectField label={t('team.role')} value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
              <option value="analyst">{t('app.overview.role.analyst')}</option>
              <option value="viewer">{t('app.overview.role.viewer')}</option>
            </SelectField>
            <Button type="submit" icon="send" loading={invite.isPending} className="sm:mt-6">{t('team.invite')}</Button>
          </form>
          <dl className="m-0 mt-4 grid gap-2 sm:grid-cols-2">
            {(['analyst', 'viewer'] as const).map((r) => (
              <div key={r} className="rounded-[var(--radius-md)] bg-[var(--n-50)] p-3 [[data-theme=dark]_&]:bg-[#0C1024]">
                <dt className="text-[13px] font-medium text-[var(--ink)]">{t(`app.overview.role.${r}`)}</dt>
                <dd className="m-0 t-caption text-[var(--ink-muted)]">{t(`team.roleHelp.${r}`)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]">
        <h2 className="border-b border-[var(--border)] bg-[var(--n-50)] px-5 py-2.5 font-sans t-overline text-[var(--ink-muted)] [[data-theme=dark]_&]:bg-[#151A33]">{t('team.members')}</h2>
        {members.isLoading ? <div className="p-5"><SkeletonBlock /></div> : members.isError ? (
          <div className="p-5"><Alert variant="error">{t('errors.generic')}</Alert></div>
        ) : (
          <ul className="m-0 list-none p-0">
            {members.data!.map((m) => {
              const isMe = m.user_id === user?.id
              return (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 border-b border-[var(--divider)] px-5 py-3 last:border-b-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-50)] text-[13px] font-semibold text-[var(--brand-700)] [[data-theme=dark]_&]:bg-[#262C45] [[data-theme=dark]_&]:text-[var(--brand-300)]" aria-hidden="true">
                    {(m.full_name || m.email)[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[14px] text-[var(--ink)]">{m.full_name || m.email}{isMe ? <span className="ml-1.5 t-caption text-[var(--ink-muted)]">({t('team.you')})</span> : null}</p>
                    <p className="m-0 truncate t-caption text-[var(--ink-muted)]">{m.email}</p>
                  </div>
                  {isOwner && !isMe ? (
                    <div className="flex items-center gap-2">
                      <select aria-label={t('team.role')} value={m.role} onChange={(e) => changeRole.mutate({ userId: m.user_id, next: e.target.value as OrgRole })}
                        className="h-10 rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--input-bg)] px-2 text-[13px] text-[var(--ink)]">
                        {(['owner', 'analyst', 'viewer'] as const).map((r) => <option key={r} value={r}>{t(`app.overview.role.${r}`)}</option>)}
                      </select>
                      <button type="button" onClick={() => setRemoving(m)} aria-label={t('team.remove', { name: m.full_name || m.email })}
                        className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-[var(--border-strong)] text-[var(--risk-high-ink)] hover:border-[var(--risk-high)]">
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  ) : (
                    <span className="t-label text-[var(--ink-muted)]">{t(`app.overview.role.${m.role}`)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isOwner && invites.data?.length ? (
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]">
          <h2 className="border-b border-[var(--border)] bg-[var(--n-50)] px-5 py-2.5 font-sans t-overline text-[var(--ink-muted)] [[data-theme=dark]_&]:bg-[#151A33]">{t('team.pending')}</h2>
          <ul className="m-0 list-none p-0">
            {invites.data.map((i) => {
              const expired = new Date(i.expires_at) < new Date()
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--divider)] px-5 py-3 last:border-b-0">
                  <Icon name={expired ? 'review' : 'pending'} size={18} className="text-[var(--ink-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[14px] text-[var(--ink)]">{i.email}</p>
                    <p className="m-0 t-caption text-[var(--ink-muted)]">
                      {t(`app.overview.role.${i.role}`)} · {expired ? t('team.expired') : t('team.expires', { date: dateFmt.format(new Date(i.expires_at)) })}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => revoke.mutate(i.id)}>{t('team.revoke')}</Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {footer}

      <Modal
        open={Boolean(inviteLink)}
        onClose={() => setInviteLink(null)}
        icon="send"
        title={t('team.linkTitle')}
        description={t('team.linkBody', { email: inviteLink?.email })}
        footer={<Button onClick={() => setInviteLink(null)}>{t('common.done')}</Button>}
        note={t('team.linkNote')}
      >
        {inviteLink ? <CopyField value={inviteLink.url} /> : null}
      </Modal>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        icon="trash"
        iconTone="danger"
        title={t('team.removeTitle')}
        description={t('team.removeBody', { name: removing?.full_name || removing?.email })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} data-autofocus>{t('common.cancel')}</Button>
            <Button variant="destructive" loading={remove.isPending} onClick={() => removing && remove.mutate(removing)}>{t('team.removeConfirm')}</Button>
          </>
        }
      />
    </div>
  )
}

export function CopyField({ value, label, onCopied }: { value: string; label?: string; onCopied?: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      onCopied?.()
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponível: o campo continua selecionável */ }
  }
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="t-label text-[var(--ink)]">{label}</span> : null}
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label={label ?? t('common.link')}
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--input-border)] bg-[var(--n-50)] px-3 text-[13px] text-[var(--ink)] lg:h-10 [[data-theme=dark]_&]:bg-[#0C1024]" />
        <Button variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copy}>
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? t('common.copied') : ''}</span>
    </div>
  )
}

function inviteError(e: unknown, t: ReturnType<typeof useTranslation>['t']): string {
  const msg = (e as { message?: string })?.message ?? ''
  if (msg.includes('already_member')) return t('team.errors.alreadyMember')
  if (msg.includes('invite_limit_reached')) return t('team.errors.limit')
  if (msg.includes('invalid_email')) return t('auth.validation.emailInvalid')
  if (msg.includes('pelo menos um proprietário')) return t('team.errors.lastOwner')
  return authErrorMessage(e, t)
}
