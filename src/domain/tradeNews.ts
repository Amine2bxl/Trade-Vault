/**
 * LES ANNONCES ÉCONOMIQUES DE LA JOURNÉE D'UN TRADE — module PUR.
 *
 * Un trade est daté (jour civil du trader) et porte un symbole ; le calendrier
 * publie des annonces datées à l'instant près, par devise. Ce module relie les
 * deux : quelles annonces fortes ou moyennes ont touché les devises du trade
 * ce jour-là, et lesquelles tombaient pendant qu'il était en position.
 *
 * Il sert deux surfaces :
 *   • TradeModal — une ligne discrète : « USD · CPI 14:30 · FOMC 20:00 » ;
 *   • Analytics — les résultats des jours d'annonce face aux jours calmes,
 *     chacun avec son `n`, rien sous l'échantillon minimum, aucune causalité.
 *
 * Semaine du calendrier : du DIMANCHE au samedi, la convention de la source.
 */
import { localDateOf } from "@/shared/calendar-date";
import { currenciesForSymbol } from "./instrumentCurrency";
import { MIN_BUCKET_SAMPLE } from "./quantStats";

/** La forme minimale d'une annonce (structurellement compatible avec `CalendarEvent`). */
export interface NewsEvent {
  id: string;
  startsAt: string;
  currency: string;
  title: string;
  impact: "high" | "medium" | "low" | "holiday";
  allDay: boolean;
  source: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
}

/** Le repli intégré : des heures déduites d'une règle, jamais confirmées. */
export const APPROXIMATE_SOURCE = "builtin";

// ── Semaines ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function utcNoon(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Le dimanche qui ouvre la semaine de `day` (`YYYY-MM-DD`). */
export function weekStartOf(day: string): string {
  const d = utcNoon(day);
  if (!d) return day;
  return ymd(new Date(d.getTime() - d.getUTCDay() * DAY_MS));
}

/** `true` pour une date valide qui tombe un dimanche. */
export function isWeekStart(day: string): boolean {
  const d = utcNoon(day);
  return d !== null && ymd(d) === day && d.getUTCDay() === 0;
}

/** Les `count` semaines PASSÉES, de la plus récente à la plus ancienne. */
export function previousWeekStarts(now: Date, count: number): string[] {
  const current = utcNoon(weekStartOf(ymd(now)))!;
  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(ymd(new Date(current.getTime() - i * 7 * DAY_MS)));
  return out;
}

// ── Les annonces d'un trade ─────────────────────────────────────────────────

export interface TradeLike {
  symbol: string;
  date: string;
  /** `HH:MM`, heure locale — facultatif. */
  entryTime?: string;
  exitTime?: string;
}

export interface TradeNewsItem {
  event: NewsEvent;
  /** `HH:MM` local, `null` pour une annonce sans heure. */
  time: string | null;
  /** L'annonce est tombée pendant la position (±15 min). */
  duringTrade: boolean;
}

export interface TradeNews {
  /** Les devises du trade (vide : symbole inconnu, rien n'est affirmé). */
  currencies: string[];
  items: TradeNewsItem[];
  /** Au moins une annonce vient du repli intégré (heure approximative). */
  approximate: boolean;
  highCount: number;
}

export interface Clock {
  dayOf: (iso: string) => string;
  timeOf: (iso: string) => string;
}

const LOCAL_CLOCK: Clock = {
  dayOf: (iso) => localDateOf(new Date(iso)),
  timeOf: (iso) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
};

