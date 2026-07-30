-- Add missing FOREIGN KEY on trades.user_id → profiles(id).
-- All other user-owned tables already reference auth.users(id) with CASCADE.
-- Chain: auth.users → profiles(id) → trades(user_id)

alter table public.trades
  add constraint trades_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
