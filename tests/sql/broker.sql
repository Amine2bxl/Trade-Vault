-- Synchro broker et recalibrage Pro — `20261008120000_broker_sync.sql`.
--
-- Ce qui est vérifié ici, et nulle part ailleurs :
--   • recalibrer est une offre Pro, refusée PAR LA BASE à un compte gratuit
--     (le navigateur parle directement à PostgREST : un contrôle d'interface
--     seul se contournerait) ;
--   • le retour au capital d'origine reste ouvert à tous ;
--   • les frais suivent l'échelle comme le P&L ;
--   • aucune colonne d'identifiant ou de mot de passe broker n'existe ;
--   • `(user_id, external_id)` empêche un trade importé deux fois ;
--   • copier un trade vers un autre compte est une offre Pro, vérifiée par
--     la base.
--
-- Chaque bloc lève une exception à la première divergence : `psql` s'arrête
-- (ON_ERROR_STOP) et le runner sort en erreur.

insert into auth.users (id, email) values
  ('b0000000-0000-4000-8000-0000000000f1', 'broker-free@test.local'),
  ('b0000000-0000-4000-8000-0000000000f2', 'broker-pro@test.local');
insert into public.subscriptions (user_id, plan, status, source) values
  ('b0000000-0000-4000-8000-0000000000f1', 'free', 'active', 'signup'),
  ('b0000000-0000-4000-8000-0000000000f2', 'pro_monthly', 'active', 'stripe');
insert into public.accounts (id, user_id, starting_balance, original_balance) values
  ('b0000000-0000-4000-8000-00000000a001', 'b0000000-0000-4000-8000-0000000000f1', 25000, 25000),
  ('b0000000-0000-4000-8000-00000000a002', 'b0000000-0000-4000-8000-0000000000f2', 25000, 25000);
insert into public.trades (user_id, account_id, trade_date, pnl, risk_amount, fees, created_at) values
  ('b0000000-0000-4000-8000-0000000000f1', 'b0000000-0000-4000-8000-00000000a001', '2026-10-01', 100, 50, 2.5, now() - interval '1 day'),
  ('b0000000-0000-4000-8000-0000000000f2', 'b0000000-0000-4000-8000-00000000a002', '2026-10-01', 100, 50, 2.5, now() - interval '1 day');

-- 1. Gratuit : recalibrer vers 50K est refusé (PLAN_LIMIT_PRO).
do $$
begin
  perform set_config('tv.uid', 'b0000000-0000-4000-8000-0000000000f1', true);
  begin
    perform public.recalibrate_account('b0000000-0000-4000-8000-00000000a001', 2, now(), 50000, 25000, 2);
    raise exception 'ASSERT: free recalibration should have been refused';
  exception when check_violation then
    if sqlerrm not like 'PLAN_LIMIT_PRO%' then raise; end if;
  end;
end $$;

-- 2. Pro : recalibrer convertit P&L, risque ET frais.
do $$
declare n int; t record;
begin
  perform set_config('tv.uid', 'b0000000-0000-4000-8000-0000000000f2', true);
  n := public.recalibrate_account('b0000000-0000-4000-8000-00000000a002', 2, now(), 50000, 25000, 2);
  if n <> 1 then raise exception 'ASSERT: expected 1 converted, got %', n; end if;
  select pnl, risk_amount, fees into t from public.trades where account_id = 'b0000000-0000-4000-8000-00000000a002';
  if t.pnl <> 200 or t.risk_amount <> 100 or t.fees <> 5 then
    raise exception 'ASSERT: bad conversion % % %', t.pnl, t.risk_amount, t.fees;
  end if;
end $$;

-- 3. Gratuit : le RETOUR au capital d'origine reste permis (abonnement échu).
update public.accounts set starting_balance = 50000, calibration_scale = 2 where id = 'b0000000-0000-4000-8000-00000000a001';
do $$
declare n int;
begin
  perform set_config('tv.uid', 'b0000000-0000-4000-8000-0000000000f1', true);
  n := public.recalibrate_account('b0000000-0000-4000-8000-00000000a001', 0.5, now(), 25000, 25000, 1);
  if n <> 1 then raise exception 'ASSERT: reset should convert 1 trade, got %', n; end if;
end $$;

-- 4. Aucune colonne de mot de passe ni d'identifiant broker.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'broker_connections'
             and column_name in ('secret_ciphertext', 'auth_mode', 'password', 'username')) then
    raise exception 'ASSERT: credential columns must not exist';
  end if;
end $$;

-- 5. Déduplication (user_id, external_id).
insert into public.trades (user_id, trade_date, external_id) values ('b0000000-0000-4000-8000-0000000000f2', '2026-10-02', 'tradovate:900:1');
insert into public.trades (user_id, trade_date, external_id) values ('b0000000-0000-4000-8000-0000000000f2', '2026-10-02', 'tradovate:900:1')
  on conflict (user_id, external_id) do nothing;
do $$ begin
  if (select count(*) from public.trades where external_id = 'tradovate:900:1') <> 1 then raise exception 'ASSERT: dedup'; end if;
end $$;

-- 6. Copier un trade vers un autre compte est une offre Pro, refusée par la
--    base à un compte gratuit ; un compte Pro copie normalement.
do $$
begin
  begin
    insert into public.trades (user_id, trade_date, copied_from)
      values ('b0000000-0000-4000-8000-0000000000f1', '2026-10-03', 'source-trade');
    raise exception 'ASSERT: free copy should have been refused';
  exception when check_violation then
    if sqlerrm not like 'PLAN_LIMIT_PRO%' then raise; end if;
  end;
  insert into public.trades (user_id, trade_date, copied_from)
    values ('b0000000-0000-4000-8000-0000000000f2', '2026-10-03', 'source-trade');
  -- Un trade gratuit SANS copie passe toujours.
  insert into public.trades (user_id, trade_date)
    values ('b0000000-0000-4000-8000-0000000000f1', '2026-10-03');
end $$;

-- 7. Les colonnes OAuth existent : retour exact, jeton de renouvellement
--    chiffré, hôtes d'API par compte.
do $$
begin
  if (select count(*) from information_schema.columns where table_name = 'broker_connections'
      and column_name in ('oauth_redirect_uri', 'refresh_token_ciphertext', 'api_hosts')) <> 3 then
    raise exception 'ASSERT: OAuth columns missing';
  end if;
end $$;
