import type { ToolDefinition } from "@/modules/ai/tools/types";
import { contractMath, FUTURES_SPECS } from "@/domain/futuresContracts";
import { serviceClient } from "@/backend/billing.server";
import type { AnyClient } from "./trades";

/**
 * LES OUTILS « MARCHÉ » DE JARVIS — ce qui lui manquait pour parler NQ.
 *
 * Deux lectures, toutes deux sans écriture et sans donnée inventée :
 *
 *   • `get_contract_math` — l'arithmétique d'un contrat (points ↔ ticks ↔
 *     dollars, taille de position). Calcul PUR (`domain/futuresContracts`) :
 *     le modèle ne multiplie plus de tête, et chaque chiffre de sa réponse se
 *     retrouve dans une sortie d'outil, donc passe la validation.
 *   • `get_economic_calendar` — le calendrier économique DÉJÀ synchronisé dans
 *     `economic_events` (la page Actualités éco lit la même table). Jarvis
 *     répondait « je ne vois pas le calendrier » à « quelles news aujourd'hui
 *     ? » : la donnée était en base, simplement pas branchée.
 *
 * Le calendrier est public (aucune donnée du trader) : il n'a pas besoin de
 * `ctx.userId`, mais l'outil ne s'exécute quand même que pour un utilisateur
 * identifié, comme tous les autres (voir `askCoach`).
 */

export const getContractMath: ToolDefinition = {
  name: "get_contract_math",
  description:
    "Deterministic CME futures arithmetic — use it for EVERY tick/point/dollar/contract " +
    `figure instead of computing it yourself. Contracts: ${Object.keys(FUTURES_SPECS).join(", ")} ` +
    "(continuous or dated symbols like NQ1!, NQZ5 work). Give `symbol` plus a distance as " +
    "`points`, `ticks` or `dollars` (with optional `contracts`, default 1) to convert it; " +
    "give `riskDollars` + `stopPoints` to size a position (max contracts, and the same risk " +
    "in the micro/mini twin). `symbol` alone returns the contract specs (tick size, tick " +
    "value, point value). CFDs such as NAS100 are not covered — say so.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Futures symbol, e.g. NQ, MNQ, ES." },
      points: { type: "number", description: "Distance in index points." },
      ticks: { type: "number", description: "Distance in ticks." },
      dollars: { type: "number", description: "Dollar amount to convert into a distance." },
      contracts: { type: "number", description: "Number of contracts (default 1)." },
      riskDollars: { type: "number", description: "Dollar risk for position sizing." },
      stopPoints: { type: "number", description: "Stop distance in points for sizing." },
    },
    required: ["symbol"],
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input) {
    return contractMath((input ?? {}) as Record<string, unknown>);
  },
};

/** Le fuseau des annonces américaines : celui dans lequel un trader NQ pense. */
export const CALENDAR_TZ = "America/New_York";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CALENDAR_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** La journée new-yorkaise d'aujourd'hui (+ N jours) — celle du calendrier. */
export function newYorkDay(offset = 0, now: Date = new Date()): string {
  return shiftDay(dateFmt.format(now), offset);
}

/** Une date `YYYY-MM-DD` décalée de N jours, calculée en UTC pur — sans
 *  `toISOString().slice()` sur une date LOCALE, qui glisse d'un fuseau à l'autre. */
function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = (v: number) => String(v).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

export interface CalendarRow {
  starts_at: string;
  currency: string;
  title: string;
  impact: string;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  all_day: boolean;
}

/** Plafond d'événements rendus : au-delà, le bloc noie la question. */
const MAX_EVENTS = 40;

/**
 * Les lignes du cache, ramenées à la journée NEW-YORKAISE demandée et
 * filtrées. Pure : testable sans base.
 */
