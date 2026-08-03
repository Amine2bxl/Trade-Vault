import { describe, it, expect } from "bun:test";
import { historyTextOf, HISTORY_CHARS } from "../history";
import type { JarvisMessage } from "../blocks";

/**
 * Mémoire conversationnelle — non-régression.
 *
 * Le rendu lit le premier bloc `markdown` ; depuis le découpage des réponses en
 * blocs, le PLAN vit dans un bloc `mission`. Sérialiser l'historique de la même
 * façon que l'affichage faisait donc oublier à Jarvis ce qu'il venait de
 * recommander. Ces tests verrouillent ce qui doit être transmis — et surtout ce
 * qui ne doit PAS l'être.
 */

function assistant(blocks: JarvisMessage["blocks"]): JarvisMessage {
  return { role: "assistant", id: "m1", blocks, createdAt: "2026-08-03T10:00:00.000Z" };
}

describe("historyTextOf", () => {
  it("transmet le PLAN — ce que l'affichage seul perdait", () => {
    const out = historyTextOf(
      assistant([
        { type: "markdown", content: "Tu perds le vendredi." },
        {
          type: "mission",
          title: "Plan recommandé",
          items: ["Taille fixe", "Max 2 trades", "Stop après 1 perte"],
        },
      ]),
    );
    expect(out).toContain("Tu perds le vendredi.");
    expect(out).toContain("Stop après 1 perte");
  });

  it("transmet le nom du pattern mais PAS les chiffres (déjà renvoyés par les signaux)", () => {
    const out = historyTextOf(
      assistant([
        {
          type: "insight",
          patternLabel: "Performance par jour",
          metrics: [{ label: "Win rate Vendredi", value: "38%", tone: "down" }],
          impact: "Ce jour te coûte −$640",
        },
      ]),
    );
    expect(out).toContain("Performance par jour");
    // Recopier les valeurs reviendrait à payer deux fois la même information.
    expect(out).not.toContain("38%");
    expect(out).not.toContain("640");
  });

  it("EXCLUT les notices d'interface : Jarvis ne doit pas croire les avoir dites", () => {
    const out = historyTextOf(
      assistant([
        { type: "alert", level: "info", message: "Analyse hors ligne" },
        { type: "markdown", content: "Diagnostic." },
      ]),
    );
    expect(out).not.toContain("hors ligne");
    expect(out).toContain("Diagnostic.");
  });

  it("conserve l'action proposée — l'engagement fait partie du fil", () => {
    const out = historyTextOf(
      assistant([
        { type: "tool", tool: "createChecklist", label: "Ajouter cette règle à ma checklist" },
      ]),
    );
    expect(out).toContain("Ajouter cette règle à ma checklist");
  });

  it("sérialise le hero en une ligne continue", () => {
    const out = historyTextOf(
      assistant([
        {
          type: "hero",
          lines: [
            { kind: "context", text: "6 vendredis analysés." },
            { kind: "observation", text: "Win rate en chute." },
          ],
        },
      ]),
    );
    expect(out).toBe("6 vendredis analysés. Win rate en chute.");
  });

  it("borne la taille d'un tour (coût des 16 tours d'historique)", () => {
    const out = historyTextOf(assistant([{ type: "markdown", content: "x".repeat(5000) }]));
    expect(out.length).toBe(HISTORY_CHARS);
  });

  it("un message sans bloc exploitable ne casse rien", () => {
    expect(historyTextOf(assistant([]))).toBe("");
  });
});
