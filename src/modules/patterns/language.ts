/**
 * L'interdiction de la causalité — UNE seule liste, deux gardes.
 *
 * POURQUOI CE FICHIER. `tests/noCausalLanguage.test.ts` protège les fichiers de
 * traduction : il lit des chaînes écrites à l'avance, en CI. Mais en Phase 4,
 * Jarvis rédige `rationale` À L'EXÉCUTION, et aucun test statique ne peut voir
 * cette chaîne-là. Une justification qui dit « parce que » part chez
 * l'utilisateur quelle que soit la couleur de la CI.
 *
 * La liste vit donc ici, exportée une fois, importée par le test ET par le
 * contrôle d'exécution. Deux copies auraient divergé, et la copie oubliée
 * aurait été celle du chemin de production.
 *
 * ── CE QUE LA RÈGLE PROTÈGE ────────────────────────────────────────────────
 * Le produit observe une ASSOCIATION entre une variable en partie déclarative
 * (l'état émotionnel, la checklist cochée) et des résultats. Il ne peut pas
 * établir de cause : ni essai contrôlé, ni assignation aléatoire, ni contrôle
 * des variables confondantes. Écrire « ta préparation améliore ton expectancy »
 * transforme une corrélation en promesse, et un trader qui change de
 * comportement sur une promesse fausse est abîmé par le produit.
 */

/**
 * Formulations qui promettent une cause, en français et en anglais.
 *
 * Volontairement courte et concrète. Une liste plus large attraperait des
 * usages légitimes (« car » dans une FAQ), produirait des exceptions, puis une
 * règle que quelqu'un désactive.
 */
export const CAUSAL_PHRASES = [
  "parce que",
  "améliore",
  "ameliore",
  "grâce à",
  "grace a",
  "à cause de",
  "a cause de",
  "improves",
  "because",
  "causes",
  "leads to",
] as const;

export interface CausalCheck {
  ok: boolean;
  /** La formulation trouvée, pour que le rejet soit journalisable. */
  matched: string | null;
}

/**
 * Vérifie une justification produite à l'exécution.
 *
 * Rend `ok: false` avec la formulation fautive plutôt qu'un booléen nu : un
 * rejet qu'on ne peut pas expliquer dans un log est un rejet qu'on finit par
 * supprimer pour « débloquer ».
 */
export function checkCausalLanguage(text: string): CausalCheck {
  const lower = text.toLowerCase();
  for (const phrase of CAUSAL_PHRASES) {
    if (lower.includes(phrase)) return { ok: false, matched: phrase };
  }
  return { ok: true, matched: null };
}

/**
 * La contrainte, telle qu'elle est envoyée au modèle.
 *
 * Elle est ici plutôt que dans le prompt pour que le texte de la règle et le
 * contrôle qui la fait respecter vivent au même endroit. Le prompt réduit la
 * fréquence des violations ; le contrôle d'exécution est ce qui les arrête.
 */
export const NO_CAUSAL_LANGUAGE_INSTRUCTION = [
  "N'écris JAMAIS de lien de causalité entre un comportement et un résultat.",
  "Tu décris une association observée sur des données déclaratives, pas une cause.",
  "Interdits : « parce que », « grâce à », « à cause de », « améliore », « because », « improves ».",
  "Écris plutôt : « ces séances sont associées à… », « on observe, sur N séances, que… ».",
  "Cite toujours la taille d'échantillon fournie. N'invente aucun chiffre.",
].join(" ");
