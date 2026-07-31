-- ============ JARVIS REMEMBERED PROFILE ============
-- The first-open Jarvis card ("Profil mémorisé par Jarvis") captures how the
-- trader wants to be coached: first name, style, main weakness, main strength
-- and current goal. `jarvis_completed_at` being NULL is the gate the app uses
-- to re-show the card on the next Jarvis open. Everything is nullable so a
-- dismissed card never breaks the app.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jarvis_first_name    text,
  ADD COLUMN IF NOT EXISTS jarvis_style         text,
  ADD COLUMN IF NOT EXISTS jarvis_weakness      text,
  ADD COLUMN IF NOT EXISTS jarvis_strength      text,
  ADD COLUMN IF NOT EXISTS jarvis_goal          text,
  ADD COLUMN IF NOT EXISTS jarvis_completed_at  timestamptz;
