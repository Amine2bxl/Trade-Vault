-- ============ DATA INTEGRITY (lot 1) — PROVENANCE, IMPORTS IDEMPOTENTS, TRÉSORERIE ============
--
-- Tout est ADDITIF et rejouable : `if not exists`, contraintes ajoutées une
-- seule fois, aucune donnée existante réécrite. Un trade antérieur garde des
-- colonnes de provenance NULL, qui veulent dire « inconnu » — jamais une
-- valeur devinée après coup.
--
-- Cinq blocs :
--   1. provenance sur `trades` : d'où vient le trade, d'où vient son risque,
--      dans quel fuseau ses heures ont été écrites, ses instants UTC quand ils
--      sont prouvés, et sa clé d'import (idempotence) ;
--   2. `import_batches` : un import = un lot, avec ce qu'il a accepté,
--      reconnu comme doublon, mis en quarantaine ou refusé ;
--   3. `raw_ingest_events` : la ligne BRUTE telle que reçue, insert-only ;
--      un même identifiant source avec un contenu différent devient un
--      CONFLIT décidé par la base, jamais un écrasement silencieux ;
--   4. `cash_ledger` : dépôts, retraits, frais hors trade, versements ;
--   5. `account_snapshots` : soldes observés à une date.
--
-- Les blocs 4 et 5 ne contiennent que ce qui est déclaré ou observé : le solde
-- avant un trade n'est reconstruit (domain/balanceAtEntry) que lorsqu'un
-- snapshot antérieur ET tous les mouvements intermédiaires sont présents.
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- Aucune colonne existante n'est modifiée. Revenir en arrière = supprimer les
-- nouveaux objets (index `trades_user_account_import_key_uidx`, contraintes
-- `trades_*_known`, colonnes ajoutées, tables `account_snapshots`,
-- `cash_ledger`, `raw_ingest_events`, `import_batches`, fonctions
-- `raw_ingest_*`, `owns_account`). L'application tolère leur absence (voir
-- `app/store/trades.ts`, repli sans colonnes de provenance).

-- ── 0. Appartenance d'un compte ─────────────────────────────────────────────
-- Les tables ci-dessous référencent `accounts(id)`. Une clé étrangère ne dit
-- pas À QUI appartient le compte : sans ce contrôle, un utilisateur pourrait
-- rattacher ses lignes au compte d'un autre. Les politiques l'exigent.
create or replace function public.owns_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_account_id is null
      or exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = auth.uid());
$$;

revoke all on function public.owns_account(uuid) from public, anon;
grant execute on function public.owns_account(uuid) to authenticated, service_role;

