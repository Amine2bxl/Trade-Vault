/**
 * Sélection de souvenirs — le cœur de la mémoire de Jarvis (V1).
 *
 * LE PROBLÈME QU'IL RÉSOUT
 * ------------------------
 * L'ancien chemin (mort, supprimé) chargeait 40 souvenirs × 2 000 caractères et
 * les injectait tels quels : jusqu'à ~20 000 tokens à CHAQUE question. Une
 * mémoire non bornée ne rend pas un coach plus pertinent — elle le noie, elle
 * le ralentit et elle coûte cher. Le modèle doit relire toute la vie du trader
 * pour répondre « pourquoi je perds le vendredi ? ».
 *
 * La bonne question n'est donc pas « que sait-on de ce trader ? » mais
 * « que faut-il savoir POUR CETTE question-CI ? ».
 *
 * PRINCIPE
 * --------
 * Chaque souvenir reçoit un score de pertinence, puis on remplit un budget de
 * tokens STRICT par ordre de score décroissant. Le budget est une contrainte
 * dure, jamais une cible : mieux vaut trois souvenirs utiles que quinze tièdes.
 *
 * Ce module est PUR : aucun réseau, aucun accès au stockage, aucune dépendance
 * React. Il est donc testable exhaustivement — ce qui compte, parce que c'est
 * lui qui décide de ce que Jarvis « sait » à chaque réponse.
 */
import { routeQuestion, type MemoryIntent } from "./router/route";

/** Les catégories présentes dans `ai_memory` (V2). */
export type MemoryKind = "profile" | "fact" | "lesson" | "conversation" | "preference" | "decision";

export interface MemoryLike {
  id?: string;
  kind: MemoryKind;
  content: string;
  createdAt?: string;
  /** 1–5. Optionnel : les lignes écrites avant la V2 n'en ont pas. */
  importance?: number;
  /** 0–1. Une croyance contestée pèse moins qu'un fait confirmé. */
  confidence?: number;
}

/**
 * Intentions de mémoire : on classe ici ce qu'il faut SAVOIR pour répondre à
 * la question, pas ce qu'il faut afficher. Le type et la classification
 * viennent du routeur unifié (`router/route.ts`) — une seule lecture de la
 * question dans tout Jarvis.
 */
export type { MemoryIntent };

/**
 * Budget de tokens pour le bloc mémoire entier.
 *
 * 350 tokens ≈ 6 à 8 souvenirs courts. Choisi par rapport au reste du prompt
 * (les trades pèsent déjà ~2 000 tokens) : assez pour que Jarvis « connaisse »
 * le trader, assez peu pour ne jamais devenir le poste dominant du contexte.
 * Réglable sans redéploiement via l'appelant.
 */
export const MEMORY_TOKEN_BUDGET = 350;

/** Un souvenir plus long que ça est tronqué : au-delà, c'est du récit, pas un fait. */
export const MAX_MEMORY_CHARS = 240;

/**
 * Nombre maximum de souvenirs envoyés, indépendamment du budget.
 *
 * Pourquoi un plafond EN PLUS du budget : la mesure a montré qu'un corpus
 * réaliste (10 souvenirs ≈ 170 tokens) tient entièrement dans le budget, donc
 * le budget seul n'écarte RIEN — il ne fait qu'ordonner. Or un coach qui reçoit
 * tout ce qu'il sait n'est pas plus pertinent : il est plus dilué. Huit
 * souvenirs, c'est ce qu'un humain garde en tête sur quelqu'un qu'il connaît
 * bien.
 */
export const MAX_MEMORIES = 8;

/**
 * Score minimal pour qu'un souvenir mérite d'être envoyé.
 *
 * Le score vaut affinité (1–4) + recoupement (0–6) + récence (0–1). Un plancher
 * à 2 écarte donc ce qui n'a NI catégorie pertinente pour cette question NI
 * mot en commun avec elle — typiquement une vieille ligne de `conversation`.
 * C'est ce qui transforme « tout ce qui rentre » en « ce qui sert vraiment ».
 */
