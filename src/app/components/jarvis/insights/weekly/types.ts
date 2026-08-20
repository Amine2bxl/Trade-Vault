import type { UnifiedFilter } from "../../../../utils/tradeFilter";
import type { Page } from "../../../../types";

/**
 * Weekly Evolution (Phase 1, Step 7) — contrat de données.
 *
 * Couche d'ORCHESTRATION au-dessus des calculs existants : computeStats,
 * computeBehaviorSignals, computeRuleAdherence, Edge Score, goals, intent/
 * reflection, missed setups. Aucune métrique dupliquée — chaque bloc ne fait
 * que relier des mesures déjà produites par les moteurs déterministes,
 * en respectant leurs seuils d'échantillon.
 *
 * Toute affirmation porte : claim + preuve (sample, période, comparaison) +
 * deep-link vers les trades concernés. Sous le seuil, on dit « signal faible ».
 */

export interface WeekComparison {
  /** Valeur sur la semaine courante. */
  value: number;
  /** Valeur sur la semaine précédente (null = non calculable). */
  previous: number | null;
  /** value - previous. */
  delta: number | null;
  /** variation relative en % (null si previous nul/non calculable). */
  deltaPct: number | null;
  /** n de la semaine courante. */
  sample: number;
  /** n de la semaine précédente. */
  previousSample: number;
  /** La semaine courante a-t-elle assez de trades pour conclure ? */
  sufficient: boolean;
}

export interface WeeklyEvidence {
  /** Claim court et stable (ex: "win_rate_up", "plan_broken"). */
  claim: string;
  metric: string;
  value: number;
  sampleSize: number;
  period: string;
  compare: WeekComparison | null;
  /** Les trades de CETTE semaine qui prouvent le claim. */
  affectedTradeIds: string[];
  /** Deep-link filtre + page (Journal/Analytics/Missed). */
  filter?: UnifiedFilter;
  page?: Page;
  lowSample: boolean;
}

export interface StaticLine {
  fr: string;
  en: string;
}

export interface WeeklySection {
  id:
    | "glance"
    | "improved"
    | "worse"
    | "edge"
    | "leak"
    | "intent"
    | "missed"
    | "goals"
    | "discipline"
    | "next";
  title: StaticLine;
  tone?: "accent" | "success" | "warning" | "danger";
  lines: StaticLine[];
  evidence?: WeeklyEvidence[];
}

export interface WeeklyGoal {
  kind: string;
  target: number;
  current: number;
}

export interface WeeklyEvolution {
  status: "ready" | "learning" | "empty";
  /** Semaine courante (lundi = début), clé ISO du lundi. */
  period: string;
  previousPeriod: string;
  /** Score global : Edge Score actuel vs semaine précédente (quand calculable). */
  score: { current: number | null; previous: number | null; delta: number | null } | null;
  sections: WeeklySection[];
}
