-- Durcissement facturation + quotas — audit P0/P1.
--
-- Quatre sujets indépendants, une seule migration parce qu'ils partagent la
-- même exigence : ce que l'application PROMET doit être tenu par la base, pas
-- par du code React ni par une lecture-puis-écriture qui perd la course.
--
--   1. `redeem_promo_code`  — la rédemption d'un code promo, ATOMIQUE.
--   2. `ai_rate_limits`     — des compteurs par PORTÉE (horaire ET quotidien).
--   3. `count_trades_in_month` / `enforce_trade_quota` — la limite de trades.
--   4. `enforce_account_quota` — la limite de comptes de trading.
--
-- Migration ADDITIVE : aucune table n'est supprimée, aucune donnée réécrite.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. RÉDEMPTION DE CODE PROMO — atomique
-- ════════════════════════════════════════════════════════════════════════════
--
-- Le code applicatif faisait : lire `uses_count`, puis écrire `uses_count + 1`.
-- Deux checkouts simultanés lisaient la même valeur et écrivaient la même
-- valeur + 1 : `max_uses` était franchissable à volonté avec deux onglets.
--
-- Ici, `select … for update` sérialise les rédemptions du MÊME code. Deux
-- appels concurrents s'exécutent l'un après l'autre et le second voit bien le
-- compteur incrémenté par le premier.
--
-- L'insertion est idempotente par `(code, user_id)` (la clé primaire de
-- `promo_redemptions`) : rejouer le même checkout ne consomme pas un second
-- usage, et renvoie `already_redeemed` — ce qui doit laisser passer le
-- parcours, pas le refuser (une personne qui reprend un checkout abandonné
-- n'est pas un abus).
--
-- Retours possibles :
--   'redeemed'         — usage consommé, `uses_count` incrémenté
--   'already_redeemed' — cette personne avait déjà utilisé ce code
--   'exhausted'        — `max_uses` atteint
--   'inactive'         — code désactivé
--   'expired'          — date de fin dépassée
--   'unknown'          — code absent du catalogue
create or replace function public.redeem_promo_code(
  p_code    text,
  p_user_id uuid,
  p_email   text,
  p_plan    text,
  p_kind    text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  pc     public.promo_codes%rowtype;
  v_rows int;
begin
  -- Verrou de ligne : la sérialisation des rédemptions d'un même code.
  select * into pc from public.promo_codes where code = p_code for update;
  if not found then
    return 'unknown';
  end if;

  if not pc.active then
    return 'inactive';
  end if;

  if pc.expires_at is not null and pc.expires_at <= now() then
    return 'expired';
  end if;

  -- Déjà utilisé par cette personne : on ne consomme rien de plus.
  if exists (
    select 1 from public.promo_redemptions
    where code = p_code and user_id = p_user_id
  ) then
    return 'already_redeemed';
  end if;

  -- Le plafond est évalué SOUS LE VERROU, donc sur la valeur réellement à jour.
  if pc.max_uses is not null and pc.uses_count >= pc.max_uses then
    return 'exhausted';
  end if;

  insert into public.promo_redemptions (code, user_id, email, plan, kind)
  values (p_code, p_user_id, p_email, p_plan, p_kind)
  on conflict (code, user_id) do nothing;

  -- `GET DIAGNOSTICS … = ROW_COUNT` rend un ENTIER : le comparer plutôt que
  -- l'affecter à un booléen, sinon plpgsql lève à l'exécution.
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- Course perdue de justesse contre une autre transaction : elle a compté
    -- l'usage, pas nous. Le résultat pour l'appelant est le même.
    return 'already_redeemed';
  end if;

  update public.promo_codes
    set uses_count = uses_count + 1
    where code = p_code;

  return 'redeemed';
end;
$$;

-- Rendre une rédemption — le checkout à prix réduit RÉSERVE l'usage avant
-- d'ouvrir la session Stripe ; si Stripe échoue, l'usage doit être relâché,
-- sinon un incident réseau consommerait un code à durée limitée pour rien.
create or replace function public.release_promo_redemption(
  p_code    text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_rows int;
begin
  perform 1 from public.promo_codes where code = p_code for update;

  delete from public.promo_redemptions
   where code = p_code and user_id = p_user_id;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.promo_codes
      set uses_count = greatest(uses_count - 1, 0)
      where code = p_code;
  end if;

  return v_rows > 0;
end;
$$;

-- Ces deux fonctions n'ont AUCUN appelant client : le checkout tourne avec le
-- rôle de service. On révoque donc tout le monde, explicitement — un `grant`
-- oublié ici serait un distributeur d'abonnements gratuits.
revoke all on function public.redeem_promo_code(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.release_promo_redemption(text, uuid) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. COMPTEURS IA PAR PORTÉE
-- ════════════════════════════════════════════════════════════════════════════
--
-- `ai_rate_limits` était indexée par `(user_id, window_start)`. Ajouter un
-- second compteur (le quota QUOTIDIEN par palier, à côté du plafond horaire
-- anti-abus) l'aurait fait entrer en collision avec le premier : les deux
-- fenêtres tombent sur le même `window_start` à minuit UTC, donc les deux
-- compteurs auraient partagé une ligne et se seraient mutuellement épuisés.
--
-- On introduit une colonne `scope`. Les lignes existantes sont de portée
-- horaire, d'où le défaut.

alter table public.ai_rate_limits
  add column if not exists scope text not null default 'hourly';

do $$
begin
  -- La clé primaire historique porte le nom par défaut de Postgres.
  if exists (
    select 1 from pg_constraint
    where conname = 'ai_rate_limits_pkey'
      and conrelid = 'public.ai_rate_limits'::regclass
  ) then
    alter table public.ai_rate_limits drop constraint ai_rate_limits_pkey;
  end if;
end $$;

-- Une ligne par (personne, portée, fenêtre).
create unique index if not exists ai_rate_limits_scope_key
  on public.ai_rate_limits (user_id, scope, window_start);

/**
 * Consomme un jeton dans une fenêtre fixe, pour une portée donnée.
 *
 * `insert … on conflict do update … returning` est atomique : le compteur ne
 * peut pas être lu puis écrit, donc deux requêtes simultanées ne peuvent pas
 * obtenir le même numéro.
 */
create or replace function public.consume_ai_quota_scoped(
  p_scope          text,
  p_limit          int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  if auth.uid() is null then
    return true;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.ai_rate_limits (user_id, scope, window_start, count)
  values (auth.uid(), p_scope, v_window, 1)
  on conflict (user_id, scope, window_start)
  do update set count = public.ai_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- L'ancienne signature reste en place et DÉLÈGUE : tout appelant non encore
-- migré continue de fonctionner, sur la portée horaire.
create or replace function public.consume_ai_quota(p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  return public.consume_ai_quota_scoped('hourly', p_limit, p_window_seconds);
end;
$$;

revoke all on function public.consume_ai_quota_scoped(text, int, int) from public, anon;
grant execute on function public.consume_ai_quota_scoped(text, int, int) to authenticated;
revoke all on function public.consume_ai_quota(int, int) from public, anon;
grant execute on function public.consume_ai_quota(int, int) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LIMITE DE TRADES PAR MOIS
-- ════════════════════════════════════════════════════════════════════════════
--
-- La limite « 10 trades par mois en gratuit » n'était vérifiée que dans React.
-- Le client parle à PostgREST avec son propre jeton : un `insert` direct la
-- contournait, et antidater un trade la contournait même DEPUIS l'interface
-- (le filtre porte sur `trade_date`, une valeur saisie par l'utilisateur).
--
-- Le déclencheur ci-dessous est la vraie barrière. Il ne compte que les
-- CRÉATIONS (`before insert`) : corriger une note sur un trade déjà saisi n'a
-- rien à voir avec l'offre et ne doit jamais être refusé.

/** Le palier réellement ouvert pour cette personne, vu par la base.
 *  Réplique fidèle de `domain/entitlement.ts` : statut, période échue, et le
 *  délai de grâce de trois jours réservé à Stripe. */
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

/** Trades CRÉÉS sur le mois calendaire d'une date donnée. Compte sur
 *  `trade_date` — la même définition que l'interface, pour que le chiffre
 *  affiché et le chiffre appliqué soient le même chiffre. */
create or replace function public.count_trades_in_month(p_user_id uuid, p_month text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.trades
  where user_id = p_user_id
    and to_char(trade_date::date, 'YYYY-MM') = p_month;
$$;

create or replace function public.enforce_trade_quota()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tier  text;
  v_limit int;
  v_used  int;
begin
  -- L'application enregistre un trade par UPSERT (`insert … on conflict do
  -- update`) : ce déclencheur `before insert` se déclenche donc AUSSI quand
  -- l'utilisateur MODIFIE un trade existant. Sans cette sortie, un compte
  -- gratuit arrivé à sa limite ne pourrait plus corriger une faute de frappe
  -- sur un trade déjà saisi — une régression, pas une limite d'offre.
  -- La limite porte sur les CRÉATIONS, exactement comme `canLogTrade` côté
  -- application (`utils/planLimits.ts`).
  if exists (select 1 from public.trades where id = new.id) then
    return new;
  end if;

  v_tier := public.effective_tier(new.user_id);

  -- `null` = aucune limite. Les paliers payants sortent immédiatement : la
  -- limite ne doit rien coûter à ceux qui ont payé pour ne pas l'avoir.
  v_limit := case v_tier when 'free' then 10 else null end;
  if v_limit is null then
    return new;
  end if;

  select public.count_trades_in_month(new.user_id, to_char(new.trade_date::date, 'YYYY-MM'))
    into v_used;

  if v_used >= v_limit then
    raise exception 'PLAN_LIMIT_TRADES: monthly trade limit reached for this plan'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trades_enforce_quota on public.trades;
create trigger trades_enforce_quota
  before insert on public.trades
  for each row execute function public.enforce_trade_quota();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. LIMITE DE COMPTES DE TRADING
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.enforce_account_quota()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tier  text;
  v_limit int;
  v_used  int;
begin
  v_tier := public.effective_tier(new.user_id);
  v_limit := case v_tier when 'free' then 1 when 'pro' then 3 else null end;
  if v_limit is null then
    return new;
  end if;

  select count(*)::int into v_used from public.accounts where user_id = new.user_id;

  if v_used >= v_limit then
    raise exception 'PLAN_LIMIT_ACCOUNTS: account limit reached for this plan'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists accounts_enforce_quota on public.accounts;
create trigger accounts_enforce_quota
  before insert on public.accounts
  for each row execute function public.enforce_account_quota();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. INDEX D'EXPIRATION
-- ════════════════════════════════════════════════════════════════════════════
-- Le balayage quotidien cherche les abonnements non-Stripe dont la période est
-- écoulée. Sans index, il lit toute la table chaque nuit.
create index if not exists subscriptions_period_end_active_idx
  on public.subscriptions (current_period_end)
  where status = 'active' and current_period_end is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. APPLICATION D'UN ÉVÉNEMENT D'ABONNEMENT — idempotente et ordonnée
-- ════════════════════════════════════════════════════════════════════════════
--
-- Les webhooks écrivaient avec `update … eq(user_id)`. Trois défauts :
--
--  1. Un `update` qui ne touche AUCUNE ligne ne renvoie pas d'erreur. Un
--     abonnement créé depuis le dashboard Stripe, ou un compte supprimé puis
--     recréé, n'avait pas de ligne : le webhook répondait 200, l'événement
--     était marqué traité, et le paiement était perdu SANS AUCUN SIGNAL.
--  2. Les livraisons de Stripe ne sont pas ordonnées. Un `subscription.updated`
--     retardé pouvait écraser un `subscription.deleted` déjà appliqué et
--     rouvrir un accès résilié.
--  3. Rien ne distinguait un rejeu (inoffensif) d'une régression d'état.
--
-- `provider_event_at` porte l'horodatage de l'événement qui a produit l'état
-- courant. L'écriture n'a lieu que si l'événement entrant est au moins aussi
-- récent. Un rejeu à l'identique réécrit les mêmes valeurs (idempotent) ; un
-- événement plus ancien est ignoré et signalé `stale`.

alter table public.subscriptions
  add column if not exists provider_event_at timestamptz;

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
  where public.subscriptions.provider_event_at is null
     or public.subscriptions.provider_event_at <= excluded.provider_event_at;

  get diagnostics v_rows = row_count;
  -- Zéro ligne ici ne peut vouloir dire qu'une chose : le `where` du
  -- `do update` a rejeté l'écriture, donc l'état stocké vient d'un événement
  -- PLUS RÉCENT. Ce n'est pas une erreur, c'est une livraison hors ordre.
  return case when v_rows = 0 then 'stale' else 'applied' end;
end;
$$;

revoke all on function public.apply_subscription_event(
  uuid, text, text, text, text, text, text, timestamptz, boolean, timestamptz
) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RETROUVER UN COMPTE PAR ADRESSE
-- ════════════════════════════════════════════════════════════════════════════
--
-- `admin.server.ts` parcourait `auth.admin.listUsers()` page par page, plafonné
-- à vingt pages de deux cents : au-delà de 4 000 comptes il renvoyait `null` en
-- SILENCE, et accorder ou révoquer un accès cessait de fonctionner sans que
-- rien ne le signale. C'était aussi jusqu'à vingt appels d'API par opération.
--
-- Une recherche indexée sur `auth.users` remplace le balayage. `security
-- definer` parce que `auth.users` n'est pas lisible par les rôles applicatifs ;
-- révoquée pour tout le monde parce qu'elle répond « ce compte existe » — une
-- primitive d'énumération d'adresses si elle était exposée.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer set search_path = public, auth
as $$
  select id from auth.users
  where lower(email) = lower(p_email)
  order by created_at asc
  limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. PAGINATION DES BALAYAGES PAR UTILISATEUR
-- ════════════════════════════════════════════════════════════════════════════
--
-- Les crons mensuels et le scan de patterns faisaient
-- `select user_id from trades where trade_date >= …` SANS AUCUNE LIMITE, puis
-- dédoublonnaient en mémoire. Deux problèmes, tous deux silencieux :
--
--  1. PostgREST plafonne les réponses à `db.max_rows` (1 000 par défaut chez
--     Supabase). Passé quelques centaines de trades sur la fenêtre, le cron ne
--     voyait plus qu'une FRACTION des utilisateurs — sans erreur, sans journal,
--     sans que personne ne remarque que les rapports mensuels avaient cessé
--     d'arriver à la majorité des comptes.
--  2. Même sans ce plafond, la requête lit une ligne par trade pour n'en
--     retenir qu'une par personne.
--
-- Cette fonction rend les identifiants DISTINCTS, triés, après un curseur : la
-- pagination est exacte (pas de doublon, pas d'oubli) et s'appuie sur l'index.
create or replace function public.users_with_trades_since(
  p_since date,
  p_after uuid,
  p_limit int
)
returns table (user_id uuid)
language sql
stable
security definer set search_path = public
as $$
  select distinct t.user_id
  from public.trades t
  where t.trade_date >= p_since
    and (p_after is null or t.user_id > p_after)
  order by t.user_id
  limit greatest(p_limit, 1);
$$;

revoke all on function public.users_with_trades_since(date, uuid, int) from public, anon, authenticated;

-- Le balayage filtre sur la date puis trie par utilisateur : sans cet index,
-- chaque passage relit la table entière.
create index if not exists trades_date_user_idx
  on public.trades (trade_date, user_id);
