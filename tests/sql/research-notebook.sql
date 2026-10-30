-- Research Notebook (lot 2) — `20261030160000_research_notebook.sql`.
--
-- En rôle `authenticated` (RLS active) :
--   • isolation A/B (lecture, insertion pour autrui, sur le compte d'autrui,
--     résultat attaché à la note d'autrui) ;
--   • le protocole d'une note est IMMUABLE (hypothèse, holdout, graine,
--     méthode, empreinte), même pour son auteur ; statut et note libre évoluent ;
--   • les résultats s'ajoutent, ne se réécrivent pas.

grant select on public.accounts to authenticated;

insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-0000000000a1', 'notebook-a@test.local'),
  ('e0000000-0000-4000-8000-0000000000b1', 'notebook-b@test.local');
insert into public.accounts (id, user_id) values
  ('e0000000-0000-4000-8000-00000000aa01', 'e0000000-0000-4000-8000-0000000000a1');

begin;
set local role authenticated;
\o /dev/null
select set_config('tv.uid', 'e0000000-0000-4000-8000-0000000000a1', true);
\o
insert into public.research_notes
  (id, account_id, hypothesis, dimension, cell_key, holdout_start, method_version, seed, data_snapshot)
values
  ('e0000000-0000-4000-8000-0000000e0001', 'e0000000-0000-4000-8000-00000000aa01',
   'ORB garde une espérance positive hors échantillon', 'strategy', 'ORB', '2026-09-01', 1, 42,
   '{"trainTrades":120,"lastTrainDay":"2026-08-31","hash":"abc"}');
insert into public.research_note_results (note_id, result)
values ('e0000000-0000-4000-8000-0000000e0001', '{"holdout":"confirmed","n":24}');
commit;

-- 1. B ne voit ni la note ni ses résultats ; il n'y attache rien.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'e0000000-0000-4000-8000-0000000000b1', true);
  select count(*) into n from public.research_notes;
  if n <> 0 then raise exception 'ASSERT: B sees % notes of A', n; end if;
  select count(*) into n from public.research_note_results;
  if n <> 0 then raise exception 'ASSERT: B sees % results of A', n; end if;
  begin
    insert into public.research_note_results (note_id, result)
    values ('e0000000-0000-4000-8000-0000000e0001', '{"forged":true}');
    raise exception 'ASSERT: B attached a result to a note of A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.research_notes
      (account_id, hypothesis, dimension, cell_key, holdout_start, method_version, seed, data_snapshot)
    values ('e0000000-0000-4000-8000-00000000aa01', 'x', 'strategy', 'ORB', '2026-09-01', 1, 1, '{}');
    raise exception 'ASSERT: B wrote a note on an account of A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 2. Le protocole est figé, même pour A ; statut et note libre évoluent.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'e0000000-0000-4000-8000-0000000000a1', true);
  begin
    update public.research_notes set hypothesis = 'réécrite après coup'
     where id = 'e0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: the hypothesis was rewritten';
  exception when check_violation then null;
  end;
  begin
    update public.research_notes set holdout_start = '2026-10-01'
     where id = 'e0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: the holdout start was moved';
  exception when check_violation then null;
  end;
  begin
    update public.research_notes set seed = 7 where id = 'e0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: the seed was changed';
  exception when check_violation then null;
  end;
  update public.research_notes set archived = true, note = 'holdout trop court'
   where id = 'e0000000-0000-4000-8000-0000000e0001';
  select count(*) into n from public.research_notes where archived and note is not null;
  if n <> 1 then raise exception 'ASSERT: status and free note should be editable'; end if;
end $$;

-- 3. Un résultat ne se réécrit pas.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'e0000000-0000-4000-8000-0000000000a1', true);
  begin
    update public.research_note_results set result = '{"holdout":"not_confirmed"}';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'ASSERT: a result was rewritten'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'RESEARCH NOTEBOOK OK — isolation, protocole figé, résultats ajoutés'
