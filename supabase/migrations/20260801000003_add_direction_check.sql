-- Add CHECK constraint on trades.direction to prevent invalid values.

alter table public.trades
  add constraint trades_direction_check
  check (direction in ('long', 'short', 'be'));
