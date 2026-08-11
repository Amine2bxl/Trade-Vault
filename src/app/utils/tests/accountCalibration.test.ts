import { describe, it, expect } from "bun:test";
import {
  IDENTITY_FACTOR,
  convertMoney,
  convertTrade,
  factorFor,
  isCalibrated,
  normalizedReturns,
  pickPreviewTrade,
  previewCalibration,
  roundMoney,
} from "../accountCalibration";
import type { Trade } from "../../types";

/** Le trade de référence de l'énoncé : compte 25k, risque 1 %, SL 250, TP 500. */
function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: "t1",
    date: "2026-03-14",
    symbol: "NQ",
    direction: "long",
    pnl: -250,
    riskAmount: 250,
    rMultiple: -1,
    strategy: "Breakout",
    mistakes: ["revenge"],
    setupQuality: 4,
    notes: "trop tôt",
    screenshots: [],
    entryTime: "09:35",
    exitTime: "10:02",
    confluences: ["FVG"],
    confidence: 70,
    mae: -300,
    mfe: 120,
    slippage: -12.5,
    ...over,
  };
}

/**
 * Simule la chaîne réelle : la conversion SQL écrit dans les lignes, donc le
 * « stocké » d'après est le résultat de la conversion précédente. C'est
 * exactement ce que fait `recalibrate_account_trades`.
 */
function recalibrate(stored: Trade, currentBalance: number, targetBalance: number): Trade {
  return convertTrade(stored, factorFor(currentBalance, targetBalance));
}

describe("factorFor — relatif à la représentation COURANTE", () => {
  it("Test 1 — 25k → 50k applique 2×", () => {
    expect(factorFor(25_000, 50_000)).toBe(2);
  });

  it("Test 2 — 25k → 100k applique 4×", () => {
    expect(factorFor(25_000, 100_000)).toBe(4);
  });

  it("Test 3 — réduction : 50k → 25k applique 0,5×", () => {
    expect(factorFor(50_000, 25_000)).toBe(0.5);
  });

  it("Test 5 — cible égale au courant : facteur neutre, donc aucune écriture", () => {
    expect(factorFor(50_000, 50_000)).toBe(IDENTITY_FACTOR);
    expect(isCalibrated(factorFor(50_000, 50_000))).toBe(false);
  });

  it("refuse les capitaux absurdes plutôt que de produire l'infini", () => {
    expect(factorFor(0, 50_000)).toBe(IDENTITY_FACTOR);
    expect(factorFor(25_000, 0)).toBe(IDENTITY_FACTOR);
    expect(factorFor(Number.NaN, 50_000)).toBe(IDENTITY_FACTOR);
  });
});

describe("Test 4 et 15 — recalibrages successifs, sans double multiplication", () => {
  it("25k → 50k → 100k aboutit au MÊME montant que 25k → 100k en un saut", () => {
    // Le facteur du second saut porte sur des lignes DÉJÀ converties à 50k :
    // 2× puis 2× est donc correct ici, contrairement au modèle « lentille »
    // où cela aurait donné 8× depuis l'origine.
    const stocke = trade({ pnl: -250, riskAmount: 250 });
    const apres50k = recalibrate(stocke, 25_000, 50_000);
    const apres100k = recalibrate(apres50k, 50_000, 100_000);

    const enUnSaut = recalibrate(stocke, 25_000, 100_000);
    expect(apres100k.pnl).toBe(enUnSaut.pnl);
    expect(apres100k.pnl).toBe(-1000);
    expect(apres100k.riskAmount).toBe(1000);
  });

  it("Test 5 — revenir au capital d'origine restitue les montants d'origine", () => {
    const stocke = trade({ pnl: -250, riskAmount: 250, mae: -300, mfe: 120, slippage: -12.5 });
    const monte = recalibrate(stocke, 25_000, 100_000);
    const retour = recalibrate(monte, 100_000, 25_000);
    expect(retour.pnl).toBe(stocke.pnl);
    expect(retour.riskAmount).toBe(stocke.riskAmount);
    expect(retour.mae).toBe(stocke.mae);
    expect(retour.mfe).toBe(stocke.mfe);
    expect(retour.slippage).toBe(stocke.slippage);
  });

  it("le trade fourni n'est jamais muté — la conversion rend un nouvel objet", () => {
    const t = trade();
    convertTrade(t, 4);
    expect(t.pnl).toBe(-250);
    expect(t.riskAmount).toBe(250);
  });
});

