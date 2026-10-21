import { describe, expect, test } from "bun:test";
import { extractRSamples } from "../src/app/features/monte-carlo/monteCarloEngine";
import {
  breakEvenWinRate,
  edgeGrid,
  edgeTerms,
  expectancyR,
  modelFromSamples,
  poolsFromSamples,
  rrAt,
  rrPos,
  sameModel,
  syntheticPools,
  tradeShape,
  dollarPerR,
} from "../src/app/features/monte-carlo/strategy";
import {
  OUTCOME_FAILED,
  OUTCOME_OPEN,
  OUTCOME_PASSED,
  advanceBands,
  bestRisk,
  createBands,
  createSimulation,
  riskLevels,
  simulateAll,
  summarize,
  type SimConfig,
} from "../src/app/features/monte-carlo/simulation";
import {
  clearFanGrid,
  createFanGrid,
  paintFan,
  rasterizeRuns,
} from "../src/app/features/monte-carlo/fanRender";
import { changedKeys, configOf, roundPlan } from "../src/app/features/monte-carlo/plan";

/**
 * MONTE-CARLO v2 — ce que la page affiche est calculé, reproductible, et
 * fidèle aux trades du trader.
 */

const trades = [
  ...Array.from({ length: 30 }, (_, i) => ({
    pnl: 200 + i * 5,
    rMultiple: 2 + i * 0.05,
    direction: "long" as const,
  })),
  ...Array.from({ length: 40 }, () => ({ pnl: -100, rMultiple: -1, direction: "short" as const })),
  ...Array.from({ length: 5 }, () => ({ pnl: 0, rMultiple: 0, direction: "be" as const })),
];
const samples = extractRSamples(trades);
const model = modelFromSamples(samples);
const pools = poolsFromSamples(samples)!;

const cfg: SimConfig = {
  model,
  pools,
  balance: 10_000,
  risk: 100,
  tradesPerDay: 2,
  days: 30,
  targetPct: 10,
  limitPct: 10,
  runs: 2_000,
  seed: 42,
};

describe("le modèle et la forme", () => {
  test("le modèle reprend les définitions du journal", () => {
    expect(model.winRate).toBeCloseTo(30 / 70, 6);
    expect(model.beRate).toBeCloseTo(5 / 75, 6);
    expect(model.avgLossR).toBeCloseTo(1, 6);
    expect(model.avgWinR).toBeCloseTo(2 + 0.05 * 14.5, 6);
  });

  test("les réservoirs sont normalisés à une moyenne de 1 et gardent la forme", () => {
    const mean = (a: Float64Array) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(pools.wins)).toBeCloseTo(1, 9);
    expect(mean(pools.losses)).toBeCloseTo(1, 9);
    // La dispersion des gains est conservée : le plus gros gain reste plus
    // gros que la moyenne.
    expect(Math.max(...pools.wins)).toBeGreaterThan(1.1);
    expect(pools.real).toBe(true);
  });

  test("sans gains ou sans pertes exploitables, pas de forme", () => {
    const flat = extractRSamples(trades.map((t) => ({ ...t, rMultiple: 0 })));
    expect(poolsFromSamples(flat)).toBeNull();
  });

  test("la forme modèle est déterministe et de moyenne 1", () => {
    const a = syntheticPools();
    const b = syntheticPools();
    expect(Array.from(a.wins.slice(0, 8))).toEqual(Array.from(b.wins.slice(0, 8)));
    expect(a.wins.reduce((s, v) => s + v, 0) / a.wins.length).toBeCloseTo(1, 9);
    expect(a.real).toBe(false);
  });

  test("espérance, ses deux termes et le point mort", () => {
    const m = { winRate: 0.5, beRate: 0, avgWinR: 2, avgLossR: 1 };
    expect(expectancyR(m)).toBeCloseTo(0.5, 9);
    expect(edgeTerms(m)).toEqual({ gain: 1, loss: 0.5, net: 0.5 });
    expect(breakEvenWinRate(2, 1)).toBeCloseTo(1 / 3, 9);
    // Au point mort, l'espérance est nulle.
    expect(expectancyR({ ...m, winRate: breakEvenWinRate(2, 1) })).toBeCloseTo(0, 9);
    // Les neutres diluent l'espérance sans changer son signe.
    expect(expectancyR({ ...m, beRate: 0.2 })).toBeCloseTo(0.4, 9);
  });

  test("un R vaut, en argent, la médiane de |P&L ÷ R|", () => {
    expect(dollarPerR(samples)).toBe(100);
    expect(dollarPerR(extractRSamples([{ pnl: 0, rMultiple: 0, direction: "be" }]))).toBeNull();
  });

  test("la forme simulée pèse 1 et suit le modèle", () => {
    const shape = tradeShape(model, pools);
    expect(shape.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 9);
    const losses = shape.filter((b) => b.center < 0).reduce((s, b) => s + b.share, 0);
    expect(losses).toBeCloseTo((1 - model.beRate) * (1 - model.winRate), 9);
    // Les neutres tombent dans la classe de 0.
    expect(shape.find((b) => Math.abs(b.center) < 1e-9)?.share).toBeCloseTo(model.beRate, 9);
  });

  test("deux modèles égaux à l'affichage près", () => {
    expect(sameModel(model, { ...model, winRate: model.winRate + 0.0001 })).toBe(true);
    expect(sameModel(model, { ...model, avgWinR: model.avgWinR + 0.1 })).toBe(false);
  });

  test("la carte de l'edge : axe log, point mort à zéro", () => {
    expect(rrAt(0)).toBeCloseTo(0.5, 9);
    expect(rrAt(1)).toBeCloseTo(4, 9);
    expect(rrPos(rrAt(0.37))).toBeCloseTo(0.37, 9);
    const g = edgeGrid(40, 30);
    expect(g.length).toBe(1_200);
    // Haut-droite (gros R:R, gros taux) gagne ; bas-gauche perd.
    expect(g[39]).toBeGreaterThan(0);
    expect(g[29 * 40]).toBeLessThan(0);
  });
});

