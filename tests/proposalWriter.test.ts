import { describe, expect, it } from "bun:test";
import type { CandidateAction } from "@/modules/patterns/derive";
import { parseWriterOutput, writerSystemPrompt, writerUserPrompt } from "@/modules/patterns/writer";
import { CAUSAL_PHRASES } from "@/modules/patterns/language";

/**
 * Le modèle n'a droit qu'à deux phrases. Ces tests portent sur ce qu'on refuse
 * quand il en profite pour faire autre chose.
 */

const action: CandidateAction = {
  actionType: "create_rule",
  payloadDraft: { metric: "max_consecutive_losses", threshold: 1 },
  rationaleFacts: {
    kind: "after_loss",
    clusterId: null,
    n: 42,
    comparisonN: 61,
    comparisons: 2,
    value: 0.35,
    baseline: 0.52,
    impactR: -0.4,
  },
};

describe("writerSystemPrompt", () => {
  it("porte l'interdiction de causalité, mot pour mot", () => {
    const prompt = writerSystemPrompt("fr");
    expect(prompt).toContain("parce que");
    expect(prompt).toContain("N'invente AUCUN chiffre");
  });

  it("existe en anglais aussi", () => {
    expect(writerSystemPrompt("en")).toContain("Invent NO numbers");
  });
});

describe("writerUserPrompt", () => {
  it("fournit les faits déjà mis en forme, n compris", () => {
    const prompt = writerUserPrompt(action, "fr");
    expect(prompt).toContain("create_rule");
    expect(prompt).toContain("(n) : 42");
    expect(prompt).toContain("Tranches examinées : 2");
    expect(prompt).toContain("metric = max_consecutive_losses, threshold = 1");
  });

  it("dit explicitement quand aucun paramètre chiffré n'est fixé", () => {
    const checklist: CandidateAction = {
      ...action,
      actionType: "add_checklist_item",
      payloadDraft: {},
    };
    expect(writerUserPrompt(checklist, "fr")).toContain("Aucun paramètre chiffré");
  });
});

describe("parseWriterOutput", () => {
  const good = {
    text: "Apres une perte, un seul trade de plus.",
    rationale: "Sur 42 trades suivant une perte, on observe 35 % de reussite contre 52 % sinon.",
  };

  it("accepte une sortie propre et rend le payload complet", () => {
    const result = parseWriterOutput(JSON.stringify(good), action);
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      metric: "max_consecutive_losses",
      threshold: 1,
      text: "Apres une perte, un seul trade de plus.",
    });
  });

  it("accepte un JSON encadré de ```json", () => {
    const result = parseWriterOutput("```json\n" + JSON.stringify(good) + "\n```", action);
    expect(result.ok).toBe(true);
  });

  it("refuse ce qui n'est pas du JSON", () => {
    const result = parseWriterOutput("Voici ta règle !", action);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not JSON");
  });

  it("refuse une sortie sans justification", () => {
    const result = parseWriterOutput(JSON.stringify({ text: "Une regle" }), action);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("missing");
  });

  it("refuse un chiffre absent des faits", () => {
    const result = parseWriterOutput(
      JSON.stringify({
        ...good,
        rationale: "Sur 200 trades suivant une perte, le resultat chute.",
      }),
      action,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("200");
  });

  it("refuse une formulation causale, comme le chemin d'écriture", () => {
    const result = parseWriterOutput(
      JSON.stringify({
        ...good,
        rationale: "Sur 42 trades, ta discipline ameliore ton resultat.",
      }),
      action,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("causal");
    // La liste est bien la même des deux côtés.
    expect(CAUSAL_PHRASES).toContain("ameliore");
  });

  it("ne laisse pas le modèle changer un paramètre fixé", () => {
    const result = parseWriterOutput(
      JSON.stringify({ ...good, threshold: 5, metric: "max_risk_pct" }),
      action,
    );
    // Les clés en trop sont ignorées : le payload sort du moteur, pas du modèle.
    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({ metric: "max_consecutive_losses", threshold: 1 });
  });

  it("refuse un libellé vide", () => {
    const result = parseWriterOutput(JSON.stringify({ ...good, text: "  " }), action);
    expect(result.ok).toBe(false);
  });
});
