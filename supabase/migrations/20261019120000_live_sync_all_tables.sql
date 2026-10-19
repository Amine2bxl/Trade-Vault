-- Synchronisation live multi-appareils — palier 1.
--
-- Un même compte ouvert sur le téléphone et sur l'ordinateur ne doit former
-- qu'un seul état : ce qui change sur l'un apparaît sur l'autre sans
-- rafraîchir. Le client s'abonne à TOUTES les tables du compte par un canal
-- unique (`src/app/store/liveSync.ts`) ; encore faut-il que Postgres les
-- diffuse. Jusqu'ici, seules `trades`, `missed_opportunities` et `profiles`
-- l'étaient (`20260826120000_enable_realtime_sync.sql`) : une règle, une
-- notification lue, un objectif ou un compte modifiés ailleurs n'arrivaient
-- qu'au rechargement suivant.
--
-- Les tables ajoutées sont exactement celles qu'un écran monté affiche.
-- `trading_sessions` et `simulation_scenarios` n'en font pas partie : aucune
-- surface montée ne les montre, Jarvis les lit à la demande.
--
-- REPLICA IDENTITY FULL : sans elle, l'événement DELETE ne porte que la clé
-- primaire, le filtre `user_id=eq.…` ne peut pas être évalué et la
-- suppression n'atteint jamais les autres appareils.
--
-- La sécurité ne change pas : Realtime applique la RLS des tables, chacun ne
-- reçoit que ses propres lignes.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

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

    execute format('alter table public.%I replica identity full', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Une alerte n'existe qu'une fois, quel que soit le nombre d'appareils ────
--
-- Chaque appareil ouvert évalue les règles de notification. Le journal local
-- (`tv.notif.*`) ne voit que son navigateur, et la lecture des clés déjà en
-- base (`loadRecentDedupKeys`) laisse une fenêtre : deux appareils qui
-- évaluent à la même seconde écrivent chacun leur exemplaire. La garantie
-- passe donc dans la base : `(user_id, dedup_key)` est unique, et le client
-- insère avec `on conflict do nothing`.
--
-- L'index n'est PAS partiel : PostgREST ne sait pas transmettre le prédicat
-- d'un index partiel à `on conflict`. Il n'en a pas besoin : les `NULL` sont
-- distincts entre eux, donc les notifications sans clé ne se gênent pas.
--
-- Aucune ligne existante n'est remplie : elles restent à `NULL`, ce qui
-- garantit que la création de l'index ne peut pas échouer sur un doublon
-- historique.

alter table public.notifications add column if not exists dedup_key text;

create unique index if not exists notifications_user_dedup_key
  on public.notifications (user_id, dedup_key);
