-- ============ SYNCHRONISATION BROKER (Tradovate) ============
--
-- Le trader connecte ses comptes Tradovate (prop firms comprises) : chaque
-- aller-retour clôturé arrive dans son journal sans qu'il ait rien à saisir,
-- avec tout ce qui est structurel déjà rempli (date, heures, sens, contrats,
-- prix moyens, frais, P&L net, et le R quand le stop initial est retrouvé).
--
-- Trois blocs, tous additifs :
--   1. `broker_connections` — une connexion par login broker ;
--   2. `broker_accounts`    — les comptes de ce login, et le compte
--                             TradeVault dans lequel chacun se journalise ;
--   3. des colonnes d'EXÉCUTION sur `trades` + une clé de déduplication.
--
-- ── AUCUN MOT DE PASSE, LECTURE SEULE ───────────────────────────────────────
-- Le trader se connecte CHEZ Tradovate (OAuth) : son identifiant, son mot de
-- passe et son e-mail ne transitent jamais par TradeVault et ne sont stockés
-- nulle part ici. TradeVault ne garde que le JETON d'accès délivré par
-- Tradovate, CHIFFRÉ par le serveur (AES-256-GCM, clé
-- `BROKER_CREDENTIALS_KEY`, jamais en base ni dans le bundle client) avant
-- écriture. Le client serveur n'appelle que des lectures (liste blanche dans
-- `backend/tradovate.server.ts`) : aucun ordre, aucune modification de compte.
-- La RLS reste owner-only : lire sa propre ligne ne rend qu'un texte chiffré.
--
-- ── LA DÉDUPLICATION ────────────────────────────────────────────────────────
-- `trades (user_id, external_id)` est UNIQUE. La synchronisation recalcule les
-- mêmes allers-retours à chaque passage (l'appariement est déterministe) et
-- les insère avec `on conflict do nothing` : rejouer une synchro n'écrit
-- jamais deux fois le même trade. Un index unique ordinaire (et non partiel)
-- parce que PostgREST ne sait pas cibler un index partiel dans `on_conflict` ;
-- les NULL étant distincts, les trades saisis à la main ne sont pas concernés.

-- ── 1. Connexions ───────────────────────────────────────────────────────────
create table if not exists public.broker_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  broker            text not null default 'tradovate' check (broker in ('tradovate')),
  environment       text not null default 'live' check (environment in ('live', 'demo')),
  label             text not null default '',
  status            text not null default 'active'
                      check (status in ('pending', 'active', 'error', 'disabled')),
  -- Le jeton d'accès Tradovate, chiffré. Jamais d'identifiant ni de mot de passe.
  token_ciphertext  text,
  token_expires_at  timestamptz,
  -- Empreinte SHA-256 du `state` OAuth en attente (jamais la valeur brute).
  oauth_state       text,
  external_user_id  text,
  -- Risque par trade utilisé quand aucun stop n'est retrouvé chez le broker.
  default_risk      numeric(12, 2) check (default_risk is null or default_risk >= 0),
  -- Compte TradeVault proposé par défaut aux nouveaux comptes broker.
  default_account_id uuid references public.accounts(id) on delete set null,
  -- Fuseau du trader : la date et l'heure d'un trade s'écrivent dans SON fuseau.
  timezone          text not null default 'UTC',
  last_sync_at      timestamptz,
  last_success_at   timestamptz,
  last_error        text,
  -- Curseur et cache : `syncedThrough` (dernière sortie journalisée) et la
  -- fiche des contrats déjà résolus.
  sync_cursor       jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists broker_connections_user_idx on public.broker_connections (user_id);
create index if not exists broker_connections_sync_idx
  on public.broker_connections (status, last_sync_at);

alter table public.broker_connections enable row level security;
grant select, insert, update, delete on public.broker_connections to authenticated;
grant all on public.broker_connections to service_role;

drop policy if exists "broker_connections_select_own" on public.broker_connections;
create policy "broker_connections_select_own" on public.broker_connections
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "broker_connections_insert_own" on public.broker_connections;
create policy "broker_connections_insert_own" on public.broker_connections
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "broker_connections_update_own" on public.broker_connections;
create policy "broker_connections_update_own" on public.broker_connections
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "broker_connections_delete_own" on public.broker_connections;
create policy "broker_connections_delete_own" on public.broker_connections
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists broker_connections_set_updated_at on public.broker_connections;
create trigger broker_connections_set_updated_at
  before update on public.broker_connections
  for each row execute function public.set_updated_at();

-- ── 2. Comptes broker → comptes TradeVault ──────────────────────────────────
create table if not exists public.broker_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  connection_id       uuid not null references public.broker_connections(id) on delete cascade,
  external_account_id text not null,
  name                text not null default '',
  -- Compte TradeVault où ses trades sont journalisés. NULL = pas encore
  -- choisi : la synchro n'écrit rien pour ce compte tant que le trader n'a
  -- pas décidé où ses trades vont.
  account_id          uuid references public.accounts(id) on delete set null,
  enabled             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (connection_id, external_account_id)
);

