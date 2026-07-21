-- Onboarding V2 (Sprint 2 — US-2.3) : la question « situation » (prop-firm /
-- compte réel / apprentissage) pilote le message, le plan personnalisé et la
-- mémoire du coach. Additif uniquement.

alter table public.profiles
  add column if not exists onboarding_situation text;
