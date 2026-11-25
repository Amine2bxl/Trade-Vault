-- SETUPS MANQUÉS — raison fermée, classe, niveaux et issue.
--
-- Additif : colonnes NULLABLES, aucune donnée réécrite, RLS owner-only déjà
-- en place sur `missed_opportunities`. Une ligne d'avant (classe NULL) garde
-- le R que le trader avait déclaré (`estimated_r`) ; le produit ne le
-- recalcule pas.
--
--   direction / entry_price / stop_price / target_price : le setup, en prix ;
--   reason_code    : pourquoi il n'a pas été pris (vocabulaire fermé) ;
--   classification : valide, manqué par hésitation, écarté volontairement,
--                    invalide — seuls les deux premiers peuvent coûter ;
--   outcome        : cible ou stop touché, ou inconnu.
--
-- Retour arrière : supprimer ces colonnes (aucune autre table ne les lit).

alter table public.missed_opportunities
  add column if not exists direction      text check (direction in ('long', 'short')),
  add column if not exists entry_price    numeric check (entry_price > 0),
  add column if not exists stop_price     numeric check (stop_price > 0),
  add column if not exists target_price   numeric check (target_price > 0),
  add column if not exists reason_code    text check (reason_code in (
    'hesitation', 'fear', 'not_recognized', 'no_confirmation',
    'outside_window', 'risk_constraint', 'daily_limit', 'deliberate')),
  add column if not exists classification text check (classification in ('valid', 'hesitation', 'skipped', 'invalid')),
  add column if not exists outcome        text check (outcome in ('target', 'stop', 'unknown'));
