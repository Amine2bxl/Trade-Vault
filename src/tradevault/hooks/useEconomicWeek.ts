import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  addDays,
  getEventsForWeek,
  isoDate,
  type EconomicWeek,
} from "../utils/economicEvents";

// Week data is public, identical for everyone and edge-cached, so it is safe to
// hold for a long time in the client cache. The practical effect: flipping back
// to an already-seen week is instant with zero network, and the adjacent weeks
// are already warm because we prefetch them.
const STALE_MS = 15 * 60 * 1000;
const GC_MS = 60 * 60 * 1000;

async function fetchWeek(weekStartIso: string): Promise<EconomicWeek> {
  try {
    const res = await fetch(`/api/economic-calendar?week=${weekStartIso}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`calendar endpoint responded ${res.status}`);
    const json = (await res.json()) as EconomicWeek;
    if (!Array.isArray(json.events)) throw new Error("malformed calendar payload");
    return json;
  } catch (err) {
    // Offline, or the endpoint is down: generate the week locally so the page
    // still shows a usable schedule instead of an error state.
    console.error("[economic-calendar] falling back to the offline schedule", err);
    const [y, m, d] = weekStartIso.split("-").map(Number);
    return {
      events: await getEventsForWeek(new Date(y, m - 1, d)),
      source: "builtin",
      fetchedAt: new Date().toISOString(),
    };
  }
}

const weekQuery = (weekStartIso: string) => ({
  queryKey: ["economic-week", weekStartIso] as const,
  queryFn: () => fetchWeek(weekStartIso),
  staleTime: STALE_MS,
  gcTime: GC_MS,
});

/**
 * A week of economic events, with the previous and next weeks prefetched so the
 * arrows feel instant. `keepPreviousData` means the old week stays on screen
 * while a genuinely new one loads — no skeleton flash mid-navigation.
 */
export function useEconomicWeek(weekStart: Date) {
  const iso = isoDate(weekStart);
  const qc = useQueryClient();

  const query = useQuery({ ...weekQuery(iso), placeholderData: keepPreviousData });

  useEffect(() => {
    for (const delta of [-7, 7]) {
      void qc.prefetchQuery(weekQuery(isoDate(addDays(weekStart, delta))));
    }
  }, [qc, iso, weekStart]);

  return query;
}
