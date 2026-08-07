-- Add CHECK constraint on trades.direction to prevent invalid values.
--
-- IDEMPOTENT : même raison que la migration des clés étrangères — une preview
-- rejoue la chaîne entière, et `add constraint` échoue si elle existe déjà.
--
-- `be` (break-even) est une direction à part entière dans TradeVault, pas une
-- valeur parasite : un trade sorti au point mort compte dans la discipline
-- sans peser sur le P&L. L'omettre invaliderait des trades légitimes.

alter table public.trades drop constraint if exists trades_direction_check;
alter table public.trades
  add constraint trades_direction_check
  check (direction in ('long', 'short', 'be'));
