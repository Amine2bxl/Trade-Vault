-- Every read of missed_opportunities filters by user_id and orders by opportunity_date desc
-- (see loadMissedOpportunities in src/tradevault/store.ts), but the table only had its
-- primary key (id) — every query was a full sequential scan. Add the matching composite index,
-- mirroring the one already present on public.trades.
CREATE INDEX IF NOT EXISTS missed_opportunities_user_date_idx
  ON public.missed_opportunities (user_id, opportunity_date DESC);
