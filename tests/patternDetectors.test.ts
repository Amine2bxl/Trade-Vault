import { expect, test } from "bun:test";
import {
  afterLoss,
  clusterConcentration,
  readinessAssociation,
  timeOfDay,
  type TradeLike,
} from "../src/modules/patterns/detectors";
import { MIN_R_DELTA, MIN_SESSIONS, MIN_TRADES } from "../src/modules/patterns/thresholds";

function trades(n: number, over: Partial<TradeLike> = {}): TradeLike[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    pnl: i % 2 === 0 ? -100 : 200,
    rMultiple: i % 2 === 0 ? -1 : 2,
    mistakes: i % 2 === 0 ? ["No stop loss"] : [],
    entryTime: "09:30",
    ...over,
  }));
}

// ── La règle qui gouverne tout : rien n'est affirmé sous le minimum ────────

test("every detector refuses to speak below its minimum sample", () => {
  const thin = trades(MIN_TRADES - 1);
  for (const out of [clusterConcentration(thin), afterLoss(thin), timeOfDay(thin)]) {
    expect(out).not.toBeNull();
    expect(out!.status).toBe("not_enough");
  }
});

test("a refusal says how many more are needed, not just 'insufficient'", () => {
  const out = clusterConcentration(trades(12));
  expect(out).toMatchObject({ status: "not_enough", unit: "trades", n: 12, required: MIN_TRADES });
  expect((out as { missing: number }).missing).toBe(MIN_TRADES - 12);
});

test("missing never goes negative once the threshold is passed", () => {
  const out = readinessAssociation([], []);
  expect((out as { missing: number }).missing).toBe(MIN_SESSIONS);
});

// ── Aucune statistique sans son n ──────────────────────────────────────────

test("every emitted pattern carries n, and a comparison carries both sizes", () => {
  const found = clusterConcentration(trades(40));
  expect(found!.status).toBe("found");
  const evidence = (found as { evidence: { n: number; comparisonN: number | null } }).evidence;
  expect(evidence.n).toBeGreaterThan(0);

  const cmp = afterLoss(trades(60));
  expect(cmp!.status).toBe("found");
  const e2 = (cmp as { evidence: { n: number; comparisonN: number | null } }).evidence;
  expect(e2.n).toBeGreaterThan(0);
  expect(e2.comparisonN).toBeGreaterThan(0);
});

// ── Détecteurs, comportement ───────────────────────────────────────────────

test("cluster concentration names the family carrying the losses, with the loss count as n", () => {
  const out = clusterConcentration(trades(40)) as {
    clusterId: string;
    evidence: { n: number; value: number };
  };
  expect(out.clusterId).toBe("risk");
  expect(out.evidence.n).toBe(20); // les 20 trades perdants, pas les 40
  expect(out.evidence.value).toBe(1);
});

test("cluster concentration stays silent when no mistake was ever tagged", () => {
  expect(clusterConcentration(trades(40, { mistakes: [] }))).toBeNull();
});

test("after-loss needs BOTH groups to stand on their own", () => {
  // 40 trades, mais un seul perdant : le groupe « après une perte » est vide.
  const almostAllWins = trades(40).map((t, i) =>
    i === 0 ? t : { ...t, pnl: 100, rMultiple: 1, mistakes: [] },
  );
  const out = afterLoss(almostAllWins);
  expect(out!.status).toBe("not_enough");
});

test("time of day refuses to conclude on a trader who only trades one slot", () => {
  expect(timeOfDay(trades(40, { entryTime: "09:30" }))).toBeNull();
});

test("time of day works once three slots are populated", () => {
  const spread = trades(90).map((t, i) => ({
    ...t,
    entryTime: ["09:30", "11:30", "14:30"][i % 3],
    rMultiple: i % 3 === 2 ? -2 : 1,
  }));
  const out = timeOfDay(spread) as { evidence: { n: number; comparisonN: number } };
  expect(out.evidence.n).toBeGreaterThanOrEqual(10);
  expect(out.evidence.comparisonN).toBeGreaterThan(out.evidence.n);
});

// ── Préparation : une association, jamais une cause ────────────────────────

test("readiness needs 20 SCORED sessions — backfilled ones do not count", () => {
  const backfilled = Array.from({ length: 40 }, (_, i) => ({
    sessionDate: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    readinessScore: null,
  }));
  const out = readinessAssociation(backfilled, trades(60));
  expect(out).toMatchObject({ status: "not_enough", unit: "sessions", n: 0 });
});

