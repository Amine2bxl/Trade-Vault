-- Intégrité des données (lot 1) — `20261028140000_data_integrity_provenance.sql`.
--
-- Vérifié ici, contre un vrai Postgres, en rôle `authenticated` (la RLS
-- s'applique, comme pour un client PostgREST) :
--   • isolation A/B : lecture, insertion pour autrui, insertion sur le compte
--     d'autrui, réaffectation du propriétaire ;
--   • les événements bruts sont insert-only, même pour le propriétaire ;
--   • rejouer le même fait n'ajoute rien ; même clé + autre contenu → conflit
--     décidé par la base, quoi que dise l'appelant ;
--   • la clé d'import d'un trade est unique PAR COMPTE ;
--   • le signe d'un mouvement de trésorerie suit sa nature ; une ligne
--     « broker » ou « relevé » ne se crée pas depuis le client.
--
-- Chaque bloc lève une exception à la première divergence.

-- Supabase accorde ces droits d'office ; un Postgres nu, non.
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant select on public.accounts to authenticated;
grant select, insert on public.trades to authenticated;

insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-0000000000a1', 'tenant-a@test.local'),
  ('d0000000-0000-4000-8000-0000000000b1', 'tenant-b@test.local');
-- Pro : deux comptes pour A (les quotas de l'offre gratuite ne sont pas l'objet ici).
insert into public.subscriptions (user_id, plan, status, source) values
  ('d0000000-0000-4000-8000-0000000000a1', 'pro_monthly', 'active', 'stripe'),
  ('d0000000-0000-4000-8000-0000000000b1', 'pro_monthly', 'active', 'stripe');
insert into public.accounts (id, user_id) values
  ('d0000000-0000-4000-8000-00000000aa01', 'd0000000-0000-4000-8000-0000000000a1'),
  ('d0000000-0000-4000-8000-00000000aa02', 'd0000000-0000-4000-8000-0000000000a1'),
  ('d0000000-0000-4000-8000-00000000bb01', 'd0000000-0000-4000-8000-0000000000b1');

-- Empreintes factices de 64 caractères hexadécimaux.
\set h1 '''1111111111111111111111111111111111111111111111111111111111111111'''
\set h2 '''2222222222222222222222222222222222222222222222222222222222222222'''

-- 1. A crée un lot et un événement brut sur SON compte.
begin;
set local role authenticated;
\o /dev/null
select set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
\o
insert into public.import_batches (id, account_id, source_kind, file_name, file_sha256, row_count)
values ('d0000000-0000-4000-8000-0000000b0001', 'd0000000-0000-4000-8000-00000000aa01', 'csv', 'a.csv', :h1, 2);
insert into public.raw_ingest_events (batch_id, account_id, source_kind, source_key, payload, payload_sha256, status)
values ('d0000000-0000-4000-8000-0000000b0001', 'd0000000-0000-4000-8000-00000000aa01', 'csv',
        'csv:aa01:row-1#0', '{"pnl":"125.50"}', :h1, 'accepted');
commit;

-- 2. B ne voit rien de A.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000b1', true);
  select count(*) into n from public.import_batches;
  if n <> 0 then raise exception 'ASSERT: tenant B sees % batches of tenant A', n; end if;
  select count(*) into n from public.raw_ingest_events;
  if n <> 0 then raise exception 'ASSERT: tenant B sees % raw events of tenant A', n; end if;
end $$;

-- 3. B ne peut ni écrire pour A, ni écrire sur le compte de A.
do $$
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000b1', true);
  begin
    insert into public.import_batches (user_id, source_kind) values ('d0000000-0000-4000-8000-0000000000a1', 'csv');
    raise exception 'ASSERT: B inserted a batch owned by A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.import_batches (account_id, source_kind) values ('d0000000-0000-4000-8000-00000000aa01', 'csv');
    raise exception 'ASSERT: B attached a batch to an account of A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cash_ledger (account_id, kind, amount, occurred_at)
    values ('d0000000-0000-4000-8000-00000000aa01', 'deposit', 1000, now());
    raise exception 'ASSERT: B wrote a cashflow on an account of A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.raw_ingest_events (batch_id, source_kind, source_key, payload, payload_sha256, status)
    values ('d0000000-0000-4000-8000-0000000b0001', 'csv', 'x', '{}', repeat('3', 64), 'accepted');
    raise exception 'ASSERT: B attached a raw event to a batch of A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. A ne peut pas céder son lot à B (réaffectation du propriétaire).
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
  begin
    update public.import_batches set user_id = 'd0000000-0000-4000-8000-0000000000b1'
    where id = 'd0000000-0000-4000-8000-0000000b0001';
    raise exception 'ASSERT: owner column of a batch is writable';
  exception when insufficient_privilege then null;
  end;
  -- Les compteurs, eux, se mettent à jour (fin d'import).
  update public.import_batches set accepted = 1, status = 'completed', completed_at = now()
  where id = 'd0000000-0000-4000-8000-0000000b0001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ASSERT: batch counters not updatable by owner'; end if;
end $$;

-- 5. Un événement brut ne se réécrit pas — même par son propriétaire, même
--    par le service.
do $$
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
  begin
    update public.raw_ingest_events set payload = '{"pnl":"0"}' where source_key = 'csv:aa01:row-1#0';
    raise exception 'ASSERT: raw event payload was rewritten by its owner';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
do $$
begin
  begin
    update public.raw_ingest_events set payload = '{"pnl":"0"}' where source_key = 'csv:aa01:row-1#0';
    raise exception 'ASSERT: raw event payload was rewritten by the service';
  exception when check_violation then
    if sqlerrm not like 'RAW_INGEST_IMMUTABLE%' then raise; end if;
  end;
end $$;
do $$
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
  begin
    delete from public.raw_ingest_events where source_key = 'csv:aa01:row-1#0';
    raise exception 'ASSERT: owner deleted a raw event';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 6. Rejouer le même fait n'ajoute rien ; un autre contenu sous la même clé
--    devient un CONFLIT, même si l'appelant le déclare « accepted ».
do $$
declare n int; s text; tid text;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
  begin
    insert into public.raw_ingest_events (account_id, source_kind, source_key, payload, payload_sha256, status)
    values ('d0000000-0000-4000-8000-00000000aa01', 'csv', 'csv:aa01:row-1#0', '{"pnl":"125.50"}',
            repeat('1', 64), 'accepted');
    raise exception 'ASSERT: the same fact was recorded twice';
  exception when unique_violation then null;
  end;
  insert into public.raw_ingest_events (account_id, source_kind, source_key, payload, payload_sha256, status, trade_id)
  values ('d0000000-0000-4000-8000-00000000aa01', 'csv', 'csv:aa01:row-1#0', '{"pnl":"999.00"}',
          repeat('2', 64), 'accepted', 'should-not-link');
  select status, trade_id into s, tid from public.raw_ingest_events
  where source_key = 'csv:aa01:row-1#0' and payload_sha256 = repeat('2', 64);
  if s <> 'conflict' then raise exception 'ASSERT: changed payload classified %, expected conflict', s; end if;
  if tid is not null then raise exception 'ASSERT: a conflict must not be linked to a trade'; end if;
  select count(*) into n from public.raw_ingest_events where source_key = 'csv:aa01:row-1#0';
  if n <> 2 then raise exception 'ASSERT: expected original + quarantined conflict, got %', n; end if;
end $$;

-- 7. La clé d'import d'un trade est unique PAR COMPTE.
do $$
begin
  insert into public.trades (user_id, account_id, trade_date, pnl, import_key)
  values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', '2026-10-21', 125.5, 'csv:k#0');
  begin
    insert into public.trades (user_id, account_id, trade_date, pnl, import_key)
    values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', '2026-10-21', 125.5, 'csv:k#0');
    raise exception 'ASSERT: the same import key was written twice in one account';
  exception when unique_violation then null;
  end;
  -- Même fichier, autre compte : deux faits indépendants.
  insert into public.trades (user_id, account_id, trade_date, pnl, import_key)
  values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa02', '2026-10-21', 125.5, 'csv:k#0');
  -- Deux occurrences légitimes du même contenu dans un fichier : #0 et #1.
  insert into public.trades (user_id, account_id, trade_date, pnl, import_key)
  values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', '2026-10-21', 125.5, 'csv:k#1');
  -- Les trades sans clé (saisie manuelle, historique) ne sont pas contraints.
  insert into public.trades (user_id, account_id, trade_date, pnl)
  values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', '2026-10-21', 125.5),
         ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', '2026-10-21', 125.5);
  -- Sans compte, NULL n'égale rien : l'index partiel refuse quand même le doublon.
  insert into public.trades (user_id, account_id, trade_date, pnl, import_key)
  values ('d0000000-0000-4000-8000-0000000000a1', null, '2026-10-21', 125.5, 'csv:k#0');
  begin
    insert into public.trades (user_id, account_id, trade_date, pnl, import_key)
    values ('d0000000-0000-4000-8000-0000000000a1', null, '2026-10-21', 125.5, 'csv:k#0');
    raise exception 'ASSERT: the same import key was written twice without an account';
  exception when unique_violation then null;
  end;
  -- Sans compte et sans clé : l'historique reste libre.
  insert into public.trades (user_id, account_id, trade_date, pnl)
  values ('d0000000-0000-4000-8000-0000000000a1', null, '2026-10-21', 125.5),
         ('d0000000-0000-4000-8000-0000000000a1', null, '2026-10-21', 125.5);
end $$;

-- 8. Provenance : valeurs connues seulement, instants ordonnés.
do $$
begin
  begin
    insert into public.trades (user_id, trade_date, risk_source) values ('d0000000-0000-4000-8000-0000000000a1', '2026-10-21', 'guess');
    raise exception 'ASSERT: unknown risk_source accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.trades (user_id, trade_date, entry_at, exit_at)
    values ('d0000000-0000-4000-8000-0000000000a1', '2026-10-21', '2026-10-21T14:00:00Z', '2026-10-21T13:00:00Z');
    raise exception 'ASSERT: exit before entry accepted';
  exception when check_violation then null;
  end;
end $$;

-- 9. Trésorerie : le signe suit la nature ; un fait « broker » ne se crée pas
--    depuis le client ; le trader gère ses déclarations.
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
  begin
    insert into public.cash_ledger (account_id, kind, amount, occurred_at)
    values ('d0000000-0000-4000-8000-00000000aa01', 'withdrawal', 500, now());
    raise exception 'ASSERT: a positive withdrawal was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.cash_ledger (account_id, kind, amount, occurred_at)
    values ('d0000000-0000-4000-8000-00000000aa01', 'adjustment', 50, now());
    raise exception 'ASSERT: an unjustified adjustment was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.cash_ledger (account_id, kind, amount, occurred_at, source)
    values ('d0000000-0000-4000-8000-00000000aa01', 'deposit', 500, now(), 'broker');
    raise exception 'ASSERT: a client created a broker cashflow';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.account_snapshots (account_id, balance, observed_at, source)
    values ('d0000000-0000-4000-8000-00000000aa01', 25000, now(), 'statement');
    raise exception 'ASSERT: a client created a statement snapshot';
  exception when insufficient_privilege then null;
  end;
  insert into public.cash_ledger (account_id, kind, amount, occurred_at)
  values ('d0000000-0000-4000-8000-00000000aa01', 'deposit', 500, now()),
         ('d0000000-0000-4000-8000-00000000aa01', 'withdrawal', -200, now());
  insert into public.account_snapshots (account_id, balance, observed_at)
  values ('d0000000-0000-4000-8000-00000000aa01', 25000, now() - interval '30 days');
  select count(*) into n from public.cash_ledger;
  if n <> 2 then raise exception 'ASSERT: expected 2 own cashflows, got %', n; end if;
end $$;

-- 10. Un mouvement observé (service) reste intouchable par le trader.
insert into public.cash_ledger (user_id, account_id, kind, amount, occurred_at, source, external_id)
values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', 'payout', -1000,
        now(), 'broker', 'tv-cash-1');
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000a1', true);
  update public.cash_ledger set amount = -1 where external_id = 'tv-cash-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERT: owner rewrote a broker cashflow'; end if;
  delete from public.cash_ledger where external_id = 'tv-cash-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERT: owner deleted a broker cashflow'; end if;
  -- … et B ne voit aucun mouvement de A.
  perform set_config('tv.uid', 'd0000000-0000-4000-8000-0000000000b1', true);
  select count(*) into n from public.cash_ledger;
  if n <> 0 then raise exception 'ASSERT: tenant B sees % cashflows of A', n; end if;
end $$;

-- 11. Le même mouvement broker ne s'enregistre qu'une fois.
do $$
begin
  insert into public.cash_ledger (user_id, account_id, kind, amount, occurred_at, source, external_id)
  values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000aa01', 'payout', -1000,
          now(), 'broker', 'tv-cash-1');
  raise exception 'ASSERT: the same broker cashflow was recorded twice';
exception when unique_violation then null;
end $$;

-- 12. Supprimer l'utilisateur emporte ses faits bruts (RGPD) malgré
--     l'immutabilité : aucun déclencheur DELETE ne bloque la cascade.
do $$
declare n int;
begin
  delete from auth.users where id = 'd0000000-0000-4000-8000-0000000000a1';
  select count(*) into n from public.raw_ingest_events;
  if n <> 0 then raise exception 'ASSERT: % raw events survived account deletion', n; end if;
  select count(*) into n from public.cash_ledger;
  if n <> 0 then raise exception 'ASSERT: % cashflows survived account deletion', n; end if;
end $$;

\echo 'DATA INTEGRITY OK — isolation, insert-only, rejeu, conflits, clés par compte, trésorerie'
