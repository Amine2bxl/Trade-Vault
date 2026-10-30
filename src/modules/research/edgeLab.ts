import type { Trade } from "@/domain/trade";
import { measuredR } from "@/domain/trade";
import { easternClockOf } from "@/domain/easternClock";
import { getSessionForTrade, hasUnverifiedEtTime, type TradingSession } from "@/domain/quantStats";
import { seedFrom } from "@/modules/probability/rng";
import { MIN_SESSIONS, MIN_TRADES } from "@/modules/patterns/thresholds";
import { sessionBlockBootstrap, type BootstrapResult } from "./bootstrap";
import { benjaminiHochberg } from "./fdr";

/**
 * EDGELAB — dans quelles conditions le trader gagne-t-il, et à quel point le
 * sait-on ? Module pur (lot 2).
 *
 * Pour chaque valeur d'une dimension (setup, symbole, session, jour, compte),
 * le moteur rend : `n`, nombre de séances, espérance nette par trade, R
 * mesuré avec son propre `n`, dispersion, intervalle bootstrap PAR SÉANCES,
 * p et q corrigé pour les tests multiples (Benjamini-Hochberg), et un verdict
 * qui ne dit jamais « meilleur setup » :
 *
 *   • `insufficient` — sous MIN_TRADES trades ou MIN_SESSIONS séances
 *     (seuils UNIQUES du produit, `modules/patterns/thresholds`) : rien n'est
 *     affirmé, pas même un intervalle ;
 *   • `positive_observed` / `negative_observed` — l'intervalle exclut 0 ET
 *     q ≤ `FDR_ALPHA` : un ÉCART OBSERVÉ, pas un avantage durable prouvé ;
 *   • `indistinguishable` — compatible avec une espérance nulle.
 *
 * Un écart observé est en outre déclaré `fragile` s'il ne survit pas au
 * retrait de son meilleur (ou pire) trade : un seul gros gain ne fait pas
 * une condition.
 *
 * Les trades dont la dimension est INCONNUE (heure non prouvée, setup d'un
 * import non relu…) ne sont rangés nulle part : ils sont comptés à part, et la
 * couverture est rendue.
 */

export const EDGE_LAB_VERSION = 1;
/** Seuil de fausses découvertes déclaré. */
export const FDR_ALPHA = 0.1;

export type EdgeDimension = "strategy" | "symbol" | "session" | "weekday" | "account";

export type EdgeVerdict =
  | "insufficient"
  | "positive_observed"
  | "negative_observed"
  | "indistinguishable";

export type EdgeTrade = Pick<
  Trade,
  "id" | "date" | "pnl" | "riskAmount" | "symbol" | "strategy" | "entryTime"
> &
  Partial<
    Pick<Trade, "accountId" | "broker" | "reviewPending" | "riskSource" | "entryAt" | "exitAt">
  >;

export interface EdgeCell {
  key: string;
  n: number;
  sessions: number;
  /** P&L net moyen par trade. */
  netExpectancy: number;
  /** Écart-type du P&L par trade. */
  stdDev: number;
  /** R moyen sur les seuls trades à R mesuré — `null` sous le minimum. */
  expectancyR: number | null;
  nR: number;
  /** `null` quand `insufficient`. */
  bootstrap: BootstrapResult | null;
  q: number | null;
  verdict: EdgeVerdict;
  /** Seulement pour un écart observé : survit-il au retrait de son trade extrême ? */
  fragile: boolean | null;
}

export interface EdgeReport {
  dimension: EdgeDimension;
  cells: EdgeCell[];
  /** Trades sans valeur connue pour la dimension. */
  unknown: number;
  /** Part des trades classés, 0–1. */
  coverage: number;
  /** Nombre de valeurs réellement testées (base de la correction FDR). */
  tests: number;
  alpha: number;
  iterations: number;
  version: number;
  /** Coût supplémentaire par trade appliqué (stress des frais). */
  extraCostPerTrade: number;
}

/** La séance d'un trade : jour de New York de l'entrée prouvée, sinon sa date. */
export function sessionKey(t: Pick<EdgeTrade, "date" | "entryAt">): string {
  return easternClockOf(t.entryAt)?.date ?? t.date;
}

