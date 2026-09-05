-- Socle minimal pour exécuter les migrations de TradeVault sur un Postgres nu.
--
-- POURQUOI CE FICHIER. Les garanties les plus chères du produit — `max_uses`
-- réellement appliqué, deux checkouts simultanés qui ne se doublent pas, un
-- webhook rejoué qui n'ajoute pas un mois d'abonnement — ne vivent pas dans du
-- TypeScript : elles vivent dans du SQL. Les vérifier par lecture de code, ou
-- par un faux client Supabase, ne prouve rien du tout : c'est le comportement
-- de Postgres sous concurrence qu'il faut observer.
--
-- Ce socle recrée UNIQUEMENT ce dont les migrations testées dépendent, avec
-- les mêmes colonnes et les mêmes contraintes que la vraie base :
--   • le schéma `auth` et sa table `users` (référencée par les clés étrangères)
--   • `auth.uid()`, que Supabase fournit et qu'on simule par un réglage de
--     session — c'est ce qui rend testable le compteur de quota IA
--   • les tables applicatives citées par les migrations sous test
--
-- Ce n'est PAS une réplique de la base de production, et ça ne prétend pas
-- l'être : la RLS, le stockage et les déclencheurs d'authentification ne sont
-- pas rejoués ici. C'est un banc d'essai pour les fonctions et déclencheurs que
-- la migration `20260829090000_billing_and_quota_hardening.sql` ajoute.

-- Les rôles que Supabase provisionne. Les migrations leur accordent ou leur
-- retirent des droits (`grant execute … to authenticated`, `revoke … from
-- anon`) : sans eux, la migration échoue à l'application — ce qui est déjà, en
-- soi, une vérification utile.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

-- Supabase expose l'utilisateur courant via `auth.uid()`. Ici, un réglage de
-- session tient le même rôle : `set local tv.uid = '…'` avant l'appel.
create or replace function auth.uid()
returns uuid
language plpgsql
stable
as $$
declare
  v text;
begin
  v := current_setting('tv.uid', true);
  if v is null or v = '' then
    return null;
  end if;
  return v::uuid;
end;
$$;

-- ── Tables applicatives (colonnes réelles, contraintes réelles) ─────────────

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  plan                   text not null default 'free'
                         check (plan in ('free', 'pro_monthly', 'pro_yearly',
                                         'elite_monthly', 'elite_yearly')),
  status                 text not null default 'canceled'
                         check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  source                 text not null default 'signup'
                         check (source in ('signup', 'trial', 'stripe', 'crypto', 'comp', 'promo')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  crypto_charge_id       text,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.promo_codes (
  code             text primary key,
  plan             text not null default 'pro_yearly'
                   check (plan in ('pro_monthly', 'pro_yearly', 'elite_monthly', 'elite_yearly')),
  owner_email      text,
  discount_percent int check (discount_percent is null or discount_percent between 1 and 100),
  active           boolean not null default true,
  expires_at       timestamptz,
  max_uses         int check (max_uses is null or max_uses >= 1),
  uses_count       int not null default 0,
  note             text,
  granted_by       text,
  created_at       timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  code       text not null references public.promo_codes (code) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text not null,
  plan       text not null,
  kind       text not null check (kind in ('owner', 'free', 'discount')),
  created_at timestamptz not null default now(),
  primary key (code, user_id)
);

create table if not exists public.ai_rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (user_id, window_start)
);

create table if not exists public.trades (
  id         text primary key default gen_random_uuid()::text,
  user_id    uuid not null references auth.users(id) on delete cascade,
  account_id uuid,
  trade_date date not null,
  symbol     text not null default 'EURUSD',
  direction  text not null default 'long',
  pnl        numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_memory (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  content    text not null,
  key        text,
  importance smallint not null default 3,
  confidence real not null default 0.6,
  source     text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null default 'Personal',
  type             text not null default 'personal',
  starting_balance numeric not null default 25000,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now()
);

