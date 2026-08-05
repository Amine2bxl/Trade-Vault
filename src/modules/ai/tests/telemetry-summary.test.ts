import { describe, it, expect } from "bun:test";
import { summarizeRuns, percentile, type AgentRunRow } from "../runtime/telemetry-summary";

/**
 * Agrégation de télémétrie — non-régression.
 *
 * Ces chiffres serviront à trancher des arbitrages (quel modèle, quel budget
 * de tokens, quel coût acceptable). Un agrégat faux oriente des décisions
 * produit pendant des mois sans que personne ne s'en aperçoive — c'est le type
 * de bug le plus coûteux et le moins visible.
 */

function run(over: Partial<AgentRunRow> = {}): AgentRunRow {
  return {
    model: "gemini-2.5-flash",
    provider: "gemini",
    status: "ok",
    input_tokens: 2000,
    output_tokens: 300,
    latency_ms: 1200,
    created_at: "2026-08-05T10:00:00Z",
    ...over,
  };
}

describe("percentile", () => {
  it("médiane sur une série impaire", () => {
    expect(percentile([300, 100, 200], 50)).toBe(200);
  });

  it("p95 remonte la queue haute", () => {
    // Rang le plus proche : sur 100 valeurs, le p95 est la 95e triée (indice
    // 94). Avec 10 appels lents, la queue commence à l'indice 90 — le p95 les
    // attrape donc bien.
    const values = [...Array(90).fill(100), ...Array(10).fill(5000)];
    expect(percentile(values, 95)).toBe(5000);
  });

  it("un outlier UNIQUE sur 20 appels n'est PAS le p95 — il est le maximum", () => {
    // Verrouille la sémantique : le p95 décrit ce que vit le trader mal servi
    // de façon RÉCURRENTE, pas un incident isolé. Confondre les deux ferait
    // conclure à une régression à chaque timeout unique.
    const values = [...Array(19).fill(900), 10000];
    expect(percentile(values, 95)).toBe(900);
    expect(percentile(values, 100)).toBe(10000);
  });

  it("liste vide = 0, jamais NaN", () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe("summarizeRuns", () => {
  it("compte séparément ok, erreurs et REPLIS", () => {
    // `fallback` n'est pas une erreur : le trader a eu une réponse fondée sur
    // ses données. Les confondre masquerait le taux de repli.
    const rows = [
      run(),
      run({ status: "error", latency_ms: null }),
      run({ status: "fallback", latency_ms: null }),
      run({ status: "fallback", latency_ms: null }),
    ];
    const s = summarizeRuns(rows);
    expect(s.total).toBe(4);
    expect(s.ok).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.fallbacks).toBe(2);
    expect(s.degradedPct).toBe(75);
  });

  it("EXCLUT les latences absentes — sinon la médiane serait maquillée", () => {
    // Un repli immédiat n'a pas mis 0 ms. Le compter tirerait la médiane vers
    // le bas et ferait croire à des performances qui n'existent pas.
    const rows = [
      run({ latency_ms: 1000 }),
      run({ latency_ms: 2000 }),
      run({ status: "fallback", latency_ms: null }),
      run({ status: "fallback", latency_ms: 0 }),
    ];
    expect(summarizeRuns(rows).medianMs).toBe(1000);
  });

  it("une queue lente RÉCURRENTE apparaît au p95 sans fausser la médiane", () => {
    // C'est exactement pourquoi la moyenne n'est pas affichée : elle mélangerait
    // les deux et ne dirait ni l'un ni l'autre.
    const rows = [
      ...Array(90)
        .fill(null)
        .map(() => run({ latency_ms: 900 })),
      ...Array(10)
        .fill(null)
        .map(() => run({ latency_ms: 10000 })),
    ];
    const s = summarizeRuns(rows);
    expect(s.medianMs).toBe(900);
    expect(s.p95Ms).toBe(10000);
  });

  it("sépare par modèle et classe par volume", () => {
    const rows = [
      run({ model: "gemini-2.5-flash" }),
      run({ model: "gemini-2.5-flash" }),
      run({ model: "claude-sonnet" }),
    ];
    const s = summarizeRuns(rows);
    expect(s.byModel[0]).toMatchObject({ model: "gemini-2.5-flash", runs: 2 });
    expect(s.byModel[1]).toMatchObject({ model: "claude-sonnet", runs: 1 });
  });

  it("nomme explicitement les appels SANS modèle au lieu de les masquer", () => {
    // Un appel sans modèle n'a jamais atteint de provider — c'est une
    // information, pas un vide à cacher.
    const s = summarizeRuns([run({ model: null, status: "fallback", latency_ms: null })]);
    expect(s.byModel[0].model).toBe("(aucun)");
  });

  it("totalise les tokens réellement consommés", () => {
    const s = summarizeRuns([
      run({ input_tokens: 1000, output_tokens: 200 }),
      run({ input_tokens: 1500, output_tokens: 300 }),
    ]);
    expect(s.totalInputTokens).toBe(2500);
    expect(s.totalOutputTokens).toBe(500);
  });

  it("aucun appel : tout à zéro, aucune exception", () => {
    const s = summarizeRuns([]);
    expect(s).toMatchObject({ total: 0, degradedPct: 0, medianMs: 0, p95Ms: 0 });
    expect(s.byModel).toEqual([]);
  });
});
