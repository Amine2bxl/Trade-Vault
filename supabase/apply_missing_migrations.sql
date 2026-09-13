-- =====================================================================
-- CORRECTIF PRODUCTION — migrations manquantes sur la base Supabase
--
-- Diagnostiqué le 2026-09-13 : la base live ne contient PAS les tables
-- que le code de main interroge (trading_sessions, detected_patterns,
-- agent_proposals, trade_intent, trade_reflection) => erreurs 500 sur les
-- routes serveur qui les utilisent.
--
-- SÛR À EXÉCUTER : tout est additif (IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS). À lancer UNE fois dans l'éditeur SQL du dashboard Supabase,
-- ou via : supabase db push (les migrations d'origine rejouées sont
-- idempotentes).
-- =====================================================================

-- ── 1/4 trading_sessions (sessions de trading, rattachement des trades) ──
-- ============ SESSIONS DE TRADING ============
--
-- La clé de voûte de `ECOSYSTEM_WIRING.md`. Aujourd'hui la checklist
-- pré-marché est ÉPHÉMÈRE : sa configuration vit dans `profiles.checklist_config`
-- et ce qui a réellement été coché un matin donné n'est écrit nulle part. Il
-- n'existe donc aucun objet « journée de trading » auquel rattacher un état
-- émotionnel, des règles actives, des trades et, plus tard, une revue.
--
-- Cette table crée cet objet. Tout ce qui vient après (taxonomie d'erreurs,
-- détection de motifs, propositions) en dépend.
--
-- ── POURQUOI UNE PHOTO, PAS UNE RÉFÉRENCE ──────────────────────────────────
-- `checklist_snapshot` et `active_rules` copient ce qui était vrai CE MATIN.
-- Le trader modifiera son modèle de checklist et ses règles plus tard ; une
-- référence ferait alors mentir l'historique — la séance de mars afficherait
-- les règles de juin. Une photo coûte quelques octets et garde l'histoire
-- vraie.
--
-- ── POURQUOI LE SCORE DE PRÉPARATION EST CALCULÉ, JAMAIS DEMANDÉ ───────────
-- Demander « note ta préparation sur 100 » produit une variable inutilisable :
-- l'auto-évaluation s'ancre (le même 70 tous les jours) et corrèle avec
-- l'humeur du moment, pas avec la préparation. Le score est donc DÉRIVÉ de
-- faits observables — la part de checklist réellement cochée, l'état
-- émotionnel déclaré, l'existence de règles de risque — et les entrées sont
-- stockées à côté du résultat pour que le chiffre reste auditable et
-- recalculable si la formule change.
--
-- ── POURQUOI `session_id` EST NULLABLE SUR `trades` ────────────────────────
-- Un trade saisi sans séance ouverte reste un trade valide. Le rattachement se
-- fait au mieux (même utilisateur, même compte, même date) et ne doit JAMAIS
-- bloquer l'enregistrement d'un trade : le journal passe avant la mécanique
-- qui l'observe.
--
-- Additif : aucune table ni colonne existante n'est modifiée dans son sens.

create table if not exists public.trading_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  -- La table des comptes s'appelle `accounts` dans ce dépôt (voir
  -- `20260715090000_sub_accounts.sql`) ; le spec la nomme `sub_accounts`.
  -- `on delete set null` : supprimer un compte ne doit pas effacer l'histoire
  -- comportementale du trader, seulement la détacher de ce compte.
  account_id         uuid references public.accounts(id) on delete set null,
  session_date       date not null,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  emotional_state    text check (emotional_state in
                       ('calm','focused','tired','anxious','frustrated','overconfident')),
  -- Dérivé, jamais saisi. Voir l'en-tête.
  readiness_score    int check (readiness_score between 0 and 100),
  -- Les ENTRÉES du score, gardées avec lui : sans elles un score passé n'est
  -- ni auditable ni recalculable.
  readiness_inputs   jsonb not null default '{}'::jsonb,
  checklist_snapshot jsonb not null default '{}'::jsonb,
  market_context     text,
  daily_objective    text,
  active_rules       jsonb not null default '[]'::jsonb,
  discipline_score   int check (discipline_score between 0 and 100),
  review_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Une séance par compte et par jour — la contrainte qui rend le rattachement
