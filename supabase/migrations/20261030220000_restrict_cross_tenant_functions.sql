-- ════════════════════════════════════════════════════════════════════════════
-- FONCTIONS PRIVILÉGIÉES : PLUS DE LECTURE ENTRE COMPTES (lot 5).
--
-- `effective_tier(p_user_id)` et `count_trades_in_month(p_user_id, p_month)`
-- sont SECURITY DEFINER et prennent l'utilisateur EN ARGUMENT. Elles étaient
-- exécutables par `anon` et `authenticated` via `/rest/v1/rpc/…` : n'importe
-- qui, même sans compte, pouvait lire le palier d'abonnement et le nombre de
-- trades mensuels de n'importe quel utilisateur dont il connaissait l'id
-- (signalé par l'advisor Supabase « Public Can Execute SECURITY DEFINER »).
--
-- Elles restent nécessaires aux déclencheurs de quota et aux contrôles Pro
-- (dont certains tournent en SECURITY INVOKER, avec le rôle de l'utilisateur) :
-- on ne retire donc pas `EXECUTE` à `authenticated`. On le retire à `anon`, qui
-- n'en a jamais besoin, et on ajoute une GARDE : un utilisateur connecté ne
-- peut interroger que lui-même. Le rôle de service (aucun `auth.uid()`) garde
-- l'accès complet (crons, webhooks, synchro broker).
--
-- Les deux fonctions de déclencheur de quota n'ont rien à faire en RPC : leur
-- `EXECUTE` est retiré à tous (un déclencheur se déclenche sans ce droit).
--
-- Corps repris À L'IDENTIQUE de `20260829090000_billing_and_quota_hardening`,
-- garde exceptée. ROLLBACK : réappliquer ces deux définitions depuis cette
-- migration-là et re-`grant execute … to anon, authenticated`.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.effective_tier(p_user_id uuid)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  s public.subscriptions%rowtype;
  grace interval;
begin
  -- Un utilisateur connecté n'interroge que lui-même.
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN: effective_tier is limited to the calling user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into s from public.subscriptions where user_id = p_user_id;
  if not found then
    return 'free';
  end if;

  if s.status = 'trialing' then
    if s.trial_ends_at is null or s.trial_ends_at <= now() then
      return 'free';
    end if;
  elsif s.status <> 'active' then
    return 'free';
  else
    grace := case when s.source = 'stripe' then interval '3 days' else interval '0' end;
    if s.current_period_end is not null and now() > s.current_period_end + grace then
      return 'free';
    end if;
  end if;

  return case
    when s.plan like 'elite%' then 'elite'
    when s.plan like 'pro%'   then 'pro'
    else 'free'
  end;
end;
$$;

create or replace function public.count_trades_in_month(p_user_id uuid, p_month text)
returns int
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN: count_trades_in_month is limited to the calling user'
      using errcode = 'insufficient_privilege';
  end if;
  return (
    select count(*)::int
    from public.trades
    where user_id = p_user_id
      and to_char(trade_date::date, 'YYYY-MM') = p_month
  );
end;
$$;

revoke all on function public.effective_tier(uuid) from public, anon;
grant execute on function public.effective_tier(uuid) to authenticated, service_role;
revoke all on function public.count_trades_in_month(uuid, text) from public, anon;
grant execute on function public.count_trades_in_month(uuid, text) to authenticated, service_role;

revoke all on function public.enforce_trade_quota() from public, anon, authenticated;
revoke all on function public.enforce_account_quota() from public, anon, authenticated;
