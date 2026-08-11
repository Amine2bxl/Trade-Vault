-- ============ OBJECTIFS PAR COMPTE ============
--
-- L'INCOHÉRENCE CORRIGÉE. Les trades sont scopés par sous-compte : le journal,
-- les statistiques, le simulateur, tout est lu compte par compte. Les
-- objectifs, eux, étaient GLOBAUX — une seule ligne par utilisateur, clé
-- primaire sur `user_id`.
--
-- Un trader avec un compte perso à 25 000 $ et un compte financé à 50 000 $
-- voyait donc le MÊME objectif de capital sur les deux, mesuré contre le P&L
-- du compte affiché. La barre de progression sautait au changement de compte,
-- et la projection de probabilité branchée dessus confrontait un objectif
-- pensé pour un compte à l'historique d'un autre.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────────────
-- Additif et non destructif : aucune ligne n'est supprimée, aucun objectif
-- n'est perdu. Le plan existant de chaque utilisateur est RATTACHÉ à son
-- compte par défaut — celui sur lequel il l'a très probablement défini, et le
-- seul choix qui ne perde l'information pour personne.
--
-- La clé primaire passe de (user_id) à (user_id, account_id) : un plan par
-- compte, ce qui est exactement le contrat que l'application applique déjà à
-- toutes ses autres données.

alter table public.goal_plans
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

-- Rattachement des plans existants au compte par défaut de leur propriétaire,
-- à défaut au plus ancien compte. Sans ce repli, un utilisateur dont aucun
-- compte n'est marqué par défaut perdrait l'accès à son plan.
update public.goal_plans gp
set account_id = sub.id
from (
  select distinct on (user_id) user_id, id
  from public.accounts
  order by user_id, is_default desc, created_at asc
) sub
where sub.user_id = gp.user_id
  and gp.account_id is null;

-- Un plan orphelin (utilisateur sans aucun compte) ne peut pas être rattaché.
-- On le supprime plutôt que de bloquer la migration : il est de toute façon
-- inatteignable, l'application n'ouvrant jamais la page sans compte actif.
delete from public.goal_plans where account_id is null;

alter table public.goal_plans alter column account_id set not null;

alter table public.goal_plans drop constraint if exists goal_plans_pkey;
alter table public.goal_plans add primary key (user_id, account_id);

comment on column public.goal_plans.account_id is
  'Sous-compte auquel ce plan appartient. Un objectif de capital n''a de sens que rapporte a un compte precis.';
