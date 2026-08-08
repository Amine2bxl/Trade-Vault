import { describe, it, expect } from "bun:test";
import {
  IDENTITY_SCALE,
  calibrateTrade,
  calibrateTrades,
  calibratedBalance,
  isCalibrated,
  normalizedReturns,
  pickPreviewTrade,
  previewCalibration,
  scaleFor,
  scaleMoney,
  uncalibrateTrade,
  withPnlFromRiskAndR,
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

const ORIGINAL = 25_000;

describe("scaleFor — le facteur vient TOUJOURS du capital d'origine", () => {
  it("Test 1 — 25k → 50k donne 2×", () => {
    expect(scaleFor(ORIGINAL, 50_000)).toBe(2);
  });

  it("Test 2 — 25k → 100k donne 4×", () => {
    expect(scaleFor(ORIGINAL, 100_000)).toBe(4);
  });

  it("Test 3 — réduction d'échelle : 50k → 25k donne 0,5×", () => {
    expect(scaleFor(50_000, 25_000)).toBe(0.5);
  });

  it("Test 4 — 25k → 50k → 100k vaut EXACTEMENT 25k → 100k", () => {
    // Le piège central : appliquer 2× puis 2× sur des données déjà
    // recalibrées donnerait 4× sur du 50k, soit 8× depuis l'origine.
    const enDeuxEtapes = scaleFor(ORIGINAL, 100_000); // recalculé depuis l'origine
    const enUneEtape = scaleFor(ORIGINAL, 100_000);
    expect(enDeuxEtapes).toBe(enUneEtape);
    expect(enDeuxEtapes).toBe(4);
  });

  it("Test 5 — revenir à l'original rend le facteur neutre", () => {
    expect(scaleFor(ORIGINAL, ORIGINAL)).toBe(IDENTITY_SCALE);
    expect(isCalibrated(scaleFor(ORIGINAL, ORIGINAL))).toBe(false);
  });

  it("refuse les capitaux absurdes plutôt que de produire l'infini", () => {
    expect(scaleFor(0, 50_000)).toBe(IDENTITY_SCALE);
    expect(scaleFor(25_000, 0)).toBe(IDENTITY_SCALE);
    expect(scaleFor(Number.NaN, 50_000)).toBe(IDENTITY_SCALE);
  });
});

describe("Test 15 — aucune double multiplication", () => {
  it("recalibrer deux fois de suite depuis l'origine ne compose pas les facteurs", () => {
    const t = trade();
    // L'application recalcule le facteur depuis l'origine à chaque fois, et
    // convertit TOUJOURS depuis le trade brut — jamais depuis un trade déjà
    // converti.
    const vers50k = calibrateTrade(t, scaleFor(ORIGINAL, 50_000));
    const vers100k = calibrateTrade(t, scaleFor(ORIGINAL, 100_000));
    expect(vers50k.pnl).toBe(-500);
    expect(vers100k.pnl).toBe(-1000); // et non -2000
  });

  it("le trade d'origine n'est JAMAIS muté", () => {
    const t = trade();
    calibrateTrade(t, 4);
    expect(t.pnl).toBe(-250);
    expect(t.riskAmount).toBe(250);
  });
});

describe("Tests 6 à 8 — les ratios sont invariants", () => {
  const scaled = calibrateTrade(trade({ pnl: 500, rMultiple: 2 }), 2);

  it("Test 6/7 — le R multiple ne change pas", () => {
    // Risquer 250 pour gagner 500, ou 500 pour gagner 1000 : le même trade.
    expect(scaled.rMultiple).toBe(2);
  });

  it("Test 8 — le risque en % du capital ne change pas", () => {
    const before = (250 / 25_000) * 100;
    const after = (scaled.riskAmount / 50_000) * 100;
    expect(after).toBeCloseTo(before, 10);
    expect(after).toBeCloseTo(1, 10);
  });
});

describe("Tests 9 et 10 — les montants sont recalibrés", () => {
  const scaled = calibrateTrade(trade(), 2);

  it("Test 9 — le P&L suit l'échelle", () => {
    expect(scaled.pnl).toBe(-500);
  });

  it("Test 10 — risque, MAE, MFE et slippage suivent aussi", () => {
    // MAE/MFE sont des excursions EN DOLLARS (cf. types.ts) : elles suivent.
    expect(scaled.riskAmount).toBe(500);
    expect(scaled.mae).toBe(-600);
    expect(scaled.mfe).toBe(240);
    expect(scaled.slippage).toBe(-25);
  });

  it("« non renseigné » reste non renseigné — un MAE absent n'est pas un MAE nul", () => {
    const s = calibrateTrade(trade({ mae: null, mfe: undefined, slippage: null }), 2);
    expect(s.mae).toBeNull();
    expect(s.mfe).toBeUndefined();
    expect(s.slippage).toBeNull();
  });
});

describe("Test 11 — aucun prix de marché n'est touché", () => {
  it("le modèle Trade ne contient AUCUN champ de prix, tick ou point", () => {
    // Garde-fou de non-régression : si un jour un SL en prix (17 950) est
    // ajouté au modèle, ce test échoue et force à décider explicitement qu'il
    // reste hors du recalibrage. Un stop à 17 950 doublé donnerait 35 900,
    // un prix qui n'existe sur aucun marché.
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

describe("Test 12 — le drawdown suit l'échelle en montant, pas en pourcentage", () => {
  it("le drawdown monétaire double, sa part du capital reste identique", () => {
    // Le drawdown est dérivé des P&L par `quantStats`. Recalibrer les P&L ET
    // le capital du même facteur laisse le pourcentage inchangé — c'est le
    // mécanisme qui rend inutile toute modification des moteurs existants.
    const serie = [
      trade({ pnl: -250 }),
      trade({ id: "t2", pnl: -500 }),
      trade({ id: "t3", pnl: 300 }),
    ];
    const scaled = calibrateTrades(serie, 2);
    const ddBrut = Math.min(...serie.map((t) => t.pnl));
    const ddScaled = Math.min(...scaled.map((t) => t.pnl));
    expect(ddScaled).toBe(ddBrut * 2);
    expect(ddScaled / 50_000).toBeCloseTo(ddBrut / 25_000, 12);
  });
});

describe("Test 13 — le comportement n'est JAMAIS recalibré", () => {
  it("erreurs, qualité de setup, confiance, confluences et notes sont intacts", () => {
    // « Tu as revenge-tradé 4 fois » reste 4 fois. Changer d'échelle
    // financière ne réécrit pas l'histoire de ce que le trader a fait.
    const t = trade();
    const s = calibrateTrade(t, 4);
    expect(s.mistakes).toEqual(t.mistakes);
    expect(s.setupQuality).toBe(t.setupQuality);
    expect(s.confidence).toBe(t.confidence);
    expect(s.confluences).toEqual(t.confluences);
    expect(s.notes).toBe(t.notes);
    expect(s.strategy).toBe(t.strategy);
    expect(s.entryTime).toBe(t.entryTime);
    expect(s.direction).toBe(t.direction);
  });

  it("le taux de respect des règles est un pourcentage : invariant", () => {
    const serie = [trade(), trade({ id: "t2", mistakes: [] }), trade({ id: "t3", mistakes: [] })];
    const propre = (ts: Trade[]) => ts.filter((t) => t.mistakes.length === 0).length / ts.length;
    expect(propre(calibrateTrades(serie, 4))).toBe(propre(serie));
  });
});

describe("Test 14 — deux comptes ne se contaminent pas", () => {
  it("calibrer un historique n'affecte pas l'autre", () => {
    // La calibration est portée par le COMPTE et appliquée à la lecture des
    // trades de ce compte uniquement ; deux appels distincts ne partagent
    // aucun état.
    const compteA = [trade({ id: "a1", pnl: -250 })];
    const compteB = [trade({ id: "b1", pnl: -250 })];
    const aCalibre = calibrateTrades(compteA, 2);
    const bNonCalibre = calibrateTrades(compteB, IDENTITY_SCALE);
    expect(aCalibre[0].pnl).toBe(-500);
    expect(bNonCalibre[0].pnl).toBe(-250);
    expect(compteA[0].pnl).toBe(-250);
  });

  it("sans calibration, le TABLEAU d'origine est rendu par référence", () => {
    // Les consommateurs sont mémoïsés sur l'identité du tableau : en recréer
    // un ferait recalculer toutes les statistiques à chaque rendu.
    const serie = [trade()];
    expect(calibrateTrades(serie, IDENTITY_SCALE)).toBe(serie);
    expect(calibrateTrades(serie, 1)).toBe(serie);
  });
});

describe("Test 16 — stabilité numérique", () => {
  it("un facteur non décimal ne laisse pas traîner de flottants", () => {
    // 25k → 30k = 1,2. Sans arrondi au cent, 250 × 1,2 vaut
    // 299.99999999999994 et l'erreur se propage dans toutes les sommes.
    const s = calibrateTrade(trade({ pnl: 250, riskAmount: 250 }), scaleFor(25_000, 30_000));
    expect(s.pnl).toBe(300);
    expect(s.riskAmount).toBe(300);
  });

  it("l'arrondi se fait au cent, montant par montant", () => {
    expect(scaleMoney(33.33, 3)).toBe(99.99);
    expect(scaleMoney(0.005, 1)).toBe(0.01);
  });

  it("aller-retour 25k → 100k → 25k retrouve la valeur d'origine au cent près", () => {
    const t = trade({ pnl: -250, riskAmount: 250 });
    const monte = calibrateTrade(t, scaleFor(25_000, 100_000));
    // Le retour se fait depuis le trade BRUT, pas depuis le trade converti —
    // c'est la garantie qu'aucune erreur ne s'accumule.
    const retour = calibrateTrade(t, scaleFor(25_000, 25_000));
    expect(monte.pnl).toBe(-1000);
    expect(retour.pnl).toBe(-250);
    expect(retour).toBe(t); // facteur neutre : objet rendu tel quel
  });
});

describe("calibratedBalance", () => {
  it("dit à quelle échelle l'historique est représenté", () => {
    expect(calibratedBalance({ scale: 2, originalBalance: 25_000 })).toBe(50_000);
    expect(calibratedBalance({ scale: 1, originalBalance: 25_000 })).toBe(25_000);
    expect(calibratedBalance({ scale: 4, originalBalance: 25_000 })).toBe(100_000);
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
    const empty = previewCalibration(null, 25_000, 50_000, 2);
    expect(empty).toHaveLength(1);
    expect(empty[0].key).toBe("recal.rowBalance");
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
  it("les séries normalisées sont INVARIANTES au recalibrage", () => {
    // Propriété indispensable : une probabilité de ruine calculée sur le même
    // comportement de trading ne doit pas changer parce que le trader a
    // changé de taille de compte.
    const serie = [
      trade({ pnl: -250, rMultiple: -1 }),
      trade({ id: "t2", pnl: 500, rMultiple: 2 }),
    ];
    const brut = normalizedReturns(serie, 25_000);
    const calibre = normalizedReturns(calibrateTrades(serie, 2), 50_000);
    expect(calibre.r).toEqual(brut.r);
    calibre.pctOfBalance.forEach((v, i) => expect(v).toBeCloseTo(brut.pctOfBalance[i], 12));
  });

  it("sans capital, seule la série en R est produite", () => {
    const { r, pctOfBalance } = normalizedReturns([trade()], 0);
    expect(r).toHaveLength(1);
    expect(pctOfBalance).toHaveLength(0);
  });
});

describe("uncalibrateTrade — l'écriture repasse à l'échelle d'origine", () => {
  it("aller-retour : ce qui est affiché puis réécrit retrouve la valeur stockée", () => {
    // LE défaut que cette fonction empêche : le formulaire est alimenté par le
    // trade AFFICHÉ (déjà converti) ; le réécrire tel quel doublerait les
    // montants stockés, et les redoublerait à chaque édition suivante.
    const brut = trade({ pnl: -250, riskAmount: 250, mae: -300, mfe: 120, slippage: -12.5 });
    const affiche = calibrateTrade(brut, 2);
    expect(affiche.pnl).toBe(-500);

    const aStocker = uncalibrateTrade(affiche, 2);
    expect(aStocker.pnl).toBe(brut.pnl);
    expect(aStocker.riskAmount).toBe(brut.riskAmount);
    expect(aStocker.mae).toBe(brut.mae);
    expect(aStocker.mfe).toBe(brut.mfe);
    expect(aStocker.slippage).toBe(brut.slippage);
  });

  it("l'aller-retour tient sur un facteur non décimal", () => {
    const brut = trade({ pnl: 300, riskAmount: 250 });
    const scale = scaleFor(25_000, 30_000); // 1,2
    expect(uncalibrateTrade(calibrateTrade(brut, scale), scale).pnl).toBe(300);
  });

  it("sans calibration, le trade est rendu tel quel", () => {
    const t = trade();
    expect(uncalibrateTrade(t, IDENTITY_SCALE)).toBe(t);
  });

  it("le comportement traverse l'aller-retour intact", () => {
    const t = trade();
    const r = uncalibrateTrade(calibrateTrade(t, 4), 4);
    expect(r.mistakes).toEqual(t.mistakes);
    expect(r.rMultiple).toBe(t.rMultiple);
    expect(r.notes).toBe(t.notes);
  });
});

describe("withPnlFromRiskAndR — une seule définition du lien P&L / risque / R", () => {
  it("changer le R recalcule le P&L", () => {
    const r = withPnlFromRiskAndR(trade({ riskAmount: 250, rMultiple: -1, pnl: -250 }), {
      rMultiple: 2,
    });
    expect(r.pnl).toBe(500);
    expect(r.riskAmount).toBe(250);
  });

  it("changer le risque recalcule le P&L, à R constant", () => {
    const r = withPnlFromRiskAndR(trade({ riskAmount: 250, rMultiple: 2, pnl: 500 }), {
      riskAmount: 500,
    });
    expect(r.pnl).toBe(1000);
    expect(r.rMultiple).toBe(2);
  });

  it("un break-even reste à zéro — son P&L ne se déduit pas d'un risque", () => {
    const r = withPnlFromRiskAndR(trade({ direction: "be" }), { riskAmount: 500 });
    expect(r.pnl).toBe(0);
    expect(r.rMultiple).toBe(0);
  });

  it("arrondit au cent, sans laisser de flottant", () => {
    const r = withPnlFromRiskAndR(trade(), { riskAmount: 333.33, rMultiple: 3 });
    expect(r.pnl).toBe(999.99);
  });
});

describe("édition rapide sur un compte recalibré — le scénario complet", () => {
  it("saisir 500 $ de risque sur un compte 2× stocke 250 et réaffiche 500", () => {
    // La chaîne réelle : le trader voit un trade calibré, corrige une valeur
    // à l'échelle qu'il a sous les yeux, et l'écriture repasse à l'origine.
    // Sans ce retour, le stockage vaudrait 500 et l'affichage 1 000.
    const stocke = trade({ pnl: -250, riskAmount: 250, rMultiple: -1 });
    const affiche = calibrateTrade(stocke, 2);

    const corrige = withPnlFromRiskAndR(affiche, { riskAmount: 500 });
    const aStocker = uncalibrateTrade(corrige, 2);

    expect(aStocker.riskAmount).toBe(250); // ce qui part en base
    expect(calibrateTrade(aStocker, 2).riskAmount).toBe(500); // ce qui revient à l'écran
  });

  it("corriger le R met le P&L d'accord avec lui, aux deux échelles", () => {
    const stocke = trade({ pnl: -250, riskAmount: 250, rMultiple: -1 });
    const affiche = calibrateTrade(stocke, 2); // risque 500, P&L -500

    const corrige = withPnlFromRiskAndR(affiche, { rMultiple: 2 });
    expect(corrige.pnl).toBe(1000); // 500 × 2, cohérent avec ce qui est affiché

    const aStocker = uncalibrateTrade(corrige, 2);
    expect(aStocker.pnl).toBe(500); // 250 × 2 à l'échelle d'origine
    expect(aStocker.rMultiple).toBe(2); // le R est un ratio : identique partout
  });

  it("éditer DEUX fois de suite ne fait pas dériver la valeur stockée", () => {
    // Le piège d'une correction sans retour à l'échelle : chaque édition
    // multiplierait de nouveau. Ici, dix éditions successives laissent le
    // risque exactement où le trader l'a mis.
    let stocke = trade({ riskAmount: 250, rMultiple: 1, pnl: 250 });
    for (let i = 0; i < 10; i++) {
      const affiche = calibrateTrade(stocke, 2);
      stocke = uncalibrateTrade(withPnlFromRiskAndR(affiche, { riskAmount: 600 }), 2);
    }
    expect(stocke.riskAmount).toBe(300);
    expect(calibrateTrade(stocke, 2).riskAmount).toBe(600);
  });
});