function weekdayOf(t: EdgeTrade): number | null {
  const clock = easternClockOf(t.entryAt);
  if (clock) return clock.weekday;
  // La date d'une saisie suit la convention du journal ; celle d'un import
  // dont l'heure n'est pas certifiée ne dit pas le jour de New York.
  if (hasUnverifiedEtTime({ broker: t.broker ?? null, reviewPending: !!t.reviewPending }))
    return null;
  const d = new Date(`${t.date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

export function dimensionValue(t: EdgeTrade, dimension: EdgeDimension): string | null {
  switch (dimension) {
    case "strategy":
      // Le setup d'un import non relu est une valeur par défaut, pas un choix.
      return t.reviewPending ? null : t.strategy?.trim() || null;
    case "symbol":
      return t.symbol?.trim().toUpperCase() || null;
    case "session": {
      const s: TradingSession | null = getSessionForTrade({
        entryTime: t.entryTime,
        broker: t.broker ?? null,
        reviewPending: !!t.reviewPending,
        entryAt: t.entryAt,
      });
      return s;
    }
    case "weekday": {
      const w = weekdayOf(t);
      return w === null ? null : String(w);
    }
    case "account":
      return t.accountId ?? null;
  }
}

function mean(xs: readonly number[]) {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}
function std(xs: readonly number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

function bySession(list: readonly EdgeTrade[], cost: number): number[][] {
  const map = new Map<string, number[]>();
  for (const t of list) {
    const k = sessionKey(t);
    const arr = map.get(k) ?? [];
    arr.push(t.pnl - cost);
    map.set(k, arr);
  }
  return [...map.keys()].sort().map((k) => map.get(k)!);
}

export interface EdgeOptions {
  /** Coût supplémentaire par trade (stress des frais), en devise. */
  extraCostPerTrade?: number;
  iterations?: number;
  /** Graine de base ; chaque valeur dérive la sienne de façon stable. */
  seed?: number;
}

export function analyzeDimension(
  trades: readonly EdgeTrade[],
  dimension: EdgeDimension,
  opts: EdgeOptions = {},
): EdgeReport {
  const cost = Math.max(0, opts.extraCostPerTrade ?? 0);
  const baseSeed = opts.seed ?? seedFrom(`edgelab:${dimension}:v${EDGE_LAB_VERSION}`);
  const groups = new Map<string, EdgeTrade[]>();
  let unknown = 0;
  for (const t of trades) {
    if (!Number.isFinite(t.pnl)) continue;
    const v = dimensionValue(t, dimension);
    if (v === null) {
      unknown++;
      continue;
    }
    const list = groups.get(v) ?? [];
    list.push(t);
    groups.set(v, list);
  }

  const cells: EdgeCell[] = [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, list]) => {
      const pnls = list.map((t) => t.pnl - cost);
      const sessions = bySession(list, cost);
      const rs = list.map((t) => measuredR(t)).filter((r): r is number => r !== null);
      const eligible = list.length >= MIN_TRADES && sessions.length >= MIN_SESSIONS;
      return {
        key,
        n: list.length,
        sessions: sessions.length,
        netExpectancy: mean(pnls),
        stdDev: std(pnls),
        expectancyR: rs.length >= MIN_TRADES ? mean(rs) : null,
        nR: rs.length,
        bootstrap: eligible
          ? sessionBlockBootstrap(sessions, {
              seed: (baseSeed ^ seedFrom(key)) >>> 0,
              iterations: opts.iterations,
            })
          : null,
        q: null,
        verdict: "insufficient" as EdgeVerdict,
        fragile: null,
      };
    });

  // Correction sur les SEULES valeurs testées : celles qui n'ont pas
  // d'échantillon ne comptent pas comme tests (et ne sont pas « gagnées »).
  const qs = benjaminiHochberg(cells.map((c) => c.bootstrap?.p ?? null));
  cells.forEach((c, i) => {
    c.q = qs[i];
    if (!c.bootstrap || c.q === null) return;
    const excludesZero = c.bootstrap.low > 0 || c.bootstrap.high < 0;
    if (c.q <= FDR_ALPHA && excludesZero) {
      c.verdict = c.bootstrap.low > 0 ? "positive_observed" : "negative_observed";
      c.fragile = isFragile(groups.get(c.key)!, cost, c.verdict);
    } else {
      c.verdict = "indistinguishable";
    }
  });

  const classified = trades.length - unknown;
  return {
    dimension,
    cells,
    unknown,
    coverage: trades.length > 0 ? classified / trades.length : 0,
    tests: cells.filter((c) => c.bootstrap !== null).length,
    alpha: FDR_ALPHA,
    iterations: cells.find((c) => c.bootstrap)?.bootstrap?.iterations ?? opts.iterations ?? 0,
    version: EDGE_LAB_VERSION,
    extraCostPerTrade: cost,
  };
}

/** L'écart garde-t-il son signe sans son trade le plus favorable ? */
function isFragile(list: readonly EdgeTrade[], cost: number, verdict: EdgeVerdict): boolean {
  const pnls = list.map((t) => t.pnl - cost).sort((a, b) => a - b);
  const without = verdict === "positive_observed" ? pnls.slice(0, -1) : pnls.slice(1);
  if (without.length === 0) return true;
  const m = mean(without);
  return verdict === "positive_observed" ? m <= 0 : m >= 0;
}

// ── Validation chronologique ─────────────────────────────────────────────────

export type HoldoutStatus = "confirmed" | "not_confirmed" | "insufficient_holdout";

export interface ChronoSplit {
  /** Séances (jours) de chaque période, dans l'ordre. */
  train: string[];
  validation: string[];
  holdout: string[];
}

/**
 * Découpe chronologique PAR SÉANCES : apprentissage, validation, holdout.
 * Les séances ne sont jamais mélangées : le holdout est la période la plus
 * récente, figée par sa première date.
 */
export function chronologicalSplit(
  trades: readonly EdgeTrade[],
  fractions: { train: number; validation: number } = { train: 0.6, validation: 0.2 },
): ChronoSplit {
  const days = [...new Set(trades.map(sessionKey))].sort();
  const a = Math.floor(days.length * fractions.train);
  const b = Math.floor(days.length * (fractions.train + fractions.validation));
  return { train: days.slice(0, a), validation: days.slice(a, b), holdout: days.slice(b) };
}

export interface OutOfSampleCell {
  key: string;
  verdict: "positive_observed" | "negative_observed";
  /** Même sens en validation (n ≥ minimum de groupe) ? */
  validation: HoldoutStatus;
  holdout: HoldoutStatus;
  holdoutN: number;
  holdoutExpectancy: number | null;
}

/**
 * Les écarts SÉLECTIONNÉS sur la seule période d'apprentissage, puis
 * vérifiés hors échantillon. Le holdout ne sert jamais à choisir : changer
 * ses trades ne change pas la liste des valeurs examinées (test dédié).
 */
export function outOfSample(
  trades: readonly EdgeTrade[],
  dimension: EdgeDimension,
  opts: EdgeOptions & { minGroup?: number } = {},
): { split: ChronoSplit; cells: OutOfSampleCell[] } {
  const split = chronologicalSplit(trades);
  const inPeriod = (days: string[]) => {
    const set = new Set(days);
    return trades.filter((t) => set.has(sessionKey(t)));
  };
  const discovery = analyzeDimension(inPeriod(split.train), dimension, opts);
  const minGroup = opts.minGroup ?? 10;
  const cost = Math.max(0, opts.extraCostPerTrade ?? 0);
  const check = (period: EdgeTrade[], key: string, sign: number) => {
    const list = period.filter((t) => dimensionValue(t, dimension) === key);
    if (list.length < minGroup)
      return { status: "insufficient_holdout" as const, n: list.length, m: null };
    const m = mean(list.map((t) => t.pnl - cost));
    return {
      status: (Math.sign(m) === sign ? "confirmed" : "not_confirmed") as HoldoutStatus,
      n: list.length,
      m,
    };
  };
  const validationTrades = inPeriod(split.validation);
  const holdoutTrades = inPeriod(split.holdout);
  const cells = discovery.cells
    .filter(
      (c): c is EdgeCell & { verdict: "positive_observed" | "negative_observed" } =>
        c.verdict === "positive_observed" || c.verdict === "negative_observed",
    )
    .map((c) => {
      const sign = c.verdict === "positive_observed" ? 1 : -1;
      const v = check(validationTrades, c.key, sign);
      const h = check(holdoutTrades, c.key, sign);
      return {
        key: c.key,
        verdict: c.verdict,
        validation: v.status,
        holdout: h.status,
        holdoutN: h.n,
        holdoutExpectancy: h.m,
      };
    });
  return { split, cells };
}
