import { runInsightEngine } from "./engine";
import { insightToBlocks, learningToBlock } from "./toBlocks";
import type { CopyContext } from "./copy/templates";
import type { JarvisBlock } from "../blocks";
import type { JarvisHomeData, JarvisMemory } from "./types";

/**
 * buildHomeBlocks — orchestration PUR du Home (Phase 1, Étape 5).
 *
 *   data + memory → Insight Engine → [hero, insight, mission] | [learning]
 *
 * Pure et testable : aucune dépendance UI. Le HomeWorkspace ne fait que charger
 * data + mémoire (async) puis appeler ce module et rendre le résultat.
 */

export interface HomeBlocksResult {
  blocks: JarvisBlock[];
  /** Pattern du Hero validé (null en mode apprentissage) — pour l'anti-répétition. */
  pattern: string | null;
}

export function buildHomeBlocks(
  data: JarvisHomeData,
  memory: JarvisMemory,
  ctx: CopyContext,
): HomeBlocksResult {
  const result = runInsightEngine(data, memory);
  if (result.confidence.status === "validated") {
    return {
      blocks: insightToBlocks(result.confidence.insight, ctx),
      pattern: result.confidence.insight.pattern,
    };
  }
  return {
    blocks: [learningToBlock(result.confidence.sampleSize, ctx)],
    pattern: null,
  };
}
