-- ============ SCÉNARIOS DE SIMULATION ============
--
-- Le simulateur de probabilités fait saisir au trader les règles de son compte
-- (drawdown, objectif, perte journalière, durée) puis produit un résultat.
-- Sans persistance, ces règles sont perdues à chaque rechargement et le trader
-- les ressaisit à chaque visite : la fonctionnalité devient un jouet qu'on
-- essaie une fois.
--
-- ── POURQUOI STOCKER LA GRAINE ET LA VERSION DU MOTEUR ─────────────────────
-- Un résultat de simulation n'est interprétable que si l'on sait COMMENT il a
-- été produit. `engine_version` identifie la méthode (`bootstrap_v1`), `seed`
-- la séquence tirée. Ensemble, ils permettent de rejouer exactement la même
-- simulation des mois plus tard — et, si la méthode change entre-temps, de
-- savoir qu'on ne compare pas deux chiffres produits par deux algorithmes
-- différents. C'est ce qui distingue un historique de simulations d'un tas de
-- pourcentages périmés.
--
-- ── CE QUI EST STOCKÉ, ET CE QUI NE L'EST PAS ──────────────────────────────
-- On stocke l'ENTRÉE (les règles, l'horizon, le risque, la graine) et un
-- RÉSUMÉ du résultat. On ne stocke ni les trajectoires ni les distributions
-- complètes : elles se recalculent à l'identique depuis la graine, en quelques
-- millisecondes, et les écrire ferait grossir la base sans rien apporter.
--
-- Les règles vivent dans une colonne `jsonb` plutôt qu'en colonnes typées :
-- l'ensemble des règles de compte évoluera (règles de consistance, gel de
-- trailing, variantes propres à certaines firmes) et chaque évolution
-- coûterait sinon une migration. La forme est validée côté application par
-- `AccountRules`, qui est la source de vérité du contrat.
--
-- Additif uniquement : aucune table ni colonne existante n'est touchée.

create table if not exists public.simulation_scenarios (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Un scénario appartient à un compte : les règles d'un compte financé n'ont
  -- aucun sens appliquées au compte personnel. `on delete cascade` parce qu'un
  -- scénario orphelin n'est pas récupérable — il décrivait un compte supprimé.
  account_id      uuid references public.accounts(id) on delete cascade,
  name            text not null default '',
  -- Règles du compte telles que saisies par le trader (AccountRules).
  rules           jsonb not null default '{}'::jsonb,
  horizon_unit    text not null default 'days' check (horizon_unit in ('days', 'trades')),
  horizon_value   int not null default 30 check (horizon_value > 0),
  risk_multiplier numeric not null default 1 check (risk_multiplier > 0),
  stop_after_losses int check (stop_after_losses is null or stop_after_losses > 0),
  runs            int not null default 2000 check (runs > 0),
  -- Reproductibilité. `seed` est l'entier passé au RNG ; `engine_version` la
  -- méthode. Nullables tant qu'aucune simulation n'a été lancée sur le
  -- scénario : un scénario en cours de saisie n'a pas encore de résultat.
  seed            bigint,
  engine_version  text,
  -- Résumé du dernier résultat, pour afficher une liste sans tout relancer.
  last_pass_probability numeric check (
    last_pass_probability is null
    or (last_pass_probability >= 0 and last_pass_probability <= 1)
  ),
  last_risk_of_ruin numeric check (
    last_risk_of_ruin is null or (last_risk_of_ruin >= 0 and last_risk_of_ruin <= 1)
  ),
  -- Taille de l'échantillon au moment du calcul : le même 92 % ne vaut pas la
  -- même chose sur 8 trades et sur 400, et cette information doit voyager avec
  -- le résultat, pas être reconstituée après coup.
  last_sample_size int,
  last_run_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.simulation_scenarios enable row level security;

-- Owner-only, exactement comme le reste du schéma. Les quatre opérations sont
-- explicites : un `for all` masquerait qu'un utilisateur peut aussi supprimer.
drop policy if exists "simulation_scenarios_select_own" on public.simulation_scenarios;
create policy "simulation_scenarios_select_own"
  on public.simulation_scenarios for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "simulation_scenarios_insert_own" on public.simulation_scenarios;
create policy "simulation_scenarios_insert_own"
  on public.simulation_scenarios for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "simulation_scenarios_update_own" on public.simulation_scenarios;
create policy "simulation_scenarios_update_own"
  on public.simulation_scenarios for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "simulation_scenarios_delete_own" on public.simulation_scenarios;
create policy "simulation_scenarios_delete_own"
  on public.simulation_scenarios for delete to authenticated
  using (auth.uid() = user_id);

-- Lecture typique : « les scénarios de ce compte, le plus récemment utilisé en
-- premier ». L'index suit exactement cette requête.
create index if not exists simulation_scenarios_account_idx
  on public.simulation_scenarios (user_id, account_id, updated_at desc);

comment on table public.simulation_scenarios is
  'Scenarios du simulateur de probabilites. Stocke l''entree et un resume du resultat ; les distributions se recalculent depuis seed + engine_version.';
