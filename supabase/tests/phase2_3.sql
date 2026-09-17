-- Testes das fases 2 e 3 (desfaz tudo ao final). Retorna "FASES 2-3 OK".
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'dona@test.local'),
  ('00000000-0000-4000-8000-0000000000a2', 'analista@test.local'),
  ('00000000-0000-4000-8000-0000000000a3', 'intruso@test.local');

create temp table t_ctx (k text primary key, v text);
grant all on t_ctx to authenticated, anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
insert into t_ctx select 'org', public.create_organization('Org Teste', 'automotive')::text;

do $$
declare
  org uuid := (select v::uuid from t_ctx where k = 'org');
  tok text; lid uuid; n int; j jsonb;
begin
  -- Brand Kit válido e inválido
  update public.organizations set brand_kit = '{"primary":"#0A5C4B","radius":"rounded","font_text":"Manrope"}' where id = org;
  begin
    update public.organizations set brand_kit = '{"primary":"red"}' where id = org;
    raise exception 'FALHA: brand kit inválido aceito';
  exception when check_violation then null; end;
  -- Coluna protegida
  begin
    update public.organizations set created_by = null where id = org;
    raise exception 'FALHA: created_by alterável';
  exception when insufficient_privilege then null; end;
  if not exists (select 1 from public.audit_logs where action = 'brand_kit.updated') then
    raise exception 'FALHA: brand_kit sem auditoria'; end if;

  -- Convite
  select i.token into tok from public.invite_member(org, 'Analista@test.local', 'analyst') i;
  insert into t_ctx values ('invite', tok);
  begin
    perform public.invite_member(org, 'x@test.local', 'owner');
    raise exception 'FALHA: convite owner aceito';
  exception when invalid_parameter_value then null; end;

  -- Link
  select c.link_id, c.token into lid, tok from public.create_verification_link(org, 'Maria da Silva', 'whatsapp', '(11) 98765-4321', null, 'PED-1', 24) c;
  insert into t_ctx values ('link', tok), ('link_id', lid::text);
  if (select status from public.verification_links_view where id = lid) <> 'created' then raise exception 'FALHA: status inicial'; end if;
  perform public.mark_link_shared(lid);
  if (select status from public.verification_links_view where id = lid) <> 'sent' then raise exception 'FALHA: mark shared'; end if;
  begin
    perform public.create_verification_link(org, 'Sem telefone', 'sms');
    raise exception 'FALHA: SMS sem telefone aceito';
  exception when check_violation then null; end;

  -- Lote
  select count(*) filter (where error is null), count(*) filter (where error is not null) into n, j
  from public.create_verification_links_batch(org,
    '[{"name":"Ana","email":"ana@x.com"},{"name":"B","email":"bad"},{"name":"Carlos","email":"c@x.com"}]', 'email', 72) b;
  if n <> 2 then raise exception 'FALHA: lote criou % (esperado 2)', n; end if;

  -- Hash: token em claro nunca é gravado
  if exists (select 1 from public.verification_links where token_hash = tok) then raise exception 'FALHA: token em claro'; end if;
end $$;

-- Analista aceita convite
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);
do $$
declare org uuid;
begin
  select public.accept_invitation((select v from t_ctx where k = 'invite')) into org;
  if (select role from public.memberships where organization_id = org and user_id = auth.uid()) <> 'analyst' then
    raise exception 'FALHA: analista sem papel'; end if;
  -- Analista pode cancelar link, mas não mudar marca
  begin
    perform public.cancel_verification_link((select v::uuid from t_ctx where k = 'link_id'), '');
    raise exception 'FALHA: cancelamento sem motivo';
  exception when invalid_parameter_value then null; end;
  update public.organizations set brand_kit = '{}' where id = org;
  if (select brand_kit->>'primary' from public.organizations where id = org) is null then
    raise exception 'FALHA: analista alterou a marca'; end if;
end $$;

-- Intruso não vê nada e não usa convite alheio
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a3', true);
do $$
begin
  if exists (select 1 from public.verification_links_view) then raise exception 'FALHA: intruso vê links'; end if;
  if exists (select 1 from public.list_org_members((select v::uuid from t_ctx where k = 'org'))) then raise exception 'FALHA: intruso lista membros'; end if;
  begin
    perform public.cancel_verification_link((select v::uuid from t_ctx where k = 'link_id'), 'teste de intruso');
    raise exception 'FALHA: intruso cancelou';
  exception when insufficient_privilege then null; end;
end $$;

-- Titular anônimo abre o link
reset role;
set local role anon;
do $$
declare j jsonb;
begin
  j := public.get_public_link((select v from t_ctx where k = 'link'));
  if j->>'status' <> 'opened' then raise exception 'FALHA: link público status %', j->>'status'; end if;
  if j::text like '%98765%' then raise exception 'FALHA: telefone vazou'; end if;
  if j#>>'{organization,brand_kit,primary}' <> '#0A5C4B' then raise exception 'FALHA: marca ausente'; end if;
  if (public.get_public_link('token-que-nao-existe-123456'))->>'status' <> 'not_found' then raise exception 'FALHA: not_found'; end if;
end $$;

reset role;
create temp table phase_result as select 'FASES 2-3 OK' as resultado;
select * from phase_result;
rollback;