create index if not exists broker_accounts_user_idx on public.broker_accounts (user_id);

alter table public.broker_accounts enable row level security;
grant select, insert, update, delete on public.broker_accounts to authenticated;
grant all on public.broker_accounts to service_role;

drop policy if exists "broker_accounts_select_own" on public.broker_accounts;
create policy "broker_accounts_select_own" on public.broker_accounts
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "broker_accounts_insert_own" on public.broker_accounts;
create policy "broker_accounts_insert_own" on public.broker_accounts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "broker_accounts_update_own" on public.broker_accounts;
create policy "broker_accounts_update_own" on public.broker_accounts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "broker_accounts_delete_own" on public.broker_accounts;
create policy "broker_accounts_delete_own" on public.broker_accounts
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists broker_accounts_set_updated_at on public.broker_accounts;
create trigger broker_accounts_set_updated_at
  before update on public.broker_accounts
  for each row execute function public.set_updated_at();

-- ── 3. Colonnes d'exécution sur `trades` ────────────────────────────────────
-- Toutes NULLables : une saisie manuelle n'en porte aucune.
alter table public.trades add column if not exists quantity       numeric;
alter table public.trades add column if not exists entry_price    numeric;
alter table public.trades add column if not exists exit_price     numeric;
alter table public.trades add column if not exists fees           numeric(12, 2);
alter table public.trades add column if not exists broker         text;
alter table public.trades add column if not exists external_id    text;
alter table public.trades add column if not exists broker_account text;
-- Importé et pas encore relu : le formulaire du trade s'ouvre de lui-même.
alter table public.trades add column if not exists review_pending boolean not null default false;
-- Trade dont celui-ci est la copie (transfert entre comptes). Pas de clé
-- étrangère : supprimer l'original ne doit pas emporter la copie.
alter table public.trades add column if not exists copied_from    text;

create unique index if not exists trades_user_external_uidx
  on public.trades (user_id, external_id);
create index if not exists trades_review_pending_idx
  on public.trades (user_id) where review_pending;
create index if not exists trades_copied_from_idx
  on public.trades (account_id, copied_from) where copied_from is not null;

-- ── 4. Le recalibrage convertit aussi les frais, et devient une offre Pro ──
-- Les frais sont de l'argent, déjà déduits du P&L : ils suivent l'échelle
-- comme lui (`CONVERTED_FIELDS`, `app/trading/accountCalibration.ts`). Les
-- prix et la quantité sont des faits de marché : jamais convertis.
--
-- Le recalibrage est réservé au palier Pro, et c'est vérifié ICI comme les
-- limites de trades et de comptes : le navigateur parle directement à
-- PostgREST, un contrôle d'interface seul se contourne. Une exception : le
-- RETOUR au capital d'origine reste ouvert à tous — un compte recalibré du
-- temps de l'abonnement ne doit pas rester prisonnier de son échelle.
create or replace function public.recalibrate_account(
  p_account_id       uuid,
  p_factor           numeric,
  p_cutoff           timestamptz,
  p_target_balance   numeric,
  p_original_balance numeric,
  p_cumulative       numeric
) returns integer
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  n integer;
begin
  if p_factor is null or p_factor <= 0 then
    raise exception 'calibration factor must be > 0';
  end if;
  if p_account_id is null or p_cutoff is null then
    raise exception 'account and cutoff are required';
  end if;
  if p_factor = 1 then
    return 0;
  end if;
  if p_target_balance <> p_original_balance
     and public.effective_tier(auth.uid()) not in ('pro', 'elite') then
    raise exception 'PLAN_LIMIT_PRO: account recalibration requires the Pro plan'
      using errcode = 'check_violation';
  end if;

  update public.trades set
    pnl                = round(pnl * p_factor, 2),
    risk_amount        = round(risk_amount * p_factor, 2),
    mae                = case when mae is null then null else round(mae * p_factor, 2) end,
    mfe                = case when mfe is null then null else round(mfe * p_factor, 2) end,
    slippage           = case when slippage is null then null else round(slippage * p_factor, 2) end,
    fees               = case when fees is null then null else round(fees * p_factor, 2) end,
    calibration_factor = calibration_factor * p_factor
  where account_id = p_account_id
    and user_id = auth.uid()
    and created_at < p_cutoff;

  get diagnostics n = row_count;

  update public.accounts set
    starting_balance  = p_target_balance,
    calibration_scale = p_cumulative,
    original_balance  = p_original_balance,
    calibrated_at     = p_cutoff
  where id = p_account_id
    and user_id = auth.uid();

  return n;
end
$$;

-- Realtime : un trade importé par le cron arrive à l'écran ouvert sans
-- rechargement (la table `trades` est déjà publiée, voir
-- `20260826120000_enable_realtime_sync.sql`).
