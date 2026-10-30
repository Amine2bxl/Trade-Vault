-- ════════════════════════════════════════════════════════════════════════════
-- EXPÉRIENCES DE PROGRESSION (lot 4) — un protocole se fige AVANT d'être observé.
--
-- « Je teste une pause après N pertes pendant X séances » : la règle, N, le
-- nombre de séances, le premier jour et la version sont IMMUABLES. Le trader
-- peut abandonner une expérience (statut) ou la MODIFIER — ce qui en crée une
-- nouvelle version liée à la précédente (`supersedes`), sans réécrire
-- l'ancienne. Le résultat final s'écrit UNE fois, à la clôture ou à l'abandon.
--
-- Additive : une table nouvelle. ROLLBACK : supprimer `progress_experiments` et
-- la fonction `progress_experiment_frozen`.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.progress_experiments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id       uuid references public.accounts(id) on delete cascade,
  rule             text not null check (rule in ('stop_after_losses')),
  max_losses       integer not null check (max_losses between 1 and 5),
  target_sessions  integer not null check (target_sessions between 5 and 60),
  start_day        date not null,
  version          integer not null check (version > 0),
  seed             bigint not null check (seed >= 0),
  supersedes       uuid references public.progress_experiments(id) on delete set null,
  status           text not null default 'active'
                     check (status in ('active', 'completed', 'abandoned')),
  final_result     jsonb check (final_result is null or pg_column_size(final_result) <= 4096),
  created_at       timestamptz not null default now(),
  ended_at         timestamptz
);

create index if not exists progress_experiments_user_idx
  on public.progress_experiments (user_id, created_at desc);

create or replace function public.progress_experiment_frozen()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.account_id is distinct from old.account_id
     or new.rule is distinct from old.rule
     or new.max_losses is distinct from old.max_losses
     or new.target_sessions is distinct from old.target_sessions
     or new.start_day is distinct from old.start_day
     or new.version is distinct from old.version
     or new.seed is distinct from old.seed
     or new.supersedes is distinct from old.supersedes
     or new.created_at is distinct from old.created_at then
    raise exception 'PROGRESS_EXPERIMENT_FROZEN: the protocol of an experiment cannot be rewritten'
      using errcode = 'check_violation';
  end if;
  -- Une expérience close ne se rouvre pas, et son résultat ne se réécrit pas.
  if old.status <> 'active' and (new.status is distinct from old.status
                                 or new.final_result is distinct from old.final_result) then
    raise exception 'PROGRESS_EXPERIMENT_CLOSED: a closed experiment cannot change'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists progress_experiments_frozen on public.progress_experiments;
create trigger progress_experiments_frozen
  before update on public.progress_experiments
  for each row execute function public.progress_experiment_frozen();

alter table public.progress_experiments enable row level security;
grant select, insert, update, delete on public.progress_experiments to authenticated;
grant all on public.progress_experiments to service_role;

drop policy if exists "progress_experiments_select_own" on public.progress_experiments;
create policy "progress_experiments_select_own" on public.progress_experiments
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "progress_experiments_insert_own" on public.progress_experiments;
create policy "progress_experiments_insert_own" on public.progress_experiments
  for insert to authenticated
  with check (auth.uid() = user_id and public.owns_account(account_id));
drop policy if exists "progress_experiments_update_own" on public.progress_experiments;
create policy "progress_experiments_update_own" on public.progress_experiments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "progress_experiments_delete_own" on public.progress_experiments;
create policy "progress_experiments_delete_own" on public.progress_experiments
  for delete to authenticated using (auth.uid() = user_id);
