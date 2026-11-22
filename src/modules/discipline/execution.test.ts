import { describe, expect, test } from "bun:test";
import { assessExecution, assessSession, type ExecutionInput } from "./execution";

const base: ExecutionInput = {
  direction: "short",
  entryPrice: 21520,
  exitPrice: 21450,
  riskAmount: 250,
  mistakes: [],
  planned: { direction: "short", entry: 21520, stop: 21560, target: 21450, scenario: "A" },
  initialStop: 21560,
  initialTarget: 21450,
  plannedRisk: 250,
  sessionBreaches: [],
  planRespected: null,
  reflectionReason: null,
  override: null,
};

describe("qualité d'exécution — les six cas du brief", () => {
  test("setup A+ et TP : bonne exécution", () => {
    expect(assessExecution(base).verdict).toBe("good_execution");
  });

  test("setup A+ et SL : bonne exécution", () => {
    expect(assessExecution({ ...base, exitPrice: 21560 }).verdict).toBe("good_execution");
  });

  test("hors plan et TP : mauvaise exécution", () => {
    const a = assessExecution({ ...base, sessionBreaches: ["direction"] });
    expect(a.verdict).toBe("bad_execution");
    expect(a.deviations[0]).toEqual({ kind: "direction", certainty: "observed" });
  });

  test("hors plan et SL : mauvaise exécution", () => {
    expect(assessExecution({ ...base, exitPrice: 21560, sessionBreaches: ["extra"] }).verdict).toBe(
      "bad_execution",
    );
  });

  test("pas de setup, pas de trade : bonne discipline", () => {
    expect(assessSession({ planned: true, tradeVerdicts: [] })).toBe("good_discipline");
  });

  test("setup manqué sans trade de revanche : bonne discipline", () => {
    expect(assessSession({ planned: true, tradeVerdicts: [] })).toBe("good_discipline");
    expect(assessSession({ planned: true, tradeVerdicts: ["bad_execution"] })).toBe(
      "bad_execution",
    );
  });
});

describe("qualité d'exécution — preuves", () => {
  test("le P&L n'est pas une entrée", () => {
    // @ts-expect-error — le P&L ne fait pas partie de l'entrée, par construction.
    expect(assessExecution({ ...base, pnl: -500 }).verdict).toBe("good_execution");
  });

  test("sans plan ni déclaration : inconnu, jamais bon par défaut", () => {
    const a = assessExecution({ ...base, planned: null, sessionBreaches: null, plannedRisk: null });
    expect(a.verdict).toBe("unknown");
  });

  test("déclaré conforme sans séance : bonne exécution", () => {
    expect(assessExecution({ ...base, sessionBreaches: null, planRespected: "yes" }).verdict).toBe(
      "good_execution",
    );
  });

  test("entrée poursuivie au-delà d'un quart de la zone", () => {
    const chased = assessExecution({ ...base, entryPrice: 21505 });
    expect(chased.deviations.map((d) => d.kind)).toContain("entry_outside_zone");
    // Meilleure que prévu : jamais un écart.
    expect(assessExecution({ ...base, entryPrice: 21540 }).verdict).toBe("good_execution");
    // Un tick plus bas : dans la tolérance.
    expect(assessExecution({ ...base, entryPrice: 21515 }).verdict).toBe("good_execution");
  });

  test("stop au-delà de l'invalidation et sur-risque", () => {
    const a = assessExecution({ ...base, initialStop: 21580, riskAmount: 400 });
    expect(a.deviations.map((d) => d.kind)).toEqual(["stop_beyond_plan", "over_risk"]);
    expect(assessExecution({ ...base, riskAmount: 260 }).verdict).toBe("good_execution");
  });

  test("erreur cochée ou raison de réflexion : déclaré", () => {
    const a = assessExecution({ ...base, mistakes: ["FOMO entry"], reflectionReason: "fomo" });
    expect(a.verdict).toBe("bad_execution");
    expect(a.deviations.every((d) => d.certainty === "declared")).toBe(true);
    expect(assessExecution({ ...base, reflectionReason: "other" }).verdict).toBe("good_execution");
  });

  test("sortie entre stop et cible : une question, pas un verdict", () => {
    const a = assessExecution({ ...base, exitPrice: 21500 });
    expect(a.verdict).toBe("good_execution");
    expect(a.deviations).toEqual([
      { kind: "early_exit", certainty: "to_confirm", detail: "21500" },
    ]);
  });

  test("la correction manuelle l'emporte et garde les écarts visibles", () => {
    const a = assessExecution({
      ...base,
      sessionBreaches: ["direction"],
      override: "good_execution",
    });
    expect(a).toMatchObject({ verdict: "good_execution", source: "manual" });
    expect(a.deviations).toHaveLength(1);
  });

  test("séance sans plan : inconnue", () => {
    expect(assessSession({ planned: false, tradeVerdicts: [] })).toBe("unknown");
    expect(assessSession({ planned: true, tradeVerdicts: ["good_execution", "unknown"] })).toBe(
      "unknown",
    );
  });
});
