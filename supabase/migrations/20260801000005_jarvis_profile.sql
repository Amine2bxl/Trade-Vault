-- RENOMMÉ de 20260801000004 -> 20260801000005.
-- Deux migrations partageaient la version 20260801000004. Supabase indexe les
-- migrations appliquées PAR VERSION : l'une des deux pouvait donc ne jamais
-- être enregistrée, et le rejeu d'une branche devenait imprévisible.
-- Renommage sans risque : ce fichier est entièrement idempotent
-- (ADD COLUMN IF NOT EXISTS), donc un rejeu en production ne change rien.
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
