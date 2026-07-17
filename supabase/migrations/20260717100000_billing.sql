-- ============ BILLING ============
-- One row per user. The app reads this to gate Pro features; only the
-- server (service role, via Stripe/crypto webhooks + signup trigger)
-- writes it. Trial starts at signup — Stripe checkout aligns its own
-- trial_end to `trial_ends_at` so the card is never charged early.

create table public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  plan               text not null default 'free'
                     check (plan in ('free', 'pro_monthly', 'pro_yearly')),
  status             text not null default 'trialing'
                     check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  source             text not null default 'trial'
                     check (source in ('trial', 'stripe', 'crypto')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  crypto_charge_id       text,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Users see their own subscription; all writes go through the service role,
-- which bypasses RLS — so no insert/update/delete policies for users.
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);
create index subscriptions_trial_ends_idx on public.subscriptions (trial_ends_at) where status = 'trialing';

-- ============ LIFECYCLE EMAIL LOG ============
-- Dedupe guard: each lifecycle email (welcome / trial_ending / winback)
-- is sent at most once per user.
create table public.email_log (
  user_id   uuid not null references auth.users(id) on delete cascade,
  email_key text not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, email_key)
);

alter table public.email_log enable row level security;
-- Service-role only — no user policies at all.

-- ============ TRIAL AT SIGNUP ============
-- Every new user starts a 14-day Pro trial. Piggybacks on the same
-- auth.users trigger moment as handle_new_user, kept separate so profile
-- logic and billing logic evolve independently.
create or replace function public.handle_new_user_billing()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan, status, source, trial_ends_at)
  values (new.id, 'pro_monthly', 'trialing', 'trial', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_billing
  after insert on auth.users
  for each row execute procedure public.handle_new_user_billing();

-- Backfill existing users: expired trial window, free plan.
insert into public.subscriptions (user_id, plan, status, source, trial_ends_at)
select id, 'pro_monthly', 'trialing', 'trial', created_at + interval '14 days'
from auth.users
on conflict (user_id) do nothing;
