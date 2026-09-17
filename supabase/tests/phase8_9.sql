-- Testes das fases 8 e 9 (desfaz tudo ao final). Retorna "FASES 8-9 OK".
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'dono89@test.local'),
  ('00000000-0000-4000-8000-0000000000f2', 'leitor89@test.local');
create temp table t89 (k text primary key, v text);
grant all on t89 to authenticated, anon, service_role;

-- Painel público (sem login) já deve ter dados da organização de demonstração fixa
do $$
declare d jsonb;
begin
  d := public.public_demo_stats();
  if (d#>>'{kpis,verifications}')::int < 100 then raise exception 'FALHA: painel público sem massa de dados (%)', d->'kpis'; end if;
  if d->'organization'->>'name' is null then raise exception 'FALHA: painel público sem organização'; end if;
end $$;

-- Modo demo: gerar dados numa organização nova
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f1', true);
insert into t89 select 'org', public.create_organization('Org Demo 89', 'credit', null, null, null, null,
  '{"steps":["intro","consent","tutorial","capture","form","review","done"],"fields":[{"key":"cpf","required":true},{"key":"name","required":true}]}')::text;
insert into t89 select 'invite', i.token from public.invite_member((select v::uuid from t89 where k='org'), 'leitor89@test.local', 'viewer') i;

do $$
declare org uuid := (select v::uuid from t89 where k='org'); r jsonb;
begin
  r := public.seed_demo_data(org);
  if (r->>'sessions')::int < 800 then raise exception 'FALHA: seed com poucas sessões (%)', r; end if;
  if (select (settings->>'demo_seeded')::boolean from public.organizations where id = org) is not true then
    raise exception 'FALHA: settings.demo_seeded não marcado';
  end if;
  if (select (settings->>'retention_days')::int from public.organizations where id = org) <> 1 then
    raise exception 'FALHA: retenção do modo demo deveria ser 1 dia';
  end if;
  -- não deixa semear de novo em cima de dados reais/já semeados
  begin
    perform public.seed_demo_data(org);
    raise exception 'FALHA: permitiu semear organização não vazia de novo';
  exception when raise_exception then null; end;
end $$;

-- Leitor não pode gerar dados de demonstração
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f2', true);
select public.accept_invitation((select v from t89 where k = 'invite'));
do $$
begin
  begin
    perform public.seed_demo_data((select v::uuid from t89 where k='org'));
    raise exception 'FALHA: leitor conseguiu gerar dados de demonstração';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- LGPD: direitos do titular, de ponta a ponta, como anon (página pública)
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f1', true);
insert into t89 select 'org2', public.create_organization('Org LGPD 89', 'fintech', null, null, null, null,
  '{"steps":["intro","consent","tutorial","capture","form","review","done"],"fields":[{"key":"cpf","required":true},{"key":"name","required":true}]}')::text;
insert into t89 select 'link2', c.token from public.create_verification_link((select v::uuid from t89 where k='org2'), 'Titular Direitos', 'whatsapp', '11988887777') c;
reset role;

set local role anon;
do $$
declare j jsonb; sid uuid; sec text; p text; tok text := (select v from t89 where k = 'link2');
begin
  j := public.start_subject_session(tok, '{"fingerprint":"fp-89"}');
  sid := (j->>'session_id')::uuid; sec := j->>'secret';
  perform public.record_subject_consent(tok, sid, sec, true, true, 'v1');
  perform public.log_subject_event(tok, sid, sec, 'camera_permission_granted');
  perform public.log_subject_event(tok, sid, sec, 'capture_succeeded');
  p := public.register_subject_media(tok, sid, sec, 'selfie');
  insert into storage.objects (bucket_id, name) values ('media', p);
  perform public.submit_subject_session(tok, sid, sec, '{"cpf":"52998224725","name":"Titular Direitos Teste"}');
end $$;

do $$
declare req jsonb; otp text; verify jsonb;
begin
  req := public.create_data_request('529.982.247-25', 'titular89@exemplo.com', 'Titular Direitos Teste', 'access');
  if (req->>'matches')::int <> 1 then raise exception 'FALHA: esperava 1 titular encontrado, veio %', req->>'matches'; end if;
  otp := req->>'demo_otp';

  begin
    perform public.verify_data_request((req->>'request_id')::uuid, '000000');
    raise exception 'FALHA: aceitou código errado';
  exception when invalid_parameter_value then null; end;

  verify := public.verify_data_request((req->>'request_id')::uuid, otp);
  if jsonb_array_length(verify->'results') <> 1 or (verify->'results'->0->>'name') <> 'Titular Direitos Teste' then
    raise exception 'FALHA: acesso devolveu dados errados (%)', verify;
  end if;

  begin
    perform public.verify_data_request((req->>'request_id')::uuid, otp);
    raise exception 'FALHA: permitiu reusar um pedido já verificado';
  exception when invalid_parameter_value then null; end;

  req := public.create_data_request('529.982.247-25', 'titular89@exemplo.com', 'Titular Direitos Teste', 'deletion');
  otp := req->>'demo_otp';
  verify := public.verify_data_request((req->>'request_id')::uuid, otp);
  if (verify->'results'->0->>'status') <> 'erased' then raise exception 'FALHA: exclusão não confirmada (%)', verify; end if;
end $$;
reset role;

-- Confere o estado interno (como superusuário, já que o titular nunca acessa o banco direto)
do $$
begin
  if not exists (select 1 from public.subjects where name = 'Titular (dados removidos a pedido)') then
    raise exception 'FALHA: titular não foi anonimizado';
  end if;
  if exists (select 1 from public.subjects where marketing_opt_in and name = 'Titular (dados removidos a pedido)') then
    raise exception 'FALHA: opt-in de marketing não foi revogado na exclusão';
  end if;
end $$;

-- Retenção automática: mídia marcada para apagar já sai de list_expired_media
do $$
declare v_ids uuid[];
begin
  if not exists (select id from public.list_expired_media() limit 1) then
    raise exception 'FALHA: exclusão não marcou mídia para o ciclo de retenção';
  end if;
  select array_agg(id) into v_ids from public.list_expired_media();
  if public.purge_media_records(v_ids) <> array_length(v_ids, 1) then raise exception 'FALHA: purge_media_records'; end if;
  if exists (select id from public.list_expired_media() limit 1) then raise exception 'FALHA: mídia sobrou após o purge'; end if;
end $$;

-- Links vencidos são marcados como expirados pelo cron
do $$
declare v_link uuid := (select id from public.verification_links where token_hash = (select token_hash from public.verification_links limit 1));
begin
  update public.verification_links set expires_at = now() - interval '1 hour', status = 'sent' where id = v_link;
  perform public.expire_stale_links();
  if (select status from public.verification_links where id = v_link) <> 'expired' then
    raise exception 'FALHA: link vencido não foi expirado pelo cron';
  end if;
end $$;

create temp table phase89_result as select 'FASES 8-9 OK' as resultado;
select * from phase89_result;
rollback;
