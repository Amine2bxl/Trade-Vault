/**
 * Recalibrage d'échelle de compte — module PUR.
 *
 * ── LE PROBLÈME PRODUIT ────────────────────────────────────────────────────
 * Un trader prend 200 trades sur un compte prop de 25 000 $ en risquant 1 %
 * (250 $ par trade). Le compte saute. Il en achète un de 50 000 $ et veut
 * CONTINUER dans le même journal. Ses 200 anciens trades restent exprimés à
 * l'échelle 25k : un risque de 250 $ qui, sur son compte actuel, ne représente
 * plus 1 % mais 0,5 %.
 *
 * ── LE RECALIBRAGE EST UN ÉVÉNEMENT, PAS UNE LENTILLE ──────────────────────
 * C'est LE point à ne pas se tromper, et une première version l'avait manqué.
 *
 * Le recalibrage convertit **une fois**, au moment où le trader le demande,
 * les trades **déjà encodés**. Ensuite tout redevient normal : on saisit, on
 * édite et on supprime des trades exactement comme avant, sans la moindre
 * conversion en lecture ni en écriture.
 *
 * Traiter le recalibrage comme une lentille permanente produisait deux
 * erreurs : un trade saisi APRÈS le recalibrage était converti lui aussi —
 * alors qu'il a été tradé sur le nouveau capital et ne devait pas bouger — et
 * chaque écriture devait faire un aller-retour d'échelle, ce qui fragilisait
 * l'édition et l'import sans rien apporter.
 *
 * Ce module ne contient donc AUCUNE fonction appliquée à la lecture. Il
 * calcule le facteur, décrit ce que la conversion va faire, et c'est tout : la
 * conversion elle-même est une opération SQL unique et atomique
 * (`recalibrate_account_trades`).
 *
 * ── LE POINT DE COUPURE ────────────────────────────────────────────────────
 * La date d'ENCODAGE (`created_at`), pas la date de marché. Un trade saisi
 * aujourd'hui pour une session d'il y a trois semaines a été saisi en
 * connaissant le capital actuel : il ne doit pas être converti. C'est le geste
 * de saisie qui porte l'échelle.
 *
 * ── CE QUI EST CONVERTI, ET CE QUI NE L'EST PAS ────────────────────────────
 * Converti (valeurs monétaires) : `pnl` · `riskAmount` · `mae` · `mfe` ·
 * `slippage`.
 *
 * JAMAIS : le `rMultiple`, parce que c'est un RATIO — risquer 250 pour gagner
 * 500 ou 500 pour gagner 1 000, c'est le même trade : 2R. Et tout le
 * comportemental : erreurs, qualité de setup, confiance, confluences, notes,
 * horaires. « Tu as revenge-tradé 4 fois » reste 4 fois quel que soit le
 * capital.
 *
 * Le modèle `Trade` ne contient **aucun prix de marché** (ni SL/TP en prix, ni
 * ticks, ni points — vérifié dans `types.ts` et `domain/trade.ts`), donc aucun
 * stop à 17 950 ne risque d'être doublé.
 *
 * ── LE SOLDE SUIT, DONC LES POURCENTAGES NE BOUGENT PAS ────────────────────
 * Le solde du compte passe à la nouvelle taille en même temps que les trades.
 * Or les moteurs existants expriment déjà leurs grandeurs RELATIVEMENT à ce
 * solde : Risk Guard (`max_risk_pct`), le drawdown % de `quantStats`, la
 * composante risque de l'Edge Score. Numérateur et dénominateur étant
 * multipliés ensemble, ces pourcentages sont invariants — sans qu'un seul
 * calcul existant soit modifié ou dupliqué.
 *
 * ── RÉVERSIBILITÉ ──────────────────────────────────────────────────────────
 * Chaque trade porte le facteur CUMULÉ qui lui a été appliqué
 * (`calibration_factor`). La valeur d'origine reste donc exactement
 * calculable : `stocké / facteur`. Revenir en arrière, c'est appliquer
 * l'inverse — aucune table de sauvegarde n'est nécessaire.
 */

import type { Trade } from "../types";

/** Aucun recalibrage : les montants sont ceux qui ont été tradés. */
export const IDENTITY_FACTOR = 1;

/** Les seuls champs monétaires du modèle. Liste explicite : un champ ajouté au
 *  modèle ne doit PAS être converti par défaut, il doit être ajouté ici en
 *  conscience — c'est ainsi qu'un futur prix de marché restera protégé. */
export const CONVERTED_FIELDS = ["pnl", "riskAmount", "mae", "mfe", "slippage"] as const;

/** Un facteur est actif dès qu'il s'écarte de 1. */
export function isCalibrated(factor: number | null | undefined): boolean {
  return (
    typeof factor === "number" &&
    Number.isFinite(factor) &&
    factor > 0 &&
    factor !== IDENTITY_FACTOR
  );
}

/**
 * Facteur à appliquer aux trades déjà encodés pour passer du capital courant
 * au capital cible.
 *
 * Relatif à la représentation COURANTE, et non au capital d'origine : les
 * montants stockés sont déjà à l'échelle courante, puisque le recalibrage
 * précédent les a réellement convertis. 25k → 50k applique 2 ; puis
 * 50k → 100k applique 2 de nouveau, aux lignes qui valent alors 50k. Aucune
 * ligne n'est convertie deux fois pour le même saut.
 */
