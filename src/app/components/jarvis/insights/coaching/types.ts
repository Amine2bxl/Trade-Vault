import type { UnifiedFilter } from "../../../../utils/tradeFilter";
import type { Page } from "../../../../types";

/**
 * Contrat du Daily Brief (Phase 0b, Step 6A) — côté UI de Jarvis.
 *
 * `buildDailyBrief` produit des sections STRUCTURÉES (nombres réels, preuve,
 * deep-link) ; `toBriefBlocks` les transforme en `JarvisBlock[]` localisés.
 * Aucun chiffre n'est inventé : chaque claim porte son `sampleSize`, et sous le
 * seuil le champ `lowSample` force la formulation « signal faible ».
 */

export interface BriefMetric {
  label: { fr: string; en: string };
  value: string;
  tone?: "up" | "down" | "neutral";
}

export interface BriefEvidence {
  /** Métrique stable (ex: "win_rate", "pnl", "risk"). */
  metric: string;
  sampleSize: number;
  metrics: BriefMetric[];
  /** Deep-link : filtre unifié + page cible (réutilise `?f=`). */
  filter?: UnifiedFilter;
  page?: Page;
  /** Signal faible : n sous le seuil — l'UI doit dire « signal faible ». */
  lowSample?: { n: number; required: number; unit: "trades" | "days" };
}

export interface BriefSection {
  id: "objective" | "discipline" | "recent" | "temporal";
  title: { fr: string; en: string };
  tone?: "accent" | "success" | "warning" | "danger";
  lines: { fr: string; en: string }[];
  evidence?: BriefEvidence;
}

export interface DailyBrief {
  /** `ready` = sections alimentées ; `learning` = données insuffisantes. */
  status: "ready" | "learning";
  sections: BriefSection[];
}

export interface DailyReview {
  status: "ready" | "empty";
  summary: { fr: string; en: string };
  well: { fr: string; en: string }[];
  /** Le principal problème — null si rien à reprocher (honnêteté). */
  wrong: { fr: string; en: string } | null;
  evidence?: BriefEvidence;
  /** Une seule priorité claire pour demain. */
  tomorrow: { fr: string; en: string } | null;
}