-- ── 1. Provenance sur `trades` ──────────────────────────────────────────────
alter table public.trades add column if not exists source          text;
alter table public.trades add column if not exists risk_source     text;
alter table public.trades add column if not exists source_timezone text;
alter table public.trades add column if not exists entry_at        timestamptz;
alter table public.trades add column if not exists exit_at         timestamptz;
alter table public.trades add column if not exists import_key      text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trades_source_known') then
    alter table public.trades add constraint trades_source_known
      check (source is null or source in ('manual', 'csv', 'broker', 'copy'));
  end if;
  -- `user` : saisi ou confirmé par le trader ; `csv` : colonne d'un fichier ;
  -- `broker_stop` : premier stop observé chez le broker ; `broker_default` :
  -- risque forfaitaire déclaré à la connexion, faute de stop — PAS une mesure.
  if not exists (select 1 from pg_constraint where conname = 'trades_risk_source_known') then
    alter table public.trades add constraint trades_risk_source_known
      check (risk_source is null or risk_source in ('user', 'csv', 'broker_stop', 'broker_default'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_instants_ordered') then
    alter table public.trades add constraint trades_instants_ordered
      check (entry_at is null or exit_at is null or exit_at >= entry_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_import_key_shape') then
    alter table public.trades add constraint trades_import_key_shape
      check (import_key is null or length(import_key) between 1 and 300);
  end if;
end $$;

-- Un index unique ORDINAIRE (pas partiel) : PostgREST ne sait pas cibler un
-- index partiel dans `on_conflict`. Les NULL étant distincts, les trades sans
-- clé (saisies manuelles, historique) ne sont pas concernés. La clé est
-- qualifiée PAR COMPTE : importer le même fichier dans deux comptes, ce sont
-- deux séries de faits indépendantes.
create unique index if not exists trades_user_account_import_key_uidx
  on public.trades (user_id, account_id, import_key);

-- ── 2. Lots d'import ────────────────────────────────────────────────────────
create table if not exists public.import_batches (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  source_kind         text not null check (source_kind in ('csv', 'broker')),
  file_name           text check (file_name is null or length(file_name) <= 255),
  file_sha256         text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  row_count           integer not null default 0 check (row_count >= 0),
  accepted            integer not null default 0 check (accepted >= 0),
  duplicates          integer not null default 0 check (duplicates >= 0),
  probable_duplicates integer not null default 0 check (probable_duplicates >= 0),
  conflicts           integer not null default 0 check (conflicts >= 0),
  rejected            integer not null default 0 check (rejected >= 0),
  failed              integer not null default 0 check (failed >= 0),
  status              text not null default 'planned' check (status in ('planned', 'completed', 'failed')),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists import_batches_user_idx on public.import_batches (user_id, created_at desc);

alter table public.import_batches enable row level security;
grant select, insert on public.import_batches to authenticated;
-- Seuls les compteurs et l'état se mettent à jour (fin d'import) : ni le
-- propriétaire, ni le compte, ni l'empreinte du fichier.
grant update (accepted, duplicates, probable_duplicates, conflicts, rejected, failed, status, completed_at)
  on public.import_batches to authenticated;
grant all on public.import_batches to service_role;

drop policy if exists "import_batches_select_own" on public.import_batches;
create policy "import_batches_select_own" on public.import_batches
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "import_batches_insert_own" on public.import_batches;
create policy "import_batches_insert_own" on public.import_batches
  for insert to authenticated with check (auth.uid() = user_id and public.owns_account(account_id));
drop policy if exists "import_batches_update_own" on public.import_batches;
create policy "import_batches_update_own" on public.import_batches
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3. Événements bruts, insert-only ────────────────────────────────────────
create table if not exists public.raw_ingest_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  batch_id       uuid references public.import_batches(id) on delete cascade,
  account_id     uuid references public.accounts(id) on delete set null,
  source_kind    text not null check (source_kind in ('csv', 'broker')),
  -- Identifiant QUALIFIÉ de la source : broker + environnement + compte +
  -- exécution, ou fichier + compte + occurrence (voir domain/importKey).
  source_key     text not null check (length(source_key) between 1 and 300),
  payload        jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status         text not null
                   check (status in ('accepted', 'duplicate', 'probable_duplicate', 'conflict', 'rejected')),
  diagnostic     text check (diagnostic is null or length(diagnostic) <= 500),
  -- Pas de clé étrangère : supprimer le trade ne supprime pas le fait reçu.
  trade_id       text,
  received_at    timestamptz not null default now(),
  check (pg_column_size(payload) <= 16384)
);

-- Un même fait (clé + contenu) ne s'enregistre qu'une fois : rejouer un import
-- ou une synchro n'ajoute rien.
create unique index if not exists raw_ingest_events_fact_uidx
  on public.raw_ingest_events (user_id, source_key, payload_sha256);
create index if not exists raw_ingest_events_batch_idx on public.raw_ingest_events (batch_id);
create index if not exists raw_ingest_events_conflict_idx
  on public.raw_ingest_events (user_id) where status = 'conflict';

-- LA BASE décide du conflit. Une clé déjà connue avec un AUTRE contenu est
-- mise en quarantaine quoi que dise l'appelant : un client modifié ne peut pas
-- faire passer une correction de broker pour un fait nouveau accepté.
create or replace function public.raw_ingest_classify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.raw_ingest_events e
    where e.user_id = new.user_id
      and e.source_key = new.source_key
      and e.payload_sha256 <> new.payload_sha256
  ) then
    new.status := 'conflict';
    new.trade_id := null;
    new.diagnostic := coalesce(new.diagnostic, 'same source key, different payload');
  end if;
  return new;
end;
$$;

revoke all on function public.raw_ingest_classify() from public, anon, authenticated;

drop trigger if exists raw_ingest_events_classify on public.raw_ingest_events;
create trigger raw_ingest_events_classify
  before insert on public.raw_ingest_events
  for each row execute function public.raw_ingest_classify();

-- Insert-only, y compris pour le service : un fait reçu ne se réécrit pas.
-- (Les suppressions en cascade — compte supprimé, lot supprimé — restent
-- possibles : aucun déclencheur DELETE, et aucune politique DELETE pour les
-- utilisateurs.)
create or replace function public.raw_ingest_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'RAW_INGEST_IMMUTABLE: raw ingest events are insert-only'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists raw_ingest_events_immutable on public.raw_ingest_events;
create trigger raw_ingest_events_immutable
  before update on public.raw_ingest_events
  for each row execute function public.raw_ingest_immutable();

alter table public.raw_ingest_events enable row level security;
grant select, insert on public.raw_ingest_events to authenticated;
grant all on public.raw_ingest_events to service_role;

drop policy if exists "raw_ingest_events_select_own" on public.raw_ingest_events;
create policy "raw_ingest_events_select_own" on public.raw_ingest_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "raw_ingest_events_insert_own" on public.raw_ingest_events;
create policy "raw_ingest_events_insert_own" on public.raw_ingest_events
  for insert to authenticated with check (
    auth.uid() = user_id
    and public.owns_account(account_id)
    and (batch_id is null
         or exists (select 1 from public.import_batches b where b.id = batch_id and b.user_id = auth.uid()))
  );

-- ── 4. Trésorerie (hors trades) ─────────────────────────────────────────────
-- Montant SIGNÉ dans la devise du compte : + entre sur le compte, − en sort.
-- Le signe est contraint par la nature du mouvement ; un ajustement peut
-- aller dans les deux sens mais doit être justifié (`evidence`).
create table if not exists public.cash_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  kind        text not null check (kind in ('deposit', 'withdrawal', 'fee', 'payout', 'adjustment')),
  amount      numeric(14, 2) not null check (amount <> 0),
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  source      text not null default 'user' check (source in ('user', 'broker', 'statement')),
  evidence    text check (evidence is null or length(evidence) <= 500),
  external_id text check (external_id is null or length(external_id) <= 200),
  created_at  timestamptz not null default now(),
  constraint cash_ledger_sign check (
    (kind = 'deposit' and amount > 0)
    or (kind in ('withdrawal', 'fee', 'payout') and amount < 0)
    or (kind = 'adjustment' and evidence is not null)
  )
);

