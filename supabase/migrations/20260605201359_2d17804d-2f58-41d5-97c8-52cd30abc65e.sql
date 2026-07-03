-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  account_balance numeric not null default 25000,
  confluences text[] not null default array[
    'Support/Resistance','Trend line','Fibonacci','VWAP',
    'EMA alignment','Volume confirmation','Market structure','Order block',
    'Supply/Demand zone','Liquidity sweep','Divergence','Break of structure'
  ],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ============ TRADES ============
create table public.trades (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid(),
  trade_date date not null,
  symbol text not null,
  direction text not null default 'long',
  pnl numeric not null default 0,
  risk_amount numeric not null default 0,
  r_multiple numeric not null default 0,
  strategy text not null default 'Other',
  mistakes text[] not null default '{}',
  setup_quality int not null default 3,
  notes text not null default '',
  screenshots text[] not null default '{}',
  entry_time text not null default '',
  exit_time text not null default '',
  confluences text[] not null default '{}',
  confidence int not null default 70,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.trades to authenticated;
grant all on public.trades to service_role;

alter table public.trades enable row level security;

create policy "Users can view their own trades"
  on public.trades for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own trades"
  on public.trades for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own trades"
  on public.trades for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own trades"
  on public.trades for delete to authenticated
  using (auth.uid() = user_id);

create index trades_user_id_idx on public.trades (user_id);
create index trades_user_date_idx on public.trades (user_id, trade_date desc);

-- ============ updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ============ Auto-create profile on signup ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();