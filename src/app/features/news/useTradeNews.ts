import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchEconomicHistory,
  requestEconomicBackfill,
} from "@/backend/economic-calendar.functions";
import type { CalendarEvent } from "@/modules/economic-calendar";
import { newsForTrade, weekStartOf, type TradeNews } from "@/domain/tradeNews";
import { localDateOf, todayLocalDate } from "@/shared/calendar-date";
import { fallbackEvents } from "./useEconomicCalendar";
import { startOfWeek } from "./economicEvents";

// ============================================================
//  Les annonces des journées de trades — accès UI.
// ------------------------------------------------------------
//  Donnée PUBLIQUE de la feature Calendrier, consommée par le journal
//  (TradeModal) et l'analyse (jours d'annonce). Trois étages :
//    1. le cache serveur (`economic_events`, historique conservé 3 ans) ;
//    2. une semaine absente est demandée au serveur, qui va la chercher
//       sur la page hebdomadaire de la source — une à la fois, une seule
//       fois par session et par semaine ;
//    3. en attendant, le repli intégré (heures APPROXIMATIVES, signalées).
// ============================================================

const DAY = 86_400_000;
/** Au-delà, la source n'est plus interrogée : trois ans, la rétention du cache. */
const HISTORY_DAYS = 3 * 365;
/** Semaines demandées au serveur par session — la politesse envers la source. */
const MAX_BACKFILL_PER_SESSION = 4;
/** Le serveur espace les pages de 20 s : inutile de demander plus vite. */
const BACKFILL_GAP_MS = 21_000;

const requested = new Set<string>();
let queue: Promise<unknown> = Promise.resolve();

function localMidnight(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface EconomicHistory {
  events: CalendarEvent[];
  loading: boolean;
  /** Le cache n'a pas pu être lu : rien ne doit être affirmé (pas même « aucune annonce »). */
  failed: boolean;
  /** Semaines servies par le repli intégré (heures approximatives). */
  approximateWeeks: Set<string>;
}

/** Les annonces fortes et moyennes couvrant ces journées (`YYYY-MM-DD`). */
export function useEconomicHistory(dates: string[]): EconomicHistory {
  const queryClient = useQueryClient();
  const today = todayLocalDate();
  const oldest = localDateOf(new Date(Date.now() - HISTORY_DAYS * DAY));

  const days = useMemo(
    () =>
      [
        ...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= oldest && d <= today)),
      ].sort(),
    [dates, oldest, today],
  );
  const range = useMemo(() => {
    if (!days.length) return null;
    // Une journée de marge de chaque côté : le cache est en UTC, le trade en local.
    const from = new Date(localMidnight(weekStartOf(days[0])).getTime() - DAY);
    const to = new Date(localMidnight(days[days.length - 1]).getTime() + 2 * DAY);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const query = useQuery({
    queryKey: ["economic-history", range?.from, range?.to],
    queryFn: () => fetchEconomicHistory({ data: range! }),
    enabled: range !== null,
    staleTime: 30 * 60_000,
  });

  const real = useMemo(() => query.data?.events ?? [], [query.data]);
  const missingWeeks = useMemo(() => {
    if (!query.data) return [];
    const covered = new Set(real.map((e) => weekStartOf(localDateOf(new Date(e.startsAt)))));
    const current = weekStartOf(today);
    return [...new Set(days.map(weekStartOf))]
      .filter((w) => !covered.has(w) && w < current)
      .sort()
      .reverse();
  }, [query.data, real, days, today]);

  // 2. Les semaines manquantes sont demandées au serveur, l'une après l'autre.
  useEffect(() => {
    const todo = missingWeeks.filter((w) => !requested.has(w));
    for (const week of todo) {
      if (requested.size >= MAX_BACKFILL_PER_SESSION) break;
      requested.add(week);
      queue = queue
        .then(() => requestEconomicBackfill({ data: { week } }))
        .then((r) => {
          if (r.outcome === "filled") {
            void queryClient.invalidateQueries({ queryKey: ["economic-history"] });
          }
        })
        .catch(() => {})
        .then(() => new Promise((r) => setTimeout(r, BACKFILL_GAP_MS)));
    }
  }, [missingWeeks, queryClient]);

  // 3. Le repli intégré, pour les seules semaines encore absentes.
  const fallback = useQuery({
    queryKey: ["economic-history-fallback", missingWeeks.join(",")],
    queryFn: async () => {
      const lists = await Promise.all(
        missingWeeks.map((w) => fallbackEvents(startOfWeek(localMidnight(w)))),
      );
      return lists.flat().filter((e) => e.impact === "high" || e.impact === "medium");
    },
    enabled: missingWeeks.length > 0,
    staleTime: Infinity,
  });

  return useMemo(
    () => ({
      events: [...real, ...(fallback.data ?? [])],
      loading: query.isPending && range !== null,
      failed: query.isError,
      approximateWeeks: new Set(missingWeeks),
    }),
    [real, fallback.data, query.isPending, query.isError, range, missingWeeks],
  );
}

/** Les annonces de la journée d'UN trade (TradeModal). */
export function useTradeNews(trade: {
  symbol: string;
  date: string;
  entryTime?: string;
  exitTime?: string;
}): { news: TradeNews; loading: boolean; failed: boolean } {
  const dates = useMemo(() => (trade.date ? [trade.date] : []), [trade.date]);
  const { events, loading, failed } = useEconomicHistory(dates);
  const news = useMemo(() => newsForTrade(trade, events), [trade, events]);
  return { news, loading, failed };
}
