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

/**
 * La faiblesse déclarée à l'onboarding (pain) oriente le Hero : Jarvis
 * surveille en priorité ce que le trader a dit être son point faible.
 * `pain` peut être une liste séparée par virgules (multi-sélection) — on
 * retourne le premier pattern mappable (best-effort, null si aucun).
 */
export function patternForPain(pain: string | null | undefined): string | null {
  if (!pain) return null;
  const map: Record<string, string> = {
    overtrading: "overtrading",
    risk: "risk_after_loss",
    emotions: "discipline_streak",
    consistency: "discipline_streak",
    journaling: "costliest_mistake",
  };
  for (const token of pain
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (map[token]) return map[token];
  }
  return null;
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

  const preferred = patternForPain(data.onboarding?.pain);
  const ranked = pickPriority(validated, memory, preferred);
  return { confidence: { status: "validated", insight: ranked[0] }, candidates: ranked };
}
