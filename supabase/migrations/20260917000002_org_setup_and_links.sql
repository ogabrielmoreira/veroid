-- =============================================================================
-- Vero ID — Fases 2 e 3
-- Fase 2: onboarding (marca, fluxo, equipe), Brand Kit validado, convites, logos.
-- Fase 3: links de verificação por RPC (token só em claro na criação), página pública.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organizações: progresso do onboarding + validação do Brand Kit
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists onboarding_step smallint not null default 2 check (onboarding_step between 1 and 6),
  add column if not exists onboarding_completed_at timestamptz;

create or replace function private.is_valid_brand_kit(k jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(k) = 'object'
    and (not k ? 'primary'   or (k->>'primary')   ~* '^#[0-9a-f]{6}$')
    and (not k ? 'secondary' or (k->>'secondary') ~* '^#[0-9a-f]{6}$')
    and (not k ? 'accent'    or (k->>'accent')    ~* '^#[0-9a-f]{6}$')
    and (not k ? 'radius'    or (k->>'radius') in ('straight', 'soft', 'rounded'))
    and (not k ? 'tone'      or (k->>'tone') in ('formal', 'friendly'))
    and (not k ? 'font_display' or (k->>'font_display') in
          ('Libre Franklin','Geist','Plus Jakarta Sans','IBM Plex Sans','Work Sans','Figtree','Manrope','Atkinson Hyperlegible'))
    and (not k ? 'font_text' or (k->>'font_text') in
          ('Libre Franklin','Geist','Plus Jakarta Sans','IBM Plex Sans','Work Sans','Figtree','Manrope','Atkinson Hyperlegible'))
    and (not k ? 'logo_light_url' or char_length(k->>'logo_light_url') <= 500)
    and (not k ? 'logo_dark_url'  or char_length(k->>'logo_dark_url')  <= 500)
    and pg_column_size(k) < 8192;
$$;

do $$ begin
  alter table public.organizations add constraint organizations_brand_kit_valid check (private.is_valid_brand_kit(brand_kit));
exception when duplicate_object then null; end $$;

-- Proprietário só altera colunas de configuração (nunca id, created_by, cnpj, niche por update direto)
revoke update on public.organizations from authenticated;
grant update (name, website, size, subniche, brand_kit, settings, dpo_email, onboarding_step, onboarding_completed_at)
  on public.organizations to authenticated;

-- Auditoria automática de mudanças na organização
create or replace function private.audit_organization_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.brand_kit is distinct from old.brand_kit then
    insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
    values (new.id, auth.uid(), 'brand_kit.updated', 'organizations:' || new.id, old.brand_kit, new.brand_kit);
  end if;
  if (new.name, new.website, new.size, new.subniche, new.dpo_email) is distinct from
     (old.name, old.website, old.size, old.subniche, old.dpo_email) then
    insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
    values (new.id, auth.uid(), 'organization.updated', 'organizations:' || new.id,
      jsonb_build_object('name', old.name, 'website', old.website, 'size', old.size, 'subniche', old.subniche),
      jsonb_build_object('name', new.name, 'website', new.website, 'size', new.size, 'subniche', new.subniche));
  end if;
  if new.onboarding_completed_at is not null and old.onboarding_completed_at is null then
    insert into public.audit_logs (organization_id, actor_id, action, target)
    values (new.id, auth.uid(), 'onboarding.completed', 'organizations:' || new.id);
  end if;
  return new;
end $$;

drop trigger if exists organizations_audit on public.organizations;
create trigger organizations_audit after update on public.organizations
  for each row execute function private.audit_organization_update();

-- Fluxo: auditoria de mudanças
create or replace function private.audit_flow_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.steps, new.fields, new.risk_rules, new.consent_version) is distinct from
     (old.steps, old.fields, old.risk_rules, old.consent_version) then
    insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
    values (new.organization_id, auth.uid(), 'flow.updated', 'flow_templates:' || new.id,
      jsonb_build_object('steps', old.steps, 'fields', old.fields),
      jsonb_build_object('steps', new.steps, 'fields', new.fields));
  end if;
  return new;
