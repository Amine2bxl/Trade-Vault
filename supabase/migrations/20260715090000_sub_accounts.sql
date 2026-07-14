-- ============ SUB-ACCOUNTS ============
-- A trader can hold several isolated accounts (Prop, Personal, Demo, Live…).
-- Each has its own starting balance and its own trades/stats. Existing data
-- is migrated into one default "Personal" account per user.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Personal',
  type text not null default 'personal',          -- personal | prop | demo | live
  starting_balance numeric not null default 25000,
  currency text not null default 'USD',
  color text not null default '#22d3ee',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;

alter table public.accounts enable row level security;

create policy "own accounts read"   on public.accounts for select to authenticated using (auth.uid() = user_id);
create policy "own accounts insert" on public.accounts for insert to authenticated with check (auth.uid() = user_id);
create policy "own accounts update" on public.accounts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own accounts delete" on public.accounts for delete to authenticated using (auth.uid() = user_id);

create index if not exists accounts_user_idx on public.accounts (user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- Link trades + missed opportunities to an account.
alter table public.trades               add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.missed_opportunities add column if not exists account_id uuid references public.accounts(id) on delete cascade;
create index if not exists trades_account_idx on public.trades (account_id);
create index if not exists missed_account_idx on public.missed_opportunities (account_id);

-- Remember the active account per user (cross-device).
alter table public.profiles add column if not exists active_account_id uuid references public.accounts(id) on delete set null;

-- ── Backfill: one default account per existing user, seeded from their profile ──
insert into public.accounts (user_id, name, type, starting_balance, is_default)
select p.id, 'Personal', 'personal', coalesce(p.starting_balance, 25000), true
from public.profiles p
where not exists (select 1 from public.accounts a where a.user_id = p.id);

update public.trades t
set account_id = a.id
from public.accounts a
where a.user_id = t.user_id and a.is_default and t.account_id is null;

update public.missed_opportunities m
set account_id = a.id
from public.accounts a
where a.user_id = m.user_id and a.is_default and m.account_id is null;

update public.profiles p
set active_account_id = a.id
from public.accounts a
where a.user_id = p.id and a.is_default and p.active_account_id is null;

-- ── New signups: auto-create their default account alongside the profile ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, type, is_default)
  values (new.id, 'Personal', 'personal', true)
  returning id into new_account_id;

  update public.profiles set active_account_id = new_account_id where id = new.id;

  return new;
end;
$$;
