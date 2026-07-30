-- Add columns that were created via the Supabase dashboard but missing from
-- migrations. All use IF NOT EXISTS so they are safe on any environment.

alter table public.profiles
  add column if not exists trustpilot_prompted_at timestamptz,
  add column if not exists trustpilot_status text;

alter table public.trades
  add column if not exists is_example boolean not null default false,
  add column if not exists mae numeric,
  add column if not exists mfe numeric,
  add column if not exists slippage numeric;
