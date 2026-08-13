import { describe, expect, it } from "bun:test";
import { deriveAction, deriveActions } from "@/modules/patterns/derive";
import type { DetectedPattern } from "@/modules/patterns/detectors";
import { validateProposal } from "@/modules/patterns/proposalSchemas";

/**
 * La frontière motif → action. Ce qui est testé ici n'est pas « ça marche »,
 * c'est « ça refuse » : deux des quatre motifs ne doivent produire AUCUNE
 * action, et le brouillon de payload ne doit jamais être insérable tel quel.
 */

function pattern(over: Partial<DetectedPattern> = {}): DetectedPattern {
  return {
    status: "found",
    kind: "cluster_concentration",
    clusterId: "fomo",
    evidence: {
      n: 42,
      comparisonN: 18,
      metric: "loss_share",
      value: 0.55,
      baseline: 0.25,
      comparisons: 4,
    },
    impactR: -0.4,
    ...over,
  };
}

describe("deriveAction", () => {
  it("cluster_concentration → un item de checklist", () => {
    const action = deriveAction(pattern());
    expect(action?.actionType).toBe("add_checklist_item");
    // Rien de machine à imposer : ni libellé ni position.
    expect(action?.payloadDraft).toEqual({});
  });

  it("cluster_concentration sans famille ne produit rien", () => {
    expect(deriveAction(pattern({ clusterId: null }))).toBeNull();
  });

  it("after_loss → une règle dont le seuil sort du motif", () => {
    const action = deriveAction(pattern({ kind: "after_loss", clusterId: null }));
    expect(action?.actionType).toBe("create_rule");
    expect(action?.payloadDraft).toEqual({ metric: "max_consecutive_losses", threshold: 1 });
  });

  it("time_of_day ne propose pas d'amputer une plage horaire", () => {
    expect(deriveAction(pattern({ kind: "time_of_day", clusterId: null }))).toBeNull();
  });

  it("readiness_correlation ne justifie aucune action automatique", () => {
    expect(deriveAction(pattern({ kind: "readiness_correlation", clusterId: null }))).toBeNull();
  });

  it("rationaleFacts ne porte que les chiffres du détecteur", () => {
    const p = pattern();
    const action = deriveAction(p);
    expect(action?.rationaleFacts).toEqual({
      kind: "cluster_concentration",
      clusterId: "fomo",
      n: 42,
      comparisonN: 18,
      comparisons: 4,
      value: 0.55,
      baseline: 0.25,
      impactR: -0.4,
    });
  });

  it("le nombre de comparaisons voyage jusqu'à la justification", () => {
    const action = deriveAction(pattern({ evidence: { ...pattern().evidence, comparisons: 12 } }));
    expect(action?.rationaleFacts.comparisons).toBe(12);
  });
});

describe("payloadDraft n'est pas insérable tel quel", () => {
  const rationale = "Sur 42 trades, cette famille represente 55 % des pertes contre 25 % attendus.";

  it("le brouillon seul est refusé — il manque le texte lisible", () => {
    const action = deriveAction(pattern({ kind: "after_loss", clusterId: null }))!;
    const check = validateProposal({
      actionType: action.actionType,
      payload: action.payloadDraft,
      rationale,
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("text");
  });

  it("complété du seul champ texte, il passe la validation", () => {
    const action = deriveAction(pattern({ kind: "after_loss", clusterId: null }))!;
    const check = validateProposal({
      actionType: action.actionType,
      payload: { ...action.payloadDraft, text: "Apres une perte, un seul trade de plus." },
      rationale,
    });
    expect(check.ok).toBe(true);
  });
});

describe("deriveActions", () => {
  it("laisse tomber les motifs sans action prévue", () => {
    const actions = deriveActions([
      pattern(),
      pattern({ kind: "time_of_day", clusterId: null }),
      pattern({ kind: "readiness_correlation", clusterId: null }),
      pattern({ kind: "after_loss", clusterId: null }),
    ]);
    expect(actions.map((a) => a.actionType)).toEqual(["add_checklist_item", "create_rule"]);
  });

  it("n'applique pas le budget d'intervention — c'est la base qui le porte", () => {
    const many = Array.from({ length: 6 }, () => pattern({ kind: "after_loss", clusterId: null }));
    expect(deriveActions(many)).toHaveLength(6);
  });
});
