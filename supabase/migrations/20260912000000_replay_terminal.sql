-- ============ TERMINAL DE REJEU HISTORIQUE ============
--
-- Une session de rejeu = une journée de cotation NQ sur un COMPTE DE REJEU
-- (compte TradeVault de type `replay`, isolé de Live/Prop/Demo). L'état complet
-- du rejeu — horloge simulée, ordres, positions, dessins, compte — tient dans
-- un unique JSONB : c'est ce qui rend la reprise littérale (« je m'arrête à
-- 10:37:14, je reviens, tout est là »).
--
-- La relation « Replay Account → Replay Session → Trade » :
--   `replay_sessions.account_id` rattache la session à son compte de rejeu ;
--   `trades.replay_session_id` rattache chaque trade journalier à la session
--   qui l'a produit. Les trades du rejeu atterrissent dans la table `trades`
--   avec le `account_id` du compte de rejeu : le journal, le calendrier, les
--   analyses et les rapports les lisent sans rien savoir du terminal.
--
-- Additif : aucune table ni colonne existante n'est modifiée dans son sens.

create table if not exists public.replay_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  symbol      text not null default 'NQ',
  start_date  date not null,
  start_time  text not null default '09:30',
  timeframe   text not null default '5m',
  status      text not null default 'active'
              check (status in ('setup', 'active', 'finished', 'abandoned')),
  -- L'état complet du rejeu (voir `modules/replay/session.ts`).
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists replay_sessions_owner_idx
  on public.replay_sessions (user_id, account_id, status, updated_at desc);

grant select, insert, update, delete on public.replay_sessions to authenticated;
grant all on public.replay_sessions to service_role;

alter table public.replay_sessions enable row level security;

create policy "replay_sessions_select_own"
  on public.replay_sessions for select to authenticated
  using (auth.uid() = user_id);

create policy "replay_sessions_insert_own"
  on public.replay_sessions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "replay_sessions_update_own"
  on public.replay_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "replay_sessions_delete_own"
  on public.replay_sessions for delete to authenticated
  using (auth.uid() = user_id);

-- La relation Session → Trade, et rien d'autre.
alter table public.trades
  add column if not exists replay_session_id uuid references public.replay_sessions(id) on delete set null;

create index if not exists trades_replay_session_idx on public.trades (replay_session_id);

comment on table public.replay_sessions is
  'Une session du terminal de rejeu : une journee NQ rejouee sur un compte de rejeu, avec son etat (horloge, ordres, positions, dessins) en JSONB.';
comment on column public.replay_sessions.state is
  'Etat complet serialise (modules/replay) : reprendre une session restaure exactement l''horloge, les ordres et les dessins.';
comment on column public.trades.replay_session_id is
  'Origine d''un trade du terminal de rejeu — conserve la relation Replay Session -> Trade pour l''analyse.';