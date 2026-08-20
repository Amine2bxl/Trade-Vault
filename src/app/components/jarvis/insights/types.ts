import type { Trade } from "../../../types";
import type { JarvisProfile, OnboardingData } from "../../../store";
import type { computeStats } from "../../../utils/tradeCalcs";
import type { computeBehaviorSignals } from "../../../utils/behaviorSignals";
import type { DailyRule } from "../../../utils/edgeScore";
import type { RuleAdherence } from "../../../utils/ruleAdherence";

/**
 * Contrat interne du module JarvisHome (Phase 1).
 *
 * Ces types sont INTERNES à `jarvis/insights/` : le contrat public de l'UI
 * reste `JarvisBlock` (voir ../blocks). L'Insight Engine, la validation de
 * confiance, le copy et le rendu ne dépendent que de ces types — jamais du
 * Shell, du workspace ou d'une implémentation de stockage.
 */

/**
 * Les « moments » de Jarvis. Phase 1 n'utilise que `onboarding`, `brief` et
 * `warning` ; `review` (post-session) est prévu pour les phases suivantes —
 * le type est déjà là pour que l'architecture reste extensible sans refonte.
 */
export type JarvisMoment = "onboarding" | "brief" | "warning" | "review";

/** Snapshot normalisé et pur des données que l'Insight Engine consomme. */
export interface JarvisHomeData {
  trades: Trade[];
  stats: ReturnType<typeof computeStats>;
  signals: ReturnType<typeof computeBehaviorSignals>;
  rule: DailyRule | null;
  /**
   * Tenue des règles sur 30 jours (`ruleAdherence.ts`).
   *
   * OPTIONNEL, et c'est délibéré : les appelants qui ne disposent pas des
   * règles du trader (workspace de conversation, fixtures) restent valides
   * sans modification. Un détecteur qui ne trouve rien reste silencieux — ce
   * qui est le comportement correct, et non une régression.
   */
  adherence?: RuleAdherence[];
  profile: JarvisProfile | null;
  onboarding: OnboardingData | null;
}

/**
 * Un insight validé : un pattern détecté, sa preuve, sa confiance, son impact
 * et la mission immédiate. Chaque champ doit pouvoir être vérifié par un test
 * (aucun chiffre inventé).
 */
export interface JarvisInsight {
  moment: JarvisMoment;
  /** Identifiant du pattern, ex: "risk_after_loss". */
  pattern: string;
  /** Rang de priorité : 1 = l'unique priorité du Hero. */
  priority: number;
  /** 0..1 — score de confiance calculé (sample + taille d'effet + cohérence). */
  confidence: number;
  /** Nombre de trades sur lesquels le pattern s'appuie. */
  sampleSize: number;
  /** Preuve chiffrée, ex: { riskIncrease: 42 }. */
  evidence: Record<string, number | string>;
  /** Impact estimé (coût/gain), null si non calculable. */
  impact: { label: string; amount: number; unit?: string } | null;
  /** 2–3 actions immédiates, actionnables. */
  mission: string[];
  /**
   * Les ids des trades qui ont servi à conclure — le fondement du
   * « voir les N trades ». Vide quand le détecteur ne porte pas de trades
   * précis (agrégats par session/stratégie non encore enrichis).
   */
  affectedTrades: string[];
  /**
   * Claim → evidence (Step 6D) : la comparaison structurée (observé vs
   * référence) qui répond à « pourquoi tu me dis ça ? ». Additif — les
   * détecteurs existants restent valides sans le renseigner.
   */
  comparison?: {
    metric: string;
    observed: number;
    baseline: number | null;
    deltaPct: number | null;
  };
  /** Période sur laquelle porte l'insight (ex: "30d"). */
  dateRange?: string;
}

/**
 * Résultat de la validation de confiance :
 *  - `validated` → l'insight est assez fiable pour être conclu ;
 *  - `learning` → données insuffisantes : Jarvis n'émet PAS de conclusion.
 */
export type JarvisConfidence =
  | { status: "validated"; insight: JarvisInsight }
  | { status: "learning"; sampleSize: number; pattern?: string };

/** Mémoire anti-répétition — état léger, indépendant du stockage. */
export interface JarvisMemory {
  /** Dernier jour (YYYY-MM-DD) où un insight a été affiché. */
  lastShownDate: string;
  /** Dernier pattern affiché (pour la rotation). */
  lastPattern: string | null;
  /** Dernière priorité affichée. */
  lastPriority: number | null;
  /** Patterns que le trader a ignorés (dismiss). */
  ignoredPatterns: string[];
  /** Nombre d'ouvertures de Jarvis ce jour. */
  seenCount: number;
}

/**
 * Abstraction de la mémoire anti-répétition. Phase 1 : `SessionJarvisMemoryStore`
 * (sessionStorage). L'Insight Engine ne dépend que de cette interface — une
 * future migration Supabase remplacera l'implémentation, jamais le moteur.
 */
export interface JarvisMemoryStore {
  read(): Promise<JarvisMemory>;
  write(memory: JarvisMemory): Promise<void>;
}