-- des trades déterministe.
--
-- Index d'EXPRESSION plutôt que `unique (user_id, account_id, session_date)` :
-- en SQL deux NULL ne sont pas égaux, donc un compte NULL (trade importé avant
-- les sous-comptes) aurait autorisé autant de séances qu'on veut le même jour.
-- `coalesce` vers un UUID nul ferme ce trou sans dépendre de
-- `nulls not distinct`, qui exige PostgreSQL 15.
create unique index if not exists trading_sessions_unique_day
  on public.trading_sessions
     (user_id, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid), session_date);

alter table public.trades
  add column if not exists session_id uuid references public.trading_sessions(id) on delete set null;

create index if not exists trades_session_idx on public.trades (session_id);

grant select, insert, update, delete on public.trading_sessions to authenticated;
grant all on public.trading_sessions to service_role;

alter table public.trading_sessions enable row level security;

-- Owner-only. Contrairement à `subscriptions`, l'utilisateur écrit
-- légitimement ici : c'est son journal de séance, pas un état facturé.
drop policy if exists "trading_sessions_select_own" on public.trading_sessions;
create policy "trading_sessions_select_own"
  on public.trading_sessions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "trading_sessions_insert_own" on public.trading_sessions;
create policy "trading_sessions_insert_own"
  on public.trading_sessions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "trading_sessions_update_own" on public.trading_sessions;
create policy "trading_sessions_update_own"
  on public.trading_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trading_sessions_delete_own" on public.trading_sessions;
create policy "trading_sessions_delete_own"
  on public.trading_sessions for delete to authenticated
  using (auth.uid() = user_id);

-- Lecture typique : « mes séances, la plus récente d'abord », filtrée par
-- compte. L'index suit cette requête.
create index if not exists trading_sessions_user_date_idx
  on public.trading_sessions (user_id, account_id, session_date desc);

comment on table public.trading_sessions is
  'Une journee de trading : preparation (checklist, etat emotionnel, regles actives), objectif, puis revue. Les trades du jour s''y rattachent par session_id.';
comment on column public.trading_sessions.readiness_score is
  'DERIVE des inputs (checklist, etat emotionnel, regles de risque) — ne jamais le faire saisir par l''utilisateur.';

-- ── REPRISE DE L'HISTORIQUE ────────────────────────────────────────────────
--
-- Chaque journée déjà journalisée devient une séance SYNTHÉTIQUE, pour que les
-- analyses à venir voient un historique continu plutôt qu'un mur au jour du
-- déploiement.
--
-- `readiness_score` reste NULL sur ces lignes, et c'est le point important :
-- personne n'a coché de checklist ce matin-là. Inventer un score reviendrait à
-- fabriquer la variable même que le produit prétend observer — exactement la
-- classe de défaut « chiffre juste, interprétation fausse » que `GO-LIVE.md`
-- documente. Un trou honnête vaut mieux qu'une valeur plausible.
--
-- Idempotent : ne crée que ce qui manque, ne rattache que les trades encore
-- orphelins.
insert into public.trading_sessions (user_id, account_id, session_date, started_at, ended_at)
select t.user_id,
       t.account_id,
       t.trade_date,
       min(t.created_at),
       max(t.created_at)
from public.trades t
where t.user_id is not null
group by t.user_id, t.account_id, t.trade_date
on conflict do nothing;

update public.trades t
set session_id = s.id
from public.trading_sessions s
where t.session_id is null
  and t.user_id = s.user_id
  and t.trade_date = s.session_date
  and t.account_id is not distinct from s.account_id;

