import type { JarvisMessage } from "./blocks";

/**
 * Sérialisation d'un message pour l'HISTORIQUE renvoyé au coach.
 *
 * Module PUR (aucune UI, aucun réseau) : ce que Jarvis se rappelle de ses
 * propres tours est une décision produit à part entière, testable seule.
 *
 * Le problème qu'il résout : l'affichage lit le premier bloc `markdown`, mais
 * depuis que les réponses sont découpées en blocs, le PLAN vit dans un bloc
 * `mission`. L'historique perdait donc exactement ce que Jarvis avait promis —
 * il se répétait ou se contredisait au tour suivant.
 */

/** Longueur maximale d'un tour renvoyé au modèle. Large pour le diagnostic,
 *  assez serré pour que 16 tours restent bon marché. */
export const HISTORY_CHARS = 900;

/**
 * Choix de CONTENU (qualité du contexte, pas seulement sa taille) :
 *
 *  - INCLUS — l'analyse, le nom du pattern, le plan et l'action proposée : rien
 *    d'autre ne transporte ces informations d'un tour à l'autre.
 *  - EXCLU — les valeurs chiffrées des blocs `insight` : elles sont recalculées
 *    et renvoyées à chaque appel dans le bloc BEHAVIOUR SIGNALS ; les recopier
 *    reviendrait à payer deux fois la même information.
 *  - EXCLU — les blocs `alert` : ce sont des notices d'INTERFACE (ex. « analyse
 *    hors ligne »), pas des propos de Jarvis. Les renvoyer ferait croire au
 *    modèle qu'il les a prononcées et polluerait les tours suivants.
 */
export function historyTextOf(message: JarvisMessage): string {
  const parts: string[] = [];
  for (const block of message.blocks) {
    switch (block.type) {
      case "markdown":
        parts.push(block.content);
        break;
      case "hero":
        parts.push(block.lines.map((l) => l.text).join(" "));
        break;
      case "insight":
        parts.push(`[pattern: ${block.patternLabel}]`);
        break;
      case "mission":
        if (block.items.length) parts.push(`${block.title}: ${block.items.join(" · ")}`);
        break;
      case "tool":
        parts.push(`[action proposée: ${block.label}]`);
        break;
    }
  }
  return parts.filter(Boolean).join("\n").slice(0, HISTORY_CHARS);
}
