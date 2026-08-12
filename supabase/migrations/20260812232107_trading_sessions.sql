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
