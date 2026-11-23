import { supabase } from "@/integrations/supabase/client";
import { MissedOpportunity } from "../types";
import { priceOrNull } from "@/domain/executionPlan";
import {
  MISSED_CLASSES,
  MISSED_OUTCOMES,
  MISSED_REASONS,
  type MissedClass,
  type MissedOutcome,
  type MissedReason,
} from "@/domain/missedSetup";
import { getActiveAccountId } from "./accounts";
import { storagePathsOf, removeScreenshotFiles } from "./storage";

// ── Missed Opportunities ──
interface MissedRow {
  id: string;
  user_id?: string;
  account_id?: string | null;
  opportunity_date: string;
  symbol: string;
  reason_not_taken: string;
  what_happened: string;
  lesson_learned: string;
  next_time_plan: string;
  estimated_r: number;
  screenshots?: string[];
  direction?: string | null;
  entry_price?: number | string | null;
  stop_price?: number | string | null;
  target_price?: number | string | null;
  reason_code?: string | null;
  classification?: string | null;
  outcome?: string | null;
}

/* Colonnes de `20261122130000_missed_setup_model` : l'app est déployée avant
   ses migrations ; sans elles, on lit et on écrit sans ces colonnes. */
const MODEL_COLUMNS = [
  "direction",
  "entry_price",
  "stop_price",
  "target_price",
  "reason_code",
  "classification",
  "outcome",
] as const;
const BASE_SELECT =
  "id,user_id,account_id,opportunity_date,symbol,reason_not_taken,what_happened,lesson_learned,next_time_plan,estimated_r,screenshots";

function isMissingModelColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const text = `${e?.code ?? ""} ${e?.message ?? ""}`;
  return /PGRST204|42703|column/i.test(text) && MODEL_COLUMNS.some((c) => text.includes(c));
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  (list as readonly unknown[]).includes(v) ? (v as T) : null;

function rowToMissed(r: MissedRow): MissedOpportunity {
  return {
    id: r.id,
    date: r.opportunity_date,
    symbol: r.symbol ?? "",
    reasonNotTaken: r.reason_not_taken ?? "",
    whatHappened: r.what_happened ?? "",
    lessonLearned: r.lesson_learned ?? "",
    nextTimePlan: r.next_time_plan ?? "",
    estimatedR: Number(r.estimated_r) || 0,
    screenshots: r.screenshots ?? [],
    direction: r.direction === "long" || r.direction === "short" ? r.direction : null,
    entryPrice: priceOrNull(r.entry_price),
    stopPrice: priceOrNull(r.stop_price),
    targetPrice: priceOrNull(r.target_price),
    reasonCode: oneOf<MissedReason>(MISSED_REASONS, r.reason_code),
    classification: oneOf<MissedClass>(MISSED_CLASSES, r.classification),
    outcome: oneOf<MissedOutcome>(MISSED_OUTCOMES, r.outcome),
  };
}

function missedToRow(m: MissedOpportunity, userId: string): MissedRow {
  return {
    id: m.id,
    user_id: userId,
    account_id: getActiveAccountId() ?? null,
    opportunity_date: m.date,
    symbol: m.symbol,
    reason_not_taken: m.reasonNotTaken,
    what_happened: m.whatHappened,
    lesson_learned: m.lessonLearned,
    next_time_plan: m.nextTimePlan,
    estimated_r: m.estimatedR,
    screenshots: m.screenshots ?? [],
    direction: m.direction ?? null,
    entry_price: priceOrNull(m.entryPrice),
    stop_price: priceOrNull(m.stopPrice),
    target_price: priceOrNull(m.targetPrice),
    reason_code: m.reasonCode ?? null,
    classification: m.classification ?? null,
    outcome: m.outcome ?? null,
  };
}

function withoutModelColumns(row: MissedRow): MissedRow {
  const out = { ...row } as Record<string, unknown>;
  for (const c of MODEL_COLUMNS) delete out[c];
  return out as unknown as MissedRow;
}

export async function loadMissedOpportunities(userId: string): Promise<MissedOpportunity[]> {
  const run = (columns: string) => {
    let q = supabase.from("missed_opportunities").select(columns).eq("user_id", userId);
    const activeId = getActiveAccountId();
    if (activeId) q = q.eq("account_id", activeId);
    return q.order("opportunity_date", { ascending: false });
  };
  let res = await run(`${BASE_SELECT},${MODEL_COLUMNS.join(",")}`);
  if (res.error && isMissingModelColumn(res.error)) res = await run(BASE_SELECT);
  if (res.error) throw res.error;
  return ((res.data ?? []) as unknown as MissedRow[]).map((r) => rowToMissed(r));
}

export async function upsertMissedOpportunity(userId: string, m: MissedOpportunity): Promise<void> {
  const row = missedToRow(m, userId);
  // `as never` : les types générés ne connaissent pas encore les colonnes du modèle.
  let { error } = await supabase.from("missed_opportunities").upsert(row as never);
  if (error && isMissingModelColumn(error)) {
    ({ error } = await supabase
      .from("missed_opportunities")
      .upsert(withoutModelColumns(row) as never));
  }
  if (error) throw error;
}

export async function deleteMissedOpportunity(userId: string, id: string): Promise<void> {
  const { data } = await supabase
    .from("missed_opportunities")
    .select("screenshots")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await supabase
    .from("missed_opportunities")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  await removeScreenshotFiles(storagePathsOf(data?.screenshots));
}
