-- ════════════════════════════════════════════════════════════════════════════
-- LICENCE À VIE — une offre unique, 20 € payés une fois.
--
-- Additif : on AJOUTE le plan `lifetime` aux listes autorisées, on apprend à
-- `effective_tier` qu'il ouvre le palier le plus haut, et on interdit à
-- `apply_subscription_event` de rétrograder une licence. Les anciens plans
-- (pro_*, elite_*) restent valides : les lignes existantes ne bougent pas.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check check (
    plan in (
      'free',
      'pro_monthly', 'pro_yearly',
      'elite_monthly', 'elite_yearly',
      'lifetime'
    )
  );

-- Accès offerts et codes promo : la licence devient l'offre par défaut.
alter table if exists public.comp_grants
  drop constraint if exists comp_grants_plan_check;
alter table if exists public.comp_grants
  add constraint comp_grants_plan_check check (
    plan in ('pro_monthly', 'pro_yearly', 'elite_monthly', 'elite_yearly', 'lifetime')
  );
alter table if exists public.comp_grants alter column plan set default 'lifetime';

alter table public.promo_codes
  drop constraint if exists promo_codes_plan_check;
alter table public.promo_codes
  add constraint promo_codes_plan_check check (
    plan in ('pro_monthly', 'pro_yearly', 'elite_monthly', 'elite_yearly', 'lifetime')
  );
alter table public.promo_codes alter column plan set default 'lifetime';

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
    -- La licence à vie (paiement unique) ouvre tout : palier le plus haut.
    when s.plan = 'lifetime'  then 'elite'
    when s.plan like 'elite%' then 'elite'
    when s.plan like 'pro%'   then 'pro'
    else 'free'
  end;
end;
$$;

create or replace function public.apply_subscription_event(
  p_user_id                uuid,
  p_plan                   text,
  p_status                 text,
  p_source                 text,
  p_stripe_subscription_id text,
  p_stripe_customer_id     text,
  p_crypto_charge_id       text,
  p_current_period_end     timestamptz,
  p_cancel_at_period_end   boolean,
  p_event_at               timestamptz
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_rows int;
begin
  insert into public.subscriptions (
    user_id, plan, status, source,
    stripe_subscription_id, stripe_customer_id, crypto_charge_id,
    current_period_end, cancel_at_period_end, provider_event_at, updated_at
  )
  values (
    p_user_id, p_plan, p_status, p_source,
    p_stripe_subscription_id, p_stripe_customer_id, p_crypto_charge_id,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_event_at, now()
  )
  on conflict (user_id) do update set
    plan                   = excluded.plan,
    status                 = excluded.status,
    source                 = excluded.source,
    -- `coalesce` : un événement qui ne porte pas l'identifiant ne doit pas
    -- effacer celui déjà connu (le portail de facturation en dépend).
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id,
                                      public.subscriptions.stripe_subscription_id),
    stripe_customer_id     = coalesce(excluded.stripe_customer_id,
                                      public.subscriptions.stripe_customer_id),
    crypto_charge_id       = coalesce(excluded.crypto_charge_id,
                                      public.subscriptions.crypto_charge_id),
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    provider_event_at      = excluded.provider_event_at,
    updated_at             = now()
  where (public.subscriptions.provider_event_at is null
         or public.subscriptions.provider_event_at <= excluded.provider_event_at)
    -- UNE LICENCE À VIE NE SE RÉTROGRADE PAS. Les anciens abonnés convertis
    -- gardent un abonnement Stripe qui s'éteint en fin de période : son
    -- dernier événement (« deleted », plan « free ») ne doit pas couper un
    -- accès payé une fois pour toutes. Seule une écriture qui pose elle-même
    -- `lifetime` peut toucher une ligne `lifetime` ; un remboursement passe
    -- par un chemin dédié côté serveur.
    and (public.subscriptions.plan <> 'lifetime' or excluded.plan = 'lifetime');

  get diagnostics v_rows = row_count;
  -- Zéro ligne ici ne peut vouloir dire qu'une chose : le `where` du
  -- `do update` a rejeté l'écriture, donc l'état stocké vient d'un événement
  -- PLUS RÉCENT. Ce n'est pas une erreur, c'est une livraison hors ordre.
  return case when v_rows = 0 then 'stale' else 'applied' end;
end;
$$;

-- Le SEUL chemin qui retire une licence : le remboursement de son paiement,
-- appelé par le webhook Stripe (rôle service uniquement).
create or replace function public.revoke_lifetime_license(p_stripe_customer_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_rows int;
begin
  update public.subscriptions
     set plan = 'free', status = 'canceled', updated_at = now()
   where stripe_customer_id = p_stripe_customer_id
     and plan = 'lifetime';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.revoke_lifetime_license(text) from public, anon, authenticated;
grant execute on function public.revoke_lifetime_license(text) to service_role;
