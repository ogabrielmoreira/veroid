-- =============================================================================
-- Vero ID — Fases 6 e 7
-- Fase 6: agregações do dashboard, visão de sessões, fila de revisão, detalhe,
--         decisões do analista, notas, nova captura e auditoria.
-- Fase 7: Score de Qualificação, Clientes Qualificados, bureau de crédito (mock).
-- =============================================================================

alter table public.verification_sessions
  add column if not exists decision_reason text check (decision_reason is null or char_length(decision_reason) <= 300);

create table if not exists public.session_notes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  session_id       uuid not null references public.verification_sessions (id) on delete cascade,
  author_id        uuid references auth.users (id) on delete set null,
  body             text not null check (char_length(body) between 1 and 1000),
  created_at       timestamptz not null default now()
);
create index if not exists session_notes_session_idx on public.session_notes (session_id, created_at);
alter table public.session_notes enable row level security;
drop policy if exists session_notes_select on public.session_notes;
create policy session_notes_select on public.session_notes for select to authenticated
  using (private.has_org_role(organization_id, array['owner','analyst']::public.org_role[]));
grant select on public.session_notes to authenticated;
grant all on public.session_notes to service_role;

-- -----------------------------------------------------------------------------
-- UF pela faixa do CEP (sem API externa) e Score de Qualificação
-- -----------------------------------------------------------------------------
create or replace function private.uf_from_cep(p text)
returns text language sql immutable set search_path = '' as $$
  with c as (select nullif(substr(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 1, 5), '')::int as n)
  select case
    when n is null then null
    when n between 1000 and 19999 then 'SP'  when n between 20000 and 28999 then 'RJ'
    when n between 29000 and 29999 then 'ES' when n between 30000 and 39999 then 'MG'
    when n between 40000 and 48999 then 'BA' when n between 49000 and 49999 then 'SE'
    when n between 50000 and 56999 then 'PE' when n between 57000 and 57999 then 'AL'
    when n between 58000 and 58999 then 'PB' when n between 59000 and 59999 then 'RN'
    when n between 60000 and 63999 then 'CE' when n between 64000 and 64999 then 'PI'
    when n between 65000 and 65999 then 'MA' when n between 66000 and 68899 then 'PA'
    when n between 68900 and 68999 then 'AP' when n between 69300 and 69399 then 'RR'
    when n between 69000 and 69899 then 'AM' when n between 69900 and 69999 then 'AC'
    when n between 70000 and 72799 then 'DF' when n between 73000 and 73699 then 'DF'
    when n between 72800 and 72999 then 'GO' when n between 73700 and 76799 then 'GO'
    when n between 76800 and 76999 then 'RO' when n between 77000 and 77999 then 'TO'
    when n between 78000 and 78899 then 'MT' when n between 79000 and 79999 then 'MS'
    when n between 80000 and 87999 then 'PR' when n between 88000 and 89999 then 'SC'
    when n between 90000 and 99999 then 'RS'
  end from c;
$$;

/**
 * Score de Qualificação (0–100), com consentimento, sem componente de crédito:
 *   50% confiança da identidade (100 − risco) · 25% completude do cadastro · 25% recência.
 */
create or replace function private.session_enrich()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  subj public.subjects;
  f public.flow_templates;
  v_total int; v_filled int; v_complete numeric; v_recency numeric;
begin
  if new.subject_id is null then return new; end if;
  select * into subj from public.subjects where id = new.subject_id;

  if new.geo_uf is null then
    new.geo_uf := coalesce(
      nullif(upper(left(subj.data->>'property_uf', 2)), ''),
      private.uf_from_cep(subj.data->>'cep'));
  end if;

  if new.risk_score is not null then
    select ft.* into f from public.verification_links l join public.flow_templates ft on ft.id = l.flow_template_id where l.id = new.link_id;
    select count(*), count(*) filter (where (value->>'key') in ('cpf', 'name') or coalesce(subj.data->>(value->>'key'), '') <> '')
      into v_total, v_filled
    from jsonb_array_elements(coalesce(f.fields, '[]'::jsonb))
    where coalesce((value->>'enabled')::boolean, true);
    v_complete := case when coalesce(v_total, 0) = 0 then 100 else 100.0 * v_filled / v_total end;
    v_recency := case
      when coalesce(new.submitted_at, new.started_at) > now() - interval '7 days' then 100
      when coalesce(new.submitted_at, new.started_at) > now() - interval '30 days' then 60
      else 30 end;
    new.qualification_score := least(100, greatest(0, round(0.5 * (100 - new.risk_score) + 0.25 * v_complete + 0.25 * v_recency)))::smallint;
  end if;
  return new;
