-- Teste de isolamento entre organizações (RLS).
-- Roda dentro de uma transação e desfaz tudo no final.
-- Supabase: cole no SQL Editor e execute. Local: psql -f supabase/tests/rls_isolation.sql
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@test.local'),
  ('00000000-0000-4000-8000-00000000000b', 'bruno@test.local');

-- Alice cria a organização A
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select public.create_organization('Org Alice', 'fintech', '11.222.333/0001-81');

-- Bruno cria a organização B
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
select public.create_organization('Org Bruno', 'agro');

do $$
declare n int;
begin
  -- Bruno só enxerga a própria organização
  select count(*) into n from public.organizations;
  if n <> 1 then raise exception 'FALHA: Bruno vê % organizações', n; end if;
  select count(*) into n from public.organizations where name = 'Org Alice';
  if n <> 0 then raise exception 'FALHA: Bruno vê a organização da Alice'; end if;
  select count(*) into n from public.memberships;
  if n <> 1 then raise exception 'FALHA: Bruno vê % memberships', n; end if;
  select count(*) into n from public.audit_logs;
  if n <> 1 then raise exception 'FALHA: Bruno vê % logs', n; end if;
  select count(*) into n from public.flow_templates;
  if n <> 1 then raise exception 'FALHA: Bruno vê % fluxos', n; end if;

  -- Bruno não consegue alterar a organização da Alice
  update public.organizations set name = 'hack' where name = 'Org Alice';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: Bruno alterou a organização da Alice'; end if;

  -- Bruno não consegue se inserir como membro de outra organização
  begin
    insert into public.memberships (user_id, organization_id, role)
    select '00000000-0000-4000-8000-00000000000b', id, 'owner' from public.organizations limit 1;
    raise exception 'FALHA: insert direto em memberships foi permitido';
  exception when insufficient_privilege then null;
  end;

  -- CNPJ inválido é recusado
  begin
    perform public.create_organization('Org X', 'fintech', '11.222.333/0001-00');
    raise exception 'FALHA: CNPJ inválido aceito';
  exception when invalid_parameter_value then null;
  end;

  -- Log de auditoria é imutável
  begin
    delete from public.audit_logs;
  exception when insufficient_privilege then null;
  end;

  raise notice 'RLS OK: isolamento entre organizações confirmado';
end $$;

-- anon não lê nada
reset role;
set local role anon;
do $$
begin
  perform count(*) from public.organizations;
  raise exception 'FALHA: anon leu organizations';
exception when insufficient_privilege then
  raise notice 'RLS OK: anon sem acesso às tabelas';
end $$;

rollback;
