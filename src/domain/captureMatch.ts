/**
 * RAPPROCHEMENT — cette capture décrit-elle un trade DÉJÀ au journal ?
 *
 * Sert deux usages avec la même règle :
 *   • détection de doublons avant de créer un trade depuis une capture ;
 *   • rattachement d'une capture à son trade (importé du broker, saisi plus tôt).
 *
 * Le jour doit coïncider ; ensuite chaque indice (contrat, sens, heure
 * d'entrée, prix d'entrée) ajoute ou retire des points. Un indice absent ne
 * compte ni pour ni contre : on ne devine pas. Le niveau (`exact`, `likely`,
 * `possible`) décide de ce que l'interface propose — jamais d'action
 * automatique : le trader confirme.
 */

import { futuresSpecFor } from "./futuresContracts";

export interface MatchProbe {
  date: string | null;
  symbol: string | null;
  direction: "long" | "short" | null;
  /** `HH:MM`, convention du journal (New York). */
  entryTime: string | null;
  entryPrice: number | null;
}

export interface MatchableTrade {
  id: string;
  date: string;
  symbol: string;
  direction: "long" | "short" | "be";
  entryTime?: string | null;
  entryPrice?: number | null;
}

export type MatchLevel = "exact" | "likely" | "possible";

export interface TradeMatch {
  id: string;
  level: MatchLevel;
  score: number;
  /** Ce qui a pesé, pour l'afficher (« même heure », « prix à 2 ticks »…). */
  reasons: ("same_contract" | "same_family" | "same_direction" | "time" | "price")[];
}

const minuteOf = (hhmm: string | null | undefined): number | null => {
  const m = hhmm ? /^(\d{2}):(\d{2})$/.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** La famille d'un contrat : NQ et MNQ se lisent sur le même graphique. */
const familyOf = (symbol: string): string => {
  const spec = futuresSpecFor(symbol);
  const s = spec?.symbol ?? symbol.toUpperCase();
  return s.startsWith("M") && futuresSpecFor(s.slice(1)) ? s.slice(1) : s;
};

export function scoreMatch(
  probe: MatchProbe,
  trade: MatchableTrade,
): Omit<TradeMatch, "id" | "level"> | null {
  if (!probe.date || probe.date !== trade.date) return null;
  let score = 1;
  const reasons: TradeMatch["reasons"] = [];

  if (probe.symbol) {
    const a = futuresSpecFor(probe.symbol)?.symbol ?? probe.symbol.toUpperCase();
    const b = futuresSpecFor(trade.symbol)?.symbol ?? trade.symbol.toUpperCase();
    if (a === b) {
      score += 3;
      reasons.push("same_contract");
    } else if (familyOf(a) === familyOf(b)) {
      score += 2;
      reasons.push("same_family");
    } else return null;
  }

  if (probe.direction && trade.direction !== "be") {
    if (probe.direction !== trade.direction) return null;
    score += 1;
    reasons.push("same_direction");
  }

  const pm = minuteOf(probe.entryTime);
  const tm = minuteOf(trade.entryTime);
  if (pm !== null && tm !== null) {
    const d = Math.abs(pm - tm);
    if (d <= 2) score += 3;
    else if (d <= 10) score += 2;
    else if (d <= 30) score += 1;
    else score -= 2;
    if (d <= 30) reasons.push("time");
  }

  if (probe.entryPrice != null && trade.entryPrice != null && trade.entryPrice > 0) {
    const tick = futuresSpecFor(trade.symbol)?.tickSize ?? probe.entryPrice * 0.0001;
    const ticks = Math.abs(probe.entryPrice - trade.entryPrice) / tick;
    if (ticks <= 2) score += 3;
    else if (ticks <= 8) score += 2;
    else if (ticks <= 40) score += 1;
    else score -= 3;
    if (ticks <= 40) reasons.push("price");
  }

  return { score, reasons };
}

const levelOf = (score: number): MatchLevel | null =>
  score >= 8 ? "exact" : score >= 5 ? "likely" : score >= 3 ? "possible" : null;

/** Les trades qui pourraient être celui de la capture, du plus probable au moins probable. */
export function findTradeMatches(
  probe: MatchProbe,
  trades: readonly MatchableTrade[],
  limit = 3,
): TradeMatch[] {
  const out: TradeMatch[] = [];
  for (const t of trades) {
    const s = scoreMatch(probe, t);
    const level = s ? levelOf(s.score) : null;
    if (s && level) out.push({ id: t.id, level, ...s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
