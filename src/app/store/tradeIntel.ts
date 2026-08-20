import { supabase } from "@/integrations/supabase/client";
import type { Trade } from "../types";
import { isEmotionalState, type EmotionalState } from "../utils/readiness";

/**
 * Intention & réflexion — Phase 0b, capture LÉGÈRE et OPTIONNELLE.
 *
 * `trade_intent` fige ce que le trader pensait AVANT d'entrer ; `trade_reflection`
 * ce qu'il conclut APRÈS. Les deux sont 1:1 avec un trade et restent absentes si
 * le trader ne remplit rien : l'écriture est un effort, pas une obligation.
 *
 * RIEN ICI N'EST BLOQUANT : les fonctions d'écriture rendent `boolean`, et
 * l'appelant décide de prévenir ou non. Un trade sans intention est un trade
 * parfaitement valide.
 *
 * L'émotion reprend `EMOTIONAL_STATES` de `readiness.ts` — une seule taxonomie,
 * pas deux. La raison de la réflexion est une liste fermée (`REFLECTION_REASONS`),
 * pour rester agrégable, avec `other` en échappatoire.
 */

export type PlanRespected = "yes" | "partial" | "no";

export const REFLECTION_REASONS = [
  "fomo",
  "revenge",
  "early_entry",
  "late_entry",
  "wrong_setup",
  "wrong_timing",
  "wrong_risk",
  "other",
] as const;

export type ReflectionReason = (typeof REFLECTION_REASONS)[number];

export interface TradeIntentInput {
  emotion: EmotionalState | null;
  reasoning: string | null;
  plan: string | null;
}

export interface TradeReflectionInput {
  planRespected: PlanRespected | null;
  reason: ReflectionReason | null;
  note: string | null;
}

/** Ce que le formulaire de trade transmet en plus du trade lui-même. */
export interface TradeJournalMeta {
  intent: TradeIntentInput | null;
  reflection: TradeReflectionInput | null;
}

function clean(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

export function isIntentEmpty(i: TradeIntentInput | null | undefined): boolean {
  if (!i) return true;
  return !i.emotion && clean(i.reasoning) == null && clean(i.plan) == null;
}

export function isReflectionEmpty(r: TradeReflectionInput | null | undefined): boolean {
  if (!r) return true;
  return !r.planRespected && !r.reason && clean(r.note) == null;
}

interface IntentRow {
  id: string;
  trade_id: string | null;
  setup: string | null;
  reasoning: string | null;
  confidence: number | null;
  planned_risk: number | null;
  plan: string | null;
  emotion: string | null;
}

interface ReflectionRow {
  id: string;
  trade_id: string;
  plan_respected: string | null;
  reason: string | null;
  note: string | null;
}

export interface TradeIntent {
  tradeId: string | null;
  setup: string | null;
  reasoning: string | null;
  confidence: number | null;
  plannedRisk: number | null;
  plan: string | null;
  emotion: EmotionalState | null;
}

export interface TradeReflection {
  tradeId: string;
  planRespected: PlanRespected | null;
  reason: ReflectionReason | null;
  note: string | null;
}

function fromIntentRow(r: IntentRow): TradeIntent {
  return {
    tradeId: r.trade_id,
    setup: r.setup,
    reasoning: r.reasoning,
    confidence: r.confidence,
    plannedRisk: r.planned_risk,
    plan: r.plan,
    emotion: isEmotionalState(r.emotion) ? r.emotion : null,
  };
}

function fromReflectionRow(r: ReflectionRow): TradeReflection {
  return {
    tradeId: r.trade_id,
    planRespected:
      r.plan_respected === "yes" || r.plan_respected === "partial" || r.plan_respected === "no"
        ? r.plan_respected
        : null,
    reason: (REFLECTION_REASONS as readonly string[]).includes(r.reason ?? "")
      ? (r.reason as ReflectionReason)
      : null,
    note: r.note,
  };
}

/**
 * Écrit l'intention d'un trade. `setup`, `confidence` et `planned_risk` sont
 * figés depuis le trade lui-même (snapshot au moment de l'entrée) ; `reasoning`,
 * `plan` et `emotion` viennent de la capture optionnelle.
 */
export async function saveTradeIntent(
  userId: string,
  trade: Trade,
  input: TradeIntentInput,
): Promise<boolean> {
  const emotion = input.emotion ?? null;
  const reasoning = clean(input.reasoning);
  const plan = clean(input.plan);

  const { error } = await supabase.from("trade_intent").upsert(
    {
      user_id: userId,
      trade_id: trade.id,
      setup: trade.strategy || null,
      reasoning,
      confidence: trade.confidence ?? null,
      planned_risk: trade.riskAmount,
      plan,
      emotion,
    },
    { onConflict: "trade_id" },
  );
  if (error) {
    console.error("saveTradeIntent failed", error);
    return false;
  }
  return true;
}

export async function saveTradeReflection(
  userId: string,
  tradeId: string,
  input: TradeReflectionInput,
): Promise<boolean> {
  const { error } = await supabase.from("trade_reflection").upsert(
    {
      user_id: userId,
      trade_id: tradeId,
      plan_respected: input.planRespected ?? null,
      reason: input.reason ?? null,
      note: clean(input.note),
    },
    { onConflict: "trade_id" },
  );
  if (error) {
    console.error("saveTradeReflection failed", error);
    return false;
  }
  return true;
}

export async function loadTradeIntent(
  userId: string,
  tradeId: string,
): Promise<TradeIntent | null> {
  const { data, error } = await supabase
    .from("trade_intent")
    .select("*")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .maybeSingle();
  if (error || !data) return null;
  return fromIntentRow(data as IntentRow);
}

export async function loadTradeReflection(
  userId: string,
  tradeId: string,
): Promise<TradeReflection | null> {
  const { data, error } = await supabase
    .from("trade_reflection")
    .select("*")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .maybeSingle();
  if (error || !data) return null;
  return fromReflectionRow(data as ReflectionRow);
}
