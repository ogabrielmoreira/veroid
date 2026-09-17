-- =============================================================================
-- Vero ID — Fases 4 e 5
-- Fase 4: sessão do titular (anônima, com segredo), eventos de funil, consentimento,
--         upload de mídia por caminho registrado, envio.
-- Fase 5: Copiloto Antifraude — motor de regras (navegador + dados + nicho) e
--         aplicação do veredito de IA (Claude Vision via Worker, opcional).
-- =============================================================================

alter table public.verification_sessions
  add column if not exists session_secret_hash text,
  add column if not exists current_step text,
  add column if not exists capture_attempts smallint not null default 0,
  add column if not exists locale text,
  add column if not exists user_agent text,
  add column if not exists consent_version text,
  add column if not exists risk_band text check (risk_band in ('low', 'review', 'high', 'unknown')),
  add column if not exists analysis_source text check (analysis_source in ('rules', 'rules+ai')),
  add column if not exists analyzed_at timestamptz,
  add column if not exists submitted_at timestamptz;

create index if not exists verification_sessions_link_idx on public.verification_sessions (link_id);
create index if not exists verification_sessions_device_idx on public.verification_sessions (organization_id, device_fingerprint);
create index if not exists subjects_cpf_idx on public.subjects (organization_id, cpf_hash);

alter table public.risk_signals add column if not exists forces_review boolean not null default false;
do $$ begin
  alter table public.media_assets add constraint media_assets_path_unique unique (storage_path);
exception when duplicate_table or duplicate_object then null; end $$;

