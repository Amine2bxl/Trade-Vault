-- ============ INTENTION & RÉFLEXION — Phase 0b ============
--
-- `docs/PHASE_0_INTELLIGENCE_FOUNDATION.md` §3.4/§3.5. Capture LÉGÈRE et
-- OPTIONNELLE : ce que le trader pensait AVANT d'entrer (intention), et ce
-- qu'il en conclut APRÈS (réflexion). C'est le prérequis de la calibration
-- (confidence vs résultat) et du « ce que je pensais vs ce qui s'est passé ».
--
-- ── POURQUOI DEUX TABLES SÉPARÉES ──────────────────────────────────────────
-- `trades` reste pur : il décrit CE QUI S'EST PASSÉ (résultat). L'intention et
-- la réflexion décrivent CE QUE PENSAIT le trader — deux vérités qui ne doivent
-- pas se mélanger, sinon on ne peut plus distinguer « j'ai mal exécuté un bon
-- plan » de « mon plan était mauvais ». Séparer rend l'historique auditable.
--
-- ── TOUT EST OPTIONNEL, RIEN N'EST BLOQUANT ────────────────────────────────
-- Aucune colonne obligatoire hors clés : un trader qui ne veut pas s'expliquer
-- enregistre son trade quand même. La capture doit tenir en 5 secondes (§7.5).
--
-- ── L'ÉMOTION REPREND LE VOCABULAIRE EXISTANT ──────────────────────────────
-- `emotion` reprend EXACTEMENT les six états de `src/app/utils/readiness.ts`
-- (`EMOTIONAL_STATES`). On ne recrée pas une seconde taxonomie émotionnelle :
-- un même mot partout, sinon deux mots pour le même état rendent toute
-- corrélation intraitable.

create table if not exists public.trade_intent (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- L'intention est reliée à son trade. `on delete cascade` : effacer un trade
  -- emporte son intention, qui n'a plus de sens sans lui. NOT NULL car, dans ce
  -- flux, le trade est toujours enregistré avant l'intention (l'upsert en dépend).
  trade_id     uuid not null references public.trades(id) on delete cascade,
  -- Snapshot du setup au moment de l'entrée (la stratégie du trade).
  setup        text,
  -- « Pourquoi j'entre » — court, libre.
  reasoning    text,
  -- Confiance déclarée 0-100, figée à l'entrée (peut diverger du trade édité).
  confidence   int check (confidence between 0 and 100),
  -- Risque PRÉVU en dollars, figé à l'entrée.
  planned_risk numeric(12,2),
  -- « Mon plan » — stop, cible, scénario d'invalidation.
  plan         text,
  -- État émotionnel, dans le vocabulaire de `readiness.ts`.
  emotion      text check (emotion in
                 ('calm','focused','tired','anxious','frustrated','overconfident')),
  created_at   timestamptz not null default now()
);

-- Une intention par trade : ré-enregistrer met à jour la même ligne.
create unique index if not exists trade_intent_one_per_trade
  on public.trade_intent (trade_id);

create index if not exists trade_intent_user_idx
  on public.trade_intent (user_id, created_at desc);

alter table public.trade_intent enable row level security;

grant select, insert, update, delete on public.trade_intent to authenticated;
grant all on public.trade_intent to service_role;

drop policy if exists "trade_intent_select_own" on public.trade_intent;
create policy "trade_intent_select_own"
  on public.trade_intent for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "trade_intent_insert_own" on public.trade_intent;
create policy "trade_intent_insert_own"
  on public.trade_intent for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "trade_intent_update_own" on public.trade_intent;
create policy "trade_intent_update_own"
  on public.trade_intent for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trade_intent_delete_own" on public.trade_intent;
create policy "trade_intent_delete_own"
  on public.trade_intent for delete to authenticated
  using (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.trade_reflection (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  trade_id       uuid not null references public.trades(id) on delete cascade,
  -- « Mon plan a-t-il été respecté ? » — la question qui mesure la discipline,
  -- pas le résultat.
  plan_respected text check (plan_respected in ('yes','partial','no')),
  -- « Pourquoi ? » — fermé, pour rester agrégable. `other` accueille le reste,
  -- et `note` porte l'explication libre.
  reason         text check (reason in
                   ('fomo','revenge','early_entry','late_entry','wrong_setup','wrong_timing','wrong_risk','other')),
  note           text,
  created_at     timestamptz not null default now()
);

-- Une réflexion par trade.
create unique index if not exists trade_reflection_one_per_trade
  on public.trade_reflection (trade_id);

create index if not exists trade_reflection_user_idx
  on public.trade_reflection (user_id, created_at desc);

alter table public.trade_reflection enable row level security;

grant select, insert, update, delete on public.trade_reflection to authenticated;
grant all on public.trade_reflection to service_role;

drop policy if exists "trade_reflection_select_own" on public.trade_reflection;
create policy "trade_reflection_select_own"
  on public.trade_reflection for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "trade_reflection_insert_own" on public.trade_reflection;
create policy "trade_reflection_insert_own"
  on public.trade_reflection for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "trade_reflection_update_own" on public.trade_reflection;
create policy "trade_reflection_update_own"
  on public.trade_reflection for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trade_reflection_delete_own" on public.trade_reflection;
create policy "trade_reflection_delete_own"
  on public.trade_reflection for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.trade_intent is
  'Ce que le trader pensait AVANT d''entrer. Snapshot figé à l''entrée, distinct de trades (le résultat).';
comment on table public.trade_reflection is
  'Ce que le trader conclut APRÈS : plan respecté, raison, note. Deux clics, optionnel.';
