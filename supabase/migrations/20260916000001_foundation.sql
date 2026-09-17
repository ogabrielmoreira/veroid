-- =============================================================================
-- Vero ID — Fase 1: fundação
-- Schema mínimo (seção 9 do prompt), RLS por organization_id, grants explícitos
-- para a Data API, funções de onboarding, bucket privado e heartbeat.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Funções auxiliares ficam num schema NÃO exposto pela Data API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.org_role as enum ('owner', 'analyst', 'viewer');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Validação de CNPJ (dígitos verificadores)
-- -----------------------------------------------------------------------------
create or replace function private.is_valid_cnpj(p text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  d int[];
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
begin
  if p is null or p !~ '^\d{14}$' or p ~ '^(\d)\1{13}$' then
    return false;
  end if;
  select array_agg(substr(p, g, 1)::int order by g) into d from generate_series(1, 14) g;
  s := 0; for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> d[13] then return false; end if;
  s := 0; for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = d[14];
end $$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  locale      text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  cnpj        text unique check (cnpj is null or private.is_valid_cnpj(cnpj)),
  website     text check (website is null or char_length(website) <= 200),
  size        text check (size in ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  niche       text not null check (niche in (
                'fintech', 'credit', 'agro', 'automotive',
                'real-estate', 'telecom', 'marketplace', 'insurance',
                'crypto', 'health', 'events', 'education', 'betting')),
  subniche    text check (subniche is null or char_length(subniche) <= 60),
  brand_kit   jsonb not null default '{}'::jsonb,
  settings    jsonb not null default '{"app_mode":"demo","retention_days":1}'::jsonb,
  dpo_email   text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id          uuid not null references auth.users (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  role             public.org_role not null,
  created_at       timestamptz not null default now(),
  primary key (user_id, organization_id)
);
create index if not exists memberships_org_idx on public.memberships (organization_id);

create table if not exists public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  email            extensions.citext not null,
  role             public.org_role not null check (role <> 'owner'),
  token_hash       text not null unique,
  invited_by       uuid references auth.users (id) on delete set null,
  expires_at       timestamptz not null default now() + interval '7 days',
  accepted_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists invitations_org_idx on public.invitations (organization_id);

create table if not exists public.flow_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  niche            text not null,
  name             text not null,
  steps            jsonb not null default '[]'::jsonb,
  fields           jsonb not null default '[]'::jsonb,
  risk_rules       jsonb not null default '[]'::jsonb,
  consent_version  text not null default 'v1',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists flow_templates_org_idx on public.flow_templates (organization_id);

create table if not exists public.verification_links (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  flow_template_id  uuid references public.flow_templates (id) on delete set null,
  token_hash        text not null unique,
  subject_name      text not null,
  phone             text,
  email             text,
  channel           text not null check (channel in ('sms', 'whatsapp', 'email', 'qr')),
  reference         text,
  status            text not null default 'created' check (status in
                      ('created', 'sent', 'opened', 'in_progress', 'completed', 'expired', 'canceled')),
  expires_at        timestamptz not null default now() + interval '24 hours',
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists verification_links_org_idx on public.verification_links (organization_id, created_at desc);

create table if not exists public.subjects (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  cpf_hash             text,
  name                 text,
  data                 jsonb not null default '{}'::jsonb,
  marketing_opt_in     boolean not null default false,
  marketing_opt_in_at  timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists subjects_org_idx on public.subjects (organization_id);

create table if not exists public.verification_sessions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  link_id              uuid references public.verification_links (id) on delete set null,
  subject_id           uuid references public.subjects (id) on delete set null,
  status               text not null default 'started' check (status in
                         ('started', 'consented', 'captured', 'submitted', 'analyzed', 'decided', 'abandoned')),
  device_fingerprint   text,
  geo_uf               char(2),
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  risk_score           smallint check (risk_score between 0 and 100),
  qualification_score  smallint check (qualification_score between 0 and 100),
  ai_verdict           jsonb,
  decision             text not null default 'pending' check (decision in ('pending', 'approved', 'rejected')),
  decided_by           uuid references auth.users (id) on delete set null,
  decided_at           timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists verification_sessions_org_idx on public.verification_sessions (organization_id, started_at desc);

create table if not exists public.session_events (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  session_id       uuid not null references public.verification_sessions (id) on delete cascade,
  type             text not null,
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists session_events_session_idx on public.session_events (session_id, created_at);

create table if not exists public.media_assets (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  session_id       uuid not null references public.verification_sessions (id) on delete cascade,
  kind             text not null check (kind in ('selfie', 'doc_front', 'doc_back')),
  storage_path     text not null,
  delete_after     timestamptz not null default now() + interval '24 hours',
  created_at       timestamptz not null default now()
);
create index if not exists media_assets_delete_idx on public.media_assets (delete_after);

create table if not exists public.risk_signals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  session_id       uuid not null references public.verification_sessions (id) on delete cascade,
  code             text not null,
  label            text not null,
  weight           numeric(4,3) not null default 0,
  source           text not null check (source in ('browser', 'ai', 'data')),
  created_at       timestamptz not null default now()
);
create index if not exists risk_signals_session_idx on public.risk_signals (session_id);

create table if not exists public.consents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  subject_id       uuid references public.subjects (id) on delete cascade,
  session_id       uuid references public.verification_sessions (id) on delete cascade,
  type             text not null check (type in ('biometric', 'marketing')),
  version          text not null,
  accepted_at      timestamptz not null default now(),
  ip_hash          text
);

create table if not exists public.audit_logs (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  actor_id         uuid references auth.users (id) on delete set null,
  action           text not null,
  target           text,
  before           jsonb,
  after            jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

create table if not exists public.bureau_checks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  subject_id       uuid not null references public.subjects (id) on delete cascade,
  purpose          text not null check (purpose = 'credit_analysis'),
  result_band      text not null check (result_band in ('low', 'medium', 'high')),
  requested_by     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.heartbeat (
  id         smallint primary key default 1 check (id = 1),
  last_ping  timestamptz not null default now()
);
insert into public.heartbeat (id) values (1) on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Helpers de autorização (security definer evita recursão de RLS)
-- -----------------------------------------------------------------------------
create or replace function private.is_org_member(org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

create or replace function private.shares_org_with(other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on b.organization_id = a.organization_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

revoke all on function private.is_org_member(uuid), private.has_org_role(uuid, public.org_role[]),
  private.shares_org_with(uuid), private.is_valid_cnpj(text) from public, anon;
grant execute on function private.is_org_member(uuid), private.has_org_role(uuid, public.org_role[]),
  private.shares_org_with(uuid), private.is_valid_cnpj(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'pt-BR' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists organizations_touch on public.organizations;
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Log de auditoria imutável (inclusive para service_role)
create or replace function private.block_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs é imutável';
end $$;

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.block_audit_mutation();

-- Não deixar a organização sem proprietário
create or replace function private.keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org uuid := coalesce(old.organization_id, new.organization_id);
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (
      select 1 from public.memberships
      where organization_id = org and role = 'owner' and user_id <> old.user_id
    ) and exists (select 1 from public.organizations where id = org) then
      raise exception 'A organização precisa de pelo menos um proprietário';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists memberships_keep_owner on public.memberships;
create trigger memberships_keep_owner before update or delete on public.memberships
  for each row execute function private.keep_one_owner();

-- -----------------------------------------------------------------------------
-- RPCs expostas
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name      text,
  p_niche     text,
  p_cnpj      text default null,
  p_website   text default null,
  p_size      text default null,
  p_subniche  text default null,
  p_flow      jsonb default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org_id uuid;
  clean_cnpj text := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if (select count(*) from public.memberships where user_id = uid and role = 'owner') >= 3 then
    raise exception 'org_limit_reached' using errcode = 'P0001',
      hint = 'Modo demo: no máximo 3 organizações por conta.';
  end if;
  if clean_cnpj is not null and not private.is_valid_cnpj(clean_cnpj) then
    raise exception 'invalid_cnpj' using errcode = '22023';
  end if;
  if p_niche = 'betting' then
    raise exception 'niche_restricted' using errcode = '42501';
  end if;

  insert into public.organizations (name, cnpj, website, size, niche, subniche, created_by)
  values (trim(p_name), clean_cnpj, nullif(trim(p_website), ''), p_size, p_niche, nullif(trim(p_subniche), ''), uid)
  returning id into org_id;

  insert into public.memberships (user_id, organization_id, role) values (uid, org_id, 'owner');

  insert into public.flow_templates (organization_id, niche, name, steps, fields, risk_rules)
  values (
    org_id, p_niche,
    coalesce(p_flow ->> 'name', 'Fluxo padrão'),
    coalesce(p_flow -> 'steps', '[]'::jsonb),
    coalesce(p_flow -> 'fields', '[]'::jsonb),
    coalesce(p_flow -> 'risk_rules', '[]'::jsonb)
  );

  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (org_id, uid, 'organization.created', 'organizations:' || org_id,
          jsonb_build_object('name', p_name, 'niche', p_niche, 'subniche', p_subniche));

  return org_id;
end $$;

create or replace function public.log_audit(
  p_organization_id uuid, p_action text, p_target text default null,
  p_before jsonb default null, p_after jsonb default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_org_member(p_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
  values (p_organization_id, auth.uid(), left(p_action, 80), left(p_target, 200), p_before, p_after);
end $$;

-- Keep-alive do plano gratuito (chamado pelo cron do Worker)
create or replace function public.ping_heartbeat()
returns timestamptz
language sql security definer
set search_path = ''
as $$
  update public.heartbeat set last_ping = now() where id = 1 returning last_ping;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, jsonb) to authenticated;
revoke all on function public.log_audit(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.log_audit(uuid, text, text, jsonb, jsonb) to authenticated;
revoke all on function public.ping_heartbeat() from public, authenticated;
grant execute on function public.ping_heartbeat() to anon, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.memberships           enable row level security;
alter table public.invitations           enable row level security;
alter table public.flow_templates        enable row level security;
alter table public.verification_links    enable row level security;
alter table public.subjects              enable row level security;
alter table public.verification_sessions enable row level security;
alter table public.session_events        enable row level security;
alter table public.media_assets          enable row level security;
alter table public.risk_signals          enable row level security;
alter table public.consents              enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.bureau_checks         enable row level security;
alter table public.heartbeat             enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (private.has_org_role(id, array['owner']::public.org_role[]))
  with check (private.has_org_role(id, array['owner']::public.org_role[]));

-- memberships
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships for update to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.org_role[]))
  with check (private.has_org_role(organization_id, array['owner']::public.org_role[]));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.org_role[])
         or user_id = (select auth.uid()));

-- invitations
drop policy if exists invitations_owner_all on public.invitations;
create policy invitations_owner_all on public.invitations for all to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.org_role[]))
  with check (private.has_org_role(organization_id, array['owner']::public.org_role[]));

-- flow_templates
drop policy if exists flow_templates_select on public.flow_templates;
create policy flow_templates_select on public.flow_templates for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists flow_templates_write on public.flow_templates;
create policy flow_templates_write on public.flow_templates for update to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.org_role[]))
  with check (private.has_org_role(organization_id, array['owner']::public.org_role[]));
drop policy if exists flow_templates_insert on public.flow_templates;
create policy flow_templates_insert on public.flow_templates for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner']::public.org_role[]));

-- verification_links (criação real passa pelo Worker; analista pode cancelar)
drop policy if exists verification_links_select on public.verification_links;
create policy verification_links_select on public.verification_links for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists verification_links_update on public.verification_links;
create policy verification_links_update on public.verification_links for update to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]))
  with check (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));