describe("la simulation", () => {
  const sim = simulateAll(cfg);
  const sum = summarize(sim);

  test("reproductible à graine égale, différente sinon", () => {
    const again = simulateAll(cfg);
    expect(Array.from(again.final.slice(0, 50))).toEqual(Array.from(sim.final.slice(0, 50)));
    const other = simulateAll({ ...cfg, seed: 43 });
    expect(Array.from(other.final.slice(0, 50))).not.toEqual(Array.from(sim.final.slice(0, 50)));
  });

  test("calculer par tranches donne exactement le même résultat", () => {
    const sliced = createSimulation(cfg);
    while (!sliced.finished) sliced.advance(37);
    expect(Array.from(sliced.final)).toEqual(Array.from(sim.final));
  });

  test("les trois issues somment à 1 et chaque compte s'arrête sur son mur", () => {
    expect(sum.passRate + sum.failRate + sum.openRate).toBeCloseTo(1, 9);
    expect(sum.runs).toBe(cfg.runs);
    for (let i = 0; i < sim.done; i++) {
      if (sim.status[i] === OUTCOME_PASSED) expect(sim.final[i]).toBeGreaterThanOrEqual(sim.target);
      if (sim.status[i] === OUTCOME_FAILED) expect(sim.final[i]).toBeLessThanOrEqual(sim.floor);
      if (sim.status[i] === OUTCOME_OPEN) {
        expect(sim.ends[i]).toBe(sim.points - 1);
        expect(sim.stopStep[i]).toBe(sim.steps);
      }
    }
  });

  test("une trajectoire arrêtée s'interrompt sur son instant d'arrêt", () => {
    const P = sim.points;
    let checked = 0;
    for (let i = 0; i < sim.done && checked < 20; i++) {
      if (sim.status[i] === OUTCOME_OPEN) continue;
      const end = sim.ends[i];
      expect(end).toBeLessThan(P);
      // Le solde d'arrêt est posé à l'instant de fin, puis répété.
      expect(sim.paths![i * P + end]).toBeCloseTo(sim.final[i], 3);
      expect(sim.paths![i * P + P - 1]).toBeCloseTo(sim.final[i], 3);
      expect(sim.stepAt[end]).toBeGreaterThanOrEqual(sim.stopStep[i]);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test("les percentiles partent du solde de départ, restent ordonnés, et finissent sur le moteur", () => {
    const bands = createBands(sim);
    while (bands.ready < sim.points) advanceBands(sim, bands, 7);
    expect(bands.p5[0]).toBe(10_000);
    expect(bands.p95[0]).toBe(10_000);
    for (let c = 0; c < sim.points; c++) {
      expect(bands.p5[c]).toBeLessThanOrEqual(bands.p25[c]);
      expect(bands.p25[c]).toBeLessThanOrEqual(bands.p50[c]);
      expect(bands.p50[c]).toBeLessThanOrEqual(bands.p75[c]);
      expect(bands.p75[c]).toBeLessThanOrEqual(bands.p95[c]);
    }
    // Au dernier instant, chaque compte arrêté a gardé son dernier solde :
    // c'est la population des soldes finaux.
    const last = sim.points - 1;
    expect(bands.p50[last]).toBeCloseTo(sum.final.p50, 2);
    // Les arrivées cumulées finissent sur les taux du résumé.
    expect(bands.passedBy[last]).toBeCloseTo(sum.passRate, 6);
    expect(bands.failedBy[last]).toBeCloseTo(sum.failRate, 6);
    expect(bands.above[last]).toBeCloseTo(sum.profitRate, 6);
  });

  test("drawdowns, séries et jours pour l'objectif sont cohérents", () => {
    expect(sum.dd.p95).toBeGreaterThanOrEqual(sum.dd.p50);
    expect(sum.streak.p95).toBeGreaterThanOrEqual(sum.streak.p50);
    expect(sum.daysToTarget).not.toBeNull();
    expect(sum.daysToTarget!.p50).toBeGreaterThanOrEqual(1);
    expect(sum.daysToTarget!.p95).toBeLessThanOrEqual(cfg.days);
    expect(sum.se).toBeCloseTo(Math.sqrt((sum.passRate * (1 - sum.passRate)) / cfg.runs), 9);
  });

  test("le modèle du journal reproduit son espérance", () => {
    // Sans objectif ni limite, le P&L moyen par trade simulé converge vers
    // l'espérance du journal × le risque.
    const free = summarize(
      simulateAll({ ...cfg, targetPct: 0, limitPct: 0, runs: 4_000, days: 50 }),
    );
    const perTrade = (free.final.p50 - cfg.balance) / (50 * cfg.tradesPerDay);
    expect(perTrade / cfg.risk).toBeCloseTo(expectancyR(model), 1);
  });

  test("un meilleur taux de réussite, mêmes hasards : jamais moins d'objectifs", () => {
    const better = summarize(
      simulateAll({ ...cfg, model: { ...model, winRate: model.winRate + 0.1 } }),
    );
    expect(better.passRate).toBeGreaterThan(sum.passRate);
  });

  test("sans trajectoires gardées, les issues restent calculées", () => {
    const lean = simulateAll({ ...cfg, keepPaths: false });
    expect(lean.paths).toBeNull();
    expect(summarize(lean).passRate).toBeCloseTo(sum.passRate, 9);
  });
});

describe("le risque", () => {
  test("une grille fixe, plus le risque actuel quand il n'y est pas", () => {
    expect(riskLevels(1)).not.toContain(1.1);
    expect(riskLevels(1.1)).toContain(1.1);
    const lv = riskLevels(0.6);
    expect([...lv].sort((a, b) => a - b)).toEqual(lv);
  });

  test("le meilleur niveau maximise l'objectif, le plus prudent à égalité", () => {
    const best = bestRisk([
      { riskPct: 0.5, pass: 0.4, fail: 0.01, profit: 0.6 },
      { riskPct: 1, pass: 0.6, fail: 0.1, profit: 0.6 },
      { riskPct: 2, pass: 0.6, fail: 0.3, profit: 0.6 },
    ]);
    expect(best?.riskPct).toBe(1);
  });
});

describe("le faisceau de densité", () => {
  const sim = simulateAll({ ...cfg, runs: 300 });
  const lo = 8_500;
  const hi = 11_500;
  const g = createFanGrid(120, 60);
  const yPx = (v: number) => ((hi - v) / (hi - lo)) * (g.h - 1);
  rasterizeRuns(g, sim, 0, sim.done, yPx);

  test("chaque trajectoire dépose exactement 1 par colonne traversée", () => {
    // Colonne 0 : tous les tirages partent du même solde.
    let col0 = 0;
    for (let y = 0; y < g.h; y++) col0 += g.tot[y * g.w];
    expect(col0).toBeCloseTo(sim.done, 3);
    // Plus loin, la masse = les tirages encore en vie à cette abscisse.
    const x = 60;
    const t = (x * (sim.points - 1)) / (g.w - 1);
    let alive = 0;
    for (let i = 0; i < sim.done; i++)
      if (Math.floor((sim.ends[i] / (sim.points - 1)) * (g.w - 1)) >= x) alive++;
    let colX = 0;
    for (let y = 0; y < g.h; y++) colX += g.tot[y * g.w + x];
    expect(colX).toBeCloseTo(alive, 3);
    expect(t).toBeGreaterThan(0);
  });

  test("la peinture reste dans la plage et colore selon l'issue", () => {
    const out = new Uint8ClampedArray(g.w * g.h * 4);
    paintFan(g, out, { neutral: [150, 150, 150], pos: [0, 255, 0], neg: [255, 0, 0] }, sim.done);
    let lit = 0;
    for (let i = 3; i < out.length; i += 4) if (out[i] > 0) lit++;
    expect(lit).toBeGreaterThan(g.w);
    // Les courbes s'arrêtent SUR les murs : rien n'est peint au-dessus de
    // l'objectif (ni sous la limite), même si le dernier trade l'a dépassé.
    const yTarget = Math.floor(yPx(sim.target));
    for (let y = 0; y < yTarget - 1; y++) {
      for (let x = 0; x < g.w; x++) expect(g.tot[y * g.w + x]).toBe(0);
    }
    // Juste sous l'objectif, la teinte penche vers le vert.
    let topGreen = 0;
    let topRed = 0;
    for (let x = g.w / 2; x < g.w; x++) {
      for (let y = yTarget; y < yTarget + 6; y++) {
        const o = (y * g.w + x) * 4;
        if (out[o + 3] > 0) {
          topGreen += out[o + 1];
          topRed += out[o];
        }
      }
    }
    expect(topGreen).toBeGreaterThan(topRed);
    clearFanGrid(g);
    expect(g.tot.every((v) => v === 0)).toBe(true);
  });
});

describe("le plan", () => {
  const base = {
    winRate: 52.4,
    avgWinR: 1.666,
    avgLossR: 0.9,
    beRate: 6.2,
    tradesPerDay: 2.6,
    balance: 25_000,
    riskPct: 0.97,
    days: 30,
    targetPct: 10,
    limitPct: 10,
  };

  test("arrondi d'affichage : ce qu'on lit est ce qui est simulé", () => {
    const p = roundPlan(base);
    expect(p).toMatchObject({
      winRate: 52,
      avgWinR: 1.67,
      beRate: 6,
      tradesPerDay: 3,
      riskPct: 0.95,
    });
    const c = configOf(p, pools, 100, 1);
    expect(c.model.winRate).toBe(0.52);
    expect(c.risk).toBeCloseTo(237.5, 9);
  });

  test("les réglages modifiés sont nommés", () => {
    const p = roundPlan(base);
    expect(changedKeys(p, p)).toEqual([]);
    expect(changedKeys({ ...p, winRate: 60, days: 45 }, p)).toEqual(["winRate", "days"]);
  });

  test("le lissage du faisceau garde la masse d'une colonne intérieure", () => {
    const sim = simulateAll({ ...cfg, runs: 200 });
    const g = createFanGrid(80, 80);
    rasterizeRuns(g, sim, 0, sim.done, (v) => ((11_500 - v) / 3_000) * 79);
    const out = new Uint8ClampedArray(g.w * g.h * 4);
    paintFan(g, out, { neutral: [1, 1, 1], pos: [2, 2, 2], neg: [3, 3, 3] }, sim.done, 0.92, 2);
    const x = 30;
    let raw = 0;
    let smooth = 0;
    for (let y = 0; y < g.h; y++) {
      raw +=
        g.tot[y * g.w + x - 2] +
        g.tot[y * g.w + x - 1] +
        g.tot[y * g.w + x] +
        g.tot[y * g.w + x + 1] +
        g.tot[y * g.w + x + 2];
      smooth += g.smoothTot[y * g.w + x];
    }
    // Le flou de boîte de rayon 2 moyenne cinq colonnes : la masse lissée
    // d'une colonne est celle de ses cinq voisines, divisée par cinq.
    expect(smooth).toBeCloseTo(raw / 5, 1);
  });
});
