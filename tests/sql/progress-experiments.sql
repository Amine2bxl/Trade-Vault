-- Expériences de progression (lot 4) — `20261030200000_progress_experiments.sql`.
-- En rôle `authenticated` : isolation A/B, protocole figé, clôture définitive.

insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-0000000000a1', 'experiment-a@test.local'),
  ('f0000000-0000-4000-8000-0000000000b1', 'experiment-b@test.local');
insert into public.accounts (id, user_id) values
  ('f0000000-0000-4000-8000-00000000aa01', 'f0000000-0000-4000-8000-0000000000a1');

begin;
set local role authenticated;
\o /dev/null
select set_config('tv.uid', 'f0000000-0000-4000-8000-0000000000a1', true);
\o
insert into public.progress_experiments
  (id, account_id, rule, max_losses, target_sessions, start_day, version, seed)
values ('f0000000-0000-4000-8000-0000000e0001', 'f0000000-0000-4000-8000-00000000aa01',
        'stop_after_losses', 2, 20, '2026-11-02', 1, 42);
commit;

-- 1. B ne voit rien, n'écrit rien chez A.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'f0000000-0000-4000-8000-0000000000b1', true);
  select count(*) into n from public.progress_experiments;
  if n <> 0 then raise exception 'ASSERT: B sees % experiments of A', n; end if;
  begin
    insert into public.progress_experiments
      (account_id, rule, max_losses, target_sessions, start_day, version, seed)
    values ('f0000000-0000-4000-8000-00000000aa01', 'stop_after_losses', 2, 20, '2026-11-02', 1, 1);
    raise exception 'ASSERT: B wrote an experiment on an account of A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 2. Le protocole est figé ; l'abandon est permis, puis définitif.
do $$
begin
  set local role authenticated;
  perform set_config('tv.uid', 'f0000000-0000-4000-8000-0000000000a1', true);
  begin
    update public.progress_experiments set max_losses = 3
     where id = 'f0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: the rule threshold was rewritten';
  exception when check_violation then null;
  end;
  begin
    update public.progress_experiments set start_day = '2026-10-01'
     where id = 'f0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: the start day was moved into the past';
  exception when check_violation then null;
  end;
  update public.progress_experiments
     set status = 'abandoned', ended_at = now(), final_result = '{"complied":3,"violated":1}'
   where id = 'f0000000-0000-4000-8000-0000000e0001';
  begin
    update public.progress_experiments set status = 'active'
     where id = 'f0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: a closed experiment was reopened';
  exception when check_violation then null;
  end;
  begin
    update public.progress_experiments set final_result = '{"complied":9}'
     where id = 'f0000000-0000-4000-8000-0000000e0001';
    raise exception 'ASSERT: a final result was rewritten';
  exception when check_violation then null;
  end;
end $$;

\echo 'PROGRESS EXPERIMENTS OK — isolation, protocole figé, clôture définitive'
