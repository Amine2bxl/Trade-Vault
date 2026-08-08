-- ============ RECALIBRAGE D'ÉCHELLE DE COMPTE ============
--
-- Permet de représenter un historique tradé sur 25 000 $ comme s'il l'avait
-- été sur 50 000 $, quand le trader change de taille de compte et veut
-- continuer dans le même journal.
--
-- ARCHITECTURE : les lignes `trades` ne sont JAMAIS modifiées. La calibration
-- est une métadonnée portée par le compte, appliquée à la LECTURE. La vérité
-- d'origine reste donc intacte et l'opération est réversible à tout moment.
--
-- `starting_balance` conserve exactement son sens actuel : le solde auquel le
-- compte est représenté aujourd'hui. Tous les moteurs existants (Edge Score,
-- Risk Guard, drawdown %, objectifs) continuent de s'en servir sans changer
-- d'une ligne — c'est ce qui rend les pourcentages invariants au recalibrage.
--
-- MIGRATION ADDITIVE ET IDEMPOTENTE :
--   - deux colonnes nullables, aucune contrainte sur l'existant ;
--   - `calibration_scale` vaut 1 par défaut, soit « aucun recalibrage » ;
--   - `original_balance` reste NULL tant qu'aucun recalibrage n'a eu lieu, et
--     l'application lit alors `starting_balance` comme capital d'origine ;
--   - relançable sans effet de bord (les branches de preview rejouent toute
--     la chaîne de migrations).
-- Aucune donnée existante n'est lue, réécrite ni supprimée.
--
-- APPLIQUÉE le 2026-08-08 sur le projet de production, sous la version
-- enregistrée `20260808004859` — d'où le nom de ce fichier. Le nom DOIT suivre
-- la version en base : une divergence entre les deux est précisément ce qui
-- avait désynchronisé l'historique de migrations par le passé.
--
-- Vérifié avant et après : 10 comptes, 10 utilisateurs, 325 000 de capital
-- cumulé — identiques. Les 4 politiques RLS owner-only sont intactes, et les
-- 10 comptes sont à l'échelle neutre (scale = 1, original_balance NULL).

alter table public.accounts
  add column if not exists calibration_scale numeric not null default 1,
  add column if not exists original_balance numeric,
  add column if not exists calibrated_at timestamptz;

-- Un facteur nul ou négatif n'a pas de sens et produirait des montants
-- absurdes ou des divisions par zéro dans les statistiques.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_calibration_scale_positive'
  ) then
    alter table public.accounts
      add constraint accounts_calibration_scale_positive
      check (calibration_scale > 0);
  end if;
end $$;

comment on column public.accounts.calibration_scale is
  'Facteur appliqué aux montants historiques à la lecture (1 = aucun recalibrage). Toujours recalculé comme cible / original_balance, jamais par multiplications successives.';
comment on column public.accounts.original_balance is
  'Capital sur lequel les trades ont RÉELLEMENT été pris. Source canonique du facteur. NULL tant qu''aucun recalibrage n''a eu lieu.';
comment on column public.accounts.calibrated_at is
  'Date du dernier recalibrage, pour l''affichage et le contexte fourni à Jarvis.';

-- RLS : aucune politique nouvelle. Les colonnes héritent des politiques
-- owner-only déjà en place sur `accounts` — un utilisateur ne peut donc lire
-- ni écrire la calibration d'un compte qui n'est pas le sien.