describe("LE point du modèle — un trade encodé APRÈS ne bouge pas", () => {
  it("seuls les trades antérieurs sont convertis ; les suivants sont intacts", () => {
    // C'est la différence entre l'événement ponctuel et la lentille
    // permanente : un trade saisi après le recalibrage a été tradé sur le
    // nouveau capital, le convertir le fausserait.
    const ancien = trade({ id: "avant", pnl: -250, riskAmount: 250 });
    const nouveau = trade({ id: "apres", pnl: -500, riskAmount: 500 });

    // Le filtre `created_at < cutoff` est appliqué en SQL ; ici on modélise
    // son effet : le nouveau ne passe simplement pas par la conversion.
    const converti = recalibrate(ancien, 25_000, 50_000);

    expect(converti.pnl).toBe(-500); // l'ancien rejoint la nouvelle échelle
    expect(nouveau.pnl).toBe(-500); // le nouveau était déjà à la bonne échelle
    expect(nouveau.riskAmount).toBe(500);
  });

  it("après conversion, les deux trades expriment le même risque relatif", () => {
    const ancien = recalibrate(trade({ riskAmount: 250 }), 25_000, 50_000);
    const nouveau = trade({ riskAmount: 500 });
    expect(ancien.riskAmount / 50_000).toBeCloseTo(nouveau.riskAmount / 50_000, 12);
    expect((ancien.riskAmount / 50_000) * 100).toBeCloseTo(1, 10);
  });
});

describe("Tests 6 à 8 — les ratios sont invariants", () => {
  const converti = convertTrade(trade({ pnl: 500, rMultiple: 2 }), 2);

  it("Test 6/7 — le R multiple ne change pas", () => {
    // Risquer 250 pour gagner 500, ou 500 pour gagner 1 000 : le même trade.
    expect(converti.rMultiple).toBe(2);
  });

  it("Test 8 — le risque en % du capital ne change pas", () => {
    const avant = (250 / 25_000) * 100;
    const apres = (converti.riskAmount / 50_000) * 100;
    expect(apres).toBeCloseTo(avant, 10);
    expect(apres).toBeCloseTo(1, 10);
  });
});

describe("Tests 9 et 10 — les montants sont convertis", () => {
  const converti = convertTrade(trade(), 2);

  it("Test 9 — le P&L suit l'échelle", () => {
    expect(converti.pnl).toBe(-500);
  });

  it("Test 10 — risque, MAE, MFE et slippage suivent aussi", () => {
    // MAE/MFE sont des excursions EN DOLLARS (cf. types.ts).
    expect(converti.riskAmount).toBe(500);
    expect(converti.mae).toBe(-600);
    expect(converti.mfe).toBe(240);
    expect(converti.slippage).toBe(-25);
  });

  it("« non renseigné » reste non renseigné — un MAE absent n'est pas un MAE nul", () => {
    const c = convertTrade(trade({ mae: null, mfe: undefined, slippage: null }), 2);
    expect(c.mae).toBeNull();
    expect(c.mfe).toBeUndefined();
    expect(c.slippage).toBeNull();
  });
});

describe("Test 11 — aucun prix de marché n'est touché", () => {
  it("le modèle Trade ne contient AUCUN champ de prix, tick ou point", () => {
    // Garde-fou : si un SL en prix (17 950) est un jour ajouté au modèle, ce
    // test échoue et force à décider explicitement qu'il reste hors
    // conversion. Doublé, il donnerait 35 900 — un prix qui n'existe pas.
    const champs = Object.keys(trade());
    for (const interdit of [
      "entryPrice",
      "exitPrice",
      "stopPrice",
      "takeProfit",
      "ticks",
      "points",
    ]) {
      expect(champs).not.toContain(interdit);
    }
  });
});

describe("Test 12 — le drawdown suit en montant, pas en pourcentage", () => {
  it("le drawdown monétaire double, sa part du capital reste identique", () => {
    const serie = [trade({ pnl: -250 }), trade({ id: "t2", pnl: -500 })];
    const convertis = serie.map((t) => convertTrade(t, 2));
    const ddAvant = Math.min(...serie.map((t) => t.pnl));
    const ddApres = Math.min(...convertis.map((t) => t.pnl));
    expect(ddApres).toBe(ddAvant * 2);
    expect(ddApres / 50_000).toBeCloseTo(ddAvant / 25_000, 12);
  });
});

describe("Test 13 — le comportement n'est JAMAIS converti", () => {
  it("erreurs, qualité de setup, confiance, confluences et notes sont intacts", () => {
    // « Tu as revenge-tradé 4 fois » reste 4 fois. Changer d'échelle
    // financière ne réécrit pas ce que le trader a fait.
    const t = trade();
    const c = convertTrade(t, 4);
    expect(c.mistakes).toEqual(t.mistakes);
    expect(c.setupQuality).toBe(t.setupQuality);
    expect(c.confidence).toBe(t.confidence);
    expect(c.confluences).toEqual(t.confluences);
    expect(c.notes).toBe(t.notes);
    expect(c.strategy).toBe(t.strategy);
    expect(c.entryTime).toBe(t.entryTime);
    expect(c.direction).toBe(t.direction);
  });

  it("le taux de respect des règles est un pourcentage : invariant", () => {
    const serie = [trade(), trade({ id: "t2", mistakes: [] }), trade({ id: "t3", mistakes: [] })];
    const propre = (ts: Trade[]) => ts.filter((t) => t.mistakes.length === 0).length / ts.length;
    expect(propre(serie.map((t) => convertTrade(t, 4)))).toBe(propre(serie));
  });
});

