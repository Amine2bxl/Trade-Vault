/**
 * Recalibrage d'échelle de compte — module PUR.
 *
 * ── LE PROBLÈME PRODUIT ────────────────────────────────────────────────────
 * Un trader prend 200 trades sur un compte prop de 25 000 $ en risquant 1 %
 * (250 $ par trade). Le compte saute. Il en achète un de 50 000 $ et veut
 * CONTINUER dans le même journal. Ses 200 anciens trades restent alors
 * exprimés à l'échelle 25k : un risque de 250 $ qui, sur son compte actuel, ne
 * représente plus 1 % mais 0,5 %. Son historique dit une chose, sa réalité en
 * dit une autre, et toutes les statistiques monétaires deviennent trompeuses.
 *
 * Recalibrer, c'est répondre à : « à quoi ressemblerait mon historique si je
 * l'avais tradé sur mon capital d'aujourd'hui ? »
 *
 * ── L'ARCHITECTURE, ET POURQUOI CELLE-LÀ ───────────────────────────────────
 * Trois options existaient : (A) écrire les valeurs recalibrées en base à côté
 * des originales, (B) stocker une métadonnée de calibration et dériver à la
 * lecture, (C) versionner chaque calibration.
 *
 * **(B) est retenue**, pour une raison qui tient à ce projet précis : les
 * trades en base sont la SOURCE DE VÉRITÉ, et le produit a déjà pour règle
 * cardinale « une seule source de vérité par information ». Écrire une
 * seconde copie des montants (A) créerait exactement la duplication que cette
 * règle interdit, et la première divergence entre les deux copies serait
 * indétectable. (C) résoudrait un problème que personne n'a : l'utilisateur
 * veut connaître son échelle actuelle et son échelle d'origine, pas relire
 * l'échelle qu'il avait mardi dernier.
 *
 * Concrètement : **aucune ligne `trades` n'est jamais modifiée.** Le compte
 * porte deux champs, et la conversion se fait à la lecture, en un seul point
 * de passage (le hook `useTrades`), donc pour toutes les pages à la fois.
 *
 * ── LE FACTEUR SE CALCULE TOUJOURS DEPUIS L'ORIGINE ────────────────────────
 * 25k → 50k → 100k ne s'applique JAMAIS comme 2× puis 2×. Le facteur est
 * toujours `cible / capital d'origine`, soit une division unique : 100000 /
 * 25000 = 4. C'est ce qui rend l'opération idempotente, réversible, et exempte
 * d'accumulation d'erreur flottante — les trois pièges d'un recalibrage
 * incrémental.
 *
 * ── CE QUI EST RECALIBRÉ, ET CE QUI NE L'EST PAS ───────────────────────────
 * Recalibré (valeurs monétaires, dépendantes du capital) :
 *   `pnl` · `riskAmount` · `mae` · `mfe` · `slippage`
 *
 * JAMAIS recalibré :
 *   - `rMultiple` — c'est un RATIO. Risquer 250 $ pour en gagner 500 et
 *     risquer 500 $ pour en gagner 1 000, c'est le même trade : 2R.
 *   - tout le comportemental — `mistakes`, `setupQuality`, `confidence`,
 *     `confluences`, `strategy`, `notes`, horaires. « Tu as revenge-tradé 4
 *     fois » reste 4 fois quel que soit le capital. Changer d'échelle
 *     financière ne réécrit pas l'histoire de ce que le trader a fait.
 *
 * Le modèle `Trade` de TradeVault ne contient **aucun prix de marché** (pas de
 * SL/TP en prix, en ticks ni en points — vérifié dans `types.ts` et
 * `domain/trade.ts`). La question « ne pas multiplier un stop à 17 950 par 2 »
 * ne se pose donc pas ici : il n'existe aucun champ de ce type à protéger. Si
 * un jour le modèle en accueille un, il devra rester **hors** de
 * `CALIBRATED_FIELDS` — d'où la liste explicite plutôt qu'un parcours
 * automatique des champs numériques.
 *
 * ── POURQUOI TOUT LE RESTE SUIT SANS UNE LIGNE DE CODE ─────────────────────
 * Le solde du compte est recalibré du même facteur que les trades. Or les
 * moteurs existants expriment déjà leurs grandeurs relatives PAR RAPPORT à ce
 * solde : `max_risk_pct` divise `riskAmount` par le solde, `quantStats` calcule
 * le drawdown en pourcentage du capital, l'Edge Score en dérive sa composante
 * risque. Numérateur et dénominateur étant multipliés par le même facteur, tous
 * ces pourcentages sont **invariants** — c'est exactement le résultat voulu, et
 * il est obtenu sans dupliquer ni modifier un seul calcul existant.
 *
 * Corollaire pour le Risk Guard : une limite « perte max 2 % » vaut 500 $ sur
 * 25k et 1 000 $ sur 50k, automatiquement. Les limites exprimées en NOMBRE
 * (max 3 trades/jour, stop après 2 pertes) ne bougent pas, puisqu'elles ne
 * dépendent pas du capital.
 *
 * ── COMPATIBILITÉ MONTE CARLO ──────────────────────────────────────────────
 * `normalizedReturns()` expose l'historique en R et en % du capital — les deux
 * grandeurs invariantes à l'échelle. Une simulation nourrie de ces séries donne
 * le même résultat avant et après recalibrage, ce qui est la propriété
 * indispensable pour que « probabilité de ruine » veuille dire quelque chose.
 */

