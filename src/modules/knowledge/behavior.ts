import { hasMeasuredRisk, isBreakEven, type Trade } from "@/domain/trade";
import { compareChronological, verifiedPriorClosedTrade } from "@/domain/tradeOrder";
import { easternClockOf, instantMs } from "@/domain/easternClock";
import { sessionKey } from "@/modules/research";
import { MIN_GROUP } from "@/modules/patterns/thresholds";

/**
 * COMPORTEMENT OBSERVABLE — séquences, signatures d'erreurs, bibliothèque.
 * Module PUR (Neural Brain v2).
 *
 * Une erreur se DÉCLARE (le trader coche « Revenge trade ») ou s'OBSERVE
 * (un trade pris 12 minutes après une perte, avec un risque 1,6× la médiane).
 * Les deux ne coïncident pas toujours, et l'écart est lui-même une
 * information. Ce module rend les signatures observables à partir de champs
 * PROUVÉS (heures établies, risque mesuré, ordre de clôture vérifié) ; une
 * erreur qui demande une donnée absente (contexte HTF, placement du stop) est
 * listée comme telle, jamais devinée.
 */

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Séance d'un trade, cloisonnée par compte. */
export function sessionOf(t: Pick<Trade, "accountId" | "date" | "entryAt">): string {
  return `${t.accountId ?? ""}|${sessionKey(t)}`;
}

/**
 * Instants d'entrée et de sortie comparables, ou `null`. Instants UTC prouvés
 * d'abord ; sinon l'heure locale d'une saisie manuelle (même fuseau pour tout
 * le journal du trader). Une heure d'import non relu n'est pas une preuve.
 */
