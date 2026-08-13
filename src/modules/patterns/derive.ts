import type { MistakeClusterId } from "@/app/utils/mistakeClusters";
import type { DetectedPattern } from "./detectors";
import type { ProposalActionType } from "./proposalSchemas";

/**
 * Du motif observé à l'action proposée — DÉTERMINISTE.
 *
 * C'est le point exact où `ECOSYSTEM_WIRING.md` interdit au LLM d'intervenir :
 * *« le moteur trouve les motifs, le LLM ne fait que les phraser. Le LLM ne
 * doit jamais décider QU'UN motif existe, ni inventer un seuil, ni proposer une
 * règle que le moteur n'a pas émise. »*
 *
 * Ce fichier est cette frontière. Chaque motif connu a UNE action candidate,
 * écrite ici en toutes lettres. Un motif dont la traduction en action n'est pas
 * prévue ne produit rien — pas une action approximative, pas une action
 * « générique ». Rien.
 *
 * ── LES SEUILS VIENNENT DU MOTIF, PAS D'UNE INVENTION ──────────────────────
 * Quand une action porte un nombre (« pas plus de N trades par jour »), ce
 * nombre est DÉRIVÉ des données observées, jamais choisi par un modèle ni tiré
 * d'une bonne pratique générique. Un seuil inventé serait exactement le genre
 * de chiffre juste-en-apparence que `GO-LIVE.md` recense.
 *
 * ── LA JUSTIFICATION NE CONTIENT QUE DES FAITS ─────────────────────────────
 * `rationaleFacts` rend les chiffres bruts — valeur, référence, tailles de
 * groupe, nombre de comparaisons. La mise en phrase viendra ensuite, et le
 * filtre de causalité (`language.ts`) s'appliquera à ce qu'elle produit. Ici,
 * aucune prose.
 */

export interface CandidateAction {
  actionType: ProposalActionType;
  /**
   * Les champs du payload que LE MOTEUR fixe — jamais complet.
   *
   * Il manque toujours `text` : la formulation lisible est la seule part que le
   * rédacteur (humain ou modèle) apporte. Le nom dit « brouillon » pour qu'on ne
   * l'insère pas tel quel : `validateProposal` le refuse sans `text`, et c'est
   * voulu — un payload complet sorti d'ici laisserait croire que le moteur sait
   * écrire, un payload complété ailleurs qu'ici laisse le moteur seul maître des
   * chiffres.
   */
  payloadDraft: Record<string, unknown>;
  /**
   * Les faits que la justification devra citer, et RIEN d'autre.
   * Un rédacteur — humain ou modèle — n'a pas le droit d'y ajouter un chiffre.
   */
  rationaleFacts: {
    kind: string;
    clusterId: MistakeClusterId | null;
    n: number;
    comparisonN: number | null;
    comparisons: number;
    value: number;
    baseline: number | null;
    impactR: number | null;
  };
}

/**
 * L'action candidate d'un motif, ou `null` si aucune n'est prévue.
 *
 * `readiness_correlation` rend délibérément `null` : une association entre
 * préparation déclarée et résultats ne justifie AUCUNE action automatique. Le
 * trader peut la lire ; en tirer « impose-toi la checklist » supposerait une
 * cause que les données ne portent pas.
 */
export function deriveAction(pattern: DetectedPattern): CandidateAction | null {
  const facts: CandidateAction["rationaleFacts"] = {
    kind: pattern.kind,
    clusterId: pattern.clusterId,
    n: pattern.evidence.n,
    comparisonN: pattern.evidence.comparisonN,
    comparisons: pattern.evidence.comparisons,
    value: pattern.evidence.value,
    baseline: pattern.evidence.baseline,
    impactR: pattern.impactR,
  };

  switch (pattern.kind) {
    case "cluster_concentration": {
      // Un item de checklist, pas une règle : à ce stade on veut que le trader
      // REGARDE la famille en cause avant d'entrer, pas qu'il s'impose un
      // plafond chiffré qu'aucune donnée ne fixe.
      // Aucun champ machine : ni la position ni le libellé ne se déduisent des
      // données. `payloadDraft` est vide, et c'est exact — le moteur n'a ici
      // rien à imposer d'autre que la famille, qui voyage dans les faits.
      if (!pattern.clusterId) return null;
      return {
        actionType: "add_checklist_item",
        payloadDraft: {},
        rationaleFacts: facts,
      };
    }

    case "after_loss": {
      // Le seul seuil honnête ici est 1 : « après une perte, un seul trade de
      // plus ». Il ne sort pas d'une bonne pratique, il sort du motif — c'est
      // le trade suivant une perte qui se dégrade.
      return {
        actionType: "create_rule",
        payloadDraft: { metric: "max_consecutive_losses", threshold: 1 },
        rationaleFacts: facts,
      };
    }

    case "time_of_day": {
      // Aucune action automatique : « ne trade pas entre 14 h et 16 h » est une
      // interdiction tirée d'un minimum parmi plusieurs tranches. On montre
      // l'observation, on ne propose pas de s'amputer une plage horaire.
      return null;
    }

    case "readiness_correlation":
      return null;

    default:
      return null;
  }
}

/**
 * Les actions candidates d'un passage, dans l'ordre reçu, sans les vides.
 *
 * Le budget d'intervention (3 en attente, 1 par jour) n'est PAS appliqué ici :
 * il est porté par la base, où aucun futur chemin d'écriture ne peut l'oublier.
 * Ce module se contente de dire ce qui serait proposable.
 */
export function deriveActions(patterns: DetectedPattern[]): CandidateAction[] {
  return patterns.map(deriveAction).filter((a): a is CandidateAction => a !== null);
}