create index if not exists cash_ledger_account_idx on public.cash_ledger (account_id, occurred_at);
create unique index if not exists cash_ledger_external_uidx
  on public.cash_ledger (user_id, account_id, source, external_id);

alter table public.cash_ledger enable row level security;
grant select, insert, update, delete on public.cash_ledger to authenticated;
grant all on public.cash_ledger to service_role;

-- Le trader gère SES déclarations ; une ligne venue du broker ou d'un relevé
-- est un fait observé, qu'il peut lire mais ni créer ni modifier lui-même.
drop policy if exists "cash_ledger_select_own" on public.cash_ledger;
create policy "cash_ledger_select_own" on public.cash_ledger
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "cash_ledger_insert_own" on public.cash_ledger;
create policy "cash_ledger_insert_own" on public.cash_ledger
  for insert to authenticated
  with check (auth.uid() = user_id and source = 'user' and public.owns_account(account_id));
drop policy if exists "cash_ledger_update_own" on public.cash_ledger;
create policy "cash_ledger_update_own" on public.cash_ledger
  for update to authenticated
  using (auth.uid() = user_id and source = 'user')
  with check (auth.uid() = user_id and source = 'user' and public.owns_account(account_id));
drop policy if exists "cash_ledger_delete_own" on public.cash_ledger;
create policy "cash_ledger_delete_own" on public.cash_ledger
  for delete to authenticated using (auth.uid() = user_id and source = 'user');

-- ── 5. Soldes observés ──────────────────────────────────────────────────────
create table if not exists public.account_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  balance     numeric(14, 2) not null,
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  observed_at timestamptz not null,
  source      text not null default 'user' check (source in ('user', 'broker', 'statement')),
  evidence    text check (evidence is null or length(evidence) <= 500),
  external_id text check (external_id is null or length(external_id) <= 200),
  created_at  timestamptz not null default now()
);

create index if not exists account_snapshots_account_idx on public.account_snapshots (account_id, observed_at);
create unique index if not exists account_snapshots_external_uidx
  on public.account_snapshots (user_id, account_id, source, external_id);

alter table public.account_snapshots enable row level security;
grant select, insert, update, delete on public.account_snapshots to authenticated;
grant all on public.account_snapshots to service_role;

drop policy if exists "account_snapshots_select_own" on public.account_snapshots;
create policy "account_snapshots_select_own" on public.account_snapshots
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "account_snapshots_insert_own" on public.account_snapshots;
create policy "account_snapshots_insert_own" on public.account_snapshots
  for insert to authenticated
  with check (auth.uid() = user_id and source = 'user' and public.owns_account(account_id));
drop policy if exists "account_snapshots_update_own" on public.account_snapshots;
create policy "account_snapshots_update_own" on public.account_snapshots
  for update to authenticated
  using (auth.uid() = user_id and source = 'user')
  with check (auth.uid() = user_id and source = 'user' and public.owns_account(account_id));
drop policy if exists "account_snapshots_delete_own" on public.account_snapshots;
create policy "account_snapshots_delete_own" on public.account_snapshots
  for delete to authenticated using (auth.uid() = user_id and source = 'user');
