/**
 * Extraction de mémoire depuis une conversation — module PUR.
 *
 * C'est le maillon qui fait passer Jarvis de « lit une mémoire » à « apprend du
 * trader ». C'est aussi, de loin, le plus dangereux du produit : un LLM à qui
 * l'on accorde le droit d'écrire dans la mémoire long terme peut y installer
 * une croyance fausse qui sera ensuite renvoyée dans CHAQUE prompt, pour
 * toujours. Une hallucination ponctuelle est un incident ; une hallucination
 * mémorisée est une régression permanente de la qualité du coaching.
 *
 * D'où le parti pris : **tout ce qui n'est pas manifestement légitime est
 * rejeté**. Le coût d'un souvenir manqué est faible — le trader le redira, ou
 * un détecteur déterministe le retrouvera. Le coût d'un faux souvenir est
 * durable et invisible.
 *
 * Ce module ne fait AUCUNE entrée/sortie : ni appel LLM, ni accès base. Il
 * reçoit la sortie brute du modèle et rend des candidats validés. C'est ce qui
 * permet de tester les garde-fous — la partie qui compte — sans réseau.
 */

import type { MemoryKind, MemorySource } from "./memory";

/**
 * Seules catégories extractibles par un LLM.
 *
 * `decision` (un engagement) et `preference` (un goût durable) sont les deux
 * seules choses qu'un trader énonce et qu'AUCUN calcul ne peut retrouver.
 *
 * Tout le reste est délibérément hors d'atteinte :
 *  - `profile` a une source canonique (onboarding + profil Jarvis) ;
 *  - `fact` et `lesson` seraient le vecteur d'entrée des hallucinations, car
 *    rien dans le texte ne permet de les vérifier ;
 *  - `conversation` n'a pas à être extrait, il EST la conversation.
 */
export const EXTRACTABLE_KINDS = ["decision", "preference"] as const;
export type ExtractableKind = (typeof EXTRACTABLE_KINDS)[number];

/**
 * Plafond de confiance d'un souvenir extrait.
 *
 * Volontairement SOUS le profil déclaré (0.9) et très en dessous d'une règle
 * explicitement acceptée (1.0) : une phrase interprétée par un modèle ne doit
 * jamais peser autant qu'un clic de l'utilisateur. Reste au-dessus du seuil
 * d'utilisation (0.3), donc le souvenir sert — mais cède devant une source
 * plus sûre, et deux contradictions suffisent à le faire taire.
 */
export const EXTRACTED_MAX_CONFIDENCE = 0.5;

/** Importance plafonnée : un engagement déduit ne prime pas sur l'identité. */
export const EXTRACTED_MAX_IMPORTANCE = 4;

/**
 * Au plus 3 souvenirs par conversation. Sans plafond, une longue session
 * produirait des dizaines de lignes et noierait les souvenirs structurants
 * dans du bavardage — le budget de sélection étant borné, mémoriser trop
 * revient exactement à mémoriser mal.
 */
export const MAX_EXTRACTED_PER_CONVERSATION = 3;

/** Bornes de longueur : trop court n'informe pas, trop long n'est pas un fait. */
const MIN_CONTENT_LENGTH = 12;
const MAX_CONTENT_LENGTH = 200;

/**
 * Un souvenir ne doit JAMAIS contenir de chiffre de performance.
 *
 * C'est la règle la plus importante du fichier. Le win rate, le P&L, le nombre
 * de trades, le R moyen ont tous une source de vérité calculée à partir des
 * trades. Figer « son win rate est de 62 % » dans la mémoire crée un second
 * chiffre qui ne bougera plus, divergera du premier, et sera renvoyé au modèle
 * comme un fait — c'est-à-dire exactement la contradiction que le produit
 * promet d'éliminer.
 *
 * On rejette donc tout pourcentage, montant monétaire, multiple de R, et toute
 * quantité chiffrée de trades ou de jours.
 */
const PERFORMANCE_FIGURE =
  /\d+\s*(%|€|\$|£|r\b|:1\b)|\b\d+\s*(trades?|pips?|points?|jours?|days?|semaines?|weeks?|mois|months?)\b/i;

/**
 * Marqueurs d'incertitude. Un modèle qui écrit « il semble que » ou « peut-être »
 * signale lui-même qu'il extrapole. On le prend au mot : ce n'est pas un fait,
 * ce n'est pas mémorisable.
 */