end $$;

drop trigger if exists verification_sessions_enrich on public.verification_sessions;
create trigger verification_sessions_enrich before insert or update of risk_score, subject_id, decision on public.verification_sessions
  for each row execute function private.session_enrich();

-- -----------------------------------------------------------------------------
-- Visão de sessões (painel e filtros clicáveis)
-- -----------------------------------------------------------------------------
create or replace view public.sessions_view
with (security_invoker = true) as
select
  s.id, s.organization_id, s.link_id, s.subject_id, s.status, s.decision, s.decision_reason, s.decided_at, s.decided_by,
  s.risk_score, s.risk_band, s.qualification_score, s.analysis_source, s.geo_uf,
  s.started_at, s.submitted_at, s.completed_at, s.capture_attempts,
  subj.name as subject_name,
  l.channel, l.reference,
  extract(isodow from s.started_at at time zone 'America/Sao_Paulo')::int as dow,
  extract(hour from s.started_at at time zone 'America/Sao_Paulo')::int as hour,
  case
    when s.user_agent ~* 'iphone|ipad' then 'iOS'
    when s.user_agent ~* 'android' then 'Android'
    when s.user_agent ~* 'windows' then 'Windows'
    when s.user_agent ~* 'mac os' then 'macOS'
    when s.user_agent is null then null
    else 'Outro' end as device_os,
  case
    when s.user_agent ~* 'samsungbrowser' then 'Samsung Internet'
    when s.user_agent ~* 'edg/|edga/' then 'Edge'
    when s.user_agent ~* 'crios|chrome/' then 'Chrome'
    when s.user_agent ~* 'fxios|firefox/' then 'Firefox'
    when s.user_agent ~* 'safari/' then 'Safari'
    when s.user_agent is null then null
    else 'Outro' end as browser,
  coalesce((select array_agg(r.code order by r.weight desc) from public.risk_signals r where r.session_id = s.id and r.weight > 0), '{}') as signal_codes
from public.verification_sessions s
left join public.subjects subj on subj.id = s.subject_id
left join public.verification_links l on l.id = s.link_id;

