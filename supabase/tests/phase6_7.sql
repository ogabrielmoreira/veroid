-- Testes das fases 6 e 7 (desfaz tudo ao final). Retorna "FASES 6-7 OK".
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'dono67@test.local'),
  ('00000000-0000-4000-8000-0000000000c2', 'leitor67@test.local');
create temp table t67 (k text primary key, v text);
grant all on t67 to authenticated, anon, service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
insert into t67 select 'org', public.create_organization('Org Fintech', 'fintech', null, null, null, null,
  '{"steps":["intro","consent","tutorial","capture","form","review","done"],"fields":[{"key":"cpf","required":true},{"key":"name","required":true},{"key":"birth_date","required":true},{"key":"cep","required":true},{"key":"declared_income","required":false}]}')::text;
insert into t67 select 'link', c.token from public.create_verification_link((select v::uuid from t67 where k='org'), 'Maria Silva', 'whatsapp', '11987654321') c;
insert into t67 select 'invite', i.token from public.invite_member((select v::uuid from t67 where k='org'), 'leitor67@test.local', 'viewer') i;

reset role;
set local role anon;
do $$
declare j jsonb; sid uuid; sec text; p text; tok text := (select v from t67 where k = 'link');
begin
  j := public.start_subject_session(tok, '{"fingerprint":"fp-67","user_agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1"}');
  sid := (j->>'session_id')::uuid; sec := j->>'secret';
  insert into t67 values ('sid', sid::text);
  perform public.log_subject_event(tok, sid, sec, 'camera_permission_granted');
  perform public.log_subject_event(tok, sid, sec, 'capture_succeeded');
  perform public.record_subject_consent(tok, sid, sec, true, true, 'v1');
  p := public.register_subject_media(tok, sid, sec, 'selfie');
  insert into storage.objects (bucket_id, name) values ('media', p);
  perform public.submit_subject_session(tok, sid, sec, '{"cpf":"529.982.247-25","name":"Maria Silva","birth_date":"1990-05-12","cep":"09010-160","declared_income":"R$ 8.500,00"}');
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
do $$
declare
  org uuid := (select v::uuid from t67 where k = 'org');
  sid uuid := (select v::uuid from t67 where k = 'sid');
  d jsonb; sv public.sessions_view; n int;
begin
  select * into sv from public.sessions_view where id = sid;
  if sv.geo_uf <> 'SP' then raise exception 'FALHA: UF pelo CEP = %', sv.geo_uf; end if;
  if sv.device_os <> 'iOS' or sv.browser <> 'Safari' then raise exception 'FALHA: dispositivo % %', sv.device_os, sv.browser; end if;
  if sv.qualification_score is null then raise exception 'FALHA: score de qualificação vazio'; end if;

  d := public.dashboard_stats(org, now() - interval '30 days', now() + interval '1 hour', '{}');
  if (d#>>'{kpis,verifications}')::int <> 1 then raise exception 'FALHA: verificações %', d->'kpis'; end if;
  if (d->'funnel'->0->>'n')::int <> 1 or (d->'funnel'->4->>'n')::int <> 1 then raise exception 'FALHA: funil %', d->'funnel'; end if;
  if jsonb_array_length(d->'histogram') <> 10 then raise exception 'FALHA: histograma'; end if;
  if (d->'by_uf'->0->>'uf') <> 'SP' then raise exception 'FALHA: mapa %', d->'by_uf'; end if;
  d := public.dashboard_stats(org, now() - interval '30 days', now() + interval '1 hour', '{"channel":"qr"}');
  if (d#>>'{kpis,verifications}')::int <> 0 then raise exception 'FALHA: filtro de canal'; end if;

  d := public.get_session_detail(sid);
  if not (d->>'can_review')::boolean or jsonb_array_length(d->'media') <> 1 or jsonb_array_length(d->'events') < 3 then
    raise exception 'FALHA: detalhe %', d; end if;

  begin
    perform public.decide_session(sid, 'rejected', '');
    raise exception 'FALHA: reprovação sem motivo';
  exception when invalid_parameter_value then null; end;

  -- Clientes Qualificados só depois da aprovação
  if exists (select 1 from public.qualified_subjects where session_id = sid) then raise exception 'FALHA: qualificado antes de aprovar'; end if;
  perform public.decide_session(sid, 'approved', 'Documentos conferidos');
  if not exists (select 1 from public.qualified_subjects where session_id = sid) then raise exception 'FALHA: aprovado com opt-in não aparece'; end if;
  if (public.get_session_detail(sid)->'audit'->-1->>'action') <> 'session.approved' then raise exception 'FALHA: auditoria da decisão'; end if;

  perform public.add_session_note(sid, 'Cliente ligou confirmando.');
  begin
    perform public.run_bureau_check(sv.subject_id, 'marketing');
    raise exception 'FALHA: bureau sem finalidade de crédito';
  exception when invalid_parameter_value then null; end;
  if public.run_bureau_check(sv.subject_id, 'credit_analysis') not in ('low', 'medium', 'high') then raise exception 'FALHA: bureau'; end if;
  if (select count(*) from public.bureau_checks where subject_id = sv.subject_id) <> 1 then raise exception 'FALHA: bureau duplicado'; end if;
  perform public.run_bureau_check(sv.subject_id, 'credit_analysis');
  if (select count(*) from public.bureau_checks where subject_id = sv.subject_id) <> 1 then raise exception 'FALHA: cache de 24h do bureau'; end if;

  begin
    perform public.update_org_settings(org, '{"is_admin": true}');
    raise exception 'FALHA: configuração desconhecida aceita';
  exception when invalid_parameter_value then null; end;
  perform public.update_org_settings(org, '{"auto_approve": true, "qualified_min": 70, "webhook_url": "https://crm.exemplo.com/hook"}');
  begin
    update public.organizations set settings = '{}' where id = org;
    raise exception 'FALHA: settings alterável sem RPC';
  exception when insufficient_privilege then null; end;

  if (select count(*) from public.request_new_capture(sid)) <> 1 then raise exception 'FALHA: nova captura'; end if;
end $$;

-- Leitor: vê dashboard, não decide nem vê mídia
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c2', true);
select public.accept_invitation((select v from t67 where k = 'invite'));
do $$
declare sid uuid := (select v::uuid from t67 where k = 'sid'); d jsonb;
begin
  d := public.dashboard_stats((select v::uuid from t67 where k = 'org'), now() - interval '30 days', now() + interval '1 hour');
  if (d#>>'{kpis,verifications}')::int <> 1 then raise exception 'FALHA: leitor sem dashboard'; end if;
  d := public.get_session_detail(sid);
  if (d->>'can_review')::boolean or jsonb_array_length(d->'media') <> 0 or d#>>'{subject,data,birth_date}' is not null then raise exception 'FALHA: leitor vê dados sensíveis'; end if;
  begin
    perform public.decide_session(sid, 'rejected', 'tentativa do leitor');
    raise exception 'FALHA: leitor decidiu';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.session_notes) then raise exception 'FALHA: leitor vê notas'; end if;
end $$;

reset role;
create temp table phase67_result as select 'FASES 6-7 OK' as resultado;
select * from phase67_result;
rollback;