-- Teto diário de chamadas à IA (usado pelo Worker com service role)
create table if not exists public.ai_usage (
  day   date primary key,
  calls int not null default 0
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant all on public.ai_usage to service_role;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function private.is_valid_cpf(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare d int[]; s int; r int; i int;
begin
  if p is null or p !~ '^\d{11}$' or p ~ '^(\d)\1{10}$' then return false; end if;
  select array_agg(substr(p, g, 1)::int order by g) into d from generate_series(1, 11) g;
  s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0; for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end $$;

create or replace function private.norm_name(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(coalesce(p, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g');
$$;

-- Valida token + sessão + segredo. Devolve a sessão ou erro.
create or replace function private.subject_session(p_token text, p_session_id uuid, p_secret text, p_allow_closed boolean default false)
returns public.verification_sessions
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.verification_links;
  s public.verification_sessions;
begin
  select * into l from public.verification_links where token_hash = private.token_hash(coalesce(p_token, ''));
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  select * into s from public.verification_sessions
   where id = p_session_id and link_id = l.id and session_secret_hash = private.token_hash(coalesce(p_secret, ''));
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if not p_allow_closed then
    if private.link_effective_status(l) in ('expired', 'canceled') then raise exception 'link_closed' using errcode = 'P0001'; end if;
    if s.status in ('submitted', 'analyzed', 'decided') then raise exception 'session_submitted' using errcode = 'P0001'; end if;
  end if;
  return s;
end $$;

create or replace function private.add_event(s public.verification_sessions, p_type text, p_payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.session_events (organization_id, session_id, type, payload)
  values (s.organization_id, s.id, p_type, coalesce(p_payload, '{}'::jsonb));
$$;

-- -----------------------------------------------------------------------------
-- Fase 4 — RPCs do titular (anon)
-- -----------------------------------------------------------------------------
create or replace function public.start_subject_session(p_token text, p_device jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.verification_links;
  v_secret text := private.new_token() || private.new_token();
  s public.verification_sessions;
  v_status text;
begin
  select * into l from public.verification_links where token_hash = private.token_hash(coalesce(p_token, '')) for update;
  if not found then raise exception 'link_not_found' using errcode = 'P0002'; end if;
  v_status := private.link_effective_status(l);
  if v_status in ('expired', 'canceled', 'completed') then raise exception 'link_closed' using errcode = 'P0001'; end if;
  if (select count(*) from public.verification_sessions where link_id = l.id) >= 5 then
    raise exception 'session_limit' using errcode = 'P0001';
  end if;

  insert into public.verification_sessions
    (organization_id, link_id, status, device_fingerprint, locale, user_agent, current_step, session_secret_hash)
  values
    (l.organization_id, l.id, 'started',
     left(nullif(p_device->>'fingerprint', ''), 128),
     left(nullif(p_device->>'locale', ''), 16),
     left(nullif(p_device->>'user_agent', ''), 300),
     'consent', private.token_hash(v_secret))
  returning * into s;

  update public.verification_links set status = 'in_progress', opened_at = coalesce(opened_at, now()) where id = l.id;
  perform private.add_event(s, 'session_started', jsonb_build_object('tz', left(p_device->>'tz', 64), 'screen', left(p_device->>'screen', 32)));

  return jsonb_build_object('session_id', s.id, 'secret', v_secret);
end $$;

create or replace function public.resume_subject_session(p_token text, p_session_id uuid, p_secret text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.verification_sessions;
begin
  s := private.subject_session(p_token, p_session_id, p_secret, true);
  return jsonb_build_object(
    'status', s.status,
    'current_step', s.current_step,
    'consented', exists (select 1 from public.consents c where c.session_id = s.id and c.type = 'biometric'),
    'media', coalesce((
      select jsonb_agg(m.kind) from public.media_assets m
      where m.session_id = s.id
        and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = m.storage_path)
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.log_subject_event(p_token text, p_session_id uuid, p_secret text, p_type text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare s public.verification_sessions;
begin
  if p_type not in ('step_viewed', 'camera_permission_requested', 'camera_permission_granted', 'camera_permission_denied',
                    'camera_not_found', 'camera_not_readable', 'capture_attempt', 'capture_succeeded', 'liveness_unavailable',
                    'liveness_challenge_passed', 'liveness_challenge_failed', 'document_captured', 'form_completed', 'assisted_help_requested') then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  s := private.subject_session(p_token, p_session_id, p_secret);
  if (select count(*) from public.session_events where session_id = s.id) >= 300 then return; end if;
  if pg_column_size(p_payload) > 2048 then p_payload := '{}'::jsonb; end if;

  if p_type = 'step_viewed' then
    update public.verification_sessions set current_step = left(p_payload->>'step', 24) where id = s.id;
  elsif p_type = 'capture_attempt' then
    update public.verification_sessions set capture_attempts = least(capture_attempts + 1, 999) where id = s.id;
  end if;
  perform private.add_event(s, p_type, p_payload);
end $$;

create or replace function public.record_subject_consent(p_token text, p_session_id uuid, p_secret text,
  p_biometric boolean, p_marketing boolean, p_version text)
returns void
language plpgsql security definer set search_path = '' as $$
declare s public.verification_sessions;
begin
  s := private.subject_session(p_token, p_session_id, p_secret);
  if not coalesce(p_biometric, false) then
    raise exception 'biometric_consent_required' using errcode = '22023';
  end if;
  delete from public.consents where session_id = s.id;
  insert into public.consents (organization_id, session_id, type, version)
  values (s.organization_id, s.id, 'biometric', left(coalesce(p_version, 'v1'), 16));
  if coalesce(p_marketing, false) then
    insert into public.consents (organization_id, session_id, type, version)
    values (s.organization_id, s.id, 'marketing', left(coalesce(p_version, 'v1'), 16));
  end if;
  update public.verification_sessions
     set status = case when status = 'started' then 'consented' else status end,
         consent_version = left(coalesce(p_version, 'v1'), 16)
   where id = s.id;
  perform private.add_event(s, 'consent_given', jsonb_build_object('marketing', coalesce(p_marketing, false), 'version', p_version));
end $$;

-- Registra o caminho de upload. O Storage só aceita objetos em caminhos registrados (policy abaixo).
create or replace function public.register_subject_media(p_token text, p_session_id uuid, p_secret text, p_kind text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.verification_sessions;
  v_path text;
  v_days int;
begin
  if p_kind not in ('selfie', 'doc_front', 'doc_back') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  s := private.subject_session(p_token, p_session_id, p_secret);
  if not exists (select 1 from public.consents where session_id = s.id and type = 'biometric') then
    raise exception 'biometric_consent_required' using errcode = '22023';
  end if;
  select coalesce((settings->>'retention_days')::int, 1) into v_days from public.organizations where id = s.organization_id;
  -- Nova tentativa gera caminho novo (sem sobrescrever objeto existente)
  v_path := s.organization_id || '/' || s.id || '/' || p_kind || '-' || substr(private.new_token(), 1, 8) || '.jpg';
  delete from public.media_assets m where m.session_id = s.id and m.kind = p_kind
    and not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = m.storage_path);
  insert into public.media_assets (organization_id, session_id, kind, storage_path, delete_after)
  values (s.organization_id, s.id, p_kind, v_path, now() + make_interval(days => greatest(1, least(v_days, 365))));
  return v_path;
end $$;

create or replace function private.media_upload_allowed(p_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.media_assets m
    join public.verification_sessions s on s.id = m.session_id
    where m.storage_path = p_name
      and s.status in ('started', 'consented', 'captured')
      and s.started_at > now() - interval '6 hours'
  );
$$;

drop policy if exists media_subject_insert on storage.objects;
create policy media_subject_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media' and private.media_upload_allowed(name));

-- -----------------------------------------------------------------------------
-- Fase 5 — Copiloto Antifraude (motor de regras)
-- Pesos em pontos/100 (0.45 = 45 pontos). O cliente nunca define peso.
-- -----------------------------------------------------------------------------
create or replace function private.signal_catalog()
returns table (code text, label text, weight numeric, forces_review boolean, source text)
language sql immutable set search_path = '' as $$
  values
  -- navegador (MediaPipe)
  ('faces_none',            'Nenhum rosto detectado na captura',                 0.45::numeric, false, 'browser'),
  ('faces_multiple',        'Mais de um rosto na captura',                         0.35, false, 'browser'),
  ('liveness_failed',       'Desafio de prova de vida não concluído',              0.40, false, 'browser'),
  ('liveness_unavailable',  'Prova de vida indisponível neste navegador',          0.15, true,  'browser'),
  ('low_light',             'Iluminação baixa na captura',                          0.05, false, 'browser'),
  ('face_unstable',         'Rosto instável ou muito distante',                    0.10, false, 'browser'),
  ('document_low_quality',  'Documento com pouca nitidez ou luz',                  0.10, false, 'browser'),
  -- dados e dispositivo
  ('many_capture_attempts', 'Várias tentativas de captura em sequência',           0.10, false, 'data'),
  ('fast_completion',       'Fluxo concluído rápido demais (padrão de automação)', 0.15, false, 'data'),
  ('underage',              'Idade menor que 18 anos',                             0.40, true,  'data'),
  ('device_multi_cpf',      'Mesmo dispositivo em sessões com CPFs diferentes',    0.25, false, 'data'),
  ('cpf_multi_sessions',    'Mesmo CPF em várias sessões nas últimas 24h',         0.15, false, 'data'),
  ('cpf_name_mismatch',     'CPF já cadastrado com outro nome',                    0.30, false, 'data'),
  ('senior_remote',         'Titular com 70+ anos em contratação remota',          0.20, true,  'data'),
  ('car_missing_credit',    'CAR ausente em operação de crédito rural',            0.20, true,  'data'),
  ('high_deposit_no_history','Sinal acima do limite e titular sem histórico (PLD)', 0.25, true,  'data'),
  ('ai_not_run',            'Análise de imagem por IA não executada (modo local)', 0.00, false, 'data'),
  -- IA (Claude Vision)
  ('ai_screen_replay',      'Imagem capturada de uma tela',                        0.60, false, 'ai'),
  ('ai_printed_photo',      'Foto impressa apresentada à câmera',                  0.60, false, 'ai'),
  ('ai_mask_or_doll',       'Máscara ou boneco',                                   0.70, false, 'ai'),
  ('ai_animal',             'Animal no lugar de um rosto humano',                  0.80, false, 'ai'),
  ('ai_object_or_no_face',  'Objeto ou ausência de rosto',                         0.80, false, 'ai'),
  ('ai_multiple_faces',     'IA detectou mais de um rosto',                        0.35, false, 'ai'),
  ('ai_uncertain',          'IA inconclusiva, precisa de revisão humana',          0.10, true,  'ai'),
  ('ai_doc_face_mismatch',  'Rosto da selfie diferente do documento',              0.50, false, 'ai');
$$;

create or replace function private.analyze_session(p_session_id uuid)
returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  s public.verification_sessions;
  o public.organizations;
  subj public.subjects;
  v_age int;
  v_score int;
  v_forced boolean;
  v_band text;
  v_has_ai boolean;
  v_birth date;
  v_sigs text[] := '{}';
begin
  select * into s from public.verification_sessions where id = p_session_id for update;
  if not found then return null; end if;
  select * into o from public.organizations where id = s.organization_id;
  select * into subj from public.subjects where id = s.subject_id;

  delete from public.risk_signals where session_id = s.id and source = 'data';

  -- idade
  begin v_birth := (subj.data->>'birth_date')::date; exception when others then v_birth := null; end;
  if v_birth is not null then v_age := extract(year from age(v_birth))::int; end if;

  if s.capture_attempts >= 3 then v_sigs := v_sigs || 'many_capture_attempts'::text; end if;
  if s.submitted_at is not null and s.submitted_at - s.started_at < interval '20 seconds' then v_sigs := v_sigs || 'fast_completion'::text; end if;
  if v_age is not null and v_age < 18 then v_sigs := v_sigs || 'underage'::text; end if;

  if s.device_fingerprint is not null and exists (
    select 1 from public.verification_sessions x join public.subjects sx on sx.id = x.subject_id
    where x.organization_id = s.organization_id and x.id <> s.id
      and x.device_fingerprint = s.device_fingerprint
      and sx.cpf_hash is distinct from subj.cpf_hash
      and x.started_at > now() - interval '30 days'
  ) then v_sigs := v_sigs || 'device_multi_cpf'::text; end if;

  if subj.cpf_hash is not null and (
    select count(*) from public.verification_sessions x
    where x.subject_id = subj.id and x.id <> s.id and x.started_at > now() - interval '24 hours'
  ) >= 2 then v_sigs := v_sigs || 'cpf_multi_sessions'::text; end if;

  if coalesce(subj.data->>'name_conflict', 'false') = 'true' then v_sigs := v_sigs || 'cpf_name_mismatch'::text; end if;

  -- regras de nicho
  if o.niche = 'credit' and v_age is not null and v_age >= 70 then v_sigs := v_sigs || 'senior_remote'::text; end if;
  if o.niche = 'agro' and coalesce(subj.data->>'car', '') = ''
     and (coalesce(o.subniche, '') ilike '%crédito%' or coalesce(o.subniche, '') ilike '%cpr%') then
    v_sigs := v_sigs || 'car_missing_credit'::text;
  end if;
  if o.niche = 'automotive'
     and coalesce(nullif(regexp_replace(coalesce(subj.data->>'deposit_amount', ''), '[^0-9]', '', 'g'), ''), '0')::numeric / 100
         > coalesce((o.settings->>'deposit_limit')::numeric, 10000)
     and not exists (select 1 from public.verification_sessions x where x.subject_id = subj.id and x.decision = 'approved' and x.id <> s.id) then
    v_sigs := v_sigs || 'high_deposit_no_history'::text;
  end if;

  v_has_ai := s.ai_verdict is not null;
  if not v_has_ai then v_sigs := v_sigs || 'ai_not_run'::text; end if;

  insert into public.risk_signals (organization_id, session_id, code, label, weight, source, forces_review)
  select s.organization_id, s.id, c.code, c.label, c.weight, c.source, c.forces_review
  from private.signal_catalog() c where c.code = any (v_sigs);

  select least(100, round(coalesce(sum(weight), 0) * 100))::int, coalesce(bool_or(forces_review), false)
    into v_score, v_forced
  from public.risk_signals where session_id = s.id;

  v_band := case when v_score >= 71 then 'high' when v_score >= 31 then 'review' else 'low' end;
  if v_band = 'low' and v_forced then v_band := 'review'; end if;
  if exists (select 1 from public.risk_signals where session_id = s.id and code in ('liveness_unavailable', 'ai_uncertain'))
     and v_band <> 'high' then
    v_band := 'unknown';
  end if;

  update public.verification_sessions
     set risk_score = v_score, risk_band = v_band, analyzed_at = now(),
         analysis_source = case when v_has_ai then 'rules+ai' else 'rules' end,
         status = case when status in ('submitted', 'analyzed') then 'analyzed' else status end
   where id = s.id;

  -- Aprovação automática só com permissão explícita da organização e decisão ainda pendente
  if v_band = 'low' and s.decision = 'pending' and coalesce((o.settings->>'auto_approve')::boolean, false) then
    update public.verification_sessions set decision = 'approved', decided_at = now(), status = 'decided' where id = s.id;
    insert into public.audit_logs (organization_id, actor_id, action, target, after)
    values (s.organization_id, null, 'session.auto_approved', 'verification_sessions:' || s.id, jsonb_build_object('risk_score', v_score));
  end if;

  return v_score;
end $$;

create or replace function public.submit_subject_session(p_token text, p_session_id uuid, p_secret text,
  p_data jsonb, p_browser_signals text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.verification_sessions;
  l public.verification_links;
  f public.flow_templates;
  v_cpf text := regexp_replace(coalesce(p_data->>'cpf', ''), '\D', '', 'g');
  v_name text := trim(coalesce(p_data->>'name', ''));
  v_hash text;
  subj public.subjects;
  v_clean jsonb;
  v_marketing boolean;
  v_field jsonb;
  v_conflict boolean := false;
begin
  s := private.subject_session(p_token, p_session_id, p_secret);
  select * into l from public.verification_links where id = s.link_id;
  select * into f from public.flow_templates where id = l.flow_template_id;

  if not exists (select 1 from public.consents where session_id = s.id and type = 'biometric') then
    raise exception 'biometric_consent_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.media_assets m where m.session_id = s.id and m.kind = 'selfie'
                 and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = m.storage_path)) then
    raise exception 'selfie_required' using errcode = '22023';
  end if;
  if f.steps ? 'document' and (select count(distinct m.kind) from public.media_assets m where m.session_id = s.id and m.kind in ('doc_front', 'doc_back')
       and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = m.storage_path)) < 2 then
    raise exception 'document_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 8192 then
    raise exception 'invalid_data' using errcode = '22023';
  end if;

  -- Campos obrigatórios e habilitados do fluxo
  if f.steps ? 'form' then
    for v_field in select value from jsonb_array_elements(coalesce(f.fields, '[]'::jsonb)) loop
      if coalesce((v_field->>'required')::boolean, false) and coalesce((v_field->>'enabled')::boolean, true)
         and coalesce(trim(p_data->>(v_field->>'key')), '') = '' then
        raise exception 'missing_field:%', v_field->>'key' using errcode = '22023';
      end if;
    end loop;
  end if;
  if v_cpf <> '' and not private.is_valid_cpf(v_cpf) then raise exception 'invalid_cpf' using errcode = '22023'; end if;
  if v_name = '' then v_name := l.subject_name; end if;

  -- Minimização: CPF só como hash + máscara; só chaves conhecidas do fluxo
  select coalesce(jsonb_object_agg(k, left(p_data->>k, 200)), '{}'::jsonb) into v_clean
  from (select value->>'key' as k from jsonb_array_elements(coalesce(f.fields, '[]'::jsonb))) keys
  where k not in ('cpf', 'name') and p_data ? k;
  if v_cpf <> '' then
    v_hash := private.token_hash(s.organization_id::text || ':' || v_cpf);
    v_clean := v_clean || jsonb_build_object('cpf_masked', '***.***.' || substr(v_cpf, 7, 3) || '-' || substr(v_cpf, 10, 2));
  end if;

  v_marketing := exists (select 1 from public.consents where session_id = s.id and type = 'marketing');

  if v_hash is not null then
    select * into subj from public.subjects where organization_id = s.organization_id and cpf_hash = v_hash
    order by created_at limit 1 for update;
  end if;
  if subj.id is not null then
    v_conflict := private.norm_name(subj.name) <> private.norm_name(v_name);
    update public.subjects
       set data = data || v_clean || jsonb_build_object('name_conflict', v_conflict),
           marketing_opt_in = marketing_opt_in or v_marketing,
           marketing_opt_in_at = case when v_marketing and not marketing_opt_in then now() else marketing_opt_in_at end
     where id = subj.id
    returning * into subj;
  else
    insert into public.subjects (organization_id, cpf_hash, name, data, marketing_opt_in, marketing_opt_in_at)
    values (s.organization_id, v_hash, left(v_name, 120), v_clean || '{"name_conflict": false}'::jsonb, v_marketing, case when v_marketing then now() end)
    returning * into subj;
  end if;

  update public.consents set subject_id = subj.id where session_id = s.id;

  -- Sinais do navegador: só códigos conhecidos, pesos do catálogo
  insert into public.risk_signals (organization_id, session_id, code, label, weight, source, forces_review)
  select s.organization_id, s.id, c.code, c.label, c.weight, c.source, c.forces_review
  from private.signal_catalog() c
  where c.source = 'browser' and c.code = any (coalesce(p_browser_signals, '{}'))
    and not exists (select 1 from public.risk_signals r where r.session_id = s.id and r.code = c.code);

  update public.verification_sessions
     set subject_id = subj.id, status = 'submitted', submitted_at = now(), completed_at = now(), current_step = 'done'
   where id = s.id;
  update public.verification_links set status = 'completed' where id = l.id;
  perform private.add_event(s, 'submitted', '{}'::jsonb);

  perform private.analyze_session(s.id);

  -- Nunca devolve score ou sinais ao titular
  return jsonb_build_object('ok', true);
end $$;

-- Veredito da IA (chamado só pelo Worker com service role)
create or replace function public.apply_ai_verdict(p_session_id uuid, p_verdict jsonb)
returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  s public.verification_sessions;
  v_code text;
begin
  select * into s from public.verification_sessions where id = p_session_id;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;

  delete from public.risk_signals where session_id = s.id and source = 'ai';
  v_code := case p_verdict->>'verdict'
    when 'screen_replay' then 'ai_screen_replay'
    when 'printed_photo' then 'ai_printed_photo'
    when 'mask_or_doll' then 'ai_mask_or_doll'
    when 'animal' then 'ai_animal'
    when 'object_or_no_face' then 'ai_object_or_no_face'
    when 'multiple_faces' then 'ai_multiple_faces'
    when 'real_person' then null
    else 'ai_uncertain' end;

  insert into public.risk_signals (organization_id, session_id, code, label, weight, source, forces_review)
  select s.organization_id, s.id, c.code, c.label, c.weight, c.source, c.forces_review
  from private.signal_catalog() c
  where c.code = v_code
     or (c.code = 'ai_doc_face_mismatch' and p_verdict->>'document_face_match' = 'mismatch');

  update public.verification_sessions set ai_verdict = p_verdict where id = s.id;
  perform private.add_event(s, 'ai_analyzed', jsonb_build_object('verdict', p_verdict->>'verdict', 'confidence', p_verdict->'confidence'));
  return private.analyze_session(s.id);
end $$;

-- Membro reprocessa a análise de regras (ex.: depois de mudar limites)
create or replace function public.reanalyze_session(p_session_id uuid)
returns smallint
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.verification_sessions where id = p_session_id;
  if v_org is null or not private.has_org_role(v_org, array['owner','analyst']::public.org_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, target)
  values (v_org, auth.uid(), 'session.reanalyzed', 'verification_sessions:' || p_session_id);
  return private.analyze_session(p_session_id);
end $$;

-- Contador do teto diário de IA (Worker)
create or replace function public.consume_ai_quota(p_limit int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  insert into public.ai_usage (day, calls) values (current_date, 1)
  on conflict (day) do update set calls = public.ai_usage.calls + 1
  returning calls into v;
  return v <= p_limit;
end $$;

-- Página pública passa a informar a retenção (texto do consentimento)
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
    'retention_days', coalesce((o.settings->>'retention_days')::int, 1),
    'flow', case when v_status in ('opened', 'in_progress') and f.id is not null
             then jsonb_build_object('steps', f.steps, 'fields', f.fields, 'consent_version', f.consent_version)
             else null end
  );
end $$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant usage on schema private to anon;
revoke all on function private.is_valid_cpf(text), private.norm_name(text),
  private.subject_session(text, uuid, text, boolean), private.add_event(public.verification_sessions, text, jsonb),
  private.signal_catalog(), private.analyze_session(uuid) from public, anon, authenticated;
revoke all on function private.media_upload_allowed(text) from public;
grant execute on function private.media_upload_allowed(text) to anon, authenticated;

revoke all on function public.start_subject_session(text, jsonb) from public;
revoke all on function public.resume_subject_session(text, uuid, text) from public;
revoke all on function public.log_subject_event(text, uuid, text, text, jsonb) from public;
revoke all on function public.record_subject_consent(text, uuid, text, boolean, boolean, text) from public;
revoke all on function public.register_subject_media(text, uuid, text, text) from public;
revoke all on function public.submit_subject_session(text, uuid, text, jsonb, text[]) from public;
grant execute on function public.start_subject_session(text, jsonb) to anon, authenticated;
grant execute on function public.resume_subject_session(text, uuid, text) to anon, authenticated;
grant execute on function public.log_subject_event(text, uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.record_subject_consent(text, uuid, text, boolean, boolean, text) to anon, authenticated;
grant execute on function public.register_subject_media(text, uuid, text, text) to anon, authenticated;
grant execute on function public.submit_subject_session(text, uuid, text, jsonb, text[]) to anon, authenticated;

revoke all on function public.apply_ai_verdict(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_ai_verdict(uuid, jsonb) to service_role;
revoke all on function public.consume_ai_quota(int) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(int) to service_role;
revoke all on function public.reanalyze_session(uuid) from public, anon;
grant execute on function public.reanalyze_session(uuid) to authenticated;