grant select on public.sessions_view to authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard
-- -----------------------------------------------------------------------------
create or replace function private.fraud_type(p_code text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_code in ('ai_screen_replay') then 'screen'
    when p_code in ('ai_printed_photo') then 'printed'
    when p_code in ('faces_none', 'ai_object_or_no_face', 'ai_animal', 'ai_mask_or_doll') then 'no_face'
    when p_code in ('ai_doc_face_mismatch', 'faces_multiple', 'ai_multiple_faces') then 'face_mismatch'
    when p_code in ('device_multi_cpf', 'cpf_multi_sessions', 'fast_completion', 'many_capture_attempts') then 'device'
    when p_code in ('underage', 'cpf_name_mismatch', 'senior_remote', 'car_missing_credit', 'high_deposit_no_history') then 'data'
    when p_code in ('liveness_failed') then 'liveness'
    else null end;
$$;

create or replace function public.dashboard_stats(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.organizations;
  v_span interval := p_to - p_from;
  v_ticket numeric;
  v_kpis jsonb; v_prev jsonb; v_funnel jsonb; v_types jsonb; v_hist jsonb; v_uf jsonb; v_heat jsonb; v_dev jsonb; v_niche jsonb; v_trend jsonb;
  v_channel text := nullif(p_filters->>'channel', '');
  v_band text := nullif(p_filters->>'band', '');
  v_decision text := nullif(p_filters->>'decision', '');
begin
  if not private.is_org_member(p_organization_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_to <= p_from or v_span > interval '400 days' then raise exception 'invalid_range' using errcode = '22023'; end if;
  select * into o from public.organizations where id = p_organization_id;
  v_ticket := coalesce((o.settings->>'avg_ticket')::numeric, 2500);

  create temp table if not exists _ds on commit drop as select * from public.sessions_view limit 0;
  truncate _ds;
  insert into _ds
  select * from public.sessions_view sv
  where sv.organization_id = p_organization_id
    and sv.started_at >= p_from - v_span and sv.started_at < p_to
    and (v_channel is null or sv.channel = v_channel)
    and (v_band is null or sv.risk_band = v_band)
    and (v_decision is null or sv.decision = v_decision);

  select jsonb_build_object(
      'verifications', count(*) filter (where submitted_at is not null),
      'auto_approval_rate', round(100.0 * count(*) filter (where decision = 'approved' and decided_by is null) / nullif(count(*) filter (where submitted_at is not null), 0), 1),
      'approval_rate', round(100.0 * count(*) filter (where decision = 'approved') / nullif(count(*) filter (where submitted_at is not null), 0), 1),
      'fraud_blocked', count(*) filter (where decision = 'rejected' or (decision = 'pending' and risk_band = 'high')),
      'losses_prevented', count(*) filter (where decision = 'rejected' or (decision = 'pending' and risk_band = 'high')) * v_ticket,
      'avg_completion_seconds', round(extract(epoch from avg(submitted_at - started_at)))::int,
      'pending_review', count(*) filter (where decision = 'pending' and submitted_at is not null)
    ) into v_kpis
  from _ds where started_at >= p_from;

  select jsonb_build_object(
      'verifications', count(*) filter (where submitted_at is not null),
      'auto_approval_rate', round(100.0 * count(*) filter (where decision = 'approved' and decided_by is null) / nullif(count(*) filter (where submitted_at is not null), 0), 1),
      'fraud_blocked', count(*) filter (where decision = 'rejected' or (decision = 'pending' and risk_band = 'high')),
      'avg_completion_seconds', round(extract(epoch from avg(submitted_at - started_at)))::int
    ) into v_prev
  from _ds where started_at < p_from;

  v_kpis := v_kpis || jsonb_build_object('qualified', (
    select count(distinct sv.subject_id) from _ds sv join public.subjects su on su.id = sv.subject_id
    where sv.started_at >= p_from and sv.decision = 'approved' and su.marketing_opt_in
      and sv.qualification_score >= coalesce((o.settings->>'qualified_min')::int, 60)));

  -- Funil (por link, sempre monotônico)
  with links as (
    select l.id, l.status, l.sent_at, l.opened_at from public.verification_links l
    where l.organization_id = p_organization_id and l.created_at >= p_from and l.created_at < p_to
      and (v_channel is null or l.channel = v_channel)
  ), steps as (
    select
      count(*) filter (where status <> 'created' or sent_at is not null) as sent,
      count(*) filter (where opened_at is not null or status in ('opened', 'in_progress', 'completed')) as opened,
      count(*) filter (where exists (select 1 from public.session_events e join public.verification_sessions s on s.id = e.session_id
                                     where s.link_id = links.id and e.type = 'camera_permission_granted')) as camera,
      count(*) filter (where exists (select 1 from public.session_events e join public.verification_sessions s on s.id = e.session_id
                                     where s.link_id = links.id and e.type = 'capture_succeeded')) as captured,
      count(*) filter (where exists (select 1 from public.verification_sessions s where s.link_id = links.id and s.submitted_at is not null)) as submitted,
      count(*) filter (where exists (select 1 from public.verification_sessions s where s.link_id = links.id and s.decision = 'approved')) as approved,
      count(*) filter (where exists (select 1 from public.session_events e join public.verification_sessions s on s.id = e.session_id
                                     where s.link_id = links.id and e.type = 'camera_permission_denied')) as camera_denied
    from links
  )
  select jsonb_build_array(
    jsonb_build_object('step', 'sent', 'n', sent),
    jsonb_build_object('step', 'opened', 'n', least(opened, sent)),
    jsonb_build_object('step', 'camera', 'n', least(camera, opened), 'denied', camera_denied),
    jsonb_build_object('step', 'captured', 'n', least(captured, camera)),
    jsonb_build_object('step', 'submitted', 'n', least(submitted, captured)),
    jsonb_build_object('step', 'approved', 'n', least(approved, submitted))
  ) into v_funnel from steps;

  -- Fraudes por tipo, por semana
  select coalesce(jsonb_agg(jsonb_build_object('week', w, 'type', t, 'n', n) order by w, t), '[]') into v_types
  from (
    select date_trunc('week', sv.started_at at time zone 'America/Sao_Paulo')::date as w, private.fraud_type(code) as t, count(distinct sv.id) as n
    from _ds sv, unnest(sv.signal_codes) code
    where sv.started_at >= p_from and private.fraud_type(code) is not null
    group by 1, 2
  ) x;

  -- Tendência diária de verificações e fraudes
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'verifications', v, 'high', h) order by d), '[]') into v_trend
  from (
    select (sv.started_at at time zone 'America/Sao_Paulo')::date as d,
           count(*) filter (where submitted_at is not null) as v,
           count(*) filter (where risk_band = 'high') as h
    from _ds sv where sv.started_at >= p_from group by 1
  ) x;

  -- Histograma de score (10 faixas)
  select jsonb_agg(jsonb_build_object('bucket', b * 10, 'n', coalesce(n, 0)) order by b) into v_hist
  from generate_series(0, 9) b
  left join (
    select least(9, risk_score / 10) as bk, count(*) as n from _ds
    where started_at >= p_from and risk_score is not null group by 1
  ) x on x.bk = b;

  select coalesce(jsonb_agg(jsonb_build_object('uf', geo_uf, 'n', n, 'high', h)), '[]') into v_uf
  from (select geo_uf, count(*) n, count(*) filter (where risk_band = 'high') h from _ds
        where started_at >= p_from and geo_uf is not null and submitted_at is not null group by 1) x;

  select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'n', n)), '[]') into v_heat
  from (select dow, hour, count(*) n from _ds where started_at >= p_from group by 1, 2) x;

  select jsonb_build_object(
    'os', coalesce((select jsonb_agg(jsonb_build_object('k', device_os, 'n', n) order by n desc) from
            (select device_os, count(*) n from _ds where started_at >= p_from and device_os is not null group by 1) a), '[]'),
    'browser', coalesce((select jsonb_agg(jsonb_build_object('k', browser, 'n', n) order by n desc) from
            (select browser, count(*) n from _ds where started_at >= p_from and browser is not null group by 1) b), '[]')
  ) into v_dev;

  -- KPI do nicho: quebra principal de aprovação
  select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'approved', a) order by n desc), '[]') into v_niche
  from (
    select case o.niche
             when 'agro' then coalesce(su.data->>'main_crop', '—')
             when 'automotive' then coalesce(su.data->>'cnh_category', '—')
             when 'credit' then case
                when su.data->>'birth_date' is null then '—'
                when extract(year from age((su.data->>'birth_date')::date)) < 30 then '18–29'
                when extract(year from age((su.data->>'birth_date')::date)) < 50 then '30–49'
                when extract(year from age((su.data->>'birth_date')::date)) < 70 then '50–69'
                else '70+' end
             else coalesce(sv.channel, '—') end as k,
           count(*) n, count(*) filter (where sv.decision = 'approved') a
    from _ds sv left join public.subjects su on su.id = sv.subject_id
    where sv.started_at >= p_from and sv.submitted_at is not null
    group by 1
  ) x;

  return jsonb_build_object('kpis', v_kpis, 'previous', v_prev, 'funnel', v_funnel, 'fraud_types', v_types, 'trend', v_trend,
    'histogram', v_hist, 'by_uf', v_uf, 'heatmap', v_heat, 'devices', v_dev, 'niche_breakdown', v_niche,
    'niche', o.niche, 'generated_at', now());
