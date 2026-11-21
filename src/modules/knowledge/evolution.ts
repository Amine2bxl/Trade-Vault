import { isBreakEven, measuredR, type Trade } from "@/domain/trade";
import { MIN_BUCKET_SAMPLE } from "@/domain/quantStats";
import { seedFrom } from "@/modules/probability/rng";
import { MIN_GROUP, MIN_GROUP_SESSIONS } from "@/modules/patterns/thresholds";
import { detectSignatures, sessionOf, type BehaviorContext } from "./behavior";
import { sessionBlockDiff } from "./stats";

/**
 * ÉVOLUTION — le trader comparé à lui-même. Module PUR.
 *
 * Par mois : volume, résultat, taux et R (avec garde d'échantillon), et la
 * fréquence de chaque erreur, déclarée ou observée. Puis, pour chaque erreur,
 * les séances récentes face aux plus anciennes avec un intervalle : une
 * erreur ne « disparaît » que si l'écart tient, pas parce qu'un mois calme
 * l'a fait oublier.
 */

export const EVOLUTION_VERSION = 1;
export const RECENT_EVOLUTION_SHARE = 0.4;

export interface EvolutionWindow {
  month: string;
  n: number;
  sessions: number;
  pnl: number;
  /** `null` sous `MIN_BUCKET_SAMPLE` trades. */
  expectancy: number | null;
  winRate: number | null;
  avgR: number | null;
  /** Part des trades marqués de chaque erreur (déclarée) ou portant chaque signature. */
  rates: Record<string, number>;
}

export type TrendStatus =
  | "resolved"
  | "improving"
  | "new"
  | "worsening"
  | "persistent"
  | "stable"
  | "insufficient";

export interface BehaviourTrend {
  /** `tag:<erreur cochée>` ou `sig:<signature>`. */
  key: string;
  status: TrendStatus;
  earlier: number;
  recent: number;
  diff: number;
  low: number | null;
  high: number | null;
  nEarlier: number;
  nRecent: number;
}

export interface Evolution {
  windows: EvolutionWindow[];
  trends: BehaviourTrend[];
  since: string | null;
  version: number;
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function computeEvolution(
  trades: readonly Trade[],
  behavior: BehaviorContext = {},
): Evolution {
  const norm = (m: string) => m.trim().replace(/\s+/g, " ");
  const sigs = detectSignatures(trades, behavior);
  const sigOf = new Map<string, Set<string>>();
  for (const [k, list] of sigs)
    for (const id of list) {
      let set = sigOf.get(id);
      if (!set) sigOf.set(id, (set = new Set()));
      set.add(k);
    }
  const keysOf = (t: Trade): Set<string> => {
    const out = new Set<string>();
    for (const m of t.mistakes ?? []) if (norm(m)) out.add(`tag:${norm(m)}`);
    for (const s of sigOf.get(t.id) ?? []) out.add(`sig:${s}`);
    return out;
  };

  // ── Fenêtres mensuelles
  const months = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!/^\d{4}-\d{2}/.test(t.date)) continue;
    const m = t.date.slice(0, 7);
    let list = months.get(m);
    if (!list) months.set(m, (list = []));
    list.push(t);
  }
  const allKeys = new Set<string>();
  for (const t of trades) for (const k of keysOf(t)) allKeys.add(k);
  const windows: EvolutionWindow[] = [...months.keys()].sort().map((month) => {
    const list = months.get(month)!;
    const n = list.length;
    const pnl = list.reduce((s, t) => s + t.pnl, 0);
    const wins = list.filter((t) => t.pnl > 0 && !isBreakEven(t)).length;
    const losses = list.filter((t) => t.pnl < 0 && !isBreakEven(t)).length;
    const rs = list.map((t) => measuredR(t)).filter((r): r is number => r !== null);
    const rates: Record<string, number> = {};
    for (const k of allKeys) rates[k] = round(list.filter((t) => keysOf(t).has(k)).length / n, 3);
    const enough = n >= MIN_BUCKET_SAMPLE;
    return {
      month,
      n,
      sessions: new Set(list.map(sessionOf)).size,
      pnl: round(pnl, 2),
      expectancy: enough ? round(pnl / n, 2) : null,
      winRate: enough && wins + losses ? round(wins / (wins + losses), 3) : null,
      avgR:
        rs.length >= MIN_BUCKET_SAMPLE ? round(rs.reduce((s, r) => s + r, 0) / rs.length, 3) : null,
      rates,
    };
  });

  // ── Récent face à avant, par erreur
  const days = [...new Set(trades.map((t) => sessionOf(t).split("|")[1]))].sort();
  if (days.length < 2 * MIN_GROUP_SESSIONS)
    return { windows, trends: [], since: null, version: EVOLUTION_VERSION };
  const since = days[Math.floor(days.length * (1 - RECENT_EVOLUTION_SHARE))];
  const recent = trades.filter((t) => sessionOf(t).split("|")[1] >= since);
  const earlier = trades.filter((t) => sessionOf(t).split("|")[1] < since);
  const bySession = (list: readonly Trade[], k: string) => {
    const map = new Map<string, number[]>();
    for (const t of list) {
      const s = sessionOf(t);
      let arr = map.get(s);
      if (!arr) map.set(s, (arr = []));
      arr.push(keysOf(t).has(k) ? 1 : 0);
    }
    return [...map.keys()].sort().map((s) => map.get(s)!);
  };
  const trends: BehaviourTrend[] = [];
  for (const k of [...allKeys].sort()) {
    const total = trades.filter((t) => keysOf(t).has(k)).length;
    const er = earlier.length ? earlier.filter((t) => keysOf(t).has(k)).length / earlier.length : 0;
    const rr = recent.length ? recent.filter((t) => keysOf(t).has(k)).length / recent.length : 0;
    const base = {
      key: k,
      earlier: round(er, 3),
      recent: round(rr, 3),
      diff: round(rr - er, 3),
      nEarlier: earlier.length,
      nRecent: recent.length,
    };
    if (total < MIN_GROUP || earlier.length < MIN_GROUP || recent.length < MIN_GROUP) {
      trends.push({ ...base, status: "insufficient", low: null, high: null });
      continue;
    }
    const d = sessionBlockDiff(bySession(recent, k), bySession(earlier, k), {
      seed: seedFrom(`evolution:${k}:v${EVOLUTION_VERSION}`),
    });
    if (!d) {
      trends.push({ ...base, status: "insufficient", low: null, high: null });
      continue;
    }
    const excludes = d.low > 0 || d.high < 0;
    const status: TrendStatus = !excludes
      ? er >= 0.1 && rr >= 0.1
        ? "persistent"
        : "stable"
      : d.diff < 0
        ? rr === 0
          ? "resolved"
          : "improving"
        : er === 0
          ? "new"
          : "worsening";
    trends.push({ ...base, status, low: round(d.low, 3), high: round(d.high, 3) });
  }
  return { windows, trends, since, version: EVOLUTION_VERSION };
}
