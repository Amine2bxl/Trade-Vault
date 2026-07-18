-- ============ AI RATE LIMITING ============
-- Per-user, fixed-window quota for the expensive AI endpoints. The window is
-- bucketed server-side; each call increments the current bucket atomically and
-- the SQL function reports whether the caller is still within the limit.
-- 100% additive: new objects only, no existing table/data touched.

create table if not exists public.ai_rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (user_id, window_start)
);

alter table public.ai_rate_limits enable row level security;
-- No user policies: the SECURITY DEFINER function below is the only writer.

create index if not exists ai_rate_limits_window_idx on public.ai_rate_limits (window_start);

-- Atomically consumes one unit of quota for the calling user and returns
-- whether the call is allowed (running count within p_limit for the window).
-- SECURITY DEFINER so it can write the RLS-locked table; auth.uid() scopes it
-- to the caller, so a user can only ever spend their own quota.
create or replace function public.consume_ai_quota(p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  -- No authenticated user → not this function's job to gate; allow.
  if auth.uid() is null then
    return true;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.ai_rate_limits (user_id, window_start, count)
  values (auth.uid(), v_window, 1)
  on conflict (user_id, window_start)
  do update set count = public.ai_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Only signed-in users may call it; never anon or the public role.
revoke all on function public.consume_ai_quota(int, int) from public;
grant execute on function public.consume_ai_quota(int, int) to authenticated;

-- ============ WEBHOOK IDEMPOTENCY ============
-- Dedupe guard for signed payment webhooks. Providers (Stripe, Coinbase
-- Commerce) retry deliveries, so a valid event can arrive more than once; the
-- (provider, event_id) primary key makes re-processing a no-op.
create table if not exists public.processed_webhook_events (
  provider     text not null,
  event_id     text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.processed_webhook_events enable row level security;
-- Written only by the webhook handlers via the service role (bypasses RLS);
-- no user-facing policies at all.
