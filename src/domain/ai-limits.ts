/**
 * LES BORNES DU CONTEXTE IA — une seule définition, des deux côtés.
 *
 * POURQUOI CE MODULE. Tout le contexte que Jarvis reçoit vient du CLIENT : le
 * serveur ne relit pas les trades, il fait confiance au corps de la requête.
 * C'est un choix d'architecture assumé (les moteurs déterministes tournent dans
 * le navigateur, l'IA ne fait qu'interpréter leurs chiffres), mais il met le
 * coût du modèle entre les mains de l'appelant.
 *
 * Les plafonds Zod d'origine autorisaient, PAR REQUÊTE :
 *
 *     500 trades × (notes 10 000 + confluences 30×100 + erreurs 20×100)
 *   ≈ 7,5 Mo de texte, soit de l'ordre du million de tokens d'entrée
 *
 * — le tout multiplié par les soixante appels horaires autorisés. Un compte
 * authentifié pouvait donc transformer une question de coach en facture de
 * modèle, sans rien faire d'illégitime en apparence.
 *
 * Le terme dominant était `notes` : 500 × 10 000 fait 5 Mo à lui seul. Une note
 * de trade est une phrase ou deux ; dix mille caractères, c'est deux pages par
 * trade. On la ramène donc à une taille réaliste, et on ajoute un PLAFOND
 * GLOBAL d'octets qui ne dépend d'aucun champ en particulier — la seule borne
 * qui résiste à l'ajout d'un nouveau champ demain.
 *
 * CE QUI N'EST PAS TOUCHÉ : le NOMBRE de trades reste à 500. C'est la
 * profondeur d'historique sur laquelle le coach raisonne, donc une décision
 * produit — la réduire changerait ses réponses. Le coût, lui, est déjà réglé
 * par la taille des notes et le plafond global.
 *
 * Module PUR (ni React, ni `process.env`) : importable par le constructeur de
 * contexte côté navigateur ET par les schémas de validation côté serveur.
 */

export const AI_LIMITS = {
  /** Profondeur d'historique. Décision produit — voir l'en-tête. */
  trades: 500,
  /**
   * Note de trade transmise au modèle.
   *
   * La note COMPLÈTE reste en base et s'affiche intégralement dans le journal :
   * seule la copie envoyée au modèle est raccourcie. Mille cinq cents
   * caractères tiennent un paragraphe dense, ce qui est le format réel d'une
   * note de trade.
   */
  tradeNote: 1_500,
  goals: 10,
  mistakes: 40,
  rules: 30,
  ruleText: 300,
  memory: 60,
  memoryContent: 2_000,
  conversation: 20,
  /** Un tour de conversation. Une réponse de Jarvis fait ~2 000 caractères ;
   *  4 000 laisse de la marge sans autoriser un roman par tour. */
  conversationContent: 4_000,
  intent: 25,
  reflection: 25,
  adherence: 5,
  /** Le bloc de signaux comportementaux, sérialisé. Inchangé : il était déjà
   *  borné, et c'est la preuve que la borne globale ci-dessous n'est pas une
   *  nouveauté de principe mais la généralisation d'une pratique existante. */
  signalsBytes: 12_000,
  profile: 600,
  question: 500,
} as const;

/**
 * Plafond GLOBAL du contexte sérialisé, en octets.
 *
 * Indépendant des champs : c'est la borne qui tient encore le jour où
 * quelqu'un ajoute un tableau au contexte sans penser au coût. 256 Ko
 * représentent environ 64 000 tokens d'entrée — largement au-dessus d'un usage
 * normal (un contexte typique pèse quelques dizaines de kilo-octets) et très
 * en dessous du million qu'autorisait l'ancienne validation.
 *
 * Réglable par `AI_MAX_CONTEXT_BYTES` côté serveur, sans redéploiement.
 */
export const AI_MAX_CONTEXT_BYTES_DEFAULT = 256 * 1024;

/** La taille réelle, en octets UTF-8, d'une valeur sérialisée. `JSON.stringify`
 *  puis `TextEncoder` : un caractère accentué compte pour ce qu'il coûte
 *  vraiment, `length` mentirait. */
export function contextByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? "").length;
  } catch {
    // Référence circulaire ou valeur non sérialisable : on la déclare
    // hors-limites plutôt que de la laisser passer sans mesure.
    return Number.POSITIVE_INFINITY;
  }
}

/** Le message d'erreur du dépassement — partagé pour que le test et le code
 *  ne le décrivent pas chacun à leur façon. */
export const AI_CONTEXT_TOO_LARGE = "AI_CONTEXT_TOO_LARGE";