export const MIN_RELEVANCE = 2;

/** Approximation usuelle : ~4 caractères par token. Suffisant pour un budget. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Détecte l'intention MÉMOIRE d'une question.
 *
 * Dérivée du routeur unifié, avec la même priorité qu'avant : l'ÉMOTION
 * d'abord (« j'ai peur de perdre » parle d'état mental, pas de P&L), puis la
 * discipline, la performance, les objectifs, les règles. Le lexique, lui, n'est
 * plus tenu ici : il est celui qui décide aussi des données et du modèle.
 */
export function detectMemoryIntent(question: string): MemoryIntent {
  return routeQuestion(question).memoryIntent;
}

/**
 * Affinité entre l'intention de la question et la CATÉGORIE d'un souvenir.
 *
 * `profile` est fort partout : savoir qui est le trader sert à toute réponse.
 * `lesson` domine sur la discipline et les règles : ce sont les engagements
 * passés. `conversation` est volontairement faible — c'est du contexte de
 * repli, pas un fait durable.
 */
const AFFINITY: Record<MemoryIntent, Record<MemoryKind, number>> = {
  psychology: { profile: 3, fact: 3, lesson: 2, decision: 2, preference: 1, conversation: 1 },
  discipline: { profile: 2, fact: 2, lesson: 4, decision: 5, preference: 1, conversation: 1 },
  performance: { profile: 2, fact: 3, lesson: 2, decision: 2, preference: 2, conversation: 1 },
  goals: { profile: 4, fact: 1, lesson: 2, decision: 3, preference: 1, conversation: 1 },
  rules: { profile: 2, fact: 1, lesson: 4, decision: 5, preference: 1, conversation: 1 },
  generic: { profile: 3, fact: 2, lesson: 2, decision: 3, preference: 2, conversation: 1 },
};

/** Mots vides ignorés dans le recoupement lexical (FR + EN). */
const STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "ou",
  "que",
  "qui",
  "quoi",
  "pour",
  "dans",
  "sur",
  "avec",
  "mon",
  "ma",
  "mes",
  "je",
  "tu",
  "il",
  "elle",
  "on",
  "nous",
  "vous",
  "ils",
  "est",
  "suis",
  "ai",
  "as",
  "a",
  "pas",
  "plus",
  "moins",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "my",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "is",
  "am",
  "are",
  "not",
  "do",
  "does",
  "did",
  "why",
  "how",
  "what",
  "when",
  "and",
  "or",
  "that",
  "this",
]);

function terms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

export interface ScoredMemory {
  memory: MemoryLike;
  /** Score final pondéré — sert au CLASSEMENT. */
  score: number;
  /**
   * Pertinence brute (affinité + recoupement + récence), AVANT pondération.
   * C'est elle qu'on compare au plancher : « ce souvenir parle-t-il de la
   * question ? » est une question distincte de « quelle confiance je lui
   * accorde ? ». Confondre les deux ferait écarter un fait pertinent au seul
   * motif qu'il est ancien ou peu important.
   */
  relevance: number;
  reason: { affinity: number; overlap: number; recency: number; weight: number };
}

/**
 * Score un souvenir face à une question.
 *
 * Trois composantes, additives et volontairement simples — un score que
 * personne ne peut expliquer est un score que personne ne peut corriger :
 *  - AFFINITÉ  : la catégorie sert-elle ce type de question ?
 *  - RECOUPEMENT : le souvenir parle-t-il des mêmes choses que la question ?
 *  - RÉCENCE   : à pertinence égale, le plus récent gagne.
 */
