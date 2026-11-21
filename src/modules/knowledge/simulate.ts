import { hasMeasuredRisk, isBreakEven, type Trade } from "@/domain/trade";
import { compareChronological } from "@/domain/tradeOrder";
import { makeRng, randomIndex, seedFrom } from "@/modules/probability/rng";
import { hasEntryClock, sessionOf, type BehaviorContext } from "./behavior";

/**
 * SIMULATION — rejouer l'historique avec d'autres décisions. Module PUR.
 *
 * Trois natures, jamais confondues, chacune étiquetée dans le résultat :
 *   • OBSERVÉ — la courbe réelle, trade par trade ;
 *   • HYPOTHÉTIQUE — la même suite de trades, modifiée par une règle
 *     (« sans les trades marqués FOMO », « au plus deux trades par séance ») :
 *     ce que CES trades ont rendu, pas ce que le trader aurait gagné — un
 *     trader qui s'arrête plus tôt ne vit pas la même séance ;
 *   • SIMULATION STATISTIQUE — un éventail de futurs obtenus en
 *     rééchantillonnant des SÉANCES entières passées (la dépendance d'une
 *     journée est gardée) ; il suppose que l'avenir ressemble au passé.
 *
 * Une règle qui exige un ordre prouvé (plafond, arrêt après N pertes) ne
 * s'applique pas à une séance aux heures non prouvées : ces séances restent
 * telles quelles et sont COMPTÉES.
 */

export const SIMULATION_VERSION = 1;

export type ScenarioRule =
  | { kind: "risk_scale"; factor: number }
  | { kind: "cap_per_session"; max: number }
  | { kind: "exclude_mistake"; mistake: string }
  | { kind: "exclude_setup"; setup: string }
  | { kind: "only_setup"; setup: string }
  | { kind: "stop_after_losses"; losses: number }
  | { kind: "plan_only" };

export interface PathStats {
  trades: number;
  net: number;
  maxDrawdown: number;
  /** Parmi les trades décisifs ; `null` sans trade décisif. */
  winRate: number | null;
  expectancy: number | null;
}

