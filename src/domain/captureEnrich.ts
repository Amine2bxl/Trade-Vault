/**
 * ENRICHISSEMENT D'UNE CAPTURE — tout ce qu'une formule suffit à établir.
 *
 * L'IA lit ; ce module calcule. Contrat, tick, valeur du point, distance du
 * stop, risque engagé, R visé et réalisé, gain potentiel, durée, nombre de
 * bougies, session : jamais demandés au modèle. Chaque valeur calculée porte
 * la confiance de sa donnée la MOINS sûre — un R calculé depuis un stop
 * « à revoir » est lui-même « à revoir ».
 *
 * Trois durées distinctes, jamais confondues :
 *   • `elapsedMinutes`  — minutes d'horloge entre l'entrée et la sortie ;
 *   • `theoreticalCandles` — bougies de l'unité de temps que le marché a
 *     réellement ouvertes sur ce laps (pauses CME et week-end exclues) ;
 *   • `actualCandles` — bougies présentes dans des données OHLC : INCONNU tant
 *     que TradeVault n'a pas de données intraday (jamais remplacé par le
 *     théorique).
 *
 * Les heures sont rendues dans la convention du journal (heure de New York).
 */

import {
  TIMEFRAME_MINUTES,
  weakest,
  type CaptureExtraction,
  type CapturedField,
  type Confidence,
} from "./capture";
import { easternClockOf } from "./easternClock";
import { futuresSpecFor, type FuturesSpec } from "./futuresContracts";
import { plannedR, rFromPrices, stopDistance } from "./executionPlan";
import { getSession, type TradingSession } from "./quantStats";

const NY = "America/New_York";
const MAX_SPAN_MINUTES = 7 * 1440;

const calc = <T>(value: T | null, ...inputs: Confidence[]): CapturedField<T> =>
  value === null
    ? { value: null, confidence: "unknown", origin: "calculated" }
    : { value, confidence: weakest(...inputs), origin: "calculated" };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Fuseaux ─────────────────────────────────────────────────────────────────

/** Décalage (minutes) du fuseau `tz` à l'instant `utcMs` : heure murale − UTC. */
function offsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return Math.round((wall - Math.floor(utcMs / 60_000) * 60_000) / 60_000);
}

/** L'instant UTC d'une heure murale `date` + `HH:MM` dans `tz`. */
export function wallTimeToUtc(date: string, hhmm: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = offsetMinutes(guess, tz);
  let utc = guess - first * 60_000;
  const second = offsetMinutes(utc, tz);
  if (second !== first) utc = guess - second * 60_000;
  return utc;
}

const hhmmOf = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

// ── Horaires de marché ─────────────────────────────────────────────────────

/** `cme_globex` : dimanche 18:00 → vendredi 17:00 ET, pause 17:00–18:00 du lundi au jeudi. */
export type MarketSchedule = "cme_globex" | "continuous";

export function scheduleFor(symbol: string | null): MarketSchedule {
  return symbol && futuresSpecFor(symbol) ? "cme_globex" : "continuous";
}

function cmeOpen(weekday: number, minute: number): boolean {
  if (weekday === 6) return false; // samedi
  if (weekday === 0) return minute >= 1080; // dimanche, ouverture 18:00
  if (weekday === 5) return minute < 1020; // vendredi, clôture 17:00
  return minute < 1020 || minute >= 1080; // pause quotidienne 17:00–18:00
}

export interface CandleSpan {
  elapsedMinutes: number;
  marketMinutes: number;
  theoreticalCandles: number;
}

/**
 * Le laps entre deux instants UTC, compté minute par minute à l'heure de New
 * York. Une bougie de `tfMinutes` est alignée sur l'ouverture de séance
 * (18:00 ET) pour la CME, sur minuit sinon ; la bougie de la sortie compte.
 */