import type { Trade } from "../types";

/** Aucune calibration : l'historique est représenté tel qu'il a été tradé. */
export const IDENTITY_SCALE = 1;

/**
 * Calibration d'un compte. `scale` est le facteur appliqué aux montants
 * historiques ; `originalBalance` est le capital sur lequel ces trades ont
 * RÉELLEMENT été pris — la source canonique dont tout facteur est recalculé.
 */
export interface AccountCalibration {
  scale: number;
  originalBalance: number;
}

/** Les seuls champs monétaires du modèle `Trade`. Liste explicite : voir §
 *  « ce qui est recalibré » — un champ ajouté au modèle ne doit PAS être
 *  recalibré par défaut, il doit être ajouté ici en conscience. */
export const CALIBRATED_FIELDS = ["pnl", "riskAmount", "mae", "mfe", "slippage"] as const;

/** Une calibration est active dès que le facteur s'écarte de 1. */
export function isCalibrated(scale: number | null | undefined): boolean {
  return (
    typeof scale === "number" && Number.isFinite(scale) && scale > 0 && scale !== IDENTITY_SCALE
  );
}

/**
 * Facteur pour représenter un historique sur `targetBalance`.
 *
 * TOUJOURS calculé depuis le capital d'origine, jamais depuis la
 * représentation courante : c'est ce qui interdit la double multiplication et
 * rend 25k → 50k → 100k identique à 25k → 100k, au bit près.
 */
export function scaleFor(originalBalance: number, targetBalance: number): number {
  if (!Number.isFinite(originalBalance) || originalBalance <= 0) return IDENTITY_SCALE;
  if (!Number.isFinite(targetBalance) || targetBalance <= 0) return IDENTITY_SCALE;
  return targetBalance / originalBalance;
}

/** Le solde auquel l'historique est actuellement représenté. */
export function calibratedBalance(cal: AccountCalibration): number {
  return round2(cal.originalBalance * cal.scale);
}

/**
 * Arrondi au cent.
 *
 * Appliqué à CHAQUE montant converti, et non à la fin d'un cumul : sans lui,
 * un facteur non décimal (25k → 30k = 1,2) laisserait traîner des
 * 249,99999999999997 qui se propageraient dans toutes les sommes et
 * finiraient par être visibles à l'écran.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convertit un montant, en préservant `null`/`undefined` (« non renseigné »
 *  n'est pas zéro : MAE absent ne veut pas dire MAE nul). */
export function scaleMoney<T extends number | null | undefined>(value: T, scale: number): T {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return round2(value * scale) as T;
}

/**
 * Représente UN trade à l'échelle demandée. L'objet d'origine n'est jamais
 * muté — l'appelant garde toujours accès à la vérité brute.
 */
export function calibrateTrade(trade: Trade, scale: number): Trade {
  if (!isCalibrated(scale)) return trade;
  return {
    ...trade,
    pnl: scaleMoney(trade.pnl, scale),
    riskAmount: scaleMoney(trade.riskAmount, scale),
    mae: scaleMoney(trade.mae, scale),
    mfe: scaleMoney(trade.mfe, scale),
    slippage: scaleMoney(trade.slippage, scale),
    // rMultiple, mistakes, setupQuality, confidence, confluences, strategy,
    // notes, horaires : INCHANGÉS. Ratios et comportement ne dépendent pas du
    // capital.
  };
}

/**
 * Représente un historique complet. Rend le tableau d'origine **par
 * référence** quand aucune calibration n'est active — les consommateurs sont
 * mémoïsés sur l'identité du tableau, en recréer un à chaque rendu ferait
 * recalculer toutes les statistiques pour rien.
 */
export function calibrateTrades(trades: Trade[], scale: number): Trade[] {
  if (!isCalibrated(scale)) return trades;
  return trades.map((t) => calibrateTrade(t, scale));
}

// ── Aperçu avant confirmation ───────────────────────────────────────────────

/** Les clés i18n que l'aperçu peut produire. Union fermée plutôt que `string` :
 *  le typage du traducteur refuse alors une clé inventée, et une clé retirée
 *  des traductions casse la compilation au lieu d'afficher son propre nom. */
export type CalibrationRowKey =
  | "recal.rowBalance"
  | "recal.rowPnl"
  | "recal.rowRisk"
  | "recal.rowRMultiple"
  | "recal.rowRiskPct";

export interface CalibrationPreviewRow {
  key: CalibrationRowKey;
  before: number;
  after: number;
  /** `money` est converti ; `ratio` et `percent` sont invariants — les montrer
   *  identiques est le meilleur moyen d'expliquer ce que fait l'opération. */
  format: "money" | "ratio" | "percent";
}

/**
 * Ce que la recalibration changera, sur un trade réel du journal.
 *
 * Montrer le trade du trader plutôt qu'un exemple inventé : c'est la
 * différence entre « on va multiplier des nombres » et « voici ton trade de
 * mardi, avant et après ».
 */
export function previewCalibration(
  sample: Trade | null,
  currentBalance: number,
  targetBalance: number,
  scale: number,
): CalibrationPreviewRow[] {
  const rows: CalibrationPreviewRow[] = [
    { key: "recal.rowBalance", before: currentBalance, after: targetBalance, format: "money" },
  ];
  if (!sample) return rows;

  const after = calibrateTrade(sample, scale);
  rows.push(
    { key: "recal.rowPnl", before: sample.pnl, after: after.pnl, format: "money" },
    { key: "recal.rowRisk", before: sample.riskAmount, after: after.riskAmount, format: "money" },
  );
  // Le R multiple et le risque en % sont montrés PRÉCISÉMENT parce qu'ils ne
  // bougent pas : c'est la preuve visible que le comportement du trade est
  // préservé et que seule l'échelle change.
  rows.push({
    key: "recal.rowRMultiple",
    before: sample.rMultiple,
    after: after.rMultiple,
    format: "ratio",
  });
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
 * risque renseigné. Un trade sans risque ne montrerait ni conversion de
 * risque ni pourcentage — soit l'essentiel de la démonstration.
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
 * bruts. Sans cela, recalibrer un compte changerait la probabilité de ruine
 * calculée sur le même comportement de trading — ce qui n'a aucun sens.
 *
 * La fonction est ici, et non dans un futur module Monte Carlo, précisément
 * pour que cette propriété soit garantie par le module qui définit l'échelle.
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