export interface ScenarioResult {
  label: "hypothetical";
  rules: ScenarioRule[];
  actual: PathStats;
  scenario: PathStats;
  /** P&L cumulé après chaque trade réel, dans l'ordre chronologique. */
  actualPath: number[];
  /** Même axe : un trade retiré laisse la courbe à plat. */
  scenarioPath: number[];
  removed: number;
  /** Trades dont le P&L a été mis à l'échelle (risque mesuré seulement). */
  scaled: number;
  /** Trades laissés tels quels faute de risque mesuré (règle de risque). */
  unscaled: number;
  /** Séances laissées telles quelles faute d'ordre prouvé (plafond, arrêt). */
  unprovenSessions: number;
  /** P&L de chaque trade dans le scénario ; un trade retiré vaut 0. */
  scenarioPnl: Record<string, number>;
  version: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function pathStats(pnls: readonly number[]): PathStats {
  let equity = 0;
  let peak = 0;
  let dd = 0;
  let wins = 0;
  let losses = 0;
  for (const p of pnls) {
    equity += p;
    peak = Math.max(peak, equity);
    dd = Math.max(dd, peak - equity);
    if (p > 0) wins++;
    else if (p < 0) losses++;
  }
  return {
    trades: pnls.length,
    net: round2(equity),
    maxDrawdown: round2(dd),
    winRate: wins + losses ? wins / (wins + losses) : null,
    expectancy: pnls.length ? round2(equity / pnls.length) : null,
  };
}

/** Bornes des réglages : une valeur venue d'un curseur ne sort jamais du sens. */
function sanitize(rule: ScenarioRule): ScenarioRule | null {
  switch (rule.kind) {
    case "risk_scale":
      return Number.isFinite(rule.factor) && rule.factor > 0
        ? { kind: "risk_scale", factor: Math.min(4, Math.max(0.1, rule.factor)) }
        : null;
    case "cap_per_session":
      return { kind: "cap_per_session", max: Math.min(20, Math.max(1, Math.floor(rule.max || 1))) };
    case "stop_after_losses":
      return {
        kind: "stop_after_losses",
        losses: Math.min(10, Math.max(1, Math.floor(rule.losses || 1))),
      };
    case "exclude_mistake":
    case "exclude_setup":
    case "only_setup":
      return "mistake" in rule
        ? rule.mistake.trim()
          ? rule
          : null
        : rule.setup.trim()
          ? rule
          : null;
    case "plan_only":
      return rule;
  }
}

/**
 * Rejoue l'historique avec les règles, dans l'ordre donné. Rend la courbe
 * observée et la courbe hypothétique sur le même axe (les trades réels).
 */
export function runScenario(
  trades: readonly Trade[],
  rulesIn: readonly ScenarioRule[],
  behavior: BehaviorContext = {},
): ScenarioResult {
  const rules = rulesIn.map(sanitize).filter((r): r is ScenarioRule => r !== null);
  const ordered = [...trades].filter((t) => Number.isFinite(t.pnl)).sort(compareChronological);
  const keep = new Map<string, boolean>(ordered.map((t) => [t.id, true]));
  const pnl = new Map<string, number>(ordered.map((t) => [t.id, t.pnl]));
  let scaled = 0;
  let unscaled = 0;
  const unproven = new Set<string>();

  const sessions = new Map<string, Trade[]>();
  for (const t of ordered) {
    const k = sessionOf(t);
    let list = sessions.get(k);
    if (!list) sessions.set(k, (list = []));
    list.push(t);
  }
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

  for (const rule of rules) {
    switch (rule.kind) {
      case "risk_scale":
        for (const t of ordered) {
          if (!keep.get(t.id)) continue;
          if (hasMeasuredRisk(t)) {
            pnl.set(t.id, pnl.get(t.id)! * rule.factor);
            scaled++;
          } else unscaled++;
        }
        break;
      case "exclude_mistake":
        for (const t of ordered)
          if ((t.mistakes ?? []).some((m) => norm(m) === norm(rule.mistake))) keep.set(t.id, false);
        break;
      case "exclude_setup":
        for (const t of ordered)
          if (!t.reviewPending && norm(t.strategy ?? "") === norm(rule.setup))
            keep.set(t.id, false);
        break;
      case "only_setup":
        for (const t of ordered)
          if (t.reviewPending || norm(t.strategy ?? "") !== norm(rule.setup)) keep.set(t.id, false);
        break;
      case "plan_only":
        for (const t of ordered) if (behavior.planRespected?.[t.id] === "no") keep.set(t.id, false);
        break;
      case "cap_per_session":
      case "stop_after_losses":
        for (const [k, list] of sessions) {
          const live = list.filter((t) => keep.get(t.id));
          if (!live.length) continue;
          if (!live.every(hasEntryClock)) {
            unproven.add(k);
            continue;
          }
          if (rule.kind === "cap_per_session") {
            live.slice(rule.max).forEach((t) => keep.set(t.id, false));
          } else {
            let streak = 0;
            let stopped = false;
            for (const t of live) {
              if (stopped) {
                keep.set(t.id, false);
                continue;
              }
              const p = pnl.get(t.id)!;
              streak = p < 0 && !isBreakEven({ pnl: p }) ? streak + 1 : 0;
              if (streak >= rule.losses) stopped = true;
            }
          }
        }
        break;
    }
  }

  const actualPnls = ordered.map((t) => t.pnl);
  const scenarioPnls = ordered.filter((t) => keep.get(t.id)).map((t) => pnl.get(t.id)!);
  const actualPath: number[] = [];
  const scenarioPath: number[] = [];
  let a = 0;
  let s = 0;
  for (const t of ordered) {
    a += t.pnl;
    if (keep.get(t.id)) s += pnl.get(t.id)!;
    actualPath.push(round2(a));
    scenarioPath.push(round2(s));
  }
  return {
    label: "hypothetical",
    rules,
    actual: pathStats(actualPnls),
    scenario: pathStats(scenarioPnls),
    actualPath,
    scenarioPath,
    removed: ordered.length - scenarioPnls.length,
    scaled,
    unscaled,
    unprovenSessions: unproven.size,
    scenarioPnl: Object.fromEntries(
      ordered.map((t) => [t.id, keep.get(t.id) ? round2(pnl.get(t.id)!) : 0]),
    ),
    version: SIMULATION_VERSION,
  };
}

// ── Simulation statistique : l'éventail des futurs ──────────────────────────

export interface Projection {
  label: "statistical";
  horizon: number;
  paths: number;
  seed: number;
  /** Percentiles du P&L cumulé à chaque séance simulée (index 0 = après la 1re). */
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
  /** Quelques trajectoires complètes, pour dessiner l'éventail. */
  samples: number[][];
  /** Part des trajectoires qui finissent sous zéro. */
  probLoss: number;
  /** Séances réelles rééchantillonnées. */
  sessions: number;
}

/**
 * Rééchantillonne des séances entières (somme de leurs P&L) pour `horizon`
 * séances futures. `null` sous 10 séances : trop peu de journées différentes
 * pour qu'un éventail dise autre chose que le passé recopié.
 */
export function projectSessions(
  trades: readonly {
    id: string;
    date: string;
    accountId?: string | null;
    entryAt?: string | null;
  }[],
  pnlOf: (id: string) => number | null,
  opts: { horizon?: number; paths?: number; seed?: number; samples?: number } = {},
): Projection | null {
  const sums = new Map<string, number>();
  for (const t of trades) {
    const p = pnlOf(t.id);
    if (p === null) continue;
    const k = sessionOf(t);
    sums.set(k, (sums.get(k) ?? 0) + p);
  }
  const blocks = [...sums.keys()].sort().map((k) => sums.get(k)!);
  if (blocks.length < 10) return null;
  const horizon = Math.min(250, Math.max(5, Math.floor(opts.horizon ?? 60)));
  const paths = Math.min(10_000, Math.max(200, Math.floor(opts.paths ?? 2000)));
  const seed = opts.seed ?? seedFrom(`brain-projection:v${SIMULATION_VERSION}`);
  const rng = makeRng(seed);
  const keepSamples = Math.min(paths, opts.samples ?? 24);
  const atStep: Float64Array[] = Array.from({ length: horizon }, () => new Float64Array(paths));
  const samples: number[][] = [];
  let losing = 0;
  for (let p = 0; p < paths; p++) {
    let eq = 0;
    const path: number[] = [];
    for (let s = 0; s < horizon; s++) {
      eq += blocks[randomIndex(rng, blocks.length)];
      atStep[s][p] = eq;
      if (p < keepSamples) path.push(round2(eq));
    }
    if (eq < 0) losing++;
    if (p < keepSamples) samples.push(path);
  }
  const pct = (q: number) =>
    atStep.map((col) => {
      const sorted = Float64Array.from(col).sort();
      return round2(sorted[Math.min(paths - 1, Math.floor(q * paths))]);
    });
  return {
    label: "statistical",
    horizon,
    paths,
    seed,
    p5: pct(0.05),
    p25: pct(0.25),
    p50: pct(0.5),
    p75: pct(0.75),
    p95: pct(0.95),
    samples,
    probLoss: losing / paths,
    sessions: blocks.length,
  };
}
