-- ════════════════════════════════════════════════════════════════════════════
-- RESEARCH NOTEBOOK (lot 2) — une hypothèse se fige AVANT d'être confrontée.
--
-- Une note de recherche enregistre une hypothèse (une valeur d'une dimension
-- d'EdgeLab), la date à partir de laquelle commence son holdout, la version de
-- la méthode, la graine et l'empreinte des données au moment de l'écrire. Ces
-- champs sont IMMUABLES : réécrire l'hypothèse après avoir vu le résultat
-- serait exactement la sélection opportuniste que le protocole interdit. Seuls
-- le statut (archivée) et une note libre évoluent ; chaque évaluation est
-- AJOUTÉE (`research_note_results`), jamais réécrite.
--
-- Additive : deux tables nouvelles, aucune colonne existante touchée.
-- ROLLBACK : supprimer `research_note_results`, `research_notes` et la
-- fonction `research_note_frozen`.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.research_notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id      uuid references public.accounts(id) on delete cascade,
  hypothesis      text not null check (length(hypothesis) between 1 and 1000),
  dimension       text not null
                    check (dimension in ('strategy', 'symbol', 'session', 'weekday', 'account')),
  cell_key        text not null check (length(cell_key) between 1 and 200),
  -- Premier jour de séance du holdout : rien avant n'est jugé hors échantillon.
  holdout_start   date not null,
  method_version  integer not null check (method_version > 0),
  seed            bigint not null check (seed >= 0),
  -- Empreinte des trades d'apprentissage au moment de l'écriture.
  data_snapshot   jsonb not null check (pg_column_size(data_snapshot) <= 4096),
  note            text check (note is null or length(note) <= 2000),
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists research_notes_user_idx on public.research_notes (user_id, created_at desc);

-- Les champs du protocole ne changent plus une fois écrits.
create or replace function public.research_note_frozen()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.account_id is distinct from old.account_id
     or new.hypothesis is distinct from old.hypothesis
     or new.dimension is distinct from old.dimension
     or new.cell_key is distinct from old.cell_key
     or new.holdout_start is distinct from old.holdout_start
     or new.method_version is distinct from old.method_version
     or new.seed is distinct from old.seed
     or new.data_snapshot is distinct from old.data_snapshot
     or new.created_at is distinct from old.created_at then
    raise exception 'RESEARCH_NOTE_FROZEN: the protocol of a research note cannot be rewritten'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists research_notes_frozen on public.research_notes;
create trigger research_notes_frozen
  before update on public.research_notes
  for each row execute function public.research_note_frozen();

alter table public.research_notes enable row level security;
grant select, insert, update, delete on public.research_notes to authenticated;
grant all on public.research_notes to service_role;

drop policy if exists "research_notes_select_own" on public.research_notes;
create policy "research_notes_select_own" on public.research_notes
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_notes_insert_own" on public.research_notes;
create policy "research_notes_insert_own" on public.research_notes
  for insert to authenticated
  with check (auth.uid() = user_id and public.owns_account(account_id));
drop policy if exists "research_notes_update_own" on public.research_notes;
create policy "research_notes_update_own" on public.research_notes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_notes_delete_own" on public.research_notes;
create policy "research_notes_delete_own" on public.research_notes
  for delete to authenticated using (auth.uid() = user_id);

-- Les évaluations successives : ajoutées, jamais réécrites.
create table if not exists public.research_note_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id     uuid not null references public.research_notes(id) on delete cascade,
  result      jsonb not null check (pg_column_size(result) <= 8192),
  created_at  timestamptz not null default now()
);

create index if not exists research_note_results_note_idx
  on public.research_note_results (note_id, created_at desc);

alter table public.research_note_results enable row level security;
grant select, insert on public.research_note_results to authenticated;
grant all on public.research_note_results to service_role;

drop policy if exists "research_note_results_select_own" on public.research_note_results;
create policy "research_note_results_select_own" on public.research_note_results
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_note_results_insert_own" on public.research_note_results;
create policy "research_note_results_insert_own" on public.research_note_results
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.research_notes n where n.id = note_id and n.user_id = auth.uid())
  );