export function factorFor(currentBalance: number, targetBalance: number): number {
  if (!Number.isFinite(currentBalance) || currentBalance <= 0) return IDENTITY_FACTOR;
  if (!Number.isFinite(targetBalance) || targetBalance <= 0) return IDENTITY_FACTOR;
  return targetBalance / currentBalance;
}

/**
 * Arrondi au cent, appliqué à chaque montant converti.
 *
 * Sans lui, un facteur non décimal (25k → 30k = 1,2) laisserait des
 * 299,99999999999994 se propager dans toutes les sommes. Le même arrondi est
 * appliqué côté SQL (`round(x, 2)` sur des colonnes `numeric`), pour que
 * l'aperçu montré au trader corresponde exactement à ce qui sera écrit.
 */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convertit un montant, en préservant `null`/`undefined` — « non renseigné »
 *  n'est pas zéro : un MAE absent ne veut pas dire un MAE nul. */
export function convertMoney<T extends number | null | undefined>(value: T, factor: number): T {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return roundMoney(value * factor) as T;
}

/**
 * Ce que deviendra UN trade après conversion.
 *
 * Sert à l'aperçu et aux tests : la conversion réelle est faite en SQL, en une
 * seule instruction. Les deux appliquent exactement les mêmes règles, ce que
 * les tests vérifient champ par champ.
 */
export function convertTrade(trade: Trade, factor: number): Trade {
  if (!isCalibrated(factor)) return trade;
  return {
    ...trade,
    pnl: convertMoney(trade.pnl, factor),
    riskAmount: convertMoney(trade.riskAmount, factor),
    mae: convertMoney(trade.mae, factor),
    mfe: convertMoney(trade.mfe, factor),
    slippage: convertMoney(trade.slippage, factor),
    // rMultiple et tout le comportemental : INCHANGÉS.
  };
}

// ── Aperçu avant confirmation ───────────────────────────────────────────────

export type PreviewRowKey =
  | "recal.rowBalance"
  | "recal.rowPnl"
  | "recal.rowRisk"
  | "recal.rowRMultiple"
  | "recal.rowRiskPct";

export interface CalibrationPreviewRow {
  key: PreviewRowKey;
  before: number;
  after: number;
  /** `money` est converti ; `ratio` et `percent` sont invariants — les montrer
   *  identiques est la meilleure explication de ce que fait l'opération. */
  format: "money" | "ratio" | "percent";
}

/**
 * Ce que la conversion changera, sur un trade réel du journal.
 *
 * Montrer le trade du trader plutôt qu'un exemple inventé : c'est la
 * différence entre « on va multiplier des nombres » et « voici ton trade de
 * mardi, avant et après ».
 */
export function previewCalibration(
  sample: Trade | null,
  currentBalance: number,
  targetBalance: number,
  factor: number,
): CalibrationPreviewRow[] {
  const rows: CalibrationPreviewRow[] = [
    { key: "recal.rowBalance", before: currentBalance, after: targetBalance, format: "money" },
  ];
  if (!sample) return rows;

  const after = convertTrade(sample, factor);
  rows.push(
    { key: "recal.rowPnl", before: sample.pnl, after: after.pnl, format: "money" },
    { key: "recal.rowRisk", before: sample.riskAmount, after: after.riskAmount, format: "money" },
    {
      key: "recal.rowRMultiple",
      before: sample.rMultiple,
      after: after.rMultiple,
      format: "ratio",
    },
  );
  if (currentBalance > 0 && targetBalance > 0 && sample.riskAmount > 0) {
    rows.push({
      key: "recal.rowRiskPct",
      before: (sample.riskAmount / currentBalance) * 100,
      after: (after.riskAmount / targetBalance) * 100,
      format: "percent",
    });
  }
  return rows;
}

/**
 * Le trade le plus représentatif pour l'aperçu : le plus récent qui porte un
 * risque renseigné. Un trade sans risque ne montrerait ni conversion de risque
 * ni pourcentage — soit l'essentiel de la démonstration.
 */
export function pickPreviewTrade(trades: readonly Trade[]): Trade | null {
  let best: Trade | null = null;
  for (const t of trades) {
    if (t.riskAmount > 0 && (!best || t.date > best.date)) best = t;
  }
  return best ?? trades[0] ?? null;
}

// ── Compatibilité Monte Carlo ───────────────────────────────────────────────

/**
 * L'historique exprimé en grandeurs INVARIANTES à l'échelle : R multiple et
 * rendement en fraction du capital.
 *
 * Une simulation Monte Carlo (ruine, distribution de drawdown, probabilité
 * d'atteindre une cible) doit tirer dans ces séries et non dans des dollars
 * bruts — sans quoi recalibrer un compte changerait la probabilité de ruine
 * calculée sur le même comportement de trading, ce qui n'a aucun sens.
 */
export function normalizedReturns(
  trades: readonly Trade[],
  balance: number,
): { r: number[]; pctOfBalance: number[] } {
  const r: number[] = [];
  const pctOfBalance: number[] = [];
  for (const t of trades) {
    if (Number.isFinite(t.rMultiple)) r.push(t.rMultiple);
    if (balance > 0) pctOfBalance.push(t.pnl / balance);
  }
  return { r, pctOfBalance };
}