const HEDGING =
  /\b(peut[- ]être|il semble|semblerait|probablement|sans doute|je pense|on dirait|maybe|probably|it seems|might be|possibly|apparently)\b/i;

/**
 * Pré-filtre déterministe : ce tour vaut-il un appel LLM d'extraction ?
 *
 * DÉCISION DE COÛT, pas de qualité. Extraire après chaque échange doublerait
 * la facture IA et la latence perçue, alors que l'écrasante majorité des tours
 * ne contient rien de mémorisable : « pourquoi je perds le vendredi ? » est une
 * question, pas un engagement. On n'appelle donc le modèle que si le trader a
 * employé une tournure d'ENGAGEMENT ou de PRÉFÉRENCE.
 *
 * Le filtre est volontairement lexical et grossier. Il ne décide pas de ce qui
 * est mémorisé — `validateCandidates` s'en charge — seulement de ce qui mérite
 * qu'on paie pour regarder. Un faux négatif coûte un souvenir manqué, que le
 * trader redira ; un faux positif coûte une fraction de centime.
 */
// Pas d'ancrage `\b` : en JavaScript, `\b` ne reconnaît pas les lettres
// accentuées comme des caractères de mot, donc `\bà partir de` ne matcherait
// JAMAIS « À partir de maintenant ». Ces marqueurs sont des locutions
// distinctives de plusieurs mots ; un faux positif par sous-chaîne est
// implausible, et il ne coûterait de toute façon qu'un appel inutile.
const COMMITMENT_MARKERS =
  /(je (vais|veux|dois|m'engage|arrête|arrete|arrêterai|décide|decide|promets|compte)|à partir de (maintenant|demain|lundi)|désormais|desormais|plus jamais|je ne (vais|veux) plus|dorénavant|dorenavant|i (will|want|must|promise|decide|commit)|from now on|never again)/i;

const PREFERENCE_MARKERS =
  /(je préfère|je prefere|j'aime|je déteste|je deteste|je n'aime pas|je me sens (mieux|plus)|je suis (plus )?(à l'aise|a l'aise)|i prefer|i like|i hate|i'm more comfortable)/i;

export function shouldAttemptExtraction(userText: string): boolean {
  const t = (userText ?? "").trim();
  // Sous ce seuil, un message n'a pas la place de contenir un engagement.
  if (t.length < 20) return false;
  return COMMITMENT_MARKERS.test(t) || PREFERENCE_MARKERS.test(t);
}

/** Candidat tel que produit par le modèle — non encore validé. */
export interface RawCandidate {
  kind?: string;
  content?: string;
  key?: string;
  importance?: number;
}

/** Candidat validé, prêt pour `remember()`. */
export interface MemoryCandidate {
  kind: ExtractableKind;
  content: string;
  key: string;
  importance: number;
  confidence: number;
  source: MemorySource;
}

/** Pourquoi un candidat a été écarté — utile au diagnostic et aux tests. */
export type RejectionReason =
  | "kind_not_extractable"
  | "empty_content"
  | "too_short"
  | "too_long"
  | "performance_figure"
  | "hedging"
  | "duplicate_key"
  | "already_known"
  | "over_limit";

export interface ExtractionResult {
  accepted: MemoryCandidate[];
  rejected: { candidate: RawCandidate; reason: RejectionReason }[];
}

/**
 * Clé sémantique déterministe.
 *
 * Deux formulations proches du même engagement doivent produire la MÊME clé,
 * sinon l'unicité en base ne sert à rien et les doublons reviennent par la
 * porte de derrière. On normalise donc agressivement : minuscules, accents
 * retirés, ponctuation supprimée, mots vides écartés, et on ne conserve que
 * les premiers mots signifiants triés — l'ordre des mots ne doit pas créer
 * deux souvenirs.
 */
const STOP_WORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "a",
  "au",
  "aux",
  "je",
  "il",
  "elle",
  "on",
  "se",
  "sa",
  "son",
  "ses",
  "mon",
  "ma",
  "mes",
  "que",
  "qui",
  "ne",
  "pas",
  "plus",
  "pour",
  "dans",
  "sur",
  "avec",
  "en",
  "the",
  "a",
  "an",
  "of",
  "and",
  "to",
  "in",
  "on",
  "with",
  "for",
  "i",
  "he",
  "she",
  "it",
  "my",
  "his",
  "her",
  "not",
  "no",
  "more",
]);

export function deriveKey(kind: ExtractableKind, content: string): string {
  const words = content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Tri alphabétique : « stopper après deux pertes » et « après deux pertes
  // stopper » désignent le même engagement et doivent se remplacer.
  const signature = [...new Set(words)].sort().slice(0, 6).join("-");
  return `${kind}:${signature}`;
}

export interface ExtractOptions {
  /** Clés déjà présentes en mémoire — évite de réécrire ce qui est connu. */
  knownKeys?: Iterable<string>;
  maxItems?: number;
}

/**
 * Valide les candidats bruts d'un modèle.
 *
 * L'ordre des contrôles va du moins coûteux au plus coûteux, et chaque rejet
 * est motivé : une extraction silencieusement vide serait indiscernable d'une
 * extraction cassée, et personne ne s'en apercevrait avant des mois.
 */
export function validateCandidates(
  raw: RawCandidate[],
  opts: ExtractOptions = {},
): ExtractionResult {
  const maxItems = opts.maxItems ?? MAX_EXTRACTED_PER_CONVERSATION;
  const known = new Set(opts.knownKeys ?? []);
  const accepted: MemoryCandidate[] = [];
  const rejected: ExtractionResult["rejected"] = [];
  const seenThisBatch = new Set<string>();

  for (const c of raw) {
    const reject = (reason: RejectionReason) => rejected.push({ candidate: c, reason });

    if (!EXTRACTABLE_KINDS.includes(c.kind as ExtractableKind)) {
      reject("kind_not_extractable");
      continue;
    }
    const content = (c.content ?? "").trim().replace(/\s+/g, " ");
    if (!content) {
      reject("empty_content");
      continue;
    }
    if (content.length < MIN_CONTENT_LENGTH) {
      reject("too_short");
      continue;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      reject("too_long");
      continue;
    }
    if (PERFORMANCE_FIGURE.test(content)) {
      reject("performance_figure");
      continue;
    }
    if (HEDGING.test(content)) {
      reject("hedging");
      continue;
    }

    const kind = c.kind as ExtractableKind;
    // La clé fournie par le modèle n'est jamais reprise telle quelle : elle
    // serait le moyen le plus simple d'écraser un souvenir existant sans
    // rapport. Elle est TOUJOURS re-dérivée du contenu, de façon déterministe.
    const key = deriveKey(kind, content);

    if (seenThisBatch.has(key)) {
      reject("duplicate_key");
      continue;
    }
    if (known.has(key)) {
      reject("already_known");
      continue;
    }
    // Le plafond se vérifie APRÈS le dé-doublonnage : sinon trois reformulations
    // du même engagement consommeraient tout le budget de la conversation.
    if (accepted.length >= maxItems) {
      reject("over_limit");
      continue;
    }

    seenThisBatch.add(key);
    accepted.push({
      kind,
      content,
      key,
      importance: Math.min(EXTRACTED_MAX_IMPORTANCE, Math.max(1, Math.round(c.importance ?? 3))),
      confidence: EXTRACTED_MAX_CONFIDENCE,
      source: "conversation",
    });
  }

  return { accepted, rejected };
}

/**
 * Parse la sortie du modèle.
 *
 * Tolérant à la forme (un modèle encadre volontiers son JSON de texte ou de
 * balises ```), STRICT sur le fond : tout ce qui n'est pas un tableau d'objets
 * exploitable rend un résultat vide plutôt qu'une exception. Un échec
 * d'extraction ne doit jamais casser la conversation en cours — l'utilisateur
 * n'a pas demandé cette fonctionnalité, il a demandé une réponse.
 */
export function parseExtraction(rawOutput: string): RawCandidate[] {
  if (!rawOutput) return [];
  const match = rawOutput.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is RawCandidate => typeof v === "object" && v !== null);
  } catch {
    return [];
  }
}

/** Chemin complet, purement fonctionnel : sortie brute → candidats validés. */
export function extractFromOutput(rawOutput: string, opts: ExtractOptions = {}): ExtractionResult {
  return validateCandidates(parseExtraction(rawOutput), opts);
}

/** Garantit à la compilation que seules des catégories réelles sont extractibles. */
const _kindCheck: MemoryKind = EXTRACTABLE_KINDS[0];
void _kindCheck;