end $$;

drop trigger if exists flow_templates_audit on public.flow_templates;
create trigger flow_templates_audit after update on public.flow_templates
  for each row execute function private.audit_flow_update();

revoke update on public.flow_templates from authenticated;
grant update (name, steps, fields, risk_rules, consent_version, is_active) on public.flow_templates to authenticated;

-- -----------------------------------------------------------------------------
-- Equipe
-- -----------------------------------------------------------------------------
create or replace function private.token_hash(p text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p, 'sha256'), 'hex');
$$;

create or replace function private.new_token()
returns text language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

-- Lista membros com e-mail (auth.users não é exposto pela Data API)
create or replace function public.list_org_members(p_organization_id uuid)
returns table (user_id uuid, full_name text, email text, role public.org_role, created_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, p.full_name, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = p_organization_id
    and private.is_org_member(p_organization_id)
  order by m.created_at;
$$;

create or replace function public.invite_member(p_organization_id uuid, p_email text, p_role public.org_role)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_token text := private.new_token();
  v_email text := lower(trim(p_email));
  v_id uuid;
  v_exp timestamptz;
begin
  if not private.has_org_role(p_organization_id, array['owner']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and lower(u.email) = v_email
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  if (select count(*) from public.invitations where organization_id = p_organization_id and accepted_at is null and expires_at > now()) >= 20 then
    raise exception 'invite_limit_reached' using errcode = 'P0001';
  end if;

  -- Reenviar convite para o mesmo e-mail invalida o anterior
  delete from public.invitations
  where organization_id = p_organization_id and email = v_email and accepted_at is null;

  insert into public.invitations (organization_id, email, role, token_hash, invited_by)
  values (p_organization_id, v_email, p_role, private.token_hash(v_token), auth.uid())
  returning id, invitations.expires_at into v_id, v_exp;

  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (p_organization_id, auth.uid(), 'member.invited', 'invitations:' || v_id,
          jsonb_build_object('email', v_email, 'role', p_role));

  return query select v_id, v_token, v_exp;
end $$;

-- Dados mínimos para a tela de aceite (antes do login não revela nada além do nome da organização)
create or replace function public.get_invitation(p_token text)
returns table (organization_name text, role public.org_role, email text, status text)
language sql stable security definer
set search_path = ''
as $$
  select o.name,
         i.role,
         -- e-mail mascarado: g*****@gmail.com
         regexp_replace(i.email::text, '^(.)[^@]*', '\1*****'),
         case when i.accepted_at is not null then 'accepted'
              when i.expires_at < now() then 'expired'
              else 'pending' end
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = private.token_hash(p_token);
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into inv from public.invitations where token_hash = private.token_hash(p_token) for update;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  if inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from lower(inv.email::text) then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;

  insert into public.memberships (user_id, organization_id, role)
  values (auth.uid(), inv.organization_id, inv.role)
  on conflict (user_id, organization_id) do nothing;

  update public.invitations set accepted_at = now() where id = inv.id;

  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (inv.organization_id, auth.uid(), 'member.joined', 'invitations:' || inv.id,
          jsonb_build_object('role', inv.role));
  return inv.organization_id;
end $$;

-- Auditoria de troca de papel / remoção
create or replace function private.audit_membership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
    values (new.organization_id, auth.uid(), 'member.role_changed', 'users:' || new.user_id,
            jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' and exists (select 1 from public.organizations where id = old.organization_id) then
    insert into public.audit_logs (organization_id, actor_id, action, target, before)
    values (old.organization_id, auth.uid(), 'member.removed', 'users:' || old.user_id,
            jsonb_build_object('role', old.role));
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists memberships_audit on public.memberships;
create trigger memberships_audit after update or delete on public.memberships
  for each row execute function private.audit_membership_change();

-- Convites: proprietário lê e revoga; criação só pela RPC
drop policy if exists invitations_owner_all on public.invitations;
drop policy if exists invitations_owner_select on public.invitations;
create policy invitations_owner_select on public.invitations for select to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.org_role[]));
drop policy if exists invitations_owner_delete on public.invitations;
create policy invitations_owner_delete on public.invitations for delete to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.org_role[]));
revoke all on public.invitations from authenticated;
grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, created_at), delete
  on public.invitations to authenticated;

