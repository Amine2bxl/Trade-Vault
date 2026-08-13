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