end $$;

-- -----------------------------------------------------------------------------
-- Detalhe da sessão e ações do analista
-- -----------------------------------------------------------------------------
create or replace function public.get_session_detail(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.verification_sessions; l public.verification_links; subj public.subjects; can_review boolean;
begin
  select * into s from public.verification_sessions where id = p_session_id;
  if not found or not private.is_org_member(s.organization_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  can_review := private.has_org_role(s.organization_id, array['owner','analyst']::public.org_role[]);
  select * into l from public.verification_links where id = s.link_id;
  select * into subj from public.subjects where id = s.subject_id;

  return jsonb_build_object(
    'can_review', can_review,
    'session', jsonb_build_object('id', s.id, 'status', s.status, 'decision', s.decision, 'decision_reason', s.decision_reason,
      'decided_at', s.decided_at, 'decided_by', (select coalesce(p.full_name, u.email) from auth.users u left join public.profiles p on p.id = u.id where u.id = s.decided_by),
      'risk_score', s.risk_score, 'risk_band', s.risk_band, 'qualification_score', s.qualification_score,
      'analysis_source', s.analysis_source, 'ai_verdict', s.ai_verdict, 'started_at', s.started_at, 'submitted_at', s.submitted_at,
      'geo_uf', s.geo_uf, 'capture_attempts', s.capture_attempts, 'user_agent', case when can_review then s.user_agent end,
      'consent_version', s.consent_version),
    'link', case when l.id is null then null else jsonb_build_object('id', l.id, 'channel', l.channel, 'reference', l.reference,
      'subject_name', l.subject_name, 'created_at', l.created_at,
      'phone_masked', case when l.phone is not null then '(' || substr(l.phone, 1, 2) || ') *****-' || right(l.phone, 4) end) end,
    'subject', case when subj.id is null then null else jsonb_build_object('id', subj.id, 'name', subj.name,
      'data', case when can_review then subj.data - 'name_conflict' else jsonb_build_object('cpf_masked', subj.data->>'cpf_masked') end,
      'marketing_opt_in', subj.marketing_opt_in, 'marketing_opt_in_at', subj.marketing_opt_in_at) end,
    'signals', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'weight', weight, 'source', source, 'forces_review', forces_review) order by weight desc)
                         from public.risk_signals where session_id = s.id), '[]'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'payload', payload, 'at', created_at) order by created_at)
                        from public.session_events where session_id = s.id), '[]'),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'version', version, 'at', accepted_at)) from public.consents where session_id = s.id), '[]'),
    'media', case when can_review then coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'path', storage_path, 'delete_after', delete_after) order by created_at desc)
                         from public.media_assets m where m.session_id = s.id
                           and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = m.storage_path)), '[]') else '[]'::jsonb end,
    'notes', case when can_review then coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'at', n.created_at,
                         'author', (select coalesce(p.full_name, u.email) from auth.users u left join public.profiles p on p.id = u.id where u.id = n.author_id)) order by n.created_at)
                         from public.session_notes n where n.session_id = s.id), '[]') else '[]'::jsonb end,
    'audit', case when can_review then coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'before', a.before, 'after', a.after, 'at', a.created_at,
                         'actor', (select coalesce(p.full_name, u.email) from auth.users u left join public.profiles p on p.id = u.id where u.id = a.actor_id)) order by a.created_at)
                         from public.audit_logs a where a.target = 'verification_sessions:' || s.id), '[]') else '[]'::jsonb end,
    'bureau', case when can_review and subj.id is not null then (select jsonb_build_object('band', result_band, 'at', created_at)
                         from public.bureau_checks b where b.subject_id = subj.id order by created_at desc limit 1) end
  );
