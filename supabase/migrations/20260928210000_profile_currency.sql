-- ============ DEVISE GLOBALE DE L'UTILISATEUR ============
-- La devise dans laquelle le trader tient son journal : choisie à
-- l'onboarding, modifiable dans Réglages, lue par chaque écran, rapport et
-- PDF qui affiche un montant. C'est une ÉTIQUETTE, pas une conversion : les
-- montants saisis restent ceux du trader.
--
-- 100 % additive : la colonne a une valeur par défaut, aucune donnée existante
-- n'est réécrite, et le code tolère son absence (lecture `select("*")`).
-- Le contrôle n'impose que la forme d'un code ISO 4217 ; la liste des devises
-- proposées vit dans `src/shared/currency.ts`, pour qu'en ajouter une ne
-- demande pas de migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_currency_iso4217'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_currency_iso4217 CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
END $$;
