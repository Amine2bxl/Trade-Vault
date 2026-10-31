-- Fonctions privilégiées (lot 5) — `20261030220000_restrict_cross_tenant_functions.sql`.
-- Un utilisateur connecté n'interroge que lui-même ; `anon` n'exécute rien ;
-- les déclencheurs de quota fonctionnent toujours ; le service garde l'accès.

grant usage on schema public to anon;
grant select, insert on public.trades to authenticated;

insert into auth.users (id, email) values
  ('c1000000-0000-4000-8000-0000000000a1', 'tenant-fn-a@test.local'),
  ('c1000000-0000-4000-8000-0000000000b1', 'tenant-fn-b@test.local');
insert into public.subscriptions (user_id, plan, status, source) values
  ('c1000000-0000-4000-8000-0000000000b1', 'pro_monthly', 'active', 'stripe');

-- 1. A lit SON palier, pas celui de B ; ni le nombre de trades de B.
do $$
declare v text; n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'c1000000-0000-4000-8000-0000000000a1', true);
  v := public.effective_tier('c1000000-0000-4000-8000-0000000000a1');
  if v <> 'free' then raise exception 'ASSERT: A should read its own tier, got %', v; end if;
  begin
    v := public.effective_tier('c1000000-0000-4000-8000-0000000000b1');
    raise exception 'ASSERT: A read the tier of B (%)', v;
  exception when insufficient_privilege then null;
  end;
  begin
    n := public.count_trades_in_month('c1000000-0000-4000-8000-0000000000b1', '2026-10');
    raise exception 'ASSERT: A counted the trades of B (%)', n;
  exception when insufficient_privilege then null;
  end;
end $$;

-- 2. Sans compte : rien.
do $$
declare v text;
begin
  set local role anon;
  perform set_config('tv.uid', '', true);
  begin
    v := public.effective_tier('c1000000-0000-4000-8000-0000000000b1');
    raise exception 'ASSERT: anon read a tier (%)', v;
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3. Le déclencheur de quota tourne toujours pour l'utilisateur lui-même.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'c1000000-0000-4000-8000-0000000000a1', true);
  insert into public.trades (user_id, trade_date, pnl)
  values ('c1000000-0000-4000-8000-0000000000a1', '2026-10-21', 10);
  n := public.count_trades_in_month('c1000000-0000-4000-8000-0000000000a1', '2026-10');
  if n <> 1 then raise exception 'ASSERT: expected 1 own trade, got %', n; end if;
  begin
    perform public.enforce_trade_quota();
    raise exception 'ASSERT: a quota trigger function was callable directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. Le service (aucun utilisateur) garde l'accès complet.
do $$
declare v text;
begin
  perform set_config('tv.uid', '', true);
  v := public.effective_tier('c1000000-0000-4000-8000-0000000000b1');
  if v <> 'pro' then raise exception 'ASSERT: service should read B tier, got %', v; end if;
end $$;

\echo 'TENANT FUNCTIONS OK — lecture limitée à soi, anon exclu, quotas intacts'
