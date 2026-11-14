-- HISTORIQUE DE MARCHÉ VÉRIFIÉ — la saisonnalité des actifs (page Saisonnalité).
--
-- Additif. Données de MARCHÉ, pas d'utilisateur : lecture publique (comme
-- `economic_events`), écriture réservée au rôle de service (cron
-- `/api/cron/market-history`). Aucune politique d'écriture : la RLS refuse
-- toute écriture qui ne vient pas du service.

-- Une clôture de fin de mois par actif. `month` = premier jour du mois.
create table if not exists public.market_monthly_closes (
  symbol      text        not null,
  month       date        not null,
  close       numeric     not null check (close > 0),
  source      text        not null check (source in ('yahoo', 'stooq', 'fred')),
  updated_at  timestamptz not null default now(),
  primary key (symbol, month)
);

alter table public.market_monthly_closes enable row level security;

create policy "market_monthly_closes_public_read"
  on public.market_monthly_closes for select to anon, authenticated
  using (true);

-- Une ligne par actif : d'où vient sa série et si une seconde source la
-- confirme. La page n'affiche jamais un chiffre sans sa provenance.
create table if not exists public.market_history_assets (
  symbol      text        primary key,
  name        text        not null,
  category    text        not null check (category in ('indices', 'forex', 'commodities', 'crypto')),
  source      text        not null check (source in ('yahoo', 'stooq', 'fred')),
  witness     text        check (witness in ('yahoo', 'stooq', 'fred')),
  verified    boolean     not null default false,
  months      integer     not null default 0,
  last_month  date,
  updated_at  timestamptz not null default now()
);

alter table public.market_history_assets enable row level security;

create policy "market_history_assets_public_read"
  on public.market_history_assets for select to anon, authenticated
  using (true);

-- L'état de la synchro (une seule ligne), comme `economic_calendar_sync`.
create table if not exists public.market_history_sync (
  id                   boolean     primary key default true check (id),
  last_attempt_at      timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  consecutive_failures integer     not null default 0
);

alter table public.market_history_sync enable row level security;

create policy "market_history_sync_public_read"
  on public.market_history_sync for select to anon, authenticated
  using (true);

insert into public.market_history_sync (id) values (true)
  on conflict (id) do nothing;
