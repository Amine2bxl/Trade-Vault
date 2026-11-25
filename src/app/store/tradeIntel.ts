import { supabase } from "@/integrations/supabase/client";
import type { Trade } from "../types";
import { isEmotionalState, type EmotionalState } from "../trading/readiness";
import { hasPlannedLevels, priceOrNull, type PlannedLevels } from "@/domain/executionPlan";

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
  /** Les niveaux du plan de séance, figés à la création de l'intention. */
  planned?: PlannedLevels | null;
  /** Stop et cible réellement posés à l'entrée, en prix (corrigeables). */
  initialStop?: number | null;
  initialTarget?: number | null;
}

export type ExecutionOverride = "good_execution" | "bad_execution";

export interface TradeReflectionInput {
  planRespected: PlanRespected | null;
  reason: ReflectionReason | null;
  note: string | null;
  /** Intensité émotionnelle après le trade, 1 à 5 — DÉCLARÉE. Absent = non touché. */
  intensity?: number | null;
  /** Envie de reprendre un trade tout de suite — DÉCLARÉE. Absent = non touché. */
  reentryUrge?: boolean | null;
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
  return (
    !i.emotion &&
    clean(i.reasoning) == null &&
    clean(i.plan) == null &&
    !hasPlannedLevels(i.planned) &&
    i.initialStop == null &&
    i.initialTarget == null
  );
}

export function isReflectionEmpty(r: TradeReflectionInput | null | undefined): boolean {
  if (!r) return true;
  return (
    !r.planRespected &&
    !r.reason &&
    clean(r.note) == null &&
    r.intensity == null &&
    r.reentryUrge == null
  );
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
  planned_direction?: string | null;
  planned_entry?: number | string | null;
  planned_stop?: number | string | null;
  planned_target?: number | string | null;
  planned_scenario?: string | null;
  initial_stop?: number | string | null;
  initial_target?: number | string | null;
}

interface ReflectionRow {
  id: string;
  trade_id: string;
  plan_respected: string | null;
  reason: string | null;
  note: string | null;
  execution_override?: string | null;
  override_note?: string | null;
  intensity?: number | null;
  reentry_urge?: boolean | null;
}

export interface TradeIntent {
  tradeId: string | null;
  setup: string | null;
  reasoning: string | null;
  confidence: number | null;
  plannedRisk: number | null;
  plan: string | null;
  emotion: EmotionalState | null;
  /** Absent ou `null` : intention d'avant la migration, ou trade encodé hors séance. */
  planned?: PlannedLevels | null;
  initialStop?: number | null;
  initialTarget?: number | null;
}

export interface TradeReflection {
  tradeId: string;
  planRespected: PlanRespected | null;
  reason: ReflectionReason | null;
  note: string | null;
  /** Correction MANUELLE du verdict d'exécution ; le verdict calculé, lui, n'est pas stocké. */
  executionOverride?: ExecutionOverride | null;
  overrideNote?: string | null;
  intensity?: number | null;
  reentryUrge?: boolean | null;
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
    planned: plannedFromRow(r),
    initialStop: priceOrNull(r.initial_stop),
    initialTarget: priceOrNull(r.initial_target),
  };
}

function plannedFromRow(r: IntentRow): PlannedLevels | null {
  const p: PlannedLevels = {
    direction:
      r.planned_direction === "long" || r.planned_direction === "short"
        ? r.planned_direction
        : null,
    entry: priceOrNull(r.planned_entry),
    stop: priceOrNull(r.planned_stop),
    target: priceOrNull(r.planned_target),
    scenario: r.planned_scenario === "A" || r.planned_scenario === "B" ? r.planned_scenario : null,
  };
  return hasPlannedLevels(p) ? p : null;
}

/* Colonnes de la migration `20261122120000_plan_vs_execution`. L'app est
   déployée AVANT ses migrations : tant qu'elles manquent, PostgREST refuse la
   colonne (`PGRST204` à l'écriture, `42703` à la lecture) et on réécrit sans
   elles — l'intention de base ne doit jamais se perdre pour autant. */
const PLAN_COLUMNS = [
  "planned_direction",
  "planned_entry",
  "planned_stop",
  "planned_target",
  "planned_scenario",
  "initial_stop",
  "initial_target",
  "execution_override",
  "override_note",
  "intensity",
  "reentry_urge",
] as const;

export function isMissingPlanColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const text = `${e.code ?? ""} ${e.message ?? ""}`;
  return /PGRST204|42703|column/i.test(text) && PLAN_COLUMNS.some((c) => text.includes(c));
}

// Les colonnes du plan sont toutes facultatives : la ligne sans elles reste une ligne valide.
function withoutPlanColumns<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!(PLAN_COLUMNS as readonly string[]).includes(k)) out[k] = v;
  }
  return out as T;
}

/** Écrit, puis réécrit sans les colonnes du plan si la base ne les a pas encore. */
async function writeWithPlanFallback<R extends Record<string, unknown>>(
  row: R,
  write: (row: R) => PromiseLike<{ error: unknown }>,
): Promise<{ error: unknown }> {
  const first = await write(row);
  if (first.error && isMissingPlanColumn(first.error)) return write(withoutPlanColumns(row));
  return first;
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
    executionOverride:
      r.execution_override === "good_execution" || r.execution_override === "bad_execution"
        ? r.execution_override
        : null,
    overrideNote: r.override_note ?? null,
    intensity:
      typeof r.intensity === "number" && r.intensity >= 1 && r.intensity <= 5 ? r.intensity : null,
    reentryUrge: typeof r.reentry_urge === "boolean" ? r.reentry_urge : null,
  };
}

