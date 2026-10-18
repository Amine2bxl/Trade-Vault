-- Historique du calendrier économique : quelles semaines passées ont été
-- récupérées (pages hebdomadaires Forex Factory), pour ne jamais redemander
-- une semaine déjà connue et espacer les nouveaux essais après un échec.
-- Écrite et lue par le seul service role : aucune policy, RLS active.
create table if not exists public.economic_calendar_backfill (
  week_start date primary key,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false,
  attempts integer not null default 0,
  events integer not null default 0,
  last_error text
);

alter table public.economic_calendar_backfill enable row level security;

create index if not exists economic_calendar_backfill_attempted_idx
  on public.economic_calendar_backfill (attempted_at desc);
