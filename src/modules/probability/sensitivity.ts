/**
 * Sensibilité — quelles variables changent VRAIMENT le résultat.
 *
 * Module PUR. Il ne suppose aucune valeur : chaque ligne du tableau de
 * sensibilité est obtenue en relançant réellement le moteur avec une variable
 * modifiée, à graine identique.
 *
 * ── POURQUOI LA MÊME GRAINE ────────────────────────────────────────────────
 * C'est le point technique décisif. Si chaque variante était simulée avec une
 * graine différente, l'écart mesuré mélangerait l'effet de la variable et le
 * bruit du tirage — et sur 2 000 trajectoires ce bruit vaut plusieurs points
 * de pourcentage, soit souvent plus que l'effet cherché. En réutilisant la
 * graine du scénario de base, les deux simulations tirent la MÊME séquence de
 * trades : tout écart restant est imputable à la variable, et à elle seule.
 * C'est la technique des « nombres aléatoires communs ».
 *
 * ── CE QUE LE MODULE NE FAIT PAS ───────────────────────────────────────────
 * Il ne classe pas les leviers par « importance » sur une échelle inventée, et
 * n'affirme pas de causalité : il rend un DELTA mesuré. « Risquer moitié moins
 * ferait passer la ruine de 31 % à 6 % » est un fait de simulation.
 * « Réduis ton risque » est un conseil — il appartient à l'interface et à
 * Jarvis, pas au moteur.
 */

import { runSimulation, type SimulationConfig, type SimulationResult } from "./engine";
import type { SimDataset } from "./dataset";

/** Ce qu'on fait varier. Chaque levier correspond à une décision que le
 *  trader peut réellement prendre demain matin — pas à un paramètre abstrait. */
export type LeverKind =
  | "risk" // taille de position
  | "stopAfterLosses" // règle d'arrêt journalier
  | "tradesPerDay" // fréquence
  | "horizon"; // durée laissée au compte

export interface Lever {
  kind: LeverKind;
  /** Valeur appliquée. Pour `risk`, un multiplicateur (0,5 = moitié moins). */
  value: number;
  /** Étiquette technique stable ; la traduction est faite par l'interface. */
  id: string;
}

export interface SensitivityRow {
  lever: Lever;
  /** Résultat complet de la variante — l'appelant peut afficher ce qu'il veut
   *  sans relancer le moteur. */
  result: SimulationResult;
  /** Variation en points de probabilité (−1..1) face au scénario de base. */
  deltaPass: number;
  deltaRuin: number;
  /** Variation du P&L médian, en devise. */
  deltaMedianPnl: number;
}

export interface SensitivityReport {
  base: SimulationResult;
  rows: SensitivityRow[];
}

/** Applique un levier à une configuration, sans muter l'original. */
export function applyLever(config: SimulationConfig, lever: Lever): SimulationConfig {
  switch (lever.kind) {
    case "risk":
      return { ...config, riskMultiplier: lever.value };
    case "stopAfterLosses":
      // 0 signifie explicitement « aucune règle d'arrêt », pas « arrêt à zéro
      // perte » — sans quoi la journée se fermerait avant le premier trade.
      return { ...config, stopAfterLosses: lever.value > 0 ? Math.round(lever.value) : null };
    case "tradesPerDay":
      return { ...config, tradesPerDay: Math.max(1, Math.round(lever.value)) };
    case "horizon":
      return { ...config, tradesPerPath: Math.max(1, Math.round(lever.value)) };
  }
}

/**
 * Mesure l'effet de chaque levier.
 *
 * `base` est recalculé ici plutôt que passé par l'appelant : rien ne
 * garantirait sinon qu'il a été produit avec la même graine que les variantes,
 * et la comparaison perdrait sa validité.
 */
export function runSensitivity(
  dataset: SimDataset,
  config: SimulationConfig,
  levers: readonly Lever[],
): SensitivityReport {
  const base = runSimulation(dataset, config);
  const rows: SensitivityRow[] = levers.map((lever) => {
    const result = runSimulation(dataset, applyLever(config, lever));
    return {
      lever,
      result,
      deltaPass: result.passProbability - base.passProbability,
      deltaRuin: result.riskOfRuin - base.riskOfRuin,
      deltaMedianPnl: result.pnl.median - base.pnl.median,
    };
  });
  return { base, rows };
}

/**
 * Le jeu de leviers par défaut : les questions qu'un trader se pose vraiment.
 *
 * Les valeurs de risque sont relatives à ce qu'il fait DÉJÀ (0,5 = « moitié
 * moins qu'aujourd'hui »), jamais un pourcentage de capital absolu — le moteur
 * ignore le risque réel du trader et l'inventer contredirait le principe de ne
 * jamais fabriquer de donnée.
 */
export function defaultLevers(config: SimulationConfig): Lever[] {
  const levers: Lever[] = [
    { kind: "risk", value: 0.5, id: "risk.half" },
    { kind: "risk", value: 0.75, id: "risk.threeQuarters" },
    { kind: "risk", value: 1.5, id: "risk.oneAndHalf" },
    { kind: "stopAfterLosses", value: 2, id: "stop.two" },
    { kind: "stopAfterLosses", value: 3, id: "stop.three" },
  ];
  // Ne proposer de réduire la fréquence que si elle peut baisser : suggérer
  // « trade moins » à un trader qui prend déjà un trade par jour serait un
  // levier vide, et une ligne vide dans un tableau d'aide à la décision coûte
  // plus de confiance qu'elle n'en rapporte.
  if (config.tradesPerDay > 1) {
    levers.push({
      kind: "tradesPerDay",
      value: Math.max(1, Math.floor(config.tradesPerDay / 2)),
      id: "frequency.half",
    });
  }
  return levers;
}
