import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEconomicCalendar } from "@/backend/economic-calendar.functions";
import type { CalendarEvent } from "@/modules/economic-calendar";
import { countryForCurrency } from "@/modules/economic-calendar";
import { addDays, etToInstant, getEventsForWeek, isoDate } from "../utils/economicEvents";

// ============================================================
//  Accès UI au calendrier économique.
// ------------------------------------------------------------
//  Un seul hook, une seule source. Les composants ne connaissent ni la table,
//  ni le fournisseur, ni la stratégie de repli.
//
//  Fraîcheur : les valeurs `actual` tombent au moment de la publication. Plutôt
//  qu'un canal temps réel permanent (une connexion WebSocket par onglet pour
//  quelques mises à jour par jour), on resserre le rafraîchissement UNIQUEMENT
//  quand une publication est imminente. Le coût suit l'intérêt.
// ============================================================

const MINUTE = 60_000;

/** sessionStorage persistence: same pattern as useTrades — on F5 the cold
 * server fetch takes ~3s. Caching the last response and feeding it back as
 * `initialData` makes the calendar paint instantly while a background
 * refetch silently updates it. */
function econStorageKey(weekKey: string) {
  return `tv:econ:${weekKey}`;
}
function readCachedEcon<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Repli hors-ligne : le générateur de règles, converti au format normalisé. */
async function fallbackEvents(weekStart: Date): Promise<CalendarEvent[]> {
  const legacy = await getEventsForWeek(weekStart);
  return legacy.map((e) => ({
    id: `builtin-${e.id}`,
    startsAt: etToInstant(e.date, e.etHour, e.etMinute).toISOString(),
    currency: e.currency,
    country: countryForCurrency(e.currency),
    title: e.name,
    impact: e.impact,
    previous: null,
    forecast: null,
    actual: null,
    allDay: false,
    source: "builtin",
  }));
}

/**
 * Cadence de rafraîchissement, décidée par ce que l'utilisateur regarde :
 *   - une publication dans l'heure  → 30 s (on veut voir `actual` apparaître)
 *   - la semaine en cours           → 5 min
 *   - une autre semaine             → jamais (données figées, rien à attendre)
 */
function refreshInterval(events: CalendarEvent[], from: Date, to: Date): number | false {
  const now = Date.now();
  if (now < from.getTime() || now >= to.getTime()) return false;

  const imminent = events.some((e) => {
    const delta = new Date(e.startsAt).getTime() - now;
    return delta > -30 * MINUTE && delta < 60 * MINUTE;
  });
  return imminent ? 30_000 : 5 * MINUTE;
}

export interface EconomicCalendarState {
  events: CalendarEvent[];
  loading: boolean;
  /** Les données affichées viennent du repli local, pas de la source réelle. */
  isFallback: boolean;
  /** Dernière synchronisation réussie côté serveur. */
  lastSuccessAt: string | null;
  /** Le serveur sert du cache : la dernière tentative de synchro a échoué. */
  stale: boolean;
}

export function useEconomicCalendar(weekStart: Date): EconomicCalendarState {
  const from = weekStart;
  const to = addDays(weekStart, 7);
  const weekKey = isoDate(weekStart);

  const sKey = econStorageKey(weekKey);
  const initialData = useMemo(
    () => readCachedEcon<Awaited<ReturnType<typeof fetchEconomicCalendar>>>(sKey),
    [sKey],
  );

  const primary = useQuery({
    queryKey: ["economic-calendar", weekKey],
    queryFn: () =>
      fetchEconomicCalendar({
        data: { from: from.toISOString(), to: to.toISOString() },
      }),
    staleTime: MINUTE,
    // Garder la semaine précédente affichée pendant le chargement de la
    // suivante : la navigation ne doit jamais faire clignoter la page.
    placeholderData: (previous) => previous,
    refetchInterval: (query) => refreshInterval(query.state.data?.events ?? [], from, to),
    initialData,
  });

  // Persist to sessionStorage so the next F5 restores the data instantly.
  useEffect(() => {
    if (!primary.data) return;
    try {
      sessionStorage.setItem(sKey, JSON.stringify(primary.data));
    } catch {
      /* quota exceeded — non-critical */
    }
  }, [primary.data, sKey]);

  const cacheEmpty = !primary.isPending && (primary.data?.events.length ?? 0) === 0;

  const fallback = useQuery({
    queryKey: ["economic-calendar-fallback", weekKey],
    queryFn: () => fallbackEvents(weekStart),
    // Ne coûte rien tant que le cache serveur répond : la requête n'existe pas.
    enabled: cacheEmpty,
    staleTime: Infinity,
  });

  const usingFallback = cacheEmpty && (fallback.data?.length ?? 0) > 0;

  return {
    events: usingFallback ? (fallback.data ?? []) : (primary.data?.events ?? []),
    loading: primary.isPending || (cacheEmpty && fallback.isPending),
    isFallback: usingFallback,
    lastSuccessAt: primary.data?.lastSuccessAt ?? null,
    stale: primary.data?.stale ?? false,
  };
}
