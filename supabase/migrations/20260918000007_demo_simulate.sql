-- =============================================================================
-- Vero ID — Fase 8.4 — "Simular onboarding" na página pública /demo
-- Cria um link de curta duração no fluxo da organização de demonstração fixa,
-- sem exigir login, para o visitante ver a tela do titular na hora.
-- =============================================================================
create or replace function public.start_public_demo_flow()
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org uuid;
  v_flow uuid;
  v_token text := private.new_token();
  v_id uuid;
  v_exp timestamptz;
begin
  select id into v_org from public.organizations where settings->>'is_public_demo' = 'true' order by created_at limit 1;
  if v_org is null then raise exception 'no_public_demo' using errcode = 'P0002'; end if;

  -- Limite simples contra abuso: até 200 simulações públicas por hora (não conta os
  -- links do seed original, só os criados por esta função).
  if (select count(*) from public.verification_links
      where organization_id = v_org and reference = 'Simulação pública' and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'demo_rate_limited' using errcode = 'P0001', hint = 'Muitas simulações públicas nesta hora, tente de novo em alguns minutos.';
  end if;

  select id into v_flow from public.flow_templates where organization_id = v_org and is_active order by created_at limit 1;

  insert into public.verification_links
    (organization_id, flow_template_id, token_hash, subject_name, channel, reference, status, expires_at, created_by)
  values
    (v_org, v_flow, private.token_hash(v_token), 'Visitante', 'qr', 'Simulação pública', 'created', now() + interval '30 minutes', null)
  returning id, expires_at into v_id, v_exp;

  return jsonb_build_object('token', v_token, 'expires_at', v_exp);
end $$;

revoke all on function public.start_public_demo_flow() from public;
grant execute on function public.start_public_demo_flow() to anon, authenticated;
