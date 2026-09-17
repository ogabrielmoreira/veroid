-- Testes das fases 4 e 5 (desfaz tudo ao final). Retorna "FASES 4-5 OK".
begin;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'dono45@test.local');
create temp table t45 (k text primary key, v text);
grant all on t45 to authenticated, anon, service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
insert into t45 select 'org', public.create_organization('Org Crédito', 'credit', null, null, null, null,
  '{"steps":["intro","consent","tutorial","capture","form","review","done"],"fields":[{"key":"cpf","required":true},{"key":"name","required":true},{"key":"birth_date","required":true},{"key":"benefit_id","required":false}]}')::text;
insert into t45 select 'link1', c.token from public.create_verification_link((select v::uuid from t45 where k='org'), 'José Idoso', 'qr') c;
insert into t45 select 'link2', c.token from public.create_verification_link((select v::uuid from t45 where k='org'), 'Outra Pessoa', 'qr') c;

reset role;
set local role anon;
do $$
declare
  j jsonb; sid uuid; sec text; p text; score smallint; n int;
  tok text := (select v from t45 where k = 'link1');
begin
  j := public.start_subject_session(tok, '{"fingerprint":"fp-123","locale":"pt-BR","user_agent":"test"}');
  sid := (j->>'session_id')::uuid; sec := j->>'secret';
  insert into t45 values ('sid1', sid::text), ('sec1', sec);

  -- segredo errado
  begin
    perform public.log_subject_event(tok, sid, 'errado', 'step_viewed', '{"step":"consent"}');
    raise exception 'FALHA: segredo errado aceito';
  exception when no_data_found then null; end;

  -- upload antes do consentimento
  begin
    perform public.register_subject_media(tok, sid, sec, 'selfie');
    raise exception 'FALHA: mídia sem consentimento';
  exception when invalid_parameter_value then null; end;

  begin
    perform public.record_subject_consent(tok, sid, sec, false, true, 'v1');
    raise exception 'FALHA: consentimento sem biometria';
  exception when invalid_parameter_value then null; end;
  perform public.record_subject_consent(tok, sid, sec, true, true, 'v1');

  perform public.log_subject_event(tok, sid, sec, 'camera_permission_granted');
  perform public.log_subject_event(tok, sid, sec, 'capture_attempt');
  perform public.log_subject_event(tok, sid, sec, 'capture_attempt');
  perform public.log_subject_event(tok, sid, sec, 'capture_attempt');

  -- envio sem selfie
  begin
    perform public.submit_subject_session(tok, sid, sec, '{"cpf":"529.982.247-25","name":"José Idoso","birth_date":"1950-03-10"}');
    raise exception 'FALHA: envio sem selfie';
  exception when invalid_parameter_value then null; end;

  p := public.register_subject_media(tok, sid, sec, 'selfie');
  -- upload anônimo em caminho registrado é aceito; em caminho inventado, não
  insert into storage.objects (bucket_id, name) values ('media', p);
  begin
    insert into storage.objects (bucket_id, name) values ('media', 'qualquer/coisa.jpg');
    raise exception 'FALHA: upload em caminho não registrado';
  exception when insufficient_privilege then null; end;

  -- CPF inválido
  begin
    perform public.submit_subject_session(tok, sid, sec, '{"cpf":"111.111.111-11","name":"José Idoso","birth_date":"1950-03-10"}');
    raise exception 'FALHA: CPF inválido aceito';
  exception when invalid_parameter_value then null; end;

  -- campo obrigatório ausente
  begin
    perform public.submit_subject_session(tok, sid, sec, '{"cpf":"529.982.247-25","name":"José Idoso"}');
    raise exception 'FALHA: campo obrigatório ausente aceito';
  exception when invalid_parameter_value then null; end;

  j := public.submit_subject_session(tok, sid, sec, '{"cpf":"529.982.247-25","name":"José Idoso","birth_date":"1950-03-10","extra":"ignorar"}',
                                     array['low_light','codigo_inventado']);
  if j::text like '%score%' then raise exception 'FALHA: score exposto ao titular'; end if;

  -- não envia duas vezes
  begin
    perform public.submit_subject_session(tok, sid, sec, '{"cpf":"529.982.247-25","name":"José Idoso","birth_date":"1950-03-10"}');
    raise exception 'FALHA: reenvio aceito';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;

  -- segunda sessão: mesmo dispositivo, outro CPF, menor de idade
  tok := (select v from t45 where k = 'link2');
  j := public.start_subject_session(tok, '{"fingerprint":"fp-123"}');
  sid := (j->>'session_id')::uuid; sec := j->>'secret';
  insert into t45 values ('sid2', sid::text);
  perform public.record_subject_consent(tok, sid, sec, true, false, 'v1');
  p := public.register_subject_media(tok, sid, sec, 'selfie');
  insert into storage.objects (bucket_id, name) values ('media', p);
  perform public.submit_subject_session(tok, sid, sec, '{"cpf":"390.533.447-05","name":"Outra Pessoa","birth_date":"2012-01-01"}', array['faces_multiple']);
