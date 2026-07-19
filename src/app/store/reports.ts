import { supabase } from "@/integrations/supabase/client";
import type { MonthlyReportData } from "../utils/monthlyReport";

// ── Monthly reports ──
export interface MonthlyReportRow {
  id: string;
  month: string;
  report: MonthlyReportData;
  createdAt: string;
}

export async function loadMonthlyReports(userId: string): Promise<MonthlyReportRow[]> {
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("id, month, report, created_at")
    .eq("user_id", userId)
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    month: r.month as string,
    report: r.report as unknown as MonthlyReportData,
    createdAt: r.created_at as string,
  }));
}