test("readiness reports both group sizes and never claims an R gain", () => {
  const sessions = Array.from({ length: 24 }, (_, i) => ({
    sessionDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
    readinessScore: i < 12 ? 40 : 90,
  }));
  const tr = sessions.flatMap((s, i) =>
    Array.from({ length: 2 }, () => ({
      date: s.sessionDate,
      pnl: i < 12 ? -100 : 100,
      rMultiple: i < 12 ? -1 : 1,
      mistakes: [],
      entryTime: "09:30",
    })),
  );
  const out = readinessAssociation(sessions, tr) as {
    evidence: { n: number; comparisonN: number };
    impactR: number | null;
  };
  expect(out.evidence.n).toBeGreaterThanOrEqual(10);
  expect(out.evidence.comparisonN).toBeGreaterThanOrEqual(10);
  // Le spec interdit de présenter l'écart entre deux groupes auto-sélectionnés
  // comme un gain promis.
  expect(out.impactR).toBeNull();
});

test("no detector ever returns NaN", () => {
  const weird = trades(40, { rMultiple: 0, pnl: 0 });
  for (const out of [clusterConcentration(weird), afterLoss(weird), timeOfDay(weird)]) {
    const value = (out as { evidence?: { value: number } })?.evidence?.value;
    if (typeof value === "number") expect(Number.isNaN(value)).toBe(false);
  }
});

// ── Comparaisons multiples : la garde que `n` ne fournit pas ───────────────

test("a difference below the effect floor is not reported, however large the sample", () => {
  // 200 trades, écart de R minuscule entre « après une perte » et le reste.
  // Toutes les gardes de TAILLE passent ; c'est le plancher d'effet qui doit
  // fermer la porte, sinon on publie du bruit avec un gros n en caution.
  // Le signe du P&L suit un cycle de 5, le R un cycle de 2 : le R d'un trade
  // ne dépend donc pas de ce qui le précède, et les deux groupes ont la même
  // moyenne au bruit près. C'est le cas qu'il faut refuser de publier.
  const flat = Array.from({ length: 200 }, (_, i) => ({
    date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    pnl: i % 5 === 0 ? -100 : 100,
    rMultiple: i % 2 === 0 ? 1 : 0.9,
    mistakes: [],
    entryTime: "09:30",
  }));
  const out = afterLoss(flat);
  expect(out).toBeNull();
});

test("a real difference clears the floor", () => {
  const degraded = Array.from({ length: 200 }, (_, i) => ({
    date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    pnl: i % 2 === 0 ? -100 : 100,
    // Le trade qui SUIT une perte (index impair) est nettement pire.
    rMultiple: i % 2 === 0 ? 1 : -2,
    mistakes: [],
    entryTime: "09:30",
  }));
  const out = degraded.length ? afterLoss(degraded) : null;
  expect(out!.status).toBe("found");
  const e = (out as { evidence: { value: number; baseline: number } }).evidence;
  expect(Math.abs(e.value - e.baseline)).toBeGreaterThanOrEqual(MIN_R_DELTA);
});

test("every finding says how many slices were examined to produce it", () => {
  const spread = trades(90).map((t, i) => ({
    ...t,
    entryTime: ["09:30", "11:30", "14:30"][i % 3],
    rMultiple: i % 3 === 2 ? -3 : 1,
  }));
  const tod = timeOfDay(spread) as { evidence: { comparisons: number } };
  // Trois créneaux balayés pour en désigner un : le lecteur doit pouvoir le
  // savoir, sinon « ta pire heure » se lit comme une mesure unique.
  expect(tod.evidence.comparisons).toBe(3);

  const cluster = clusterConcentration(trades(40)) as { evidence: { comparisons: number } };
  expect(cluster.evidence.comparisons).toBeGreaterThanOrEqual(1);

  const cmp = afterLoss(trades(60).map((t, i) => ({ ...t, rMultiple: i % 2 === 0 ? 1 : -2 }))) as {
    evidence: { comparisons: number };
  };
  expect(cmp.evidence.comparisons).toBe(1);
});

test("the cluster baseline is a constant, not a value read from the data", () => {
  // Un trader qui n'étiquette qu'une seule famille doit quand même obtenir une
  // observation : sa référence est le quart théorique, pas sa propre part.
  const out = clusterConcentration(trades(40)) as {
    evidence: { value: number; baseline: number };
  };
  expect(out.evidence.baseline).toBe(0.25);
  expect(out.evidence.value).toBe(1);
});
