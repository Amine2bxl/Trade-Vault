import { useEffect, useState } from "react";
import {
  advanceBands,
  createBands,
  createSimulation,
  summarize,
  type Bands,
  type RiskPoint,
  type SimConfig,
  type SimSummary,
  type Simulation,
} from "./simulation";

/**
 * LE PILOTE — dix mille tirages, puis leurs lectures, sans jamais figer l'écran.
 *
 * Tout le calcul est écrit comme UNE suite d'étapes (`pipeline`, un
 * générateur) que le pilote déroule par tranches de quelques millisecondes,
 * en rendant la main au navigateur entre deux tranches. Le défilement, les
 * clics, les animations continuent ; et le faisceau se remplit sous les yeux,
 * tranche après tranche — ce qu'on voit se générer est le calcul lui-même.
 *
 * Un nouveau réglage annule le calcul en cours (rien ne s'empile) et repart
 * après une courte pause : on peut enchaîner les clics sur « + » sans relancer
 * dix mille tirages à chacun.
 *
 * L'ordre suit ce que le trader regarde : le faisceau d'abord, puis ses
 * percentiles, puis le scénario de départ (pour les écarts), puis le balayage
 * du risque.
 */

export interface RunInput {
  main: SimConfig;
  /** Le scénario de départ, quand le trader a modifié quelque chose. */
  baseline: SimConfig | null;
  /** Le balayage du risque : la même stratégie à chaque niveau (en %). */
  sweep: { cfg: SimConfig; levels: number[] } | null;
}

export interface Baseline {
  sim: Simulation;
  summary: SimSummary;
  bands: Bands;
}

export interface RunState {
  /** Identifiant du calcul — change à chaque relance. */
  id: number;
  sim: Simulation | null;
  /** Tirages calculés du faisceau principal. */
  progress: number;
  /** Les lectures du DERNIER calcul terminé : elles restent affichées
   *  (atténuées) pendant le suivant, au lieu de clignoter à vide. */
  summary: SimSummary | null;
  bands: Bands | null;
  /** Le tirage auquel appartiennent `bands` — le faisceau ne pose ses
   *  percentiles que sur SES courbes. */
  bandsOf: Simulation | null;
  baseline: Baseline | null;
  sweep: RiskPoint[] | null;
  running: boolean;
}

const EMPTY: RunState = {
  id: 0,
  sim: null,
  progress: 0,
  summary: null,
  bands: null,
  bandsOf: null,
  baseline: null,
  sweep: null,
  running: false,
};

/** Tirages par pas : assez petit pour que le pilote respecte son budget. */
const BATCH = 48;
/** Budget d'une tranche : la moitié d'une image à 60 i/s. */
const SLICE_MS = 7;

function* pipeline(input: RunInput, id: number, push: (patch: Partial<RunState>) => void) {
  const sim = createSimulation(input.main);
  push({ id, sim, progress: 0, running: true });
  while (!sim.finished) {
    sim.advance(BATCH);
    push({ progress: sim.done });
    yield;
  }
  const summary = summarize(sim);
  push({ summary });
  yield;
  const bands = createBands(sim);
  while (bands.ready < sim.points) {
    advanceBands(sim, bands, 4);
    yield;
  }
  push({ bands, bandsOf: sim });

  if (input.baseline) {
    const b = createSimulation(input.baseline);
    while (!b.finished) {
      b.advance(BATCH);
      yield;
    }
    const bb = createBands(b);
    while (bb.ready < b.points) {
      advanceBands(b, bb, 8);
      yield;
    }
    push({ baseline: { sim: b, summary: summarize(b), bands: bb } });
  } else push({ baseline: null });

  if (input.sweep) {
    const points: RiskPoint[] = [];
    for (const level of input.sweep.levels) {
      const cfg = input.sweep.cfg;
      const s = createSimulation({
        ...cfg,
        risk: (cfg.balance * level) / 100,
        keepPaths: false,
      });
      while (!s.finished) {
        s.advance(BATCH * 2);
        yield;
      }
      const sm = summarize(s);
      points.push({ riskPct: level, pass: sm.passRate, fail: sm.failRate, profit: sm.profitRate });
    }
    push({ sweep: points });
  } else push({ sweep: null });

  push({ running: false });
}

export function useSimulation(input: RunInput | null, delayMs = 160): RunState {
  const [state, setState] = useState<RunState>(EMPTY);

  useEffect(() => {
    if (!input) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const id = Date.now();
    // Le calcul en cours est marqué « en cours » tout de suite : la page peut
    // atténuer les lectures périmées pendant la pause.
    setState((s) => ({ ...s, running: true }));

    const begin = () => {
      const steps = pipeline(input, id, (patch) => {
        if (!cancelled) setState((s) => ({ ...s, ...patch }));
      });
      const tick = () => {
        if (cancelled) return;
        const t0 = performance.now();
        while (performance.now() - t0 < SLICE_MS) {
          if (steps.next().done) return;
        }
        timer = setTimeout(tick, 0);
      };
      tick();
    };
    timer = setTimeout(begin, delayMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [input, delayMs]);

  return state;
}
