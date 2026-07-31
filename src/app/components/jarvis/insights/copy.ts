import type { JarvisInsight } from "./types";
import { frHeroLines, frLearning } from "./copy/fr";
import { enHeroLines, enLearning } from "./copy/en";
import { voiceModeOf, type CopyContext, type HeroLineSpec } from "./copy/templates";

/**
 * Copy Layer — la voix de Jarvis (Phase 1, Étape 3).
 *
 * Transforme un JarvisInsight VALIDÉ en texte structuré (Hero ≤ 5 phrases :
 * Contexte → Observation → Impact → Action). Ne crée aucune information :
 * les seules sources sont pattern, evidence, impact, mission et le profil
 * (expérience → mode de voix). Aucune phrase motivationnelle générique.
 */

export interface HeroCopy {
  lines: HeroLineSpec[];
}

export interface LearningCopy {
  line: string;
}

export function jarvisHeroCopy(insight: JarvisInsight, ctx: CopyContext): HeroCopy {
  const mode = voiceModeOf(ctx.experience);
  const all = ctx.lang === "fr" ? frHeroLines(insight, mode) : enHeroLines(insight, mode);
  return { lines: all.slice(0, 5) };
}

export function jarvisLearningCopy(sampleSize: number, ctx: CopyContext): LearningCopy {
  const mode = voiceModeOf(ctx.experience);
  return {
    line: ctx.lang === "fr" ? frLearning(sampleSize, mode) : enLearning(sampleSize, mode),
  };
}
