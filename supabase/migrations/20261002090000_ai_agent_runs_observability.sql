-- Observabilité de Jarvis (LOT 2) — ADDITIF uniquement.
--
-- Une ligne par question restait muette sur l'essentiel : quel niveau de
-- difficulté, quel modèle pour quel niveau, quels outils, combien d'appels,
-- combien de tokens de réflexion, quel coût, et si les chiffres de la réponse
-- ont été vérifiés. Ces colonnes le disent. Toujours AUCUN contenu : ni la
-- question, ni la réponse, ni le raisonnement — uniquement des métadonnées.
--
-- `latency_ms` mesure désormais la durée réelle vécue par le trader (de la
-- question à la réponse), et `input_tokens` / `output_tokens` la SOMME de tous
-- les appels de la question (et non plus le seul dernier).

alter table public.ai_agent_runs
  add column if not exists tier smallint,
  add column if not exists slot text,
  add column if not exists route jsonb,
  add column if not exists tools text[],
  add column if not exists tool_calls int,
  add column if not exists prefetch jsonb,
  add column if not exists model_calls int,
  add column if not exists thinking_tokens int,
  add column if not exists cached_input_tokens int,
  add column if not exists cost_usd numeric(12, 6),
  add column if not exists validation text,
  add column if not exists unsupported_figures int,
  add column if not exists context_chars int;

-- Les vues de diagnostic lisent par niveau sur sept jours.
create index if not exists ai_agent_runs_tier_idx
  on public.ai_agent_runs (tier, created_at desc);
