import { describe, expect, test } from "bun:test";
import { assessCompliance, requiredConfluences } from "./compliance";
import type { ExecutionInput } from "./execution";

const base: ExecutionInput = {
  direction: "long",
  entryPrice: 21000,
  exitPrice: 21030,
  riskAmount: 250,
  mistakes: [],
  planned: { direction: "long", entry: 21000, stop: 20990, target: 21030, scenario: "A" },
  initialStop: 20990,
  initialTarget: 21030,
  plannedRisk: 250,
  sessionBreaches: [],
  planRespected: null,
  reflectionReason: null,
  override: null,
};
const state = (a: ReturnType<typeof assessCompliance>, rule: string) =>
  a.checks.find((c) => c.rule === rule)?.state;

describe("assessCompliance", () => {
  test("toutes les règles tenues → plan respecté", () => {
    const a = assessCompliance(base);
    expect(a.verdict).toBe("respected");
    expect(a.needsExplanation).toBe(false);
  });

  test("le résultat financier n'entre jamais : un trade hors plan gagnant reste non respecté", () => {
    // `ExecutionInput` n'a pas de P&L ; un sens contraire gagnant est enfreint.
    const a = assessCompliance({ ...base, direction: "short", exitPrice: 20970 });
    expect(a.verdict).toBe("violated");
    expect(a.checks.find((c) => c.rule === "direction")).toMatchObject({
      state: "violated",
      certainty: "observed",
      mistake: "Ignored plan",
    });
    expect(a.needsExplanation).toBe(true);
  });

  test("une perte bien exécutée est conforme", () => {
    expect(assessCompliance({ ...base, exitPrice: 20990 }).verdict).toBe("respected");
  });

  test("entrée poursuivie seulement → partiellement respecté", () => {
    const a = assessCompliance({ ...base, entryPrice: 21004 });
    expect(state(a, "entry_zone")).toBe("violated");
    expect(a.verdict).toBe("partial");
    expect(a.checks.find((c) => c.rule === "entry_zone")?.mistake).toBe("Chased entry");
  });

  test("sur-risque et trade en trop : critiques", () => {
    expect(assessCompliance({ ...base, riskAmount: 400 }).verdict).toBe("violated");
    expect(assessCompliance({ ...base, sessionBreaches: ["extra"] }).verdict).toBe("violated");
  });

  test("sortie avant la cible : une question, pas une infraction", () => {
    const a = assessCompliance({ ...base, exitPrice: 21010 });
    expect(a.checks.find((c) => c.rule === "exit")).toMatchObject({
      state: "unverifiable",
      certainty: "to_confirm",
    });
    expect(a.verdict).toBe("undetermined");
    expect(a.needsExplanation).toBe(true);
  });

  test("sans plan ni déclaration : indéterminé, jamais respecté par défaut", () => {
    const a = assessCompliance({
      ...base,
      planned: null,
      plannedRisk: null,
      sessionBreaches: null,
      initialStop: null,
      initialTarget: null,
    });
    expect(a.verdict).toBe("undetermined");
    expect(a.checks.every((c) => c.state === "not_applicable")).toBe(true);
  });

  test("donnée manquante : la règle est invérifiable", () => {
    const a = assessCompliance({ ...base, initialStop: null, riskAmount: null });
    expect(state(a, "risk")).toBe("unverifiable");
    expect(a.verdict).toBe("undetermined");
  });

  test("écart déclaré par le trader : non respecté, sans question", () => {
    const a = assessCompliance({ ...base, planRespected: "no" });
    expect(a.verdict).toBe("violated");
    expect(a.checks.find((c) => c.rule === "declared")?.certainty).toBe("declared");
    expect(a.needsExplanation).toBe(false);
  });

  test("correction manuelle : l'emporte et le dit", () => {
    const a = assessCompliance({ ...base, direction: "short", override: "good_execution" });
    expect(a).toMatchObject({ verdict: "respected", source: "manual" });
  });

  test("confluences du setup : déclarées = tenues, absentes = invérifiables", () => {
    const rules = "Sweep of liquidity, then MSS, enter on the FVG";
    expect(requiredConfluences(rules)).toEqual(["Liquidity Sweep", "MSS", "FVG"]);
    expect(requiredConfluences("enter on the IFVG")).toEqual(["IFVG"]);
    const a = assessCompliance(base, {
      setupRules: rules,
      confluences: ["liquidity sweep", "FVG"],
    });
    const conf = a.checks.filter((c) => c.rule === "confluence");
    expect(conf.map((c) => [c.detail, c.state])).toEqual([
      ["Liquidity Sweep", "respected"],
      ["MSS", "unverifiable"],
      ["FVG", "respected"],
    ]);
    expect(a.verdict).toBe("undetermined");
  });
});
