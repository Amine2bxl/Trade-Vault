-- Synchro live multi-appareils — `20261019120000_live_sync_all_tables.sql`.
--
-- Ce qui est vérifié ici :
--   • chaque table du compte présente dans la base est publiée pour Realtime,
--     avec `replica identity full` (sans elle, une suppression ne porte que la
--     clé primaire : le filtre `user_id=eq.…` ne s'évalue pas et l'autre
--     appareil ne l'apprend jamais) ;
--   • une même alerte, émise deux fois (deux appareils à la même seconde), ne
--     crée qu'UNE ligne ;
--   • les notifications sans clé ne se gênent pas entre elles, et la même clé
--     reste libre pour un autre compte.
--
-- Chaque bloc lève une exception à la première divergence.

insert into auth.users (id, email) values
  ('c0000000-0000-4000-8000-0000000000a1', 'live-a@test.local'),
  ('c0000000-0000-4000-8000-0000000000a2', 'live-b@test.local');

-- 1. Publication : toutes les tables du compte présentes ici sont publiées,
--    en replica identity full.
do $$
declare
  t text;
  ri "char";
begin
  foreach t in array array[
    'trades', 'missed_opportunities', 'profiles', 'accounts', 'goal_plans',
    'notifications', 'user_preferences', 'agent_proposals', 'ai_memory',
    'broker_connections', 'broker_accounts', 'monthly_reports', 'trade_intent',
    'trade_reflection', 'subscriptions'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      raise exception 'ASSERT: % absente de supabase_realtime', t;
    end if;
    select relreplident into ri from pg_class where oid = ('public.' || t)::regclass;
    if ri <> 'f' then
      raise exception 'ASSERT: % sans replica identity full (%)', t, ri;
    end if;
  end loop;
end $$;

-- 2. Même compte, même clé : la seconde insertion n'ajoute rien.
do $$
declare n int;
begin
  insert into public.notifications (id, user_id, kind, title, body, dedup_key)
  values (gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'risk', 't', 'b',
          '2026-10-19:risk_leak:x')
  on conflict (user_id, dedup_key) do nothing;
  insert into public.notifications (id, user_id, kind, title, body, dedup_key)
  values (gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'risk', 't', 'b',
          '2026-10-19:risk_leak:x')
  on conflict (user_id, dedup_key) do nothing;
  select count(*) into n from public.notifications
  where user_id = 'c0000000-0000-4000-8000-0000000000a1' and dedup_key = '2026-10-19:risk_leak:x';
  if n <> 1 then raise exception 'ASSERT: doublon créé (% lignes)', n; end if;
end $$;

-- 3. Sans clé : aucune contrainte entre elles.
do $$
declare n int;
begin
  insert into public.notifications (id, user_id, kind, title, body)
  select gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a1', 'info', 't', 'b'
  from generate_series(1, 3);
  select count(*) into n from public.notifications
  where user_id = 'c0000000-0000-4000-8000-0000000000a1' and dedup_key is null;
  if n <> 3 then raise exception 'ASSERT: % lignes sans clé, 3 attendues', n; end if;
end $$;

-- 4. La même clé pour un autre compte : deux lignes.
do $$
declare n int;
begin
  insert into public.notifications (id, user_id, kind, title, body, dedup_key)
  values (gen_random_uuid(), 'c0000000-0000-4000-8000-0000000000a2', 'risk', 't', 'b',
          '2026-10-19:risk_leak:x')
  on conflict (user_id, dedup_key) do nothing;
  select count(*) into n from public.notifications where dedup_key = '2026-10-19:risk_leak:x';
  if n <> 2 then raise exception 'ASSERT: % lignes pour deux comptes, 2 attendues', n; end if;
end $$;
