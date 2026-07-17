-- ============ TRADING PLAN + MULTI-GOAL ACTION PLANS ============

-- Written trading plan (mission, markets, risk, setups, limits, routine).
-- One jsonb blob per user; shape owned by src/tradevault/utils/tradingPlan.ts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trading_plan jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Goals 2.0: several customizable goals at once + a derived 6-month action
-- plan. Only the raw goals and the task-done flags are stored — milestones
-- and monthly tasks are recomputed deterministically client-side
-- (src/tradevault/utils/goalPlan.ts), so progress never goes stale.
create table if not exists public.goal_plans (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  goals          jsonb not null default '[]'::jsonb,
  tasks_done     jsonb not null default '{}'::jsonb,
  started_at     date not null default current_date,
  horizon_months int  not null default 6,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.goal_plans enable row level security;

create policy "goal_plans_select_own"
  on public.goal_plans for select using (auth.uid() = user_id);
create policy "goal_plans_insert_own"
  on public.goal_plans for insert with check (auth.uid() = user_id);
create policy "goal_plans_update_own"
  on public.goal_plans for update using (auth.uid() = user_id);
create policy "goal_plans_delete_own"
  on public.goal_plans for delete using (auth.uid() = user_id);