/**
 * Ce qui reste corrigeable dans une intention : le texte, l'émotion, et le stop
 * et la cible réellement posés (une faute de frappe se corrige).
 */
function mutableIntent(input: TradeIntentInput) {
  return {
    reasoning: clean(input.reasoning),
    plan: clean(input.plan),
    emotion: input.emotion ?? null,
    initial_stop: priceOrNull(input.initialStop),
    initial_target: priceOrNull(input.initialTarget),
  };
}

/** Ce qui est FIGÉ à la création : le prévu ne change plus une fois écrit. */
export function frozenIntent(trade: Trade, input: TradeIntentInput) {
  const p = input.planned;
  return {
    setup: trade.strategy || null,
    confidence: trade.confidence ?? null,
    planned_risk: trade.riskAmount,
    planned_direction: p?.direction ?? null,
    planned_entry: priceOrNull(p?.entry),
    planned_stop: priceOrNull(p?.stop),
    planned_target: priceOrNull(p?.target),
    planned_scenario: p?.scenario ?? null,
  };
}

/**
 * Écrit l'intention d'un trade.
 *
 * `setup`, `confidence`, `planned_risk` et les niveaux `planned_*` sont un
 * INSTANTANÉ pris à la création de l'intention : ils ne s'écrivent qu'à
 * l'insertion (`ignoreDuplicates`). L'ancien upsert les réécrivait à chaque
 * enregistrement — le risque « prévu » suivait alors le risque édité, et tout
 * « prévu contre réalisé » se comparait à lui-même. Le reste (texte, émotion,
 * stop et cible posés) est mis à jour ensuite.
 */
export async function saveTradeIntent(
  userId: string,
  trade: Trade,
  input: TradeIntentInput,
): Promise<boolean> {
  const mutable = mutableIntent(input);
  const created = await writeWithPlanFallback(
    { user_id: userId, trade_id: trade.id, ...frozenIntent(trade, input), ...mutable },
    (row) =>
      supabase.from("trade_intent").upsert(row, { onConflict: "trade_id", ignoreDuplicates: true }),
  );
  const { error } = created.error
    ? created
    : await writeWithPlanFallback(mutable, (row) =>
        supabase.from("trade_intent").update(row).eq("user_id", userId).eq("trade_id", trade.id),
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
  // Les champs déclarés absents (`undefined`) ne sont PAS nommés : un upsert
  // PostgREST ne touche que les colonnes envoyées, la correction du verdict
  // saisie ailleurs survit donc à un enregistrement du formulaire.
  const row = {
    user_id: userId,
    trade_id: tradeId,
    plan_respected: input.planRespected ?? null,
    reason: input.reason ?? null,
    note: clean(input.note),
    ...(input.intensity !== undefined ? { intensity: input.intensity } : {}),
    ...(input.reentryUrge !== undefined ? { reentry_urge: input.reentryUrge } : {}),
  };
  const { error } = await writeWithPlanFallback(row, (r) =>
    supabase.from("trade_reflection").upsert(r, { onConflict: "trade_id" }),
  );
  if (error) {
    console.error("saveTradeReflection failed", error);
    return false;
  }
  return true;
}

/**
 * Corrige À LA MAIN le verdict d'exécution d'un trade (ou retire la
 * correction avec `null`). Seules ces deux colonnes partent : la réflexion
 * déjà saisie reste intacte. `false` tant que la migration manque — une
 * correction ne doit pas sembler enregistrée quand elle ne l'est pas.
 */
export async function saveExecutionOverride(
  userId: string,
  tradeId: string,
  override: ExecutionOverride | null,
  note: string | null,
): Promise<boolean> {
  const { error } = await supabase.from("trade_reflection").upsert(
    {
      user_id: userId,
      trade_id: tradeId,
      execution_override: override,
      override_note: override ? clean(note) : null,
    },
    { onConflict: "trade_id" },
  );
  if (error) {
    console.error("saveExecutionOverride failed", error);
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

/** Charge les intentions de plusieurs trades en UNE requête (`.in`). C'est la
 *  voie BULK que le coach (6I) exige : relire 25 trades un par un ferait 50
 *  requêtes par question — deux suffisent. Clé de retour : `trade_id`. */
export async function loadTradeIntents(
  userId: string,
  tradeIds: string[],
): Promise<Record<string, TradeIntent>> {
  const ids = tradeIds.filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("trade_intent")
    .select("*")
    .eq("user_id", userId)
    .in("trade_id", ids);
  if (error || !data) return {};
  const out: Record<string, TradeIntent> = {};
  for (const row of data as IntentRow[]) {
    const intent = fromIntentRow(row);
    if (intent.tradeId) out[intent.tradeId] = intent;
  }
  return out;
}

/** Idem pour les réflexions — l'accès au « avant vs après » de plusieurs trades. */
export async function loadTradeReflections(
  userId: string,
  tradeIds: string[],
): Promise<Record<string, TradeReflection>> {
  const ids = tradeIds.filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("trade_reflection")
    .select("*")
    .eq("user_id", userId)
    .in("trade_id", ids);
  if (error || !data) return {};
  const out: Record<string, TradeReflection> = {};
  for (const row of data as ReflectionRow[]) {
    const reflection = fromReflectionRow(row);
    out[reflection.tradeId] = reflection;
  }
  return out;
}
