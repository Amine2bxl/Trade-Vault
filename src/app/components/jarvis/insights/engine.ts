import { DETECTORS } from "./detectors";
import { validateInsight } from "./confidence";
import { pickPriority } from "./priority";
import type { JarvisConfidence, JarvisHomeData, JarvisInsight, JarvisMemory } from "./types";

/**
 * Insight Engine — orchestration UNIQUEMENT.
 *
 *   DETECTORS (candidats) → validation de confiance → priorité unique (Hero).
 *
 * Pur, déterministe, synchrone : même données → même résultat. Aucun accès UI,
 * aucun storage, aucun réseau. La mémoire anti-répétition arrive en entrée
 * (déjà lue par l'orchestrateur) pour ne pas coupler le moteur au stockage.
 */

export interface EngineResult {
  /** Résultat de validation du Hero : `validated` (on conclut) ou `learning`. */
  confidence: JarvisConfidence;
  /** Candidats validés, triés ; `candidates[0]` = Hero (priority 1). */
  candidates: JarvisInsight[];
}

export function runInsightEngine(data: JarvisHomeData, memory: JarvisMemory): EngineResult {
  const ignored = new Set(memory.ignoredPatterns ?? []);
  const raw: JarvisInsight[] = [];
  for (const detector of DETECTORS) {
    const candidate = detector(data);
    if (candidate && !ignored.has(candidate.pattern)) raw.push(candidate);
  }

  if (raw.length === 0) {
    return {
      confidence: { status: "learning", sampleSize: data.stats.totalTrades },
      candidates: [],
    };
  }

  const validated: JarvisInsight[] = [];
  for (const candidate of raw) {
    if (validateInsight(candidate).status === "validated") validated.push(candidate);
  }

  if (validated.length === 0) {
    return {
      confidence: { status: "learning", sampleSize: data.stats.totalTrades },
      candidates: raw,
    };
  }

  const ranked = pickPriority(validated, memory);
  return { confidence: { status: "validated", insight: ranked[0] }, candidates: ranked };
}
