/**
 * Agent d'extraction de mémoire.
 *
 * Rôle unique : lire UN tour de conversation et proposer ce qui mérite d'être
 * retenu durablement. Il ne parle jamais au trader — sa sortie n'atteint
 * l'interface sous aucune forme.
 *
 * Séparé de `coach.agent` délibérément. Fusionner les deux (demander au coach
 * d'émettre ses candidats dans la même réponse) aurait économisé un appel, mais
 * mélangé deux objectifs contradictoires dans un seul prompt : répondre au
 * trader, et se juger soi-même. Un modèle à qui l'on demande les deux fait mal
 * les deux, et la sortie mémoire polluerait la réponse visible au moindre écart
 * de format.
 *
 * Le coût de ce second appel est maîtrisé en amont par
 * `shouldAttemptExtraction()` : la très grande majorité des tours ne
 * déclenchent aucun appel.
 */
import { generate, type GenerateOptions } from "../provider-service";
import { buildPrompt } from "../prompt-builder";
import {
  extractFromOutput,
  EXTRACTABLE_KINDS,
  MAX_EXTRACTED_PER_CONVERSATION,
  type ExtractionResult,
} from "../memory-extract";

export interface MemoryExtractInput {
  /** Le message du TRADER — jamais la réponse de Jarvis. */
  userMessage: string;
  /** Clés déjà connues, pour ne pas réapprendre ce qui est su. */
  knownKeys?: string[];
}

/**
 * Le prompt est restrictif par construction.
 *
 * On n'y décrit pas ce qu'il faut retenir mais ce qu'il est INTERDIT de
 * retenir, et on exige le silence par défaut. Un modèle à qui l'on demande
 * « qu'as-tu appris ? » trouve toujours quelque chose à répondre : la question
 * elle-même l'incite à produire. On lui demande donc l'inverse.
 *
 * Ces consignes ne sont PAS la sécurité du système — `validateCandidates` l'est,
 * et elle s'applique quoi que réponde le modèle. Le prompt ne fait qu'éviter de
 * payer pour des candidats qui seront rejetés.
 */
const EXTRACTION_IDENTITY = `You extract durable memories from a trader's own words.

Return ONLY a JSON array. Return [] when in doubt — silence is the correct
default and an empty array is a successful answer.

You may ONLY return these kinds: ${EXTRACTABLE_KINDS.join(", ")}.
  - "decision"   : an explicit commitment the trader made about their own behaviour.
  - "preference" : a durable taste (setups, sessions, markets) the trader stated.

NEVER return:
  - anything the trader did not explicitly say (no inference, no interpretation)
  - any performance figure (win rate, P&L, R multiple, counts, percentages):
    these are computed from the trader's trades and must never be frozen in text
  - anything hedged ("seems", "probably", "maybe")
  - questions, opinions, or your own advice

Each item: {"kind": "...", "content": "<one short third-person sentence>"}
At most ${MAX_EXTRACTED_PER_CONVERSATION} items.`;

/** Sortie brute conservée pour la télémétrie : mesurer le taux de rejet. */
export interface MemoryExtractOutput extends ExtractionResult {
  /** `true` si le modèle a répondu, `false` si l'appel a échoué. */
  ok: boolean;
}

export async function runMemoryExtraction(
  input: MemoryExtractInput,
  opts?: GenerateOptions,
): Promise<MemoryExtractOutput> {
  const messages = buildPrompt({
    identity: EXTRACTION_IDENTITY,
    userTurn: `Trader said: """${input.userMessage}"""`,
  });

  try {
    // Plafond bas : la sortie attendue est un tableau JSON de trois éléments au
    // plus. Laisser de la marge inviterait à broder.
    const res = await generate({ messages, maxTokens: 256 }, opts);
    const result = extractFromOutput(res.text ?? "", { knownKeys: input.knownKeys });
    return { ...result, ok: true };
  } catch {
    // Un échec d'extraction n'est pas un échec de conversation : le trader a
    // déjà eu sa réponse. On rend un résultat vide, jamais une exception.
    return { accepted: [], rejected: [], ok: false };
  }
}
