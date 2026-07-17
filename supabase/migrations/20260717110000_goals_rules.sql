-- ============ ONBOARDING PROFILING + TRADING RULES + 6-MONTH GOALS ============

-- Q3 of the onboarding profile step: realistic monthly performance target (%).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_monthly_target numeric;

-- User-authored trading rules, checked on every trade save (anti-bias push).
-- Array of {id, kind, value?, text, enabled} objects; the shape is owned by
-- src/tradevault/utils/tradingRules.ts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trading_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============ 6-MONTH GOAL (automated roadmap) ============
-- One active goal per user. The monthly milestones are derived client-side
-- from (kind, start_value, target_value, started_at) — only the user's raw
-- goal is stored, so recomputing progress never needs a write.
create table public.six_month_goals (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('profit_factor', 'max_drawdown', 'capital')),
  start_value  numeric not null,
  target_value numeric not null,
  started_at   date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.six_month_goals enable row level security;

create policy "six_month_goals_select_own"
  on public.six_month_goals for select using (auth.uid() = user_id);
create policy "six_month_goals_insert_own"
  on public.six_month_goals for insert with check (auth.uid() = user_id);
create policy "six_month_goals_update_own"
  on public.six_month_goals for update using (auth.uid() = user_id);
create policy "six_month_goals_delete_own"
  on public.six_month_goals for delete using (auth.uid() = user_id);
