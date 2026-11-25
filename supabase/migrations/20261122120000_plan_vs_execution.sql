-- PRÉVU CONTRE RÉALISÉ — ce que le trader avait écrit, à côté de ce qu'il a fait.
--
-- Additif : uniquement des colonnes NULLABLES sur deux tables existantes,
-- aucune donnée réécrite, RLS owner-only déjà en place (20260818000000).
-- Une colonne NULL = inconnue : les trades d'avant cette migration n'ont pas de
-- prévu, et le produit l'affiche ainsi, jamais comme 0.
--
-- `trade_intent` — le prévu, FIGÉ à la création de l'intention :
--   planned_*        les niveaux du plan de séance au moment de l'encodage
--                    (sens, zone d'entrée, invalidation, cible, scénario A/B) ;
--   initial_stop     le stop réellement posé à l'entrée, en prix ;
--   initial_target   la cible réellement posée à l'entrée, en prix.
-- Seuls les deux derniers restent corrigeables (faute de frappe) : le prévu
-- d'un trade ne change plus une fois écrit.
--
-- `trade_reflection` — le jugement d'exécution, séparé du P&L :
--   execution_override  correction MANUELLE du verdict calculé (le calcul, lui,
--                       n'est jamais stocké : il se refait à la lecture) ;
--   override_note       pourquoi le trader corrige ;
--   intensity           intensité émotionnelle après le trade, 1 à 5, DÉCLARÉE ;
--   reentry_urge        envie de reprendre un trade tout de suite, DÉCLARÉE.
--
-- Retour arrière : supprimer les colonnes ajoutées ici (aucune autre table ne
-- les lit en base).

alter table public.trade_intent
  add column if not exists planned_direction text check (planned_direction in ('long', 'short')),
  add column if not exists planned_entry     numeric check (planned_entry > 0),
  add column if not exists planned_stop      numeric check (planned_stop > 0),
  add column if not exists planned_target    numeric check (planned_target > 0),
  add column if not exists planned_scenario  text check (planned_scenario in ('A', 'B')),
  add column if not exists initial_stop      numeric check (initial_stop > 0),
  add column if not exists initial_target    numeric check (initial_target > 0);

alter table public.trade_reflection
  add column if not exists execution_override text check (execution_override in ('good_execution', 'bad_execution')),
  add column if not exists override_note      text check (char_length(override_note) <= 500),
  add column if not exists intensity          smallint check (intensity between 1 and 5),
  add column if not exists reentry_urge       boolean;