export function instantsOf(t: Trade): [number, number] | null {
  const a = instantMs(t.entryAt);
  const b = instantMs(t.exitAt);
  if (a !== null && b !== null) return b >= a ? [a, b] : null;
  if (t.broker || t.reviewPending) return null;
  const re = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  const e = re.exec(t.entryTime?.trim() ?? "");
  const x = re.exec(t.exitTime?.trim() ?? "");
  if (!e || !x || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return null;
  const base = Date.parse(`${t.date}T00:00:00Z`);
  const ea = base + (Number(e[1]) * 60 + Number(e[2])) * 60_000;
  const xa = base + (Number(x[1]) * 60 + Number(x[2])) * 60_000;
  return xa >= ea ? [ea, xa] : null;
}

/** L'heure d'entrée prouve-t-elle l'ordre dans la journée ? */
export function hasEntryClock(t: Trade): boolean {
  if (easternClockOf(t.entryAt)) return true;
  if (t.broker || t.reviewPending) return false;
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(t.entryTime?.trim() ?? "");
}

export interface Sequenced {
  trade: Trade;
  /** Trade précédent de la MÊME séance, ordre de clôture prouvé — sinon `null`. */
  prev: Trade | null;
  /** Gains consécutifs prouvés juste avant ce trade, dans la séance. */
  winStreak: number;
  /** Rang dans la séance (0 = premier), seulement si toutes les heures sont prouvées. */
  rank: number | null;
}

/** Le journal en séquences : précédent prouvé, série de gains, rang. */
export function sequence(trades: readonly Trade[]): Sequenced[] {
  const ordered = [...trades].sort(compareChronological);
  const bySession = new Map<string, Trade[]>();
  for (const t of ordered) {
    const k = sessionOf(t);
    let list = bySession.get(k);
    if (!list) bySession.set(k, (list = []));
    list.push(t);
  }
  const rank = new Map<string, number>();
  for (const list of bySession.values()) {
    if (!list.every(hasEntryClock)) continue;
    list.forEach((t, i) => rank.set(t.id, i));
  }
  const prevOf = new Map<string, Trade | null>();
  for (let i = 0; i < ordered.length; i++) {
    const p = verifiedPriorClosedTrade(ordered, i);
    prevOf.set(ordered[i].id, p && sessionOf(p) === sessionOf(ordered[i]) ? p : null);
  }
  const streak = new Map<string, number>();
  for (const t of ordered) {
    const p = prevOf.get(t.id);
    streak.set(t.id, p && !isBreakEven(p) && p.pnl > 0 ? (streak.get(p.id) ?? 0) + 1 : 0);
  }
  return ordered.map((t) => ({
    trade: t,
    prev: prevOf.get(t.id) ?? null,
    winStreak: streak.get(t.id) ?? 0,
    rank: rank.has(t.id) ? rank.get(t.id)! : null,
  }));
}

// ── Bibliothèque d'erreurs ──────────────────────────────────────────────────

export type ErrorFamily = "psychology" | "risk" | "entry" | "exit" | "discipline" | "context";

/** Comment une erreur se reconnaît dans les données du journal. */
export type ErrorDetection =
  /** Une signature calculée sur des champs prouvés. */
  | { mode: "signature"; method: string }
  /** Seulement déclarée par le trader (case cochée). */
  | { mode: "declared" }
  /** Ni observable ni déclarable aujourd'hui : la donnée manque. */
  | { mode: "needs_data"; data: string };

export interface ErrorEntry {
  id: string;
  family: ErrorFamily;
  /** Erreurs cochables (`MISTAKE_OPTIONS`) qui la DÉCLARENT. */
  tags: readonly string[];
  detection: ErrorDetection;
}

/**
 * LA BIBLIOTHÈQUE. Évolutive : une ligne par erreur. Les textes (nom,
 * mécanisme) vivent dans l'i18n de l'app (`brain.err.<id>`).
 */
export const ERROR_LIBRARY: readonly ErrorEntry[] = [
  {
    id: "revenge",
    family: "psychology",
    tags: ["Revenge trade"],
    detection: { mode: "signature", method: "entry<=30min after verified loss, same session" },
  },
  {
    id: "post_win_escalation",
    family: "risk",
    tags: ["Size too large"],
    detection: { mode: "signature", method: "risk>=1.25x median after >=2 verified wins" },
  },
  {
    id: "oversize",
    family: "risk",
    tags: ["Size too large"],
    detection: { mode: "signature", method: "risk>2x median measured risk" },
  },
  {
    id: "overtrading",
    family: "discipline",
    tags: ["Overtrading"],
    detection: { mode: "signature", method: "rank>p90 trades/session and >=4" },
  },
  {
    id: "premature_exit",
    family: "exit",
    tags: ["Premature exit"],
    detection: { mode: "signature", method: "win realising <30% of MFE" },
  },
  {
    id: "low_quality_entry",
    family: "entry",
    tags: [],
    detection: { mode: "signature", method: "setupQuality<=2 (reviewed trades)" },
  },
  {
    id: "plan_deviation",
    family: "discipline",
    tags: ["Ignored plan"],
    detection: { mode: "signature", method: "trade_reflection.plan_respected=no" },
  },
  {
    id: "risk_above_plan",
    family: "risk",
    tags: ["Size too large"],
    detection: { mode: "signature", method: "measured risk >1.1x trade_intent.planned_risk" },
  },
  { id: "fomo", family: "psychology", tags: ["FOMO entry"], detection: { mode: "declared" } },
  { id: "chasing", family: "entry", tags: ["Chased entry"], detection: { mode: "declared" } },
  { id: "no_stop", family: "risk", tags: ["No stop loss"], detection: { mode: "declared" } },
  { id: "holding", family: "exit", tags: ["Holding too long"], detection: { mode: "declared" } },
  { id: "averaging", family: "risk", tags: ["Averaged down"], detection: { mode: "declared" } },
  {
    id: "context_ignored",
    family: "context",
    tags: ["Ignored market conditions", "Low liquidity"],
    detection: { mode: "declared" },
  },
  {
    id: "htf_misread",
    family: "context",
    tags: [],
    detection: { mode: "needs_data", data: "htf" },
  },
  {
    id: "dol_misread",
    family: "context",
    tags: [],
    detection: { mode: "needs_data", data: "dol" },
  },
  {
    id: "stop_placement",
    family: "risk",
    tags: [],
    detection: { mode: "needs_data", data: "stop_price" },
  },
  {
    id: "target_placement",
    family: "exit",
    tags: [],
    detection: { mode: "needs_data", data: "target_price" },
  },
  {
    id: "no_confirmation",
    family: "entry",
    tags: [],
    detection: { mode: "needs_data", data: "confirmation" },
  },
  {
    id: "news_misread",
    family: "context",
    tags: [],
    detection: { mode: "needs_data", data: "news_thesis" },
  },
  {
    id: "bias_flip",
    family: "discipline",
    tags: [],
    detection: { mode: "needs_data", data: "session_bias" },
  },
];

export interface BehaviorContext {
  /** Réflexion d'après-trade, par trade. */
  planRespected?: Readonly<Record<string, "yes" | "partial" | "no" | null>>;
  /** Risque prévu à l'entrée, par trade. */
  plannedRisk?: Readonly<Record<string, number | null>>;
}

export const REVENGE_WINDOW_MIN = 30;

/**
 * Les trades qui portent chaque signature. Rien sous les données requises :
 * pas de médiane de risque sous `MIN_GROUP` risques mesurés, pas de rang sans
 * heures prouvées, pas de MFE inventé.
 */
export function detectSignatures(
  trades: readonly Trade[],
  ctx: BehaviorContext = {},
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, t: Trade) => {
    let list = out.get(id);
    if (!list) out.set(id, (list = []));
    list.push(t.id);
  };
  const seq = sequence(trades);
  const measured = trades.filter((t) => hasMeasuredRisk(t));
  const med = measured.length >= MIN_GROUP ? median(measured.map((t) => t.riskAmount)) : null;

  // Seuil d'hyperactivité RELATIF au trader : son 90e centile de trades par séance.
  const perSession = new Map<string, number>();
  for (const s of seq)
    if (s.rank !== null)
      perSession.set(sessionOf(s.trade), (perSession.get(sessionOf(s.trade)) ?? 0) + 1);
  const counts = [...perSession.values()].sort((a, b) => a - b);
  const p90 = counts.length >= MIN_GROUP ? counts[Math.floor(counts.length * 0.9)] : null;

  for (const s of seq) {
    const t = s.trade;
    const measuredRisk = hasMeasuredRisk(t) ? t.riskAmount : null;
    if (s.prev && !isBreakEven(s.prev) && s.prev.pnl < 0) {
      const a = instantsOf(s.prev);
      const b = instantsOf(t);
      if (a && b && b[0] >= a[1] && b[0] - a[1] <= REVENGE_WINDOW_MIN * 60_000) add("revenge", t);
    }
    if (med && measuredRisk !== null) {
      if (measuredRisk > 2 * med) add("oversize", t);
      if (s.winStreak >= 2 && measuredRisk >= 1.25 * med) add("post_win_escalation", t);
    }
    if (p90 !== null && s.rank !== null && s.rank + 1 > Math.max(3, p90)) add("overtrading", t);
    if (
      typeof t.mfe === "number" &&
      t.mfe > 0 &&
      t.pnl > 0 &&
      !t.reviewPending &&
      t.pnl < 0.3 * t.mfe
    )
      add("premature_exit", t);
    if (!t.reviewPending && t.setupQuality > 0 && t.setupQuality <= 2) add("low_quality_entry", t);
    if (ctx.planRespected?.[t.id] === "no") add("plan_deviation", t);
    const planned = ctx.plannedRisk?.[t.id];
    if (
      measuredRisk !== null &&
      typeof planned === "number" &&
      planned > 0 &&
      measuredRisk > 1.1 * planned
    )
      add("risk_above_plan", t);
  }
  return out;
}