-- ── 2/4 detected_patterns (scan de patterns, Jarvis) ──
-- ============ MOTIFS DÉTECTÉS ============
--
-- `ECOSYSTEM_WIRING.md` Phase 3. Ce que les moteurs déterministes ont observé,
-- écrit tel quel. Le LLM n'écrit RIEN ici : il formulera plus tard, à partir de
-- ces lignes, et ne pourra pas en inventer une.
--
-- ── `evidence` EST OBLIGATOIRE, ET DOIT PORTER `n` ─────────────────────────
-- Une ligne sans taille d'échantillon n'est pas un cas dégradé, c'est un bug :
-- elle produirait un affichage du type « 62 % de tes pertes » que personne ne
-- peut interpréter. La contrainte le refuse en base, pas seulement dans le
-- code, parce que la base est le dernier endroit où l'on peut encore dire non.
--
-- `evidence` porte aussi `comparisons` : le nombre de tranches examinées pour
-- aboutir à ce motif. Balayer douze créneaux et remonter le pire n'est pas la
-- même affirmation que comparer deux groupes désignés d'avance — et le lecteur
-- doit pouvoir faire la différence.
--
-- ── POURQUOI PAS DE `severity` NI DE `confidence` ──────────────────────────
-- Les deux se fabriquent trop facilement. Ce qui est stocké est ce qui a été
-- mesuré : une valeur, une référence, deux tailles de groupe, un nombre de
-- comparaisons. Le tri se fait sur `impact_r`, qui est une somme observée.

create table if not exists public.detected_patterns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in
                 ('cluster_concentration','after_loss','time_of_day','readiness_correlation')),
  cluster_id   text references public.mistake_clusters(id),
  -- `n` obligatoire, vérifié en base.
  evidence     jsonb not null check (
                 jsonb_typeof(evidence -> 'n') = 'number'
                 and (evidence ->> 'n')::numeric > 0
               ),
  impact_r     numeric,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  dismissed_at timestamptz
);

-- Un motif d'un KIND donné (et d'une famille donnée) est unique par
-- utilisateur : un nouveau passage met à jour `last_seen` et les preuves, il
-- n'empile pas une ligne de plus. Sans ça, la boîte de réception du trader se
-- remplirait du même constat répété chaque nuit.
create unique index if not exists detected_patterns_unique_kind
  on public.detected_patterns
     (user_id, kind, coalesce(cluster_id, ''));

create index if not exists detected_patterns_user_idx
  on public.detected_patterns (user_id, last_seen desc);

alter table public.detected_patterns enable row level security;

grant select, update on public.detected_patterns to authenticated;
grant all on public.detected_patterns to service_role;

-- Lecture : la sienne. Écriture : le service role uniquement — les motifs
-- viennent des moteurs, pas du client, et un client qui pourrait insérer ici
-- pourrait fabriquer ses propres « constats ».
drop policy if exists "detected_patterns_select_own" on public.detected_patterns;
create policy "detected_patterns_select_own"
  on public.detected_patterns for select to authenticated
  using (auth.uid() = user_id);

-- La SEULE écriture permise à l'utilisateur : écarter un motif. Rien d'autre
-- ne doit pouvoir bouger depuis le navigateur.
drop policy if exists "detected_patterns_dismiss_own" on public.detected_patterns;
create policy "detected_patterns_dismiss_own"
  on public.detected_patterns for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.detected_patterns is
  'Motifs observes par les moteurs deterministes. evidence porte toujours n et comparisons ; aucune ligne n''est ecrite par un LLM.';
comment on column public.detected_patterns.dismissed_at is
  'Ecarte par le trader. Le scan ne re-surface pas ce motif avant DISMISS_DAYS (30 jours).';

-- ── 3/4 agent_proposals (propositions du coach) ──
-- ============ PROPOSITIONS DE JARVIS ============
--
-- `ECOSYSTEM_WIRING.md` Phase 4. La seule voie par laquelle l'assistant peut
-- faire changer quelque chose dans les données du trader — et elle passe par
-- son accord explicite.
--
-- ── JARVIS N'ÉCRIT RIEN DIRECTEMENT ────────────────────────────────────────
-- Aucun appel d'outil ne modifie les données de l'utilisateur. Une proposition
-- est une LIGNE EN ATTENTE ; l'objet réel n'est créé qu'à l'acceptation, côté
-- serveur, après validation. C'est ce qui distingue un assistant d'un
-- processus qui réorganise le travail de quelqu'un pendant qu'il dort.
--
-- ── LE BUDGET D'INTERVENTION EST UNE CONTRAINTE, PAS UN RÉGLAGE D'INTERFACE ─
-- Au plus 3 propositions en attente, au plus 1 nouvelle par jour. Sans cela
-- l'application devient harcelante, l'utilisateur désactive la fonction, et on
-- perd la fonctionnalité entière — pas seulement la proposition de trop.
-- La règle est donc posée en base, où l'interface ne peut pas la contourner.
--
-- ── POURQUOI `applied_ref` ─────────────────────────────────────────────────
-- « Jarvis a créé cette règle » doit être vérifiable, pas affirmé. `applied_ref`
-- porte l'identifiant de l'objet réellement créé ; sans lui, l'historique des
-- interventions serait un récit invérifiable.

