-- ============ ONBOARDING ============
-- First-run onboarding captured on the user's profile row. `onboarded_at`
-- being NULL is the single gate the app checks to decide whether to show the
-- flow. Everything is nullable / defaulted so a skipped run never breaks
-- personalization.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_goal       text,
  ADD COLUMN IF NOT EXISTS onboarding_assets     text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_style      text,
  ADD COLUMN IF NOT EXISTS onboarding_experience text,
  ADD COLUMN IF NOT EXISTS onboarding_uses_ict   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_brokers    text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_pain       text,
  ADD COLUMN IF NOT EXISTS onboarding_skipped    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarded_at          timestamptz;
