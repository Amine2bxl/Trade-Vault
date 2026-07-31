-- ============ CHECKLIST CONFIG PERSISTENCE ============
-- Phase 5 — « l'app se souvient » : la config de la checklist pré-marché
-- (items, heure de session, fuseau) vit en base en PLUS du localStorage, pour
-- survivre au changement d'appareil / au vidage du cache. 100% additive.
-- Le localStorage reste le cache de lecture rapide ; la base est la vérité.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checklist_config jsonb;