export function candleSpan(
  entryUtc: number,
  exitUtc: number,
  tfMinutes: number,
  schedule: MarketSchedule,
): CandleSpan | null {
  const elapsed = Math.round((exitUtc - entryUtc) / 60_000);
  if (!(elapsed >= 0) || elapsed > MAX_SPAN_MINUTES || !(tfMinutes > 0)) return null;
  const start = easternClockOf(new Date(entryUtc).toISOString());
  if (!start) return null;
  let { minute, weekday } = start;
  let day = 0;
  let marketMinutes = 0;
  const bars = new Set<string>();
  for (let i = 0; i <= elapsed; i++) {
    const open = schedule === "continuous" || cmeOpen(weekday, minute);
    if (open) {
      if (i < elapsed) marketMinutes++;
      const anchor = schedule === "cme_globex" ? 1080 : 0;
      const sinceAnchor = (minute - anchor + 1440) % 1440;
      const sessionDay = schedule === "cme_globex" && minute >= 1080 ? day + 1 : day;
      bars.add(
        tfMinutes >= 1440
          ? `${sessionDay}`
          : `${sessionDay}:${Math.floor(sinceAnchor / tfMinutes)}`,
      );
    }
    minute++;
    if (minute === 1440) {
      minute = 0;
      day++;
      weekday = (weekday + 1) % 7;
    }
  }
  return { elapsedMinutes: elapsed, marketMinutes, theoreticalCandles: bars.size };
}

// ── Enrichissement ─────────────────────────────────────────────────────────

export interface CaptureContext {
  /** Risque prévu par trade (compte actif ou plan de séance), en dollars. */
  plannedRiskDollars?: number | null;
}

export interface CaptureDerived {
  contract: Pick<FuturesSpec, "symbol" | "tickSize" | "tickValue" | "pointValue"> | null;
  /** Date et heures dans la convention du journal (New York). */
  dateEt: CapturedField<string>;
  entryTimeEt: CapturedField<string>;
  exitTimeEt: CapturedField<string>;
  session: CapturedField<TradingSession>;
  stopPoints: CapturedField<number>;
  stopTicks: CapturedField<number>;
  /** Risque réellement engagé : distance du stop × valeur du point × quantité. */
  riskDollars: CapturedField<number>;
  /** Risque prévu (compte ou séance), à côté — jamais confondu avec l'engagé. */
  plannedRiskDollars: CapturedField<number>;
  /** Contrats que le risque prévu autorise, quand la quantité n'est pas visible. */
  contractsForPlannedRisk: CapturedField<number>;
  plannedR: CapturedField<number>;
  /**
   * La sortie quand seul le RÉSULTAT est visible (« cible touchée » sans prix
   * de sortie imprimé) : la cible ou le stop, jamais mieux qu'estimée.
   */
  impliedExit: CapturedField<number>;
  realizedR: CapturedField<number>;
  rewardDollars: CapturedField<number>;
  /** P&L brut (sans frais) qu'impliquent les prix — une estimation, pas le P&L du broker. */
  grossPnl: CapturedField<number>;
  elapsedMinutes: CapturedField<number>;
  theoreticalCandles: CapturedField<number>;
  actualCandles: { value: null; reason: "no_intraday_data" };
}