describe("Test 14 — deux comptes ne se contaminent pas", () => {
  it("la conversion SQL est bornée par account_id ET user_id", () => {
    // Modélisé ici : convertir la série d'un compte ne touche pas l'autre.
    // Côté base, le filtre `account_id = … and user_id = auth.uid()` et les
    // politiques RLS owner-only l'imposent.
    const compteA = [trade({ id: "a1", pnl: -250 })];
    const compteB = [trade({ id: "b1", pnl: -250 })];
    const aConverti = compteA.map((t) => convertTrade(t, 2));
    expect(aConverti[0].pnl).toBe(-500);
    expect(compteB[0].pnl).toBe(-250);
    expect(compteA[0].pnl).toBe(-250); // l'entrée d'origine n'est pas mutée
  });
});

describe("Test 16 — stabilité numérique", () => {
  it("un facteur non décimal ne laisse pas traîner de flottants", () => {
    // 25k → 30k = 1,2. Sans arrondi, 250 × 1,2 vaut 299.99999999999994.
    const c = convertTrade(trade({ pnl: 250, riskAmount: 250 }), factorFor(25_000, 30_000));
    expect(c.pnl).toBe(300);
    expect(c.riskAmount).toBe(300);
  });

  it("l'arrondi se fait au cent, montant par montant", () => {
    expect(convertMoney(33.33, 3)).toBe(99.99);
    expect(roundMoney(0.005)).toBe(0.01);
  });

  it("un facteur neutre rend le trade tel quel, sans allocation", () => {
    const t = trade();
    expect(convertTrade(t, IDENTITY_FACTOR)).toBe(t);
  });
});

describe("previewCalibration", () => {
  const rows = previewCalibration(trade(), 25_000, 50_000, 2);
  const row = (k: string) => rows.find((r) => r.key === k);

  it("montre le solde, le P&L et le risque convertis", () => {
    expect(row("recal.rowBalance")).toMatchObject({ before: 25_000, after: 50_000 });
    expect(row("recal.rowPnl")).toMatchObject({ before: -250, after: -500 });
    expect(row("recal.rowRisk")).toMatchObject({ before: 250, after: 500 });
  });

  it("montre le R et le risque % IDENTIQUES — c'est la démonstration", () => {
    const r = row("recal.rowRMultiple");
    expect(r?.before).toBe(r?.after);
    const pct = row("recal.rowRiskPct");
    expect(pct?.after).toBeCloseTo(pct?.before ?? 0, 10);
  });

  it("reste utilisable sur un journal vide", () => {
    const vide = previewCalibration(null, 25_000, 50_000, 2);
    expect(vide).toHaveLength(1);
    expect(vide[0].key).toBe("recal.rowBalance");
  });
});

describe("pickPreviewTrade", () => {
  it("prend le trade récent AVEC un risque renseigné", () => {
    const sansRisque = trade({ id: "recent", date: "2026-05-01", riskAmount: 0 });
    const avecRisque = trade({ id: "utile", date: "2026-04-01", riskAmount: 250 });
    expect(pickPreviewTrade([sansRisque, avecRisque])?.id).toBe("utile");
  });

  it("se rabat sur le premier trade, puis sur null", () => {
    const t = trade({ riskAmount: 0 });
    expect(pickPreviewTrade([t])).toBe(t);
    expect(pickPreviewTrade([])).toBeNull();
  });
});

describe("normalizedReturns — compatibilité Monte Carlo", () => {
  it("les séries normalisées sont INVARIANTES à la conversion", () => {
    // Une probabilité de ruine calculée sur le même comportement ne doit pas
    // changer parce que le trader a changé de taille de compte.
    const serie = [
      trade({ pnl: -250, rMultiple: -1 }),
      trade({ id: "t2", pnl: 500, rMultiple: 2 }),
    ];
    const avant = normalizedReturns(serie, 25_000);
    const apres = normalizedReturns(
      serie.map((t) => convertTrade(t, 2)),
      50_000,
    );
    expect(apres.r).toEqual(avant.r);
    apres.pctOfBalance.forEach((v, i) => expect(v).toBeCloseTo(avant.pctOfBalance[i], 12));
  });

  it("sans capital, seule la série en R est produite", () => {
    const { r, pctOfBalance } = normalizedReturns([trade()], 0);
    expect(r).toHaveLength(1);
    expect(pctOfBalance).toHaveLength(0);
  });
});
