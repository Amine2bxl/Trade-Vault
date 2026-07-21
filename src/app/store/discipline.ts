import { supabase } from "@/integrations/supabase/client";
import type { DayScore } from "@/modules/discipline";

// ── Discipline days (daily Discipline Score history, RLS owner-only) ──

export interface DisciplineDayRow {
  date: string;
  score: number;
}

/** Last `limit` recorded discipline days, most recent first. */
export async function loadDisciplineDays(userId: string, limit = 60): Promise<DisciplineDayRow[]> {
  const { data, error } = await supabase
    .from("discipline_days")
    .select("date, score")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ date: r.date, score: r.score }));
}

/**
 * Upsert today's score. Neutral days are never written — absence IS the
 * neutral state, so streaks skip them for free. Best-effort by design at the
 * call sites: a failed write must never block the UI.
 */
export async function saveDisciplineDay(
  userId: string,
  date: string,
  day: DayScore,
  checklistDoneAt: string | null,
): Promise<void> {
  if (day.neutral) return;
  const { error } = await supabase.from("discipline_days").upsert(
    {
      user_id: userId,
      date,
      score: day.score,
      checklist_done_at: checklistDoneAt,
      journal_complete: day.journalComplete,
      trade_count: day.tradeCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}
