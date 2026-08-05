-- Add missing updated_at triggers on goals, goal_plans and habits.
-- The set_updated_at() function already exists from the initial migration.

drop trigger if exists six_month_goals_set_updated_at on public.six_month_goals;
create trigger six_month_goals_set_updated_at
  before update on public.six_month_goals
  for each row execute function public.set_updated_at();

drop trigger if exists goal_plans_set_updated_at on public.goal_plans;
create trigger goal_plans_set_updated_at
  before update on public.goal_plans
  for each row execute function public.set_updated_at();

-- habits is missing both the column and the trigger
alter table public.habits
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();
