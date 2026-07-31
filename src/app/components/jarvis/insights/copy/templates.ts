import type { JarvisInsight } from "../types";

/**
 * Templates de la voix de Jarvis (Phase 1, Étape 3).
 *
 * Le Copy Layer ne crée AUCUNE information : il ne lit que les champs d'un
 * JarvisInsight validé (pattern, evidence, impact, mission) + le profil
 * (expérience → mode de voix). Interdit : statistiques inventées, causes
 * ajoutées, conseils absents de `mission`, phrases motivationnelles génériques.
 */

export type JarvisVoiceMode = "beginner" | "intermediate" | "advanced";
export type HeroLineKind = "context" | "observation" | "impact" | "action";

export interface HeroLineSpec {
  kind: HeroLineKind;
  text: string;
}

export interface CopyContext {
  lang: "fr" | "en";
  /** `onboarding.experience` — détermine le mode de voix. */
  experience?: string | null;
}

/** Débutant = pédagogique · Intermédiaire = direct · Avancé = court/précis. */
export function voiceModeOf(experience?: string | null): JarvisVoiceMode {
  const e = (experience ?? "").toLowerCase();
  if (/beginner|novice|débutant|debutant/.test(e)) return "beginner";
  if (/advanced|expert|confirmé|confirme|pro/.test(e)) return "advanced";
  return "intermediate";
}

/** Montant monétaire court, testable (pas de regroupement de milliers). */
export function formatMoney(amount: number, lang: "fr" | "en", unit = "$"): string {
  const n = Math.round(Math.abs(amount));
  return lang === "fr" ? `${n} ${unit}` : `${unit}${n}`;
}

/** nombre signé court (P&L par trade). */
export function fmtNum(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : `${r}`;
}

/** Missions : des tokens neutres → textes localisés, interpolés depuis `evidence`. */
export const MISSION_LABELS: Record<string, { fr: string; en: string }> = {
  pause_after_loss: {
    fr: "Pause de 15 minutes après -1R",
    en: "Take a 15-minute break after -1R",
  },
  keep_size_after_loss: {
    fr: "Ne pas augmenter la taille après une perte",
    en: "Never increase size after a loss",
  },
  day_trade_cap: {
    fr: "Limiter la journée à {cap} trades max",
    en: "Cap the day at {cap} trades",
  },
  only_verified_setups: {
    fr: "N'entrer que sur des setups validés",
    en: "Only take verified setups",
  },
  eliminate_mistake: {
    fr: "Éliminer : {mistake}",
    en: "Eliminate: {mistake}",
  },
  log_mistake: {
    fr: "Noter l'erreur dès qu'elle apparaît",
    en: "Log the mistake the moment it appears",
  },
  protect_streak: {
    fr: "Protéger ta série : garder le même process",
    en: "Protect your streak: keep the same process",
  },
  no_overconfidence: {
    fr: "Ne pas surconfirmer après les gains",
    en: "Don't overconfide after wins",
  },
};

export function missionText(
  token: string,
  evidence: Record<string, number | string>,
  lang: "fr" | "en",
): string {
  const t = MISSION_LABELS[token];
  if (!t) return token;
  let s = t[lang] ?? t.en;
  const vars: Record<string, number | string> = { ...evidence };
  if (vars.medianTradesPerDay !== undefined) vars.cap = Number(vars.medianTradesPerDay) + 1;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return s;
}

/** Ligne d'action : les missions de l'insight, résolues et jointes. */
export function actionLine(insight: JarvisInsight, lang: "fr" | "en"): string {
  return insight.mission.map((m) => missionText(m, insight.evidence, lang)).join(" — ");
}

/** Nombre (evidence) → nombre, sécurisé. */
export const num = (v: unknown): number => Number(v) || 0;

/** Labels courts des patterns (pour le bloc insight). */
export const PATTERN_LABELS: Record<string, { fr: string; en: string }> = {
  risk_after_loss: { fr: "Risque après perte", en: "Risk after a loss" },
  overtrading: { fr: "Journées chargées", en: "Busy days" },
  costliest_mistake: { fr: "Erreur la plus coûteuse", en: "Costliest mistake" },
  discipline_streak: { fr: "Série de discipline", en: "Discipline streak" },
};

export function patternLabel(pattern: string, lang: "fr" | "en"): string {
  const t = PATTERN_LABELS[pattern];
  return t ? (t[lang] ?? t.en) : pattern;
}

/** Court label localisé. */
export const uiLabel = (lang: "fr" | "en", fr: string, en: string): string =>
  lang === "fr" ? fr : en;