end $$;

create or replace function public.decide_session(p_session_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare s public.verification_sessions;
begin
  select * into s from public.verification_sessions where id = p_session_id for update;
  if not found or not private.has_org_role(s.organization_id, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  if s.submitted_at is null then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  if p_decision = 'rejected' and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.verification_sessions
     set decision = p_decision, decision_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''),
         decided_by = auth.uid(), decided_at = now(), status = 'decided'
   where id = s.id;
  insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
  values (s.organization_id, auth.uid(), 'session.' || p_decision, 'verification_sessions:' || s.id,
          jsonb_build_object('decision', s.decision, 'reason', s.decision_reason, 'risk_score', s.risk_score),
          jsonb_build_object('decision', p_decision, 'reason', nullif(trim(coalesce(p_reason, '')), ''), 'ai_recommendation', s.risk_band));
end $$;

create or replace function public.add_session_note(p_session_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.verification_sessions; v_id uuid;
begin
  select * into s from public.verification_sessions where id = p_session_id;
  if not found or not private.has_org_role(s.organization_id, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'empty_note' using errcode = '22023'; end if;
  insert into public.session_notes (organization_id, session_id, author_id, body)
  values (s.organization_id, s.id, auth.uid(), left(trim(p_body), 1000)) returning id into v_id;
  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (s.organization_id, auth.uid(), 'session.note_added', 'verification_sessions:' || s.id, jsonb_build_object('note_id', v_id));
  return v_id;
end $$;

create or replace function public.request_new_capture(p_session_id uuid)
returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare s public.verification_sessions; l public.verification_links; r record;
begin
  select * into s from public.verification_sessions where id = p_session_id;
  if not found or not private.has_org_role(s.organization_id, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into l from public.verification_links where id = s.link_id;
  select * into r from public.create_verification_link(s.organization_id, l.subject_name, l.channel, l.phone, l.email,
    left(coalesce(l.reference, '') || ' (nova captura)', 80), 24, l.flow_template_id, null);
  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (s.organization_id, auth.uid(), 'session.recapture_requested', 'verification_sessions:' || s.id, jsonb_build_object('new_link_id', r.link_id));
  return query select r.link_id, r.token, r.expires_at;
end $$;

create or replace function public.log_media_view(p_session_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.verification_sessions where id = p_session_id;
  if v_org is null or not private.has_org_role(v_org, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (v_org, auth.uid(), 'media.viewed', 'verification_sessions:' || p_session_id, jsonb_build_object('kind', left(p_kind, 16)));
end $$;

-- -----------------------------------------------------------------------------
-- Fase 7 — Clientes Qualificados e bureau (mock)
-- -----------------------------------------------------------------------------
create or replace view public.qualified_subjects
with (security_invoker = true) as
select distinct on (su.id)
  su.id as subject_id, su.organization_id, su.name, su.marketing_opt_in_at,
  su.data->>'cpf_masked' as cpf_masked,
  s.id as session_id, s.qualification_score, s.risk_score, s.decided_at as verified_at, s.geo_uf,
  l.email, l.phone, l.channel,
  (select b.result_band from public.bureau_checks b where b.subject_id = su.id order by b.created_at desc limit 1) as bureau_band,
  (select b.created_at from public.bureau_checks b where b.subject_id = su.id order by b.created_at desc limit 1) as bureau_checked_at
from public.subjects su
join public.verification_sessions s on s.subject_id = su.id and s.decision = 'approved'
join public.organizations o on o.id = su.organization_id
left join public.verification_links l on l.id = s.link_id
where su.marketing_opt_in
  and s.qualification_score >= coalesce((o.settings->>'qualified_min')::int, 60)
order by su.id, s.decided_at desc;

grant select on public.qualified_subjects to authenticated;

create or replace function public.run_bureau_check(p_subject_id uuid, p_purpose text)
returns text
language plpgsql security definer set search_path = '' as $$
declare subj public.subjects; v_band text; v_recent public.bureau_checks;
begin
  select * into subj from public.subjects where id = p_subject_id;
  if not found or not private.has_org_role(subj.organization_id, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_purpose <> 'credit_analysis' then raise exception 'purpose_required' using errcode = '22023'; end if;
  if not exists (select 1 from public.verification_sessions where subject_id = subj.id and decision = 'approved') then
    raise exception 'subject_not_approved' using errcode = 'P0001';
  end if;
  select * into v_recent from public.bureau_checks where subject_id = subj.id and created_at > now() - interval '24 hours' order by created_at desc limit 1;
  if found then return v_recent.result_band; end if;

  -- Mock determinístico: mesma pessoa, mesma faixa. Nenhum dado sai do sistema.
  v_band := (array['low', 'medium', 'high'])[1 + (('x' || substr(coalesce(subj.cpf_hash, subj.id::text), 1, 8))::bit(32)::int & 2147483647) % 3];
  insert into public.bureau_checks (organization_id, subject_id, purpose, result_band, requested_by)
  values (subj.organization_id, subj.id, p_purpose, v_band, auth.uid());
  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (subj.organization_id, auth.uid(), 'bureau.checked', 'subjects:' || subj.id,
          jsonb_build_object('purpose', p_purpose, 'provider', 'mock', 'band', v_band));
  return v_band;
end $$;

-- Configurações de regras e integrações (só proprietário, com auditoria)
create or replace function public.update_org_settings(p_organization_id uuid, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.organizations; v_new jsonb; k text;
begin
  if not private.has_org_role(p_organization_id, array['owner']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k not in ('auto_approve', 'deposit_limit', 'qualified_min', 'avg_ticket', 'webhook_url', 'dpo_email', 'retention_days') then
      raise exception 'invalid_setting:%', k using errcode = '22023';
    end if;
  end loop;
  if p_patch ? 'webhook_url' and coalesce(p_patch->>'webhook_url', '') <> '' and (p_patch->>'webhook_url') !~ '^https://[^\s/]+\.[^\s]+$' then
    raise exception 'invalid_webhook' using errcode = '22023';
  end if;
  if p_patch ? 'qualified_min' and ((p_patch->>'qualified_min')::int not between 0 and 100) then raise exception 'invalid_setting:qualified_min' using errcode = '22023'; end if;
  if p_patch ? 'deposit_limit' and ((p_patch->>'deposit_limit')::numeric < 0) then raise exception 'invalid_setting:deposit_limit' using errcode = '22023'; end if;
  if p_patch ? 'avg_ticket' and ((p_patch->>'avg_ticket')::numeric < 0) then raise exception 'invalid_setting:avg_ticket' using errcode = '22023'; end if;
  if p_patch ? 'retention_days' and ((p_patch->>'retention_days')::int not between 1 and 365) then raise exception 'invalid_setting:retention_days' using errcode = '22023'; end if;

  select * into o from public.organizations where id = p_organization_id for update;
  v_new := o.settings || p_patch;
  update public.organizations set settings = v_new where id = o.id;
  insert into public.audit_logs (organization_id, actor_id, action, target, before, after)
  values (o.id, auth.uid(), 'settings.updated', 'organizations:' || o.id, o.settings, v_new);
  return v_new;
end $$;

-- Impacto do limiar de aprovação automática (preview nas Configurações)
create or replace function public.auto_approve_impact(p_organization_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not private.is_org_member(p_organization_id) then null else jsonb_build_object(
    'total', count(*),
    'low', count(*) filter (where risk_band = 'low'),
    'review', count(*) filter (where risk_band in ('review', 'unknown')),
    'high', count(*) filter (where risk_band = 'high')
  ) end
  from public.verification_sessions
  where organization_id = p_organization_id and submitted_at > now() - interval '30 days';
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function private.uf_from_cep(text), private.fraud_type(text) from public, anon;
grant execute on function private.uf_from_cep(text), private.fraud_type(text) to authenticated, service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'public.dashboard_stats(uuid, timestamptz, timestamptz, jsonb)',
    'public.get_session_detail(uuid)',
    'public.decide_session(uuid, text, text)',
    'public.add_session_note(uuid, text)',
    'public.request_new_capture(uuid)',
    'public.log_media_view(uuid, text)',
    'public.run_bureau_check(uuid, text)',
    'public.update_org_settings(uuid, jsonb)',
    'public.auto_approve_impact(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Organizações: settings só pela RPC acima (auditada)
revoke update on public.organizations from authenticated;
grant update (name, website, size, subniche, brand_kit, dpo_email, onboarding_step, onboarding_completed_at)
  on public.organizations to authenticated;
