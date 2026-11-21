import {
  computeEvolution,
  projectSessions,
  runDiscoveries,
  runScenario,
  type BehaviorContext,
  type DiscoveryRun,
  type Evolution,
  type MissedInput,
  type Projection,
  type ScenarioResult,
  type ScenarioRule,
  type SimulationInput,
} from "@/modules/knowledge";
import type { Trade } from "@/domain/trade";

/**
 * Le calcul lourd du Neural Brain : découvertes (bootstrap × des centaines de
 * comparaisons), évolution, scénarios et éventails. Exécuté par le Worker
 * (`brain.worker.ts`) ; sans Worker, sur le fil principal après le rendu.
 */

export type BrainRequest =
  | {
      type: "analyze";
      trades: Trade[];
      missed: MissedInput[];
      simulations: SimulationInput[];
      behavior: BehaviorContext;
      accountKey: string;
    }
  | {
      type: "simulate";
      trades: Trade[];
      rules: ScenarioRule[];
      behavior: BehaviorContext;
      horizon: number;
    };

export interface AnalyzeResult {
  run: DiscoveryRun;
  evolution: Evolution;
}

export interface SimulateResult {
  scenario: ScenarioResult;
  actualProjection: Projection | null;
  scenarioProjection: Projection | null;
}

/** Même graine pour les deux éventails : l'écart vient des règles, pas du tirage. */
export const PROJECTION_SEED = 20261121;

export function computeBrain(req: BrainRequest): AnalyzeResult | SimulateResult {
  if (req.type === "analyze") {
    return {
      run: runDiscoveries({
        trades: req.trades,
        missed: req.missed,
        simulations: req.simulations,
        behavior: req.behavior,
        accountKey: req.accountKey,
      }),
      evolution: computeEvolution(req.trades, req.behavior),
    };
  }
  const scenario = runScenario(req.trades, req.rules, req.behavior);
  const actual = new Map(req.trades.map((t) => [t.id, t.pnl]));
  const opts = { horizon: req.horizon, seed: PROJECTION_SEED };
  return {
    scenario,
    actualProjection: projectSessions(req.trades, (id) => actual.get(id) ?? null, opts),
    // Un trade retiré compte pour 0 : la séance existe, elle rend moins.
    scenarioProjection: projectSessions(req.trades, (id) => scenario.scenarioPnl[id] ?? 0, opts),
  };
}
