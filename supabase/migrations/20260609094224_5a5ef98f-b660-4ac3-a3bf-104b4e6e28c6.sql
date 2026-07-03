ALTER TABLE public.missed_opportunities
ADD COLUMN IF NOT EXISTS screenshots text[] NOT NULL DEFAULT '{}'::text[];