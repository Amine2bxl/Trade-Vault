/**
 * Comparaison de scénarios — module PUR.
 *
 * POURQUOI CE MODULE EST DISTINCT DE `sensitivity`. Les deux produisent un
 * tableau, mais ils répondent à deux questions différentes et n'ont pas le
 * droit de partager leur méthode :
 *
 *   `sensitivity` fait varier UNE variable sur le MÊME compte. Les variantes
 *       doivent donc rejouer la même séquence de trades — même graine — pour
 *       que l'écart mesuré soit celui de la variable et non du bruit.
 *
 *   `compare` confronte des comptes DIFFÉRENTS : prop firm A contre prop
 *       firm B, drawdown statique contre trailing, 30 jours contre 60. Chaque
 *       scénario garde SA graine, dérivée de ses propres paramètres, parce que
 *       ce sont deux univers distincts et non deux versions du même.
 *
 * Confondre les deux donnerait des chiffres faux dans un cas ou dans l'autre.
 *
 * Ce module ne classe pas les scénarios et ne désigne pas de gagnant : « le
 * meilleur » dépend de ce que le trader cherche — la probabilité de validation,
 * le risque de ruine, la vitesse. Il rend les mêmes indicateurs pour chacun,
 * et c'est l'interface qui laisse comparer.
 */

import { runSimulation, type SimulationConfig, type SimulationResult } from "./engine";
import type { SimDataset } from "./dataset";
import { assessSample, type SampleAssessment } from "./sample";

export interface ComparisonEntry {
  /** Identifiant stable côté appelant (id du scénario sauvegardé). */
  id: string;
  label: string;
  config: SimulationConfig;
}

export interface ComparisonRow {
  id: string;
  label: string;
  result: SimulationResult;
  /** Identique pour toutes les lignes — l'échantillon historique est le même,
   *  seules les RÈGLES changent. Répété par ligne pour que l'interface n'ait
   *  jamais à le reconstituer. */
  sample: SampleAssessment;
}

/**
 * Simule chaque scénario et rend une ligne par scénario, dans l'ordre reçu.
 *
 * L'ordre est préservé délibérément : le trader a rangé ses scénarios dans un
 * ordre qui a du sens pour lui, et un tri automatique par « meilleur » lui
 * ferait perdre ses repères d'un affichage à l'autre.
 */
export function compareScenarios(
  dataset: SimDataset,
  entries: readonly ComparisonEntry[],
): ComparisonRow[] {
  const sample = assessSample(dataset.trades.length, dataset.rCoverage);
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    result: runSimulation(dataset, entry.config),
    sample,
  }));
}

/**
 * Index de la meilleure ligne selon un critère, ou `null` si la comparaison
 * ne tranche pas.
 *
 * `null` en cas d'ÉGALITÉ, et c'est le point important : mettre en avant un
 * scénario qui fait strictement jeu égal avec un autre inventerait une
 * différence là où il n'y en a pas, et le trader choisirait sur du vide.
 */
export function bestBy(
  rows: readonly ComparisonRow[],
  criterion: "pass" | "ruin" | "pnl",
): number | null {
  if (rows.length === 0) return null;

  const value = (row: ComparisonRow): number => {
    switch (criterion) {
      case "pass":
        return row.result.passProbability;
      // La ruine s'inverse : moins il y en a, mieux c'est.
      case "ruin":
        return -row.result.riskOfRuin;
      case "pnl":
        return row.result.pnl.median;
    }
  };

  let bestIndex = 0;
  let tied = false;
  for (let i = 1; i < rows.length; i++) {
    const diff = value(rows[i]) - value(rows[bestIndex]);
    if (diff > 0) {
      bestIndex = i;
      tied = false;
    } else if (diff === 0) {
      tied = true;
    }
  }
  return tied ? null : bestIndex;
}