end $$;

reset role;
do $$
declare s1 public.verification_sessions; s2 public.verification_sessions; subj public.subjects;
begin
  select * into s1 from public.verification_sessions where id = (select v::uuid from t45 where k = 'sid1');
  select * into s2 from public.verification_sessions where id = (select v::uuid from t45 where k = 'sid2');
  -- sessão 1: many_capture_attempts(10) + fast_completion(15, teste é instantâneo) + senior_remote(20) + low_light(5) = 50 → review
  if s1.risk_score <> 50 then raise exception 'FALHA: score s1 = % sinais %', s1.risk_score, (select string_agg(code, ',') from public.risk_signals where session_id = s1.id); end if;
  if s1.risk_band <> 'review' then raise exception 'FALHA: faixa s1 = %', s1.risk_band; end if;
  if s1.analysis_source <> 'rules' then raise exception 'FALHA: fonte s1'; end if;
  if exists (select 1 from public.risk_signals where session_id = s1.id and code = 'codigo_inventado') then raise exception 'FALHA: sinal inventado'; end if;
  select * into subj from public.subjects where id = s1.subject_id;
  if subj.data ? 'extra' or subj.data::text like '%52998224725%' or subj.data::text like '%529.982%' then raise exception 'FALHA: dado não minimizado %', subj.data; end if;
  if not subj.marketing_opt_in then raise exception 'FALHA: opt-in não gravado'; end if;
  if (select status from public.verification_links where id = s1.link_id) <> 'completed' then raise exception 'FALHA: link não concluído'; end if;
  -- sessão 2: faces_multiple(35) + underage(40) + device_multi_cpf(25) + fast_completion(15) → teto 100 → high
  if s2.risk_score <> 100 or s2.risk_band <> 'high' then raise exception 'FALHA: s2 score % faixa %', s2.risk_score, s2.risk_band; end if;
end $$;

-- IA (service role): tela detectada eleva o score da sessão 1
set local role service_role;
do $$
declare vs smallint;
begin
  vs := public.apply_ai_verdict((select t45.v::uuid from t45 where k = 'sid1'), '{"verdict":"screen_replay","confidence":0.91,"signals":[],"document_face_match":"not_applicable","explanation_pt":"Padrão de tela."}');
  -- 50 + 60 → teto 100
  if vs <> 100 then raise exception 'FALHA: score após IA = %', vs; end if;
  if not public.consume_ai_quota(2) or not public.consume_ai_quota(2) or public.consume_ai_quota(2) then raise exception 'FALHA: teto de IA'; end if;
end $$;

-- anon não chama funções do Worker
reset role;
set local role anon;
do $$ begin
  perform public.apply_ai_verdict((select v::uuid from t45 where k = 'sid1'), '{"verdict":"real_person"}');
  raise exception 'FALHA: anon aplicou veredito';
exception when insufficient_privilege then null; end $$;

-- membro lê sinais da própria organização
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
do $$ begin
  if (select count(*) from public.risk_signals where session_id = (select v::uuid from t45 where k = 'sid1')) < 4 then
    raise exception 'FALHA: membro não lê sinais'; end if;
end $$;

reset role;
create temp table phase45_result as select 'FASES 4-5 OK' as resultado;
select * from phase45_result;
rollback;