function minutes(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const MARGIN_MIN = 15;

/** Les annonces fortes et moyennes qui ont touché ce trade, dans l'ordre du jour. */
export function newsForTrade(
  trade: TradeLike,
  events: NewsEvent[],
  clock: Clock = LOCAL_CLOCK,
): TradeNews {
  const currencies = currenciesForSymbol(trade.symbol);
  if (!currencies.length || !trade.date) {
    return { currencies, items: [], approximate: false, highCount: 0 };
  }
  const ccy = new Set<string>(currencies);
  const start = minutes(trade.entryTime);
  const endRaw = minutes(trade.exitTime);
  // Une sortie « avant » l'entrée est une position passée minuit.
  const end = start !== null && endRaw !== null && endRaw < start ? endRaw + 1440 : endRaw;

  const items: TradeNewsItem[] = [];
  for (const e of events) {
    if (e.impact !== "high" && e.impact !== "medium") continue;
    if (!ccy.has(e.currency)) continue;
    if (clock.dayOf(e.startsAt) !== trade.date) continue;
    const time = e.allDay ? null : clock.timeOf(e.startsAt);
    const at = minutes(time ?? undefined);
    const duringTrade =
      at !== null &&
      start !== null &&
      at >= start - MARGIN_MIN &&
      at <= (end ?? start) + MARGIN_MIN;
    items.push({ event: e, time, duringTrade });
  }
  items.sort(
    (a, b) =>
      (a.time ?? "").localeCompare(b.time ?? "") ||
      (a.event.impact === b.event.impact ? 0 : a.event.impact === "high" ? -1 : 1),
  );
  return {
    currencies,
    items,
    approximate: items.some((i) => i.event.source === APPROXIMATE_SOURCE),
    highCount: items.filter((i) => i.event.impact === "high").length,
  };
}

// ── Jours d'annonce face aux jours calmes ───────────────────────────────────

export interface DayBucket {
  n: number;
  wins: number;
  losses: number;
  totalPnl: number;
  /** `null` sous l'échantillon minimum : aucun chiffre n'est affiché. */
  winRate: number | null;
  avgPnl: number | null;
  avgR: number | null;
}

export interface NewsDaySplit {
  /** Jours où au moins une annonce FORTE a touché les devises du trade. */
  newsDays: DayBucket;
  quietDays: DayBucket;
  /** Trades classés (devise connue ET semaine couverte par le calendrier réel). */
  classified: number;
  /** Trades laissés de côté faute de calendrier réel pour leur semaine. */
  uncovered: number;
  minSample: number;
}

function bucket(
  trades: { pnl: number; rMultiple?: number | null }[],
  minSample: number,
): DayBucket {
  const n = trades.length;
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const withR = trades.filter((t) => typeof t.rMultiple === "number" && t.rMultiple !== 0);
  const enough = n >= minSample;
  const decided = wins + losses;
  return {
    n,
    wins,
    losses,
    totalPnl,
    winRate: enough && decided > 0 ? wins / decided : null,
    avgPnl: enough ? totalPnl / n : null,
    avgR:
      enough && withR.length >= minSample
        ? withR.reduce((s, t) => s + (t.rMultiple as number), 0) / withR.length
        : null,
  };
}

/**
 * Sépare les trades selon que leur journée portait une annonce forte sur
 * leurs devises. Seul le calendrier RÉEL compte : une semaine connue
 * uniquement par le repli intégré (heures approximatives) est laissée de côté,
 * et le nombre de trades écartés est rendu pour être affiché.
 */
export function newsDaySplit(
  trades: (TradeLike & { pnl: number; rMultiple?: number | null })[],
  events: NewsEvent[],
  clock: Clock = LOCAL_CLOCK,
  minSample: number = MIN_BUCKET_SAMPLE,
): NewsDaySplit {
  const real = events.filter((e) => e.source !== APPROXIMATE_SOURCE);
  const coveredWeeks = new Set(real.map((e) => weekStartOf(clock.dayOf(e.startsAt))));
  const news: typeof trades = [];
  const quiet: typeof trades = [];
  let uncovered = 0;
  for (const t of trades) {
    if (!currenciesForSymbol(t.symbol).length) continue;
    if (!coveredWeeks.has(weekStartOf(t.date))) {
      uncovered++;
      continue;
    }
    const { highCount } = newsForTrade(t, real, clock);
    (highCount > 0 ? news : quiet).push(t);
  }
  return {
    newsDays: bucket(news, minSample),
    quietDays: bucket(quiet, minSample),
    classified: news.length + quiet.length,
    uncovered,
    minSample,
  };
}