export function scoreMemory(
  memory: MemoryLike,
  intent: MemoryIntent,
  questionTerms: Set<string>,
  now: number,
): ScoredMemory {
  const affinity = AFFINITY[intent][memory.kind] ?? 1;

  const memTerms = terms(memory.content);
  let shared = 0;
  for (const term of questionTerms) if (memTerms.has(term)) shared++;
  // Plafonné : un souvenir long ne doit pas gagner par accumulation de mots.
  const overlap = Math.min(shared, 4) * 1.5;

  let recency = 0;
  if (memory.createdAt) {
    const ageDays = (now - Date.parse(memory.createdAt)) / 86_400_000;
    if (Number.isFinite(ageDays)) {
      // 1 point à neuf, décroissant, plancher 0 après ~60 jours.
      recency = Math.max(0, 1 - ageDays / 60);
    }
  }

  // IMPORTANCE et CONFIANCE modulent le total au lieu de s'y ajouter : un
  // souvenir hors sujet ne doit pas remonter simplement parce qu'il est
  // important, et une croyance à moitié contestée doit peser moitié moins.
  // Défauts (3 / 0.6) alignés sur le SQL, pour les lignes écrites avant la V2.
  const importance = memory.importance ?? 3;
  const confidence = memory.confidence ?? 0.6;
  const weight = (importance / 3) * confidence;
  const base = affinity + overlap + recency;

  return {
    memory,
    score: base * weight,
    relevance: base,
    reason: { affinity, overlap, recency, weight },
  };
}

export interface SelectionResult {
  selected: MemoryLike[];
  intent: MemoryIntent;
  /** Tokens réellement consommés par le bloc retenu. */
  tokens: number;
  /** Tokens qu'aurait coûtés l'envoi intégral — pour mesurer l'économie. */
  tokensIfUnbounded: number;
  /** Trace de scoring complète, ordonnée. Sert aux tests et au diagnostic. */
  scored: ScoredMemory[];
}

/**
 * Sélectionne les souvenirs utiles à UNE question, sous budget strict.
 *
 * Garantie forte : le résultat ne dépasse JAMAIS `budget` tokens. Un souvenir
 * qui ne rentre pas est ignoré, mais on continue d'examiner les suivants —
 * un fait court et pertinent ne doit pas être écarté parce qu'un long l'a
 * précédé.
 */
export function selectMemories(
  memories: MemoryLike[],
  question: string,
  opts: { budget?: number; now?: number; maxItems?: number; minRelevance?: number } = {},
): SelectionResult {
  const budget = opts.budget ?? MEMORY_TOKEN_BUDGET;
  const maxItems = opts.maxItems ?? MAX_MEMORIES;
  const minRelevance = opts.minRelevance ?? MIN_RELEVANCE;
  const now = opts.now ?? Date.now();
  const intent = detectMemoryIntent(question);
  const questionTerms = terms(question);

  const tokensIfUnbounded = memories.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  const scored = memories
    .map((m) => scoreMemory(m, intent, questionTerms, now))
    .sort((a, b) => b.score - a.score);

  const selected: MemoryLike[] = [];
  let tokens = 0;
  for (const s of scored) {
    if (selected.length >= maxItems) break;
    // Plancher de PERTINENCE : un souvenir sans lien avec la question n'est pas
    // envoyé, même s'il reste de la place. Le budget protège du volume ; ce
    // filtre protège de la dilution — ce sont deux problèmes différents.
    if (s.relevance < minRelevance) continue;
    const content =
      s.memory.content.length > MAX_MEMORY_CHARS
        ? `${s.memory.content.slice(0, MAX_MEMORY_CHARS - 1)}…`
        : s.memory.content;
    const cost = estimateTokens(content);
    // `continue` et non `break` : un souvenir court et pertinent ne doit pas
    // être perdu parce qu'un plus long l'a précédé.
    if (tokens + cost > budget) continue;
    selected.push({ ...s.memory, content });
    tokens += cost;
  }

  return { selected, intent, tokens, tokensIfUnbounded, scored };
}
