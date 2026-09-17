-- =============================================================================
-- Vero ID — Fases 8 e 9
-- Fase 8: modo demo (seed realista, painel público somente leitura, "simular
--         onboarding" reaproveita create_verification_link do front).
-- Fase 9: LGPD — retenção automática (mídia + links) e direitos do titular
--         (acesso/exclusão com verificação por código).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fase 8.1 — extrai o cálculo do painel para reaproveitar sem exigir membership
-- -----------------------------------------------------------------------------
create or replace function private.dashboard_stats_for(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_filters jsonb default '{}'::jsonb)
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

  select coalesce(jsonb_agg(jsonb_build_object('week', w, 'type', t, 'n', n) order by w, t), '[]') into v_types
  from (
    select date_trunc('week', sv.started_at at time zone 'America/Sao_Paulo')::date as w, private.fraud_type(code) as t, count(distinct sv.id) as n
    from _ds sv, unnest(sv.signal_codes) code
    where sv.started_at >= p_from and private.fraud_type(code) is not null
    group by 1, 2
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'verifications', v, 'high', h) order by d), '[]') into v_trend
  from (
    select (sv.started_at at time zone 'America/Sao_Paulo')::date as d,
           count(*) filter (where submitted_at is not null) as v,
           count(*) filter (where risk_band = 'high') as h
    from _ds sv where sv.started_at >= p_from group by 1
  ) x;

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
    'niche', o.niche, 'generated_at', now(),
    'organization', jsonb_build_object('name', o.name, 'niche', o.niche, 'subniche', o.subniche, 'brand_kit', o.brand_kit));
end $$;

