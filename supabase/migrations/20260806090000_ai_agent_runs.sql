-- ============================================================================
-- ai_agent_runs — télémétrie des appels IA
-- ============================================================================
-- Pourquoi cette table
-- -------------------
-- Aujourd'hui, RIEN n'est mesurable dans la couche IA. `runtime/metrics.ts`
-- garde des compteurs EN MÉMOIRE, donc perdus à chaque cold start serverless :
-- impossible de savoir combien coûte Jarvis, s'il ralentit, à quelle fréquence
-- le fallback déterministe est servi, ou si un changement de prompt a amélioré
-- quoi que ce soit. Toutes les décisions produit sur l'IA sont donc prises à
-- l'intuition.
--
-- Périmètre DÉLIBÉRÉMENT restreint
-- --------------------------------
-- La migration en attente `_pending_ai_os_foundation.sql` crée aussi
-- `ai_embeddings` (pgvector) et `ai_jobs`. Elles ne sont PAS reprises ici :
--   - pgvector n'est pas justifié tant que la sélection lexicale de la mémoire
--     n'a pas montré ses limites, et un index ivfflat(lists=100) est de toute
--     façon mal calibré sur un petit corpus ;
--   - `ai_jobs` n'a aucun consommateur.
-- On ne crée que ce qui a un writer et un lecteur dès aujourd'hui.

create table if not exists public.ai_agent_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  agent          text not null,
  intent         text not null default 'coach',
  provider       text,
  model          text,
  status         text not null check (status in ('ok', 'error', 'fallback')),
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  -- Jamais le prompt ni la réponse : uniquement de quoi diagnostiquer. Cette
  -- table sera lue par un écran de diagnostic, elle ne doit pas devenir une
  -- copie des conversations du trader.
  error          text,
  created_at     timestamptz not null default now()
);

alter table public.ai_agent_runs enable row level security;

-- Lecture par le propriétaire uniquement — même contrat que le reste du schéma.
drop policy if exists "ai_agent_runs_select_own" on public.ai_agent_runs;
create policy "ai_agent_runs_select_own"
  on public.ai_agent_runs for select to authenticated
  using (auth.uid() = user_id);

-- AUCUNE politique d'insertion : les écritures passent exclusivement par le
-- serveur (service role, qui contourne RLS). Un client ne doit pas pouvoir
-- fabriquer de fausses métriques — elles serviront à des décisions produit.

-- Lecture typique : « les N derniers appels de cet utilisateur ».
create index if not exists ai_agent_runs_user_idx
  on public.ai_agent_runs (user_id, created_at desc);

-- Lecture d'agrégat : « latence et coût par modèle sur la période ».
create index if not exists ai_agent_runs_model_idx
  on public.ai_agent_runs (model, created_at desc);
