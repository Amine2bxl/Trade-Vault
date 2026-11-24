-- CAPTURE — la file d'analyse des captures, des notes et des dictées.
--
-- Une ligne = un élément déposé par le trader (une ou plusieurs captures d'un
-- même trade, une note, une dictée) et ce que le moteur de capture en a tiré.
-- Elle sert à la fois :
--   • de CACHE : une capture inchangée (même empreinte `content_hash`) n'est
--     jamais réanalysée — la contrainte unique le garantit ;
--   • de FILE « À traiter » (Inbox) : pending → processing → completed |
--     failed, puis applied (distribuée à un trade ou un setup manqué) ou
--     dismissed ;
--   • d'HISTORIQUE : `original_extraction` est figée à la première analyse,
--     les corrections du trader vivent à part (`corrections`) — la valeur
--     d'origine n'est jamais réécrite.
--
-- Les fichiers restent dans le bucket existant `trade-screenshots` (aucun
-- second système de captures) : `screenshots` ne contient que leurs chemins.
-- Quand l'élément est appliqué, c'est le trade (ou le setup manqué) qui
-- devient propriétaire de ses chemins ; `trade_id` / `missed_id` gardent le
-- lien « capture → trade ».
--
-- Additif : une table neuve, RLS owner-only, aucune autre table modifiée.
-- Retour arrière : `drop table public.capture_items` (aucune autre table ne la lit).

create table if not exists public.capture_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  source              text not null check (source in ('image', 'note', 'voice')),
  target              text not null default 'trade' check (target in ('trade', 'missed')),
  status              text not null default 'pending'
                        check (status in ('pending', 'processing', 'completed', 'failed', 'applied', 'dismissed')),
  screenshots         text[] not null default '{}' check (cardinality(screenshots) <= 6),
  note                text check (note is null or char_length(note) <= 4000),
  content_hash        text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  extraction          jsonb check (extraction is null or pg_column_size(extraction) <= 32768),
  original_extraction jsonb check (original_extraction is null or pg_column_size(original_extraction) <= 32768),
  corrections         jsonb not null default '{}'::jsonb check (pg_column_size(corrections) <= 16384),
  model               text check (model is null or char_length(model) <= 120),
  error               text check (error is null or char_length(error) <= 500),
  attempts            smallint not null default 0 check (attempts between 0 and 50),
  trade_id            text references public.trades(id) on delete set null,
  missed_id           uuid references public.missed_opportunities(id) on delete set null,
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, content_hash)
);

create index if not exists capture_items_user_status_idx
  on public.capture_items (user_id, status, created_at desc);
create index if not exists capture_items_trade_idx
  on public.capture_items (trade_id) where trade_id is not null;

-- La première analyse est l'ORIGINAL : une fois posée, elle ne bouge plus.
create or replace function public.capture_item_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.original_extraction is not null
     and new.original_extraction is distinct from old.original_extraction then
    raise exception 'CAPTURE_ORIGINAL_FROZEN: the original extraction cannot be rewritten'
      using errcode = 'check_violation';
  end if;
  if new.user_id is distinct from old.user_id or new.content_hash is distinct from old.content_hash then
    raise exception 'CAPTURE_IDENTITY_FROZEN: owner and fingerprint cannot change'
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists capture_items_guard on public.capture_items;
create trigger capture_items_guard
  before update on public.capture_items
  for each row execute function public.capture_item_guard();

alter table public.capture_items enable row level security;
grant select, insert, update, delete on public.capture_items to authenticated;
grant all on public.capture_items to service_role;

-- Un lien vers un trade ou un setup manqué n'est accepté que vers SES lignes.
drop policy if exists "capture_items_select_own" on public.capture_items;
create policy "capture_items_select_own" on public.capture_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "capture_items_insert_own" on public.capture_items;
create policy "capture_items_insert_own" on public.capture_items
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.owns_account(account_id)
    and (trade_id is null or exists (
      select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()))
    and (missed_id is null or exists (
      select 1 from public.missed_opportunities m where m.id = missed_id and m.user_id = auth.uid()))
  );

drop policy if exists "capture_items_update_own" on public.capture_items;
create policy "capture_items_update_own" on public.capture_items
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_account(account_id)
    and (trade_id is null or exists (
      select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()))
    and (missed_id is null or exists (
      select 1 from public.missed_opportunities m where m.id = missed_id and m.user_id = auth.uid()))
  );

drop policy if exists "capture_items_delete_own" on public.capture_items;
create policy "capture_items_delete_own" on public.capture_items
  for delete to authenticated using (auth.uid() = user_id);
