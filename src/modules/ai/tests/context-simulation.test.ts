import { describe, it, expect } from "bun:test";
import { contextBlocks } from "../context";

const simulation = {
  engineVersion: "bootstrap_v1",
  method: "bootstrap_v1",
  sampleSize: 140,
  passProbability: 0.62,
  riskOfRuin: 0.08,
  medianPnl: 1850,
  medianDrawdown: 940,
  horizonTrades: 60,
};

describe("bloc SIMULATION du contexte de Jarvis", () => {
  it("transmet le résultat tel quel, sans le transformer", () => {
    const text = contextBlocks({ simulation });
    expect(text).toContain("SIMULATION");
    expect(text).toContain("0.62");
    expect(text).toContain("0.08");
    expect(text).toContain("140");
  });

  it("dit explicitement que c'est la SEULE source de probabilité", () => {
    // Sans cette phrase, le modèle produit volontiers son propre pourcentage :
    // il aura l'air aussi assuré qu'un vrai et sera inventé.
    const text = contextBlocks({ simulation });
    expect(text).toMatch(/ONLY source of any probability/i);
    expect(text).toMatch(/[Nn]ever recompute/);
  });

  it("porte la taille d'échantillon, pour que la réponse puisse la citer", () => {
    expect(contextBlocks({ simulation })).toMatch(/sampleSize/);
  });

  it("n'ajoute AUCUN bloc quand aucune simulation n'existe", () => {
    // C'est ce qui permet au coach de répondre « je n'ai pas encore de
    // simulation là-dessus ». Un bloc vide serait comblé par le modèle.
    const text = contextBlocks({ stats: { totalPnl: 1200 } });
    expect(text).not.toContain("SIMULATION");
  });

  it("un contexte entièrement vide ne fabrique rien", () => {
    expect(contextBlocks({})).not.toContain("SIMULATION");
  });
});
