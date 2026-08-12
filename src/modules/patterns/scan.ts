import {
  afterLoss,
  clusterConcentration,
  readinessAssociation,
  timeOfDay,
  type DetectedPattern,
  type DetectorResult,
  type SessionLike,
  type TradeLike,
} from "./detectors";
import { DISMISS_DAYS } from "./thresholds";

/**
 * Le passage de détection — PUR, et volontairement pauvre.
 *
 * Il fait trois choses et rien d'autre : lancer les détecteurs, écarter ce qui
 * a été refusé récemment, trier ce qui reste. Il n'appelle aucun modèle, ne
 * formule aucune phrase, n'invente aucun seuil.
 *
 * POURQUOI CE FICHIER EXISTE PLUTÔT QU'UNE BOUCLE DANS LE SERVEUR. Le tri et
 * la règle d'oubli sont exactement les endroits où un « petit ajustement »
 * transformerait un observatoire en machine à nagger. Isolés ici, ils sont
 * testables et lisibles d'un coup d'œil ; noyés dans un handler, ils auraient
 * dérivé au premier ticket.
 *
 * CE QU'IL NE FAIT PAS, ET NE FERA PAS : combiner des filtres. Croiser
 * « jeudi » × « après une perte » × « 14 h-16 h » produirait des motifs qui
 * paraissent forts parce qu'on en a essayé beaucoup, pas parce qu'ils le sont.
 * Chaque détecteur reste à une dimension ; c'est une contrainte
 * d'architecture, pas un réglage.
 */

export interface ScanInput {
  trades: TradeLike[];
  sessions: SessionLike[];
  /** Motifs déjà connus, pour la règle d'oubli. */
  known: { kind: string; clusterId: string | null; dismissedAt: string | null }[];
  /** Injecté pour rester pur et testable. */
  now?: Date;
}

export interface ScanOutput {
  /** Ce qui est publiable, du plus fort impact au plus faible. */
  patterns: DetectedPattern[];
  /**
   * Ce que les détecteurs ont refusé de dire, avec ce qu'il manque. Sert à
   * afficher « encore 8 séances » plutôt qu'un écran vide — le spec le demande
   * explicitement.
   */
  pending: Extract<DetectorResult, { status: "not_enough" }>[];
  /** Motifs supprimés parce qu'écartés il y a moins de 30 jours. */
  suppressed: number;
}

function keyOf(kind: string, clusterId: string | null): string {
  return `${kind}:${clusterId ?? ""}`;
}

/**
 * Un motif écarté ne revient pas avant 30 jours.
 *
 * La règle protège une chose précise : la crédibilité. Re-proposer le
 * lendemain ce que le trader vient de refuser lui apprend que le bouton
 * « ignorer » ne sert à rien, et il cesse de lire le reste.
 */
function isSuppressed(dismissedAt: string | null, now: Date): boolean {
  if (!dismissedAt) return false;
  const elapsed = now.getTime() - new Date(dismissedAt).getTime();
  return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function scan(input: ScanInput): ScanOutput {
  const now = input.now ?? new Date();
  const results: DetectorResult[] = [
    clusterConcentration(input.trades),
    afterLoss(input.trades),
    timeOfDay(input.trades),
    readinessAssociation(input.sessions, input.trades),
  ];

  const dismissed = new Map(
    input.known.map((k) => [keyOf(k.kind, k.clusterId), k.dismissedAt] as const),
  );

  const patterns: DetectedPattern[] = [];
  const pending: Extract<DetectorResult, { status: "not_enough" }>[] = [];
  let suppressed = 0;

  for (const result of results) {
    if (!result) continue;
    if (result.status === "not_enough") {
      pending.push(result);
      continue;
    }
    if (isSuppressed(dismissed.get(keyOf(result.kind, result.clusterId)) ?? null, now)) {
      suppressed += 1;
      continue;
    }
    patterns.push(result);
  }

  // Tri par impact observé, du plus lourd au plus léger. `impactR` peut être
  // `null` (association de préparation) : ces motifs passent en dernier, sans
  // qu'on leur fabrique une valeur pour les classer.
  patterns.sort((a, b) => Math.abs(b.impactR ?? 0) - Math.abs(a.impactR ?? 0));

  return { patterns, pending, suppressed };
}
