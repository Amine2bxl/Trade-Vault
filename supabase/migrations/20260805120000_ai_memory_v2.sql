-- ============================================================================
-- ai_memory V2 — les fondations durables de la mémoire de Jarvis
-- ============================================================================
-- 100% ADDITIVE : aucune colonne existante n'est modifiée ni supprimée, aucune
-- ligne n'est réécrite. Les souvenirs déjà présents restent valides — ils
-- reçoivent simplement des valeurs par défaut cohérentes.
--
-- POURQUOI CETTE MIGRATION
-- La table V1 (id, user_id, kind, content, created_at) ne permettait ni de
-- mettre à jour un souvenir (donc doublons garantis), ni de le hiérarchiser,
-- ni de le remettre en question. Un `remember()` répété créait N lignes
-- identiques, et rien ne permettait à Jarvis de dire « je croyais X, tes
-- données montrent le contraire ».

-- ── 1. Identité stable d'un souvenir ────────────────────────────────────────
-- `key` est l'identifiant SÉMANTIQUE : deux souvenirs qui parlent de la même
-- chose partagent la même clé et se remplacent au lieu de s'empiler. C'est ce
-- qui rend le dé-doublonnage STRUCTUREL plutôt que dépendant d'une
-- comparaison de texte, toujours fragile.
alter table public.ai_memory
  add column if not exists key text;

-- ── 2. Hiérarchie ───────────────────────────────────────────────────────────
-- Tous les souvenirs ne se valent pas : « s'est engagé à stopper après une
-- perte » pèse plus que « a demandé un bilan ». Sans hiérarchie, le sélecteur
-- ne peut arbitrer qu'à la récence, ce qui fait remonter le bavardage récent
-- devant l'engagement structurant.
alter table public.ai_memory
  add column if not exists importance smallint not null default 3
    check (importance between 1 and 5);

-- ── 3. Confiance — la capacité de se corriger ───────────────────────────────
-- Une croyance sur un trader peut devenir FAUSSE : il corrige un défaut, il
-- change de marché. `confidence` permet à un souvenir de perdre son autorité
-- sans être détruit — condition nécessaire pour que Jarvis puisse un jour
-- dire « je croyais X, tes données montrent le contraire ».
-- 0.6 au départ : crédible, pas certain.
alter table public.ai_memory
  add column if not exists confidence real not null default 0.6
    check (confidence >= 0 and confidence <= 1);

-- ── 4. Traçabilité ──────────────────────────────────────────────────────────
-- D'où vient ce que Jarvis croit savoir ? Un fait déduit par un détecteur
-- déterministe et une phrase extraite d'une conversation par un LLM n'ont pas
-- la même fiabilité et ne se corrigent pas de la même façon. Sans la source,
-- impossible de purger sélectivement une extraction devenue suspecte.
alter table public.ai_memory
  add column if not exists source text not null default 'unknown'
    check (source in ('onboarding','rule_accepted','conversation','detector','unknown'));

-- ── 5. « Appris quand » ≠ « confirmé quand » ────────────────────────────────
-- `created_at` date la naissance du souvenir ; `updated_at` sa dernière
-- confirmation. La distinction est indispensable à l'oubli intelligent : un
-- souvenir ancien mais reconfirmé hier est vivant, un souvenir jamais revu
-- depuis six mois est un candidat à l'oubli.
alter table public.ai_memory
  add column if not exists updated_at timestamptz not null default now();

-- Réutilise la fonction `set_updated_at()` déjà présente dans le schéma
-- (cf. 20260801000004) — aucun second mécanisme n'est introduit.
drop trigger if exists ai_memory_set_updated_at on public.ai_memory;
create trigger ai_memory_set_updated_at
  before update on public.ai_memory
  for each row execute function public.set_updated_at();

-- ── 6. Nouvelles catégories ─────────────────────────────────────────────────
-- `decision` : ce que le trader s'est ENGAGÉ à faire (règle acceptée). C'est le
--   signal le plus fort du produit — un engagement, pas une observation.
-- `preference` : ses goûts durables (setups, marchés) quand ils ne viennent pas
--   de l'onboarding.
alter table public.ai_memory
  drop constraint if exists ai_memory_kind_check;
alter table public.ai_memory
  add constraint ai_memory_kind_check
  check (kind in ('profile','fact','lesson','conversation','preference','decision'));

-- ── 7. Dé-doublonnage STRUCTUREL ────────────────────────────────────────────
-- La garantie « jamais deux souvenirs identiques » est portée par la BASE, pas
-- par du code applicatif qu'on peut oublier d'appeler. Partiel (`where key is
-- not null`) pour rester compatible avec les lignes V1 qui n'ont pas de clé.
create unique index if not exists ai_memory_user_kind_key_uidx
  on public.ai_memory (user_id, kind, key)
  where key is not null;

-- Lecture par pertinence : le sélecteur trie par importance puis fraîcheur.
create index if not exists ai_memory_user_importance_idx
  on public.ai_memory (user_id, importance desc, updated_at desc);