create or replace function public.dashboard_stats(p_organization_id uuid, p_from timestamptz, p_to timestamptz, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_org_member(p_organization_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return private.dashboard_stats_for(p_organization_id, p_from, p_to, p_filters);
end $$;

-- -----------------------------------------------------------------------------
-- Fase 8.2 — "Explorar sem cadastro": painel público somente leitura
-- -----------------------------------------------------------------------------
create or replace function public.public_demo_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where settings->>'is_public_demo' = 'true' order by created_at limit 1;
  if v_org is null then raise exception 'no_public_demo' using errcode = 'P0002'; end if;
  return private.dashboard_stats_for(v_org, now() - interval '90 days', now() + interval '1 hour', '{}'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- Fase 8.3 — gerador de dados de demonstração (~800 sessões, 90 dias)
-- -----------------------------------------------------------------------------
create or replace function private.seed_demo_core(
  p_organization_id uuid,
  p_flow_template_id uuid,
  p_owner uuid,
  p_sessions int,
  p_fraud_rate numeric,
  p_top_ufs text[]
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_denied int := round(p_sessions * 0.045);
  v_abandoned int := round(p_sessions * 0.03);
  v_never_opened int := round(p_sessions * 0.09);
  v_no_camera int := round(p_sessions * 0.05);
  v_total int := p_sessions + v_denied + v_abandoned + v_never_opened + v_no_camera;
  v_names text[] := array[
    'Maria Silva','João Pereira','Ana Rocha','Carlos Nunes','Fernanda Alves','Rafael Costa','Juliana Souza','Pedro Lima',
    'Camila Santos','Bruno Oliveira','Larissa Ferreira','Thiago Almeida','Patrícia Gomes','Marcelo Ribeiro','Aline Cardoso',
    'Diego Martins','Vanessa Barbosa','Rodrigo Teixeira','Beatriz Carvalho','Gustavo Pinto'];
  v_other_ufs text[] := array['AM','PA','CE','DF','ES','SC','RN','AL','PB','MT'];
  v_uas text[] := array[
    'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/122.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'];
  v_channels text[] := array['whatsapp','whatsapp','whatsapp','whatsapp','qr','qr','sms','sms','email'];
  v_n_sessions int; v_n_approved int; v_n_rejected int; v_n_signals int;
begin
  create temp table _seed on commit drop as
  with base as (
    select
      i,
      gen_random_uuid() as link_id,
      gen_random_uuid() as session_id,
      gen_random_uuid() as subject_id,
      (now() - interval '90 days' + (random() * 90) * interval '1 day' + (floor(random() * 24)) * interval '1 hour') as link_created_at,
      case
        when i <= v_never_opened then 'never_opened'
        when i <= v_never_opened + v_no_camera then 'no_camera'
        when i <= v_never_opened + v_no_camera + v_denied then 'denied'
        when i <= v_never_opened + v_no_camera + v_denied + v_abandoned then 'abandoned'
        else 'submitted'
      end as stage,
      v_channels[1 + floor(random() * array_length(v_channels, 1))::int] as channel,
      v_names[1 + floor(random() * array_length(v_names, 1))::int] as base_name,
      v_uas[1 + floor(random() * array_length(v_uas, 1))::int] as user_agent,
      case
        when random() < 0.80 then p_top_ufs[1 + floor(random() * least(array_length(p_top_ufs, 1), 5))::int]
        else v_other_ufs[1 + floor(random() * array_length(v_other_ufs, 1))::int]
      end as geo_uf,
      (random() < 0.55) as opt_in,
      random() as r_band,
      1 + floor(random() * 7)::int as fraud_bucket
    from generate_series(1, v_total) as i
  ), banded as (
    select *,
      case when stage <> 'submitted' then null
        when r_band < 0.03 then 'unknown'
        when r_band < 0.03 + p_fraud_rate then 'high'
        when r_band < 0.03 + p_fraud_rate + 0.22 then 'review'
        else 'low' end as risk_band
    from base
  ), scored as (
    select *,
      case risk_band
        when 'low' then floor(random() * 31)
        when 'review' then 31 + floor(random() * 40)
        when 'high' then 71 + floor(random() * 30)
        else null end::smallint as risk_score,
      case
        when stage <> 'submitted' then 'pending'
        when risk_band = 'low' then (case when random() < 0.92 then 'approved' else 'pending' end)
        when risk_band = 'review' then (case when random() < 0.55 then 'approved' when random() < 0.72 then 'rejected' else 'pending' end)
        when risk_band = 'high' then (case when random() < 0.08 then 'approved' when random() < 0.74 then 'rejected' else 'pending' end)
        else (case when random() < 0.10 then 'approved' else 'pending' end)
      end as decision
    from banded
  ), timed as (
    select *,
      (link_created_at + (5 + floor(random() * 175)) * interval '1 minute') as session_started_at,
      case when stage = 'submitted' then link_created_at + (5 + floor(random() * 175)) * interval '1 minute'
                                          + (2 + floor(random() * 8)) * interval '1 minute' end as submitted_at,
      case
        when decision = 'rejected' then p_owner
        when decision = 'approved' and risk_band = 'low' then (case when random() < 0.85 then null else p_owner end)
        when decision = 'approved' then p_owner
        else null end as decided_by,
      (1 + floor(random() * 2))::smallint as capture_attempts,
      (case when risk_band is not null and random() < 0.5 then 'rules+ai' when risk_band is not null then 'rules' end) as analysis_source,
      (1 + floor(random() * 48)) * interval '1 hour' as decide_delay
    from scored
  )
  select *,
    case when decision <> 'pending' and submitted_at is not null then submitted_at + decide_delay end as decided_at
  from timed;

  -- Links de verificação (todas as etapas)
  insert into public.verification_links (id, organization_id, flow_template_id, token_hash, subject_name, phone, email, channel,
    status, sent_at, opened_at, expires_at, created_by, created_at)
  select
    link_id, p_organization_id, p_flow_template_id,
    md5(link_id::text || clock_timestamp()::text || i::text),
    base_name || ' ' || i,
    case when channel in ('whatsapp', 'sms') then '11' || lpad((80000000 + (i * 37) % 19999999)::text, 8, '0') end,
    case when channel = 'email' then lower(regexp_replace(base_name, '[^a-zA-Z]', '', 'g')) || i || '@exemplo.com' end,
    channel,
    case stage when 'never_opened' then 'sent' when 'no_camera' then 'opened' when 'denied' then 'opened'
               when 'abandoned' then 'in_progress' else 'completed' end,
    case when channel in ('sms', 'email') then link_created_at else null end,
    case when stage <> 'never_opened' then link_created_at + interval '2 minutes' end,
    link_created_at + interval '24 hours',
    p_owner,
    link_created_at
  from _seed;

  -- Titulares (só quem chegou a enviar o formulário)
  insert into public.subjects (id, organization_id, cpf_hash, name, data, marketing_opt_in, marketing_opt_in_at)
  select
    subject_id, p_organization_id, md5(subject_id::text),
    base_name || ' ' || i,
    jsonb_build_object('cep', '0' || (1000 + (i % 8999))::text || '-000', 'declared_income', 'R$ ' || (1500 + (i % 40) * 250)::text || ',00'),
    opt_in,
    case when opt_in then submitted_at end
  from _seed where stage = 'submitted';

  -- Sessões de verificação
  insert into public.verification_sessions (id, organization_id, link_id, subject_id, status, device_fingerprint, geo_uf,
    started_at, completed_at, risk_score, risk_band, decision, decided_by, decided_at, capture_attempts, user_agent,
    consent_version, analysis_source, submitted_at, created_at)
  select
    session_id, p_organization_id, link_id,
    case when stage = 'submitted' then subject_id end,
    case stage when 'no_camera' then 'started' when 'denied' then 'consented' when 'abandoned' then 'abandoned'
               else (case when decision = 'pending' then 'submitted' else 'decided' end) end,
    md5(session_id::text || 'device'),
    case when stage <> 'never_opened' then geo_uf end,
    session_started_at,
    submitted_at,
    risk_score, risk_band, decision, decided_by,
    decided_at,
    capture_attempts,
    case when stage <> 'never_opened' then user_agent end,
    case when stage in ('denied', 'abandoned', 'submitted') then 'v1' end,
    analysis_source,
    submitted_at,
    session_started_at
  from _seed where stage <> 'never_opened';

  -- Eventos (alimentam o funil e a linha do tempo)
  insert into public.session_events (organization_id, session_id, type, created_at)
  select p_organization_id, session_id, 'session_started', session_started_at from _seed where stage <> 'never_opened'
  union all
  select p_organization_id, session_id, 'consent_given', session_started_at + interval '30 seconds' from _seed where stage in ('denied', 'abandoned', 'submitted')
  union all
  select p_organization_id, session_id, 'camera_permission_denied', session_started_at + interval '45 seconds' from _seed where stage = 'denied'
  union all
  select p_organization_id, session_id, 'camera_permission_granted', session_started_at + interval '45 seconds' from _seed where stage in ('abandoned', 'submitted')
  union all
  select p_organization_id, session_id, 'capture_succeeded', session_started_at + interval '90 seconds' from _seed where stage = 'submitted'
  union all
  select p_organization_id, session_id, 'form_completed', session_started_at + interval '150 seconds' from _seed where stage = 'submitted'
  union all
  select p_organization_id, session_id, 'submitted', submitted_at from _seed where stage = 'submitted'
  union all
  select p_organization_id, session_id, 'ai_analyzed', submitted_at + interval '5 seconds' from _seed where stage = 'submitted' and analysis_source = 'rules+ai';

  -- Consentimentos
  insert into public.consents (organization_id, subject_id, session_id, type, version, accepted_at)
  select p_organization_id, case when stage = 'submitted' then subject_id end, session_id, 'biometric', 'v1', session_started_at + interval '30 seconds'
  from _seed where stage in ('denied', 'abandoned', 'submitted')
  union all
  select p_organization_id, subject_id, session_id, 'marketing', 'v1', submitted_at
  from _seed where stage = 'submitted' and opt_in;

  -- Sinais de risco (sessões em revisão/alto risco)
  insert into public.risk_signals (organization_id, session_id, code, label, weight, source)
  select p_organization_id, session_id, sig.code, sig.label, sig.weight, sig.source
  from _seed,
    lateral (
      select * from (values
        (1, 'ai_screen_replay', 'Imagem capturada de uma tela', 0.60, 'ai'),
        (2, 'ai_printed_photo', 'Foto impressa apresentada à câmera', 0.60, 'ai'),
        (3, 'faces_none', 'Nenhum rosto detectado na captura', 0.45, 'browser'),
        (4, 'ai_doc_face_mismatch', 'Rosto da selfie diferente do documento', 0.50, 'ai'),
        (5, 'device_multi_cpf', 'Mesmo dispositivo em sessões com CPFs diferentes', 0.25, 'data'),
        (6, 'cpf_name_mismatch', 'CPF já cadastrado com outro nome', 0.30, 'data'),
        (7, 'liveness_failed', 'Desafio de prova de vida não concluído', 0.40, 'browser')
      ) as t(bucket, code, label, weight, source)
      where t.bucket = fraud_bucket
    ) sig
  where stage = 'submitted' and risk_band in ('review', 'high');

  -- Auditoria das decisões (para a tela de Auditoria)
  insert into public.audit_logs (organization_id, actor_id, action, target, after, created_at)
  select p_organization_id, decided_by, 'session.' || decision, 'verification_sessions:' || session_id,
    jsonb_build_object('decision', decision, 'risk_score', risk_score),
    coalesce(decided_at, now())
  from _seed where stage = 'submitted' and decision <> 'pending' and decided_by is not null;

  select count(*) into v_n_sessions from _seed where stage <> 'never_opened';
  select count(*) into v_n_approved from _seed where decision = 'approved';
  select count(*) into v_n_rejected from _seed where decision = 'rejected';
  select count(*) into v_n_signals from public.risk_signals where organization_id = p_organization_id;

  return jsonb_build_object('links', v_total, 'sessions', v_n_sessions, 'approved', v_n_approved, 'rejected', v_n_rejected, 'signals', v_n_signals);
end $$;

-- Chamada pelo front (Onboarding, com ?demo=1, ou Configurações → "Gerar dados de demonstração")
create or replace function public.seed_demo_data(p_organization_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.organizations; v_flow uuid; v_existing int; v_profile jsonb; v_result jsonb;
  v_top_ufs text[] := array['SP', 'RJ', 'MG', 'BA', 'PR'];
  v_sessions int := 800; v_fraud numeric := 0.09;
begin
  if not private.has_org_role(p_organization_id, array['owner']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into o from public.organizations where id = p_organization_id;
  select count(*) into v_existing from public.verification_sessions where organization_id = p_organization_id;
  if v_existing > 10 then
    raise exception 'org_not_empty' using errcode = 'P0001',
      hint = 'A demonstração só pode ser gerada em organizações novas, sem sessões reais.';
  end if;
  select id into v_flow from public.flow_templates where organization_id = p_organization_id and is_active limit 1;
  if v_flow is null then raise exception 'flow_missing' using errcode = 'P0001'; end if;

  update public.organizations
     set settings = settings || jsonb_build_object('retention_days', 1, 'demo_seeded', true, 'auto_approve', true, 'qualified_min', 60)
   where id = o.id;

  v_result := private.seed_demo_core(p_organization_id, v_flow, auth.uid(), v_sessions, v_fraud, v_top_ufs);
  perform public.expire_stale_links();
  insert into public.audit_logs (organization_id, actor_id, action, target, after)
    values (o.id, auth.uid(), 'demo.seeded', 'organizations:' || o.id, v_result);
  return v_result;
end $$;

-- -----------------------------------------------------------------------------
-- Fase 9 — LGPD: retenção automática (cron do Worker) e direitos do titular
-- -----------------------------------------------------------------------------

-- Mídia vencida (delete_after) e links expirados: lidos/aplicados pelo cron.
create or replace function public.list_expired_media()
returns table (id uuid, storage_path text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.storage_path from public.media_assets m where m.delete_after < now() limit 500;
$$;

create or replace function public.purge_media_records(p_ids uuid[])
returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.media_assets where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.expire_stale_links()
returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.verification_links set status = 'expired'
    where status in ('created', 'sent', 'opened', 'in_progress') and expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Direitos do titular (acesso/exclusão), verificados por código de 6 dígitos.
-- O CPF é hasheado por organização (mesmo padrão do submit da sessão), então a busca
-- percorre as organizações calculando o hash equivalente em cada uma — nunca guardamos
-- o CPF em claro nem um hash global correlacionável entre organizações.
create table if not exists public.data_requests (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('access', 'deletion')),
  contact_email     text not null,
  cpf_ref           text not null,
  full_name         text,
  otp_hash          text not null,
  otp_expires_at    timestamptz not null,
  otp_attempts      smallint not null default 0,
  status            text not null default 'pending_otp' check (status in ('pending_otp', 'verified', 'completed', 'expired', 'failed')),
  matched_subjects  jsonb not null default '[]'::jsonb,
  result            jsonb,
  requested_at      timestamptz not null default now(),
  verified_at       timestamptz,
  completed_at      timestamptz
);
create index if not exists data_requests_cpf_idx on public.data_requests (cpf_ref);
alter table public.data_requests enable row level security;
-- Sem policies para anon/authenticated: acesso só pelas RPCs abaixo (security definer).
grant all on public.data_requests to service_role;

create or replace function private.find_subjects_by_cpf(p_cpf text)
returns table (organization_id uuid, subject_id uuid)
language sql stable security definer set search_path = '' as $$
  select o.id, s.id
  from public.organizations o
  join public.subjects s on s.organization_id = o.id and s.cpf_hash = private.token_hash(o.id::text || ':' || p_cpf);
$$;

create or replace function public.create_data_request(p_cpf text, p_email text, p_full_name text, p_kind text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ref text;
  v_otp text;
  v_id uuid;
  v_matches jsonb;
begin
  if v_cpf = '' or not private.is_valid_cpf(v_cpf) then raise exception 'invalid_cpf' using errcode = '22023'; end if;
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = '22023'; end if;
  if p_kind not in ('access', 'deletion') then raise exception 'invalid_kind' using errcode = '22023'; end if;

  v_ref := private.token_hash('dsr:' || v_cpf);
  if (select count(*) from public.data_requests where cpf_ref = v_ref and requested_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_otp := lpad((floor(random() * 1000000))::text, 6, '0');
  select coalesce(jsonb_agg(jsonb_build_object('organization_id', organization_id, 'subject_id', subject_id)), '[]')
    into v_matches
  from private.find_subjects_by_cpf(v_cpf);

  insert into public.data_requests (kind, contact_email, cpf_ref, full_name, otp_hash, otp_expires_at, matched_subjects)
  values (p_kind, v_email, v_ref, left(trim(coalesce(p_full_name, '')), 120), private.token_hash(v_otp), now() + interval '10 minutes', v_matches)
  returning id into v_id;

  -- Modo demonstração: sem SMTP próprio configurado (ver DECISIONS.md), o código volta
  -- na resposta em vez de ser enviado por e-mail. Em produção (`APP_MODE=live` + Resend
  -- configurado), o Worker consumiria este valor e nunca o devolveria ao chamador.
  return jsonb_build_object('request_id', v_id, 'expires_in_minutes', 10, 'matches', jsonb_array_length(v_matches), 'demo_otp', v_otp);
end $$;

create or replace function public.verify_data_request(p_request_id uuid, p_otp text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.data_requests;
  v_result jsonb := '[]'::jsonb;
  m record;
  v_org public.organizations;
  v_subj public.subjects;
begin
  select * into r from public.data_requests where id = p_request_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status <> 'pending_otp' then raise exception 'already_used' using errcode = '22023'; end if;
  if r.otp_expires_at < now() then
    update public.data_requests set status = 'expired' where id = r.id;
    raise exception 'expired' using errcode = '22023';
  end if;
  if r.otp_attempts >= 5 then
    update public.data_requests set status = 'failed' where id = r.id;
    raise exception 'too_many_attempts' using errcode = '22023';
  end if;
  if private.token_hash(regexp_replace(coalesce(p_otp, ''), '\D', '', 'g')) <> r.otp_hash then
    update public.data_requests set otp_attempts = otp_attempts + 1 where id = r.id;
    raise exception 'invalid_otp' using errcode = '22023';
  end if;

  update public.data_requests set status = 'verified', verified_at = now() where id = r.id;

  for m in select * from jsonb_to_recordset(r.matched_subjects) as x(organization_id uuid, subject_id uuid) loop
    select * into v_org from public.organizations where id = m.organization_id;
    select * into v_subj from public.subjects where id = m.subject_id;
    if v_subj.id is null then continue; end if;
    if r.kind = 'access' then
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'organization', v_org.name, 'niche', v_org.niche,
        'name', v_subj.name, 'marketing_opt_in', v_subj.marketing_opt_in,
        'verifications', (select count(*) from public.verification_sessions where subject_id = v_subj.id),
        'last_verified_at', (select max(decided_at) from public.verification_sessions where subject_id = v_subj.id)));
    else
      -- Exclusão: mídia marcada para apagar no próximo ciclo do cron (mantém o registro
      -- auditável de que a exclusão aconteceu), titular anonimizado, opt-in revogado.
      update public.media_assets set delete_after = now() - interval '1 second'
        where session_id in (select id from public.verification_sessions where subject_id = v_subj.id);
      update public.subjects set name = 'Titular (dados removidos a pedido)', data = jsonb_build_object('erased', true), marketing_opt_in = false
        where id = v_subj.id;
      insert into public.audit_logs (organization_id, actor_id, action, target, after)
        values (v_org.id, null, 'subject.erasure_requested', 'subjects:' || v_subj.id, jsonb_build_object('data_request_id', r.id));
      v_result := v_result || jsonb_build_array(jsonb_build_object('organization', v_org.name, 'status', 'erased'));
    end if;
  end loop;

  update public.data_requests set status = 'completed', completed_at = now(), result = v_result where id = r.id;
  return jsonb_build_object('kind', r.kind, 'results', v_result);
end $$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function public.public_demo_stats() from public;
grant execute on function public.public_demo_stats() to anon, authenticated;

revoke all on function public.seed_demo_data(uuid) from public, anon;
grant execute on function public.seed_demo_data(uuid) to authenticated;

revoke all on function public.list_expired_media(), public.purge_media_records(uuid[]), public.expire_stale_links() from public, anon, authenticated;
grant execute on function public.list_expired_media(), public.purge_media_records(uuid[]), public.expire_stale_links() to service_role;

revoke all on function public.create_data_request(text, text, text, text), public.verify_data_request(uuid, text) from public;
grant execute on function public.create_data_request(text, text, text, text), public.verify_data_request(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Organização de demonstração pública fixa ("Explorar sem cadastro")
-- -----------------------------------------------------------------------------
do $$
declare
  v_owner uuid := '00000000-0000-4000-9000-00000000d001';
  v_org uuid;
  v_flow uuid;
begin
  if exists (select 1 from public.organizations where settings->>'is_public_demo' = 'true') then
    return;
  end if;

  insert into auth.users (id, email) values (v_owner, 'demo-publico@veroid.gabrielmoreira.tech')
    on conflict (id) do nothing;

  insert into public.organizations (name, niche, subniche, website, size, created_by, settings)
  values ('Aurora Digital', 'fintech', 'Banco digital', 'https://gabrielmoreira.tech/veroid', '51-200', v_owner,
    '{"app_mode":"demo","retention_days":1,"is_public_demo":true,"demo_seeded":true,"auto_approve":true,"qualified_min":60,"avg_ticket":2500}'::jsonb)
  returning id into v_org;

  insert into public.memberships (user_id, organization_id, role) values (v_owner, v_org, 'owner');

  insert into public.flow_templates (organization_id, niche, name, steps, fields)
  values (v_org, 'fintech', 'Fluxo padrão',
    '["intro","consent","tutorial","capture","document","form","review","done"]'::jsonb,
    '[{"key":"cpf","required":true},{"key":"name","required":true},{"key":"birth_date","required":true},{"key":"cep","required":true},{"key":"declared_income","required":false}]'::jsonb)
  returning id into v_flow;

  insert into public.audit_logs (organization_id, actor_id, action, target, after)
  values (v_org, v_owner, 'organization.created', 'organizations:' || v_org, jsonb_build_object('name', 'Aurora Digital', 'niche', 'fintech'));

  perform private.seed_demo_core(v_org, v_flow, v_owner, 800, 0.09, array['SP', 'RJ', 'MG', 'BA', 'PR']);
  perform public.expire_stale_links();
end $$;