export function shapeCalendar(
  rows: readonly CalendarRow[],
  opts: { since: string; until: string; impacts: readonly string[]; currencies: readonly string[] },
) {
  const events = rows
    .map((r) => {
      const at = new Date(r.starts_at);
      return { r, at, date: dateFmt.format(at) };
    })
    .filter(({ r, date }) => {
      if (date < opts.since || date > opts.until) return false;
      if (!opts.impacts.includes(r.impact)) return false;
      return opts.currencies.length === 0 || opts.currencies.includes(r.currency);
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ r, at, date }) => ({
      date,
      time: r.all_day ? null : timeFmt.format(at),
      allDay: r.all_day,
      currency: r.currency,
      impact: r.impact,
      title: r.title,
      forecast: r.forecast,
      previous: r.previous,
      actual: r.actual,
    }));
  return {
    timezone: CALENDAR_TZ,
    since: opts.since,
    until: opts.until,
    impact: [...opts.impacts],
    currencies: opts.currencies.length ? [...opts.currencies] : "all",
    eventCount: events.length,
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS
      ? { eventsShownForBrevity: `${MAX_EVENTS} of ${events.length}` }
      : {}),
    ...(events.length === 0
      ? {
          note:
            "No stored event matches this window and filter. The cache covers the current and next " +
            "week; say there is nothing listed, never guess an event.",
        }
      : {}),
  };
}

const day = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;

export const getEconomicCalendar: ToolDefinition = {
  name: "get_economic_calendar",
  description:
    "Read the economic calendar (same data as TradeVault's Economic News page): scheduled " +
    "releases with New York time (America/New_York), currency, impact, forecast, previous and " +
    "actual once published. Args: `date` (YYYY-MM-DD) or `since`+`until` (max 14 days), " +
    "`impact` ('high' default = high only, 'medium' = high+medium, 'all'), `currencies` " +
    "(e.g. ['USD'] for NQ/ES; omit for all). Use it for 'news today', 'CPI this week', 'what " +
    "is at 8:30', or to warn about a release before a session. Quote times exactly in ET.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Day in New York time, YYYY-MM-DD." },
      since: { type: "string", description: "Inclusive start, YYYY-MM-DD." },
      until: { type: "string", description: "Inclusive end, YYYY-MM-DD." },
      impact: { type: "string", enum: ["high", "medium", "all"] },
      currencies: { type: "array", items: { type: "string" }, maxItems: 6 },
    },
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input) {
    const args = (input ?? {}) as Record<string, unknown>;
    let since = day(args.date) ?? day(args.since);
    let until = day(args.date) ?? day(args.until) ?? since;
    if (!since || !until) return { error: "Provide `date` (YYYY-MM-DD) or `since`/`until`." };
    if (until < since) [since, until] = [until, since];
    if (until > shiftDay(since, 13)) until = shiftDay(since, 13);
    const impacts =
      args.impact === "all"
        ? ["high", "medium", "low", "holiday"]
        : args.impact === "medium"
          ? ["high", "medium"]
          : ["high"];
    const currencies = Array.isArray(args.currencies)
      ? args.currencies
          .filter((c): c is string => typeof c === "string" && /^[A-Za-z]{3}$/.test(c))
          .map((c) => c.toUpperCase())
          .slice(0, 6)
      : [];

    const sb = serviceClient() as AnyClient | null;
    if (!sb) throw new Error("Database unavailable: server Supabase credentials are missing.");
    // Une marge d'un jour de chaque côté : la journée new-yorkaise chevauche
    // deux journées UTC, et le filtre exact se fait ensuite sur la date ET.
    const { data, error } = await sb
      .from("economic_events")
      .select("starts_at, currency, title, impact, previous, forecast, actual, all_day")
      .gte("starts_at", `${shiftDay(since, -1)}T00:00:00Z`)
      .lt("starts_at", `${shiftDay(until, 2)}T00:00:00Z`)
      .order("starts_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return shapeCalendar((data ?? []) as CalendarRow[], { since, until, impacts, currencies });
  },
};