create table if not exists public.agent_proposals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- La proposition NAÎT d'un motif observé. `on delete set null` : effacer un
  -- motif ne doit pas effacer la trace d'une décision déjà prise par le trader.
  pattern_id   uuid references public.detected_patterns(id) on delete set null,
  action_type  text not null check (action_type in
                 ('create_rule','create_goal','add_checklist_item','create_mission','add_tag','add_note')),
  payload      jsonb not null,
  -- Rédigée par le LLM, filtrée AVANT insertion par `checkCausalLanguage`
  -- (`src/modules/patterns/language.ts`). La base ne peut pas lire du français ;
  -- elle exige seulement qu'il y ait une justification.
  rationale    text not null check (length(trim(rationale)) > 0),
  status       text not null default 'pending'
                 check (status in ('pending','accepted','dismissed','expired')),
  decided_at   timestamptz,
  -- Identifiant de l'objet réellement créé à l'acceptation.
  applied_ref  text,
  created_at   timestamptz not null default now(),
  -- Une proposition périmée est du bruit : elle s'appuie sur des données
  -- d'il y a trois semaines. 14 jours, puis `expired`.
  expires_at   timestamptz not null default (now() + interval '14 days')
);

-- Une seule proposition VIVANTE par motif : re-proposer la même chose pendant
-- que la première attend est déjà du harcèlement.
create unique index if not exists agent_proposals_one_pending_per_pattern
  on public.agent_proposals (user_id, pattern_id)
  where status = 'pending' and pattern_id is not null;

create index if not exists agent_proposals_user_idx
  on public.agent_proposals (user_id, status, created_at desc);

alter table public.agent_proposals enable row level security;

grant select, update on public.agent_proposals to authenticated;
grant all on public.agent_proposals to service_role;

drop policy if exists "agent_proposals_select_own" on public.agent_proposals;
create policy "agent_proposals_select_own"
  on public.agent_proposals for select to authenticated
  using (auth.uid() = user_id);

-- L'utilisateur décide (accepter / ignorer) ; il n'INSÈRE pas. Les propositions
-- viennent du moteur, via le service role. Un client qui pourrait insérer ici
-- pourrait se fabriquer un historique d'interventions.
drop policy if exists "agent_proposals_decide_own" on public.agent_proposals;
create policy "agent_proposals_decide_own"
  on public.agent_proposals for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/**
 * Le budget d'intervention, appliqué à l'insertion.
 *
 * En base plutôt qu'en TypeScript : c'est la dernière barrière avant les
 * données, et la seule qu'un futur chemin d'écriture (tâche planifiée, script
 * de reprise, second service) ne peut pas oublier de traverser.
 */
create or replace function public.enforce_proposal_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count int;
  today_count   int;
begin
  select count(*) into pending_count
    from public.agent_proposals
   where user_id = new.user_id and status = 'pending';

  if pending_count >= 3 then
    raise exception 'proposal budget: 3 pending proposals already await a decision'
      using errcode = 'check_violation';
  end if;

  select count(*) into today_count
    from public.agent_proposals
   where user_id = new.user_id
     and created_at >= date_trunc('day', now());

  if today_count >= 1 then
    raise exception 'proposal budget: one new proposal per day'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists agent_proposals_budget on public.agent_proposals;
create trigger agent_proposals_budget
  before insert on public.agent_proposals
  for each row execute function public.enforce_proposal_budget();

comment on table public.agent_proposals is
  'Propositions de Jarvis. Jarvis n''ecrit jamais directement : l''objet reel n''est cree qu''a l''acceptation, et applied_ref le prouve.';
comment on column public.agent_proposals.applied_ref is
  'Identifiant de l''objet reellement cree. Rend « Jarvis a cree ceci » verifiable plutot qu''affirme.';

-- ── 4/4 trade_intent + trade_reflection (phase 0b du journal) ──
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
