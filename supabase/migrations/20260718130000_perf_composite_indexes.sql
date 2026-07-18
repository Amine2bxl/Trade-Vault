-- ============ PERF: composite indexes for account-scoped reads ============
-- The hot read path scopes to the active account and orders by date:
--   where user_id = ? and account_id = ? order by trade_date desc
-- Existing indexes cover (user_id, trade_date) and (account_id) separately,
-- so the planner filters account_id after the index scan. These composite
-- indexes let a multi-account user with a large history stay on-index.
--
-- 100% additive: no table or existing index is touched, no data is rewritten.

create index if not exists trades_user_account_date_idx
  on public.trades (user_id, account_id, trade_date desc);

create index if not exists missed_user_account_date_idx
  on public.missed_opportunities (user_id, account_id, opportunity_date desc);
