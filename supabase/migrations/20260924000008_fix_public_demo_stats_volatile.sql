-- =============================================================================
-- Vero ID — Correção: painel público (/demo) falhando em produção
-- =============================================================================
-- Bug real (nunca pego nos testes porque eu sempre rodava os SQLs como
-- superusuário no SQL Editor, e não através da API REST que o app usa):
--
-- `public.public_demo_stats()` estava declarada `stable`, mas chama
-- `private.dashboard_stats_for()`, que executa `create temp table ... as
-- select ...` (DDL). O PostgREST decide o modo da transação pela volatilidade
-- da função de mais alto nível chamada pela API — não da função interna — e
-- para `stable`/`immutable` abre uma transação READ ONLY. Resultado: toda
-- chamada pública a `/demo` falhava com o erro do Postgres
-- `25006: cannot execute CREATE TABLE AS in a read-only transaction`.
--
-- `public.dashboard_stats()` (painel autenticado) já era `volatile`, por isso
-- nunca deu esse erro — só o modo demo público, sem login, era afetado.
--
-- Correção: `public.public_demo_stats()` passa a ser `volatile`, igual à sua
-- irmã autenticada. Não é uma escrita de fato (só chama a leitura agregada),
-- mas precisa da transação de leitura-escrita para a temp table interna.
-- =============================================================================
create or replace function public.public_demo_stats()
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where settings->>'is_public_demo' = 'true' order by created_at limit 1;
  if v_org is null then raise exception 'no_public_demo' using errcode = 'P0002'; end if;
  return private.dashboard_stats_for(v_org, now() - interval '90 days', now() + interval '1 hour', '{}'::jsonb);
end $$;

revoke all on function public.public_demo_stats() from public;
grant execute on function public.public_demo_stats() to anon, authenticated;
