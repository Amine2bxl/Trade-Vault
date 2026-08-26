-- Synchronisation temps réel multi-appareils.
--
-- Le client s'abonne déjà aux changements (`useRealtimeTrades`,
-- `useRealtimeTable`, `useRealtimeProfile`), mais Postgres n'émettait rien :
-- sans publication, un canal Realtime reste silencieux pour toujours — d'où
-- des appareils qui ne se mettaient à jour qu'au rafraîchissement.
--
-- REPLICA IDENTITY FULL est indispensable : sans elle, l'événement DELETE ne
-- porte que la clé primaire, donc le filtre `user_id=eq.…` ne peut pas être
-- évalué et la suppression n'arrive jamais aux autres appareils.
--
-- La sécurité ne change pas : Realtime applique les mêmes politiques RLS que
-- les lectures normales, chacun ne reçoit donc que ses propres lignes.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['trades', 'missed_opportunities', 'profiles']
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
