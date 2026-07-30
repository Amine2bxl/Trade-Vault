-- Add the monthly_reports table. It was missing from migrations despite
-- being used in production (store/reports.ts, monthly-reports.server.ts).

create table if not exists public.monthly_reports (
  id         uuid not null default gen_random_uuid() primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  month      text not null,
  report     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monthly_reports_user_month_idx
  on public.monthly_reports (user_id, month desc);

alter table public.monthly_reports enable row level security;

create policy "monthly_reports_select_own"
  on public.monthly_reports for select
  using (auth.uid() = user_id);

create policy "monthly_reports_insert_own"
  on public.monthly_reports for insert
  with check (auth.uid() = user_id);

create policy "monthly_reports_update_own"
  on public.monthly_reports for update
  using (auth.uid() = user_id);

create policy "monthly_reports_delete_own"
  on public.monthly_reports for delete
  using (auth.uid() = user_id);
