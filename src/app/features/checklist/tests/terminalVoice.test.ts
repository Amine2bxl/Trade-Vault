import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { emptyDay, emptyPlan, reduceDay } from "../sessionPlan";
import { greeting, line, planSummary } from "../terminalVoice";
import { LINES } from "../voice";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dir, "../../../../../public/voices/manifest.json"), "utf8"),
) as Record<string, string>;

const DEF = { risk: "250", maxTrades: 2, maxLoss: "500" };

describe("les répliques du Mode Terminal", () => {
  test("salutation selon l'heure, dans la langue choisie", () => {
    expect(greeting("en", 8)).toBe("Good morning");
    expect(greeting("fr", 20)).toBe("Bonsoir");
  });

  test("les répliques anglaises d'origine retrouvent leur clip de voix clonée", () => {
    for (const key of ["activate", "lock", "discipline", "patience", "checkDone"] as const) {
      for (let i = 0; i < LINES[key].en.length; i++) {
        const text = line(key, "en", 9, i / LINES[key].en.length);
        expect(manifest[text]).toBeDefined();
      }
    }
  });

  test("chaque réplique existe dans les deux langues", () => {
    for (const entry of Object.values(LINES)) {
      expect(entry.fr.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
    }
  });

  test("le résumé ne dit que ce qui est écrit", () => {
    let d = emptyDay(DEF);
    d = reduceDay(d, {
      type: "setPlan",
      patch: {
        ...emptyPlan(DEF),
        bias: "short",
        narrative: "x",
        target: "21 450",
        entry: "21 520",
        invalidation: "",
      },
    });
    expect(planSummary(d, "fr")).toBe(
      "Plan du jour : vente. Cible 21 450. Entrée 21 520. Risque 250. 2 trades maximum. Perte maximale du jour 500.",
    );
    expect(planSummary(emptyDay(DEF), "en")).toBe("Today's plan is not written yet.");
  });
});
