-- Add missing FOREIGN KEY on trades.user_id → profiles(id).
-- All other user-owned tables already reference auth.users(id) with CASCADE.
-- Chain: auth.users → profiles(id) → trades(user_id)
--
-- IDEMPOTENT : `add constraint` n'accepte pas `if not exists`, et une preview
-- rejoue TOUTE la chaîne depuis zéro. Sans ce garde, la migration échoue dès
-- que la contrainte existe déjà — c'est exactement ce qui a mis la branche en
-- MIGRATIONS_FAILED et rendu les previews indisponibles.

alter table public.trades drop constraint if exists trades_user_id_fkey;
alter table public.trades
  add constraint trades_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
