-- Ce test passe AVANT broker_sync : transférer ne dépend pas du broker.
begin;
insert into auth.users (id,email) values
  ('a7000000-0000-4000-8000-000000000001','transfer-free@test.dev'),
  ('a7000000-0000-4000-8000-000000000002','transfer-pro@test.dev');
insert into public.subscriptions (user_id,plan,status,source) values
  ('a7000000-0000-4000-8000-000000000001','free','active','signup'),
  ('a7000000-0000-4000-8000-000000000002','pro_monthly','active','stripe');
do $$ begin
  assert exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='trades' and column_name='copied_from');
  begin
    insert into public.trades (user_id,trade_date,copied_from)
      values ('a7000000-0000-4000-8000-000000000001','2026-10-16','source');
    raise exception 'ASSERT: la copie gratuite doit être refusée';
  exception when check_violation then
    if sqlerrm not like 'PLAN_LIMIT_PRO%' then raise; end if;
  end;
end $$;
insert into public.trades (id,user_id,trade_date,copied_from,pnl,account_id) values
  ('transfer-copy','a7000000-0000-4000-8000-000000000002','2026-10-16','source',120,'a7000000-0000-4000-8000-000000000003');
update public.subscriptions set plan='free' where user_id='a7000000-0000-4000-8000-000000000002';
-- Un abonnement expiré ne rend pas les copies existantes impossibles à éditer.
insert into public.trades (id,user_id,trade_date,copied_from,pnl) values
  ('transfer-copy','a7000000-0000-4000-8000-000000000002','2026-10-16','source',130)
  on conflict (id) do update set pnl=excluded.pnl;
do $$ begin
  assert (select pnl from public.trades where id='transfer-copy') = 130;
  assert (select account_id from public.trades where id='transfer-copy') = 'a7000000-0000-4000-8000-000000000003';
  assert not has_function_privilege('anon','public.enforce_copy_pro()','execute');
  assert not (select prosecdef from pg_proc where oid='public.enforce_copy_pro()'::regprocedure);
end $$;
rollback;
