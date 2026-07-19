import { supabase } from "@/integrations/supabase/client";
import { MissedOpportunity } from "../types";
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
}

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
  };
}

export async function loadMissedOpportunities(userId: string): Promise<MissedOpportunity[]> {
  let q = supabase.from("missed_opportunities").select("*").eq("user_id", userId);
  const activeId = getActiveAccountId();
  if (activeId) q = q.eq("account_id", activeId);
  const { data, error } = await q.order("opportunity_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: MissedRow) => rowToMissed(r));
}

export async function upsertMissedOpportunity(userId: string, m: MissedOpportunity): Promise<void> {
  const { error } = await supabase.from("missed_opportunities").upsert(missedToRow(m, userId));
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
