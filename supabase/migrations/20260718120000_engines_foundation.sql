-- ============ ENGINES FOUNDATION ============
-- Additive migration backing the 5 engines (AI Core, Analysis, Discipline,
-- Automation, Notifications). No existing table is altered destructively;
-- every table is user-scoped with owner-only RLS, mirroring the patterns of
-- earlier migrations.

-- ── Notifications (Notification Engine persistence / dashboard inbox) ──────
create table if not exists public.notifications (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  url        text,
  severity   text not null default 'info' check (severity in ('info','success','warning','error')),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert_own" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications for delete using (auth.uid() = user_id);

-- ── AI long-term memory (AI Core) ──────────────────────────────────────────
-- kind: profile | fact | lesson | conversation. Content is plain text today;
-- an embedding column can be added later without reshaping the table.
create table if not exists public.ai_memory (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('profile','fact','lesson','conversation')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_memory_user_kind_idx
  on public.ai_memory (user_id, kind, created_at desc);

alter table public.ai_memory enable row level security;
create policy "ai_memory_select_own" on public.ai_memory for select using (auth.uid() = user_id);
create policy "ai_memory_insert_own" on public.ai_memory for insert with check (auth.uid() = user_id);
create policy "ai_memory_update_own" on public.ai_memory for update using (auth.uid() = user_id);
create policy "ai_memory_delete_own" on public.ai_memory for delete using (auth.uid() = user_id);

-- ── AI reports (daily briefs, weekly reviews, analyses) ────────────────────
-- period_key examples: '2026-07-18' (daily), '2026-W29' (weekly).
create table if not exists public.ai_reports (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('daily_brief','weekly_review','trade_analysis','pattern_scan')),
  period_key text not null,
  content    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind, period_key)
);
create index if not exists ai_reports_user_kind_idx
  on public.ai_reports (user_id, kind, created_at desc);

alter table public.ai_reports enable row level security;
create policy "ai_reports_select_own" on public.ai_reports for select using (auth.uid() = user_id);
create policy "ai_reports_insert_own" on public.ai_reports for insert with check (auth.uid() = user_id);
create policy "ai_reports_update_own" on public.ai_reports for update using (auth.uid() = user_id);
create policy "ai_reports_delete_own" on public.ai_reports for delete using (auth.uid() = user_id);

-- ── User preferences (one JSONB row per user — future-proof settings) ──────
create table if not exists public.user_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
create policy "user_preferences_select_own" on public.user_preferences for select using (auth.uid() = user_id);
create policy "user_preferences_insert_own" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "user_preferences_update_own" on public.user_preferences for update using (auth.uid() = user_id);
create policy "user_preferences_delete_own" on public.user_preferences for delete using (auth.uid() = user_id);

-- ── Habits (tracked behaviors the Discipline/AI engines reinforce) ─────────
create table if not exists public.habits (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  cadence    text not null default 'daily' check (cadence in ('daily','weekly')),
  streak     integer not null default 0,
  last_done  date,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id, created_at desc);

alter table public.habits enable row level security;
create policy "habits_select_own" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits for update using (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits for delete using (auth.uid() = user_id);