-- -----------------------------------------------------------------------------
-- Logos (bucket público, escrita só do proprietário, pasta = organization_id)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 524288, array['image/svg+xml', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists brand_owner_insert on storage.objects;
create policy brand_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid()) and m.role = 'owner'
                  and m.organization_id::text = (storage.foldername(name))[1])
  );
drop policy if exists brand_owner_update on storage.objects;
create policy brand_owner_update on storage.objects for update to authenticated
  using (
    bucket_id = 'brand'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid()) and m.role = 'owner'
                  and m.organization_id::text = (storage.foldername(name))[1])
  );
drop policy if exists brand_owner_delete on storage.objects;
create policy brand_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid()) and m.role = 'owner'
                  and m.organization_id::text = (storage.foldername(name))[1])
  );
drop policy if exists brand_member_select on storage.objects;
create policy brand_member_select on storage.objects for select to authenticated
  using (
    bucket_id = 'brand'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid())
                  and m.organization_id::text = (storage.foldername(name))[1])
  );

-- -----------------------------------------------------------------------------
-- Fase 3 — Links de verificação
-- -----------------------------------------------------------------------------
alter table public.verification_links
  add column if not exists sent_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists resend_count smallint not null default 0,
  add column if not exists batch_id uuid;

do $$ begin
  alter table public.verification_links add constraint verification_links_contact
    check (
      char_length(subject_name) between 2 and 120
      and (phone is null or phone ~ '^\d{10,11}$')
      and (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
      and (channel not in ('sms', 'whatsapp') or phone is not null)
      and (channel <> 'email' or email is not null)
      and (reference is null or char_length(reference) <= 80)
    );
exception when duplicate_object then null; end $$;

-- Status efetivo (expira sem depender do cron)
create or replace function private.link_effective_status(l public.verification_links)
returns text language sql stable set search_path = '' as $$
  select case
    when l.status in ('completed', 'canceled', 'expired') then l.status
    when l.expires_at < now() then 'expired'
    else l.status end;
$$;

create or replace view public.verification_links_view
with (security_invoker = true) as
select l.id, l.organization_id, l.flow_template_id, l.subject_name, l.phone, l.email, l.channel, l.reference,
       private.link_effective_status(l) as status,
       l.expires_at, l.created_by, l.created_at, l.sent_at, l.opened_at, l.canceled_at, l.resend_count, l.batch_id
from public.verification_links l;

grant select on public.verification_links_view to authenticated;
revoke update on public.verification_links from authenticated;
drop policy if exists verification_links_update on public.verification_links;

create or replace function private.assert_can_send(p_org uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_org_role(p_org, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.create_verification_link(
  p_organization_id  uuid,
  p_subject_name     text,
  p_channel          text,
  p_phone            text default null,
  p_email            text default null,
  p_reference        text default null,
  p_expires_hours    int  default 24,
  p_flow_template_id uuid default null,
  p_batch_id         uuid default null
)
returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_token text := private.new_token();
  v_id uuid;
  v_exp timestamptz;
  v_flow uuid := p_flow_template_id;
begin
  perform private.assert_can_send(p_organization_id);
  if p_expires_hours not in (1, 24, 72, 168) then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;
  if (select count(*) from public.verification_links
      where organization_id = p_organization_id and created_at > now() - interval '24 hours') >= 500 then
    raise exception 'link_daily_limit' using errcode = 'P0001', hint = 'Modo demo: até 500 links por dia.';
  end if;
  if v_flow is null then
    select id into v_flow from public.flow_templates
    where organization_id = p_organization_id and is_active order by created_at limit 1;
  elsif not exists (select 1 from public.flow_templates where id = v_flow and organization_id = p_organization_id) then
    raise exception 'invalid_flow' using errcode = '22023';
  end if;

  insert into public.verification_links
    (organization_id, flow_template_id, token_hash, subject_name, phone, email, channel, reference,
     status, sent_at, expires_at, created_by, batch_id)
  values
    (p_organization_id, v_flow, private.token_hash(v_token), trim(p_subject_name),
     nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
     nullif(lower(trim(coalesce(p_email, ''))), ''),
     p_channel, nullif(trim(coalesce(p_reference, '')), ''),
     -- Modo demo: SMS e e-mail são simulados e contam como enviados; WhatsApp e QR ficam "criado" até o compartilhamento
     case when p_channel in ('sms', 'email') then 'sent' else 'created' end,
     case when p_channel in ('sms', 'email') then now() else null end,
     now() + make_interval(hours => p_expires_hours), auth.uid(), p_batch_id)
  returning id, verification_links.expires_at into v_id, v_exp;

  if p_batch_id is null then
    insert into public.audit_logs (organization_id, actor_id, action, target, after)
    values (p_organization_id, auth.uid(), 'link.created', 'verification_links:' || v_id,
            jsonb_build_object('channel', p_channel, 'expires_hours', p_expires_hours, 'reference', p_reference));
  end if;

  return query select v_id, v_token, v_exp;
end $$;

create or replace function public.create_verification_links_batch(
  p_organization_id uuid,
  p_rows            jsonb,
  p_channel         text,
  p_expires_hours   int default 24
)
returns table (row_index int, link_id uuid, token text, error text)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_batch uuid := gen_random_uuid();
  r jsonb;
  i int := 0;
  v_link uuid; v_token text; v_exp timestamptz;
  ok_count int := 0;
begin
  perform private.assert_can_send(p_organization_id);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'empty_batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 200 then
    raise exception 'batch_too_large' using errcode = '22023', hint = 'Máximo de 200 linhas por lote.';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    begin
      select c.link_id, c.token, c.expires_at into v_link, v_token, v_exp
      from public.create_verification_link(
        p_organization_id, r->>'name', p_channel, r->>'phone', r->>'email', r->>'reference',
        p_expires_hours, null, v_batch) c;
      ok_count := ok_count + 1;
      row_index := i; link_id := v_link; token := v_token; error := null;
    exception when others then
      row_index := i; link_id := null; token := null; error := sqlerrm;
    end;
    return next;
    i := i + 1;
  end loop;

  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (p_organization_id, auth.uid(), 'link.batch_created', 'batches:' || v_batch,
          jsonb_build_object('rows', i, 'created', ok_count, 'channel', p_channel));
end $$;

-- Reenviar gera token novo (o anterior deixa de funcionar) e renova a validade
create or replace function public.resend_verification_link(p_link_id uuid, p_expires_hours int default 24)
returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  l public.verification_links;
  v_token text := private.new_token();
  v_exp timestamptz := now() + make_interval(hours => p_expires_hours);
begin
  select * into l from public.verification_links where id = p_link_id for update;
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  perform private.assert_can_send(l.organization_id);
  if l.status in ('completed', 'canceled') then
    raise exception 'link_closed' using errcode = 'P0001';
  end if;
  if p_expires_hours not in (1, 24, 72, 168) then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;
  if l.resend_count >= 5 then
    raise exception 'resend_limit' using errcode = 'P0001';
  end if;

  update public.verification_links
  set token_hash = private.token_hash(v_token),
      status = case when l.channel in ('sms', 'email') then 'sent' else 'created' end,
      sent_at = case when l.channel in ('sms', 'email') then now() else sent_at end,
      expires_at = v_exp,
      resend_count = resend_count + 1
  where id = l.id;

  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (l.organization_id, auth.uid(), 'link.resent', 'verification_links:' || l.id,
          jsonb_build_object('resend_count', l.resend_count + 1));

  return query select l.id, v_token, v_exp;
end $$;

create or replace function public.mark_link_shared(p_link_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.verification_links;
begin
  select * into l from public.verification_links where id = p_link_id for update;
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  perform private.assert_can_send(l.organization_id);
  if l.status = 'created' and l.expires_at > now() then
    update public.verification_links set status = 'sent', sent_at = now() where id = l.id;
  end if;
end $$;

create or replace function public.cancel_verification_link(p_link_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.verification_links;
begin
  select * into l from public.verification_links where id = p_link_id for update;
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  perform private.assert_can_send(l.organization_id);
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if l.status in ('completed', 'canceled') then
    raise exception 'link_closed' using errcode = 'P0001';
  end if;
  update public.verification_links set status = 'canceled', canceled_at = now() where id = l.id;
  insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
  values (l.organization_id, auth.uid(), 'link.canceled', 'verification_links:' || l.id,
          jsonb_build_object('status', l.status), jsonb_build_object('status', 'canceled', 'reason', left(p_reason, 200)));
end $$;

-- Pública (titular): valida o token e devolve só o necessário para a tela de abertura
create or replace function public.get_public_link(p_token text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  l public.verification_links;
  o public.organizations;
  f public.flow_templates;
  v_status text;
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 64 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into l from public.verification_links where token_hash = private.token_hash(p_token);
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  v_status := private.link_effective_status(l);
  select * into o from public.organizations where id = l.organization_id;
  select * into f from public.flow_templates where id = l.flow_template_id;

  if v_status = 'expired' and l.status <> 'expired' then
    update public.verification_links set status = 'expired' where id = l.id;
  elsif v_status in ('created', 'sent') then
    update public.verification_links set status = 'opened', opened_at = coalesce(opened_at, now()) where id = l.id;
    v_status := 'opened';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'organization', jsonb_build_object('name', o.name, 'niche', o.niche, 'brand_kit', o.brand_kit),
    'subject_first_name', split_part(l.subject_name, ' ', 1),
    'expires_at', l.expires_at,
    'flow', case when v_status in ('opened', 'in_progress') and f.id is not null
             then jsonb_build_object('steps', f.steps, 'fields', f.fields, 'consent_version', f.consent_version)
             else null end
  );
end $$;

-- -----------------------------------------------------------------------------
-- Grants das RPCs
-- -----------------------------------------------------------------------------
revoke all on function public.list_org_members(uuid) from public, anon;
revoke all on function public.invite_member(uuid, text, public.org_role) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.create_verification_link(uuid, text, text, text, text, text, int, uuid, uuid) from public, anon;
revoke all on function public.create_verification_links_batch(uuid, jsonb, text, int) from public, anon;
revoke all on function public.resend_verification_link(uuid, int) from public, anon;
revoke all on function public.mark_link_shared(uuid) from public, anon;
revoke all on function public.cancel_verification_link(uuid, text) from public, anon;
revoke all on function public.get_invitation(text) from public;
revoke all on function public.get_public_link(text) from public;

grant execute on function public.list_org_members(uuid) to authenticated;
grant execute on function public.invite_member(uuid, text, public.org_role) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.create_verification_link(uuid, text, text, text, text, text, int, uuid, uuid) to authenticated;
grant execute on function public.create_verification_links_batch(uuid, jsonb, text, int) to authenticated;
grant execute on function public.resend_verification_link(uuid, int) to authenticated;
grant execute on function public.mark_link_shared(uuid) to authenticated;
grant execute on function public.cancel_verification_link(uuid, text) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.get_public_link(text) to anon, authenticated;

revoke all on function private.token_hash(text), private.new_token(), private.link_effective_status(public.verification_links),
  private.assert_can_send(uuid), private.is_valid_brand_kit(jsonb) from public, anon;
grant execute on function private.token_hash(text), private.new_token(), private.link_effective_status(public.verification_links),
  private.assert_can_send(uuid), private.is_valid_brand_kit(jsonb) to authenticated, service_role;
