import { describe, expect, test } from "bun:test";
import { draftProtocol, evaluateProtocol, type EdgeTrade } from "../index";

/** Research Notebook : protocole figé, holdout prospectif, invalidation dite. */

const pad = (n: number) => String(n).padStart(2, "0");
function day(i: number): string {
  const d = new Date(Date.UTC(2026, 0, 5 + i));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
let seq = 0;
function trade(date: string, pnl: number, strategy = "ORB"): EdgeTrade {
  return {
    id: `n${++seq}`,
    date,
    pnl,
    riskAmount: 50,
    symbol: "NQ",
    strategy,
    entryTime: "09:35",
    accountId: "acc",
  };
}
const history = Array.from({ length: 40 }, (_, i) => trade(day(i), i % 4 === 0 ? -30 : 80));
const input = {
  dimension: "strategy" as const,
  cellKey: "ORB",
  hypothesis: "ORB garde un écart positif",
  direction: 1 as const,
};

describe("protocole", () => {
  test("le holdout commence APRÈS la dernière séance connue — jamais dans le passé", () => {
    const p = draftProtocol(history, input, "2026-01-10");
    expect(p.holdoutStart).toBe(day(40));
    expect(p.dataSnapshot.trainTrades).toBe(40);
    expect(draftProtocol(history, input, "2026-12-01").holdoutStart).toBe("2026-12-01");
    // Même entrée, même protocole (graine et empreinte stables).
    expect(draftProtocol(history, input, "2026-01-10")).toEqual(p);
  });

  test("ce que le trader a déjà vu ne confirme rien : sans séance nouvelle, insuffisant", () => {
    const p = draftProtocol(history, input, "2026-01-10");
    const e = evaluateProtocol(p, history);
    expect(e.verdict).toBe("insufficient");
    expect(e.holdoutN).toBe(0);
    expect(e.missingTrades).toBe(30);
    expect(e.trainingChanged).toBe(false);
  });

  test("des séances nouvelles dans le sens annoncé : soutenue ; en sens contraire : contredite", () => {
    const p = draftProtocol(history, input, "2026-01-10");
    const good = Array.from({ length: 30 }, (_, i) => trade(day(40 + i), i % 5 === 0 ? -20 : 60));
    const bad = Array.from({ length: 30 }, (_, i) => trade(day(40 + i), i % 5 === 0 ? 20 : -60));
    expect(evaluateProtocol(p, [...history, ...good]).verdict).toBe("supported");
    expect(evaluateProtocol(p, [...history, ...bad]).verdict).toBe("contradicted");
  });

  test("un trade ajouté ou modifié dans l'apprentissage invalide la comparaison — et le dit", () => {
    const p = draftProtocol(history, input, "2026-01-10");
    const edited = history.map((t, i) => (i === 3 ? { ...t, pnl: t.pnl + 1 } : t));
    expect(evaluateProtocol(p, edited).trainingChanged).toBe(true);
    const imported = [...history, trade(day(5), 999)];
    expect(evaluateProtocol(p, imported).trainingChanged).toBe(true);
    // Un trade d'un AUTRE setup change aussi l'empreinte : la période n'est plus la même.
    expect(evaluateProtocol(p, [...history, trade(day(6), 1, "Other")]).trainingChanged).toBe(true);
  });

  test("une méthode qui a changé est signalée", () => {
    const p = { ...draftProtocol(history, input, "2026-01-10"), methodVersion: 0 };
    expect(evaluateProtocol(p, history).methodChanged).toBe(true);
  });
});
