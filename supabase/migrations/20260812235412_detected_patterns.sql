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
