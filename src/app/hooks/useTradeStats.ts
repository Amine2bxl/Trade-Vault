import { useMemo } from "react";
import { computeStats } from "../utils/tradeCalcs";
import type { Trade } from "../types";

// Single, memoized source of derived trade statistics. Any component — a page,
// the sidebar, or a future AI-coach panel — reads the same computed stats from
// here instead of calling computeStats inline, so the numbers are guaranteed
// consistent and recomputed only when the trade list actually changes.
export function useTradeStats(trades: Trade[]): ReturnType<typeof computeStats> {
  return useMemo(() => computeStats(trades), [trades]);
}