-- subjects / sessions
drop policy if exists subjects_select on public.subjects;
create policy subjects_select on public.subjects for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists verification_sessions_select on public.verification_sessions;
create policy verification_sessions_select on public.verification_sessions for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists verification_sessions_decide on public.verification_sessions;
create policy verification_sessions_decide on public.verification_sessions for update to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]))
  with check (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));

-- somente leitura para membros (escrita só pelo Worker com service role)
drop policy if exists session_events_select on public.session_events;
create policy session_events_select on public.session_events for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists media_assets_select on public.media_assets;
create policy media_assets_select on public.media_assets for select to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));
drop policy if exists risk_signals_select on public.risk_signals;
create policy risk_signals_select on public.risk_signals for select to authenticated
  using (private.is_org_member(organization_id));
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents for select to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));
drop policy if exists bureau_checks_select on public.bureau_checks;
create policy bureau_checks_select on public.bureau_checks for select to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));
-- heartbeat: sem policies (acesso só via ping_heartbeat)

-- -----------------------------------------------------------------------------
-- Grants explícitos para a Data API (projetos novos não expõem tabelas sozinhos)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon;

grant select, update                 on public.profiles              to authenticated;
grant select, update                 on public.organizations         to authenticated;
grant select, update, delete         on public.memberships           to authenticated;
grant select, insert, update, delete on public.invitations           to authenticated;
grant select, insert, update         on public.flow_templates        to authenticated;
grant select, update                 on public.verification_links    to authenticated;
grant select                         on public.subjects              to authenticated;
grant select, update                 on public.verification_sessions to authenticated;
grant select                         on public.session_events        to authenticated;
grant select                         on public.media_assets          to authenticated;
grant select                         on public.risk_signals          to authenticated;
grant select                         on public.consents              to authenticated;
grant select                         on public.audit_logs            to authenticated;
grant select                         on public.bureau_checks         to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado "media" (upload/leitura por URL assinada do Worker)
-- Caminho: <organization_id>/<session_id>/<kind>.jpg
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists media_read_org on storage.objects;
create policy media_read_org on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = (select auth.uid())
        and m.role in ('owner', 'analyst')
        and m.organization_id::text = (storage.foldername(name))[1]
    )
  );