export function enrichCapture(x: CaptureExtraction, ctx: CaptureContext = {}): CaptureDerived {
  const symbol = x.symbol.value;
  const spec = symbol ? futuresSpecFor(symbol) : null;
  const side = x.direction.value;
  const entry = x.entryPrice.value;
  const stop = x.stopPrice.value;
  const target = x.targetPrice.value;
  const outcomeLevel =
    x.outcome.value === "target" ? x.targetPrice : x.outcome.value === "stop" ? x.stopPrice : null;
  const impliedExit = calc(
    x.exitPrice.value === null && outcomeLevel?.value != null ? outcomeLevel.value : null,
    x.outcome.confidence,
    outcomeLevel?.confidence ?? "unknown",
    "estimated",
  );
  const exit = x.exitPrice.value ?? impliedExit.value;
  const exitConfidence =
    x.exitPrice.value !== null ? x.exitPrice.confidence : impliedExit.confidence;
  const qty = x.quantity.value;
  const sc = x.symbol.confidence;

  // Heures → New York. Sans fuseau lu, l'heure garde la convention du journal
  // mais ne vaut plus qu'« à revoir ».
  const tz = x.chartTimezone.value;
  const tzConf: Confidence = tz ? x.chartTimezone.confidence : "needs_review";
  const date = x.date.value;
  const toEt = (hhmm: string | null, dayOffset = 0) => {
    if (!hhmm || !date) return null;
    const base = new Date(`${date}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dayOffset);
    const day = base.toISOString().slice(0, 10);
    const utc = wallTimeToUtc(day, hhmm, tz ?? NY);
    const et = easternClockOf(new Date(utc).toISOString());
    return et ? { utc, date: et.date, hhmm: hhmmOf(et.minute) } : null;
  };
  const entryEt = toEt(x.entryTime.value);
  // Sortie avant l'entrée : position de nuit supposée, donc seulement estimée.
  const overnight = !!(
    x.entryTime.value &&
    x.exitTime.value &&
    x.exitTime.value < x.entryTime.value
  );
  const exitEt = toEt(x.exitTime.value, overnight ? 1 : 0);
  const exitConf: Confidence = overnight
    ? weakest(x.exitTime.confidence, "estimated")
    : x.exitTime.confidence;

  const dateEt = calc(entryEt?.date ?? date, x.date.confidence, entryEt ? tzConf : "high");
  const entryTimeEt = calc(
    entryEt?.hhmm ?? null,
    x.entryTime.confidence,
    x.date.confidence,
    tzConf,
  );
  const exitTimeEt = calc(exitEt?.hhmm ?? null, exitConf, x.date.confidence, tzConf);
  const session = calc(
    entryTimeEt.value ? getSession(entryTimeEt.value) : null,
    entryTimeEt.confidence,
  );

  const points = side ? stopDistance(side, entry, stop) : null;
  const lc = weakest(x.direction.confidence, x.entryPrice.confidence, x.stopPrice.confidence);
  const stopPoints = calc(points != null ? round2(points) : null, lc);
  const stopTicks = calc(
    spec && points != null ? Math.round(points / spec.tickSize) : null,
    lc,
    sc,
  );
  const riskDollars = calc(
    spec && points != null && qty ? round2(points * spec.pointValue * qty) : null,
    lc,
    sc,
    x.quantity.confidence,
  );
  const planned =
    ctx.plannedRiskDollars && ctx.plannedRiskDollars > 0 ? ctx.plannedRiskDollars : null;
  const plannedRiskDollars = calc(planned, "high");
  const contractsForPlannedRisk = calc(
    !qty && planned && spec && points
      ? Math.floor(planned / (points * spec.pointValue)) || null
      : null,
    lc,
    sc,
  );

  const pr = side ? plannedR(side, entry, stop, target) : null;
  const rr = side ? rFromPrices(side, entry, stop, exit) : null;
  const plannedRField = calc(pr, lc, x.targetPrice.confidence);
  const realizedR = calc(rr, lc, exitConfidence);
  const reward =
    side && spec && qty && entry != null && target != null && pr != null
      ? round2(Math.abs(target - entry) * spec.pointValue * qty)
      : null;
  const rewardDollars = calc(reward, lc, x.targetPrice.confidence, sc, x.quantity.confidence);
  const move =
    side && entry != null && exit != null ? (side === "long" ? exit - entry : entry - exit) : null;
  const grossPnl = calc(
    move != null && spec && qty ? round2(move * spec.pointValue * qty) : null,
    x.direction.confidence,
    x.entryPrice.confidence,
    exitConfidence,
    sc,
    x.quantity.confidence,
    "estimated",
  );

  const tfMin = x.timeframe.value ? TIMEFRAME_MINUTES[x.timeframe.value] : undefined;
  const span =
    entryEt && exitEt && tfMin
      ? candleSpan(entryEt.utc, exitEt.utc, tfMin, scheduleFor(symbol))
      : entryEt && exitEt
        ? candleSpan(entryEt.utc, exitEt.utc, 1, scheduleFor(symbol))
        : null;
  const timeConf = weakest(entryTimeEt.confidence, exitTimeEt.confidence);
  const elapsedMinutes = calc(span?.elapsedMinutes ?? null, timeConf);
  const theoreticalCandles = calc(
    span && tfMin ? span.theoreticalCandles : null,
    timeConf,
    x.timeframe.confidence,
    spec ? "high" : "estimated",
  );

  return {
    contract: spec
      ? {
          symbol: spec.symbol,
          tickSize: spec.tickSize,
          tickValue: spec.tickValue,
          pointValue: spec.pointValue,
        }
      : null,
    dateEt,
    entryTimeEt,
    exitTimeEt,
    session,
    stopPoints,
    stopTicks,
    riskDollars,
    plannedRiskDollars,
    contractsForPlannedRisk,
    plannedR: plannedRField,
    impliedExit,
    realizedR,
    rewardDollars,
    grossPnl,
    elapsedMinutes,
    theoreticalCandles,
    actualCandles: { value: null, reason: "no_intraday_data" },
  };
}
