-- ============================================================================
-- ECONOMIC CALENDAR — cache serveur du calendrier macro (ADDITIF)
-- ============================================================================
-- Le calendrier est une donnée PUBLIQUE et non personnelle : aucune colonne
-- user_id, donc pas de politique owner-only ici. Le modèle de sécurité est
-- l'inverse du reste du schéma : lecture ouverte, écriture fermée.
--
--   * lecture  : anon + authenticated (la page Economic News est publique)
--   * écriture : personne — aucune policy insert/update/delete n'existe, donc
--                seul le service role (qui contourne RLS) peut écrire, et il
--                ne vit que dans le cron serveur.
--
-- La table est un CACHE, pas une source de vérité : elle peut être vidée et
-- reconstruite par le prochain cron sans perte fonctionnelle.

-- ── Événements ──────────────────────────────────────────────────────────────
create table if not exists public.economic_events (
  -- id déterministe (hash stable de la clé métier) : le cron ré-ingère la même
  -- semaine plusieurs fois par jour et doit METTRE À JOUR les lignes — c'est ce
  -- qui fait apparaître `actual` à la publication sans créer de doublon.
  id          text primary key,
  starts_at   timestamptz not null,
  currency    text not null,
  country     text not null,
  title       text not null,
  impact      text not null check (impact in ('high', 'medium', 'low', 'holiday')),
  -- Valeurs gardées en texte : les releases mélangent unités et suffixes
  -- ("3.2%", "215K", "-1.4B"). Les parser en numérique perdrait de
  -- l'information et n'apporterait rien — on ne fait aucun calcul dessus.
  previous    text,
  forecast    text,
  actual      text,
  -- Événement sans heure précise (« All Day », « Tentative » chez la source).
  all_day     boolean not null default false,
  source      text not null default 'forexfactory',
  updated_at  timestamptz not null default now()
);

alter table public.economic_events enable row level security;

create policy "economic_events_public_read"
  on public.economic_events for select to anon, authenticated
  using (true);

-- La requête de la page est toujours « une fenêtre de temps », éventuellement
-- filtrée ensuite côté client. Un seul index sur starts_at suffit et reste
-- pertinent quelle que soit la combinaison de filtres.
create index if not exists economic_events_starts_at_idx
  on public.economic_events (starts_at);

-- ── État de synchronisation ─────────────────────────────────────────────────
-- Une seule ligne (id = true). Sert au diagnostic et permet à l'UI d'afficher
-- la fraîcheur réelle de la donnée plutôt que de laisser croire au temps réel.
create table if not exists public.economic_calendar_sync (
  id                   boolean primary key default true check (id),
  last_attempt_at      timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  consecutive_failures integer not null default 0,
  events_upserted      integer
);

alter table public.economic_calendar_sync enable row level security;

create policy "economic_calendar_sync_public_read"
  on public.economic_calendar_sync for select to anon, authenticated
  using (true);

insert into public.economic_calendar_sync (id) values (true)
  on conflict (id) do nothing;
