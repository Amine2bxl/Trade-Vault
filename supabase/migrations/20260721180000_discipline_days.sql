-- Discipline Score quotidien (Sprint 1 — US-1.3).
-- Un enregistrement par utilisateur et par jour actif : score v1 (checklist +
-- journal), horodatage de complétion de la checklist, complétude du journal.
-- Additif uniquement. RLS owner-only.

create table if not exists public.discipline_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  score integer not null check (score >= 0 and score <= 100),
  checklist_done_at timestamptz,
  journal_complete boolean not null default false,
  trade_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.discipline_days enable row level security;

create policy "discipline_days_select_own" on public.discipline_days
  for select using (auth.uid() = user_id);
create policy "discipline_days_insert_own" on public.discipline_days
  for insert with check (auth.uid() = user_id);
create policy "discipline_days_update_own" on public.discipline_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "discipline_days_delete_own" on public.discipline_days
  for delete using (auth.uid() = user_id);

create index if not exists discipline_days_user_date_idx
  on public.discipline_days (user_id, date desc);
