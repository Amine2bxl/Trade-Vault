/**
 * Du plan de séance au journal — ce que la checklist dépose pour le
 * formulaire de trade et pour les setups manqués. Module PUR : les textes
 * arrivent déjà traduits, l'heure est passée par l'appelant.
 */

import type { Trade } from "@/domain/trade";
import type { Mistake } from "@/app/trading/mistakeClusters";
import type { ReflectionReason } from "@/app/store/tradeIntel";
import type { MissedPrefill, TradePrefill } from "@/app/utils/handoff";
import { activePlan, parseAmount, planRR, type Breach, type SessionDay } from "./sessionPlan";

/**
 * Écart déclaré au bilan → erreur du journal. `null` quand le journal n'a
 * pas de mot juste : mieux vaut ne rien cocher que cocher faux.
 */
export const BREACH_TO_MISTAKE: Record<Breach, Mistake | null> = {
  direction: "Ignored plan",
  chased: "Chased entry",
  size: "Size too large",
  extra: "Overtrading",
  window: "Ignored plan",
  stopMoved: null,
  planChanged: "Ignored plan",
};

/** Écart → raison de la réflexion du trade (une seule est retenue : la première). */
export const BREACH_TO_REASON: Record<Breach, ReflectionReason> = {
  direction: "wrong_setup",
  chased: "late_entry",
  size: "wrong_risk",
  extra: "other",
  window: "wrong_timing",
  stopMoved: "wrong_risk",
  planChanged: "wrong_setup",
};

export function mistakesFor(breaches: readonly Breach[]): Mistake[] {
  const out: Mistake[] = [];
  for (const b of breaches) {
    const m = BREACH_TO_MISTAKE[b];
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

/** Le dernier trade du journal : son symbole et sa stratégie sont presque toujours ceux du jour. */
export function lastTrade(trades: readonly Trade[]): Trade | null {
  let best: Trade | null = null;
  for (const t of trades) {
    if (t.isExample) continue;
    const key = `${t.date} ${t.entryTime || ""}`;
    if (!best || key > `${best.date} ${best.entryTime || ""}`) best = t;
  }
  return best;
}

export function tradePrefill(input: {
  day: SessionDay;
  date: string;
  /** `HH:MM` local au moment de l'encodage. */
  now: string;
  last: Trade | null;
  /** Le plan en une ligne, déjà formulé (« SHORT → 21 450 EQL · FVG 21 520 »). */
  planLine: string;
  /** Depuis le bilan : la réflexion et les erreurs suivent. */
  withReview: boolean;
}): TradePrefill {
  const { day } = input;
  const plan = activePlan(day);
  const risk = parseAmount(plan.risk);
  const out: TradePrefill = {
    date: input.date,
    entryTime: input.now,
    exitTime: input.now,
    ...(input.last ? { symbol: input.last.symbol, strategy: input.last.strategy } : {}),
    ...(plan.bias === "long" || plan.bias === "short" ? { direction: plan.bias } : {}),
    ...(risk !== null ? { riskAmount: String(risk) } : {}),
    intentEmotion: day.mood,
    intentReasoning: plan.narrative.trim(),
    intentPlan: input.planLine,
  };
  if (input.withReview && day.review.respected !== null) {
    const { respected, breaches, note } = day.review;
    out.reflectionPlan = respected ? "yes" : "no";
    out.reflectionReason = !respected && breaches.length > 0 ? BREACH_TO_REASON[breaches[0]] : null;
    out.reflectionNote = note.trim();
    out.mistakes = respected ? [] : mistakesFor(breaches);
  }
  return out;
}

export function missedPrefill(input: {
  day: SessionDay;
  date: string;
  last: Trade | null;
  planLine: string;
  /** Pourquoi il n'a pas été pris — écarts ou raison de fin, déjà formulés. */
  reasonText: string;
}): MissedPrefill {
  const rr = planRR(activePlan(input.day));
  return {
    date: input.date,
    ...(input.last ? { symbol: input.last.symbol } : {}),
    // Le R que le plan promettait : c'est l'estimation la plus honnête dont on
    // dispose sans connaître la sortie réelle.
    estimatedR: rr !== null ? Math.round(rr * 10) / 10 : 0,
    reasonNotTaken: input.reasonText,
    whatHappened: input.planLine,
    lessonLearned: input.day.review.note.trim(),
    nextTimePlan: "",
  };
}
