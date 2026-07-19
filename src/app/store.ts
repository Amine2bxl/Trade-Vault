/**
 * Barrel de la couche persistance (Supabase).
 *
 * Le contenu a été éclaté par domaine dans `store/` (Phase D) — ce fichier
 * ré-exporte l'API publique pour que les importeurs gardent `from "../store"`
 * inchangé. Le bloc Trustpilot reste ici volontairement (zone gelée).
 */
import { supabase } from "@/integrations/supabase/client";

export { generateId } from "./store/ids";
export {
  type AccountType,
  type Account,
  setActiveAccountId,
  getActiveAccountId,
  loadAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  loadActiveAccountId,
  saveActiveAccountId,
} from "./store/accounts";
export {
  loadUserTrades,
  upsertTrade,
  deleteTrade,
  deleteAllTrades,
  migrateLegacyTradeScreenshots,
} from "./store/trades";
export {
  loadMissedOpportunities,
  upsertMissedOpportunity,
  deleteMissedOpportunity,
} from "./store/missed";
export {
  loadConfluences,
  saveConfluences,
  loadAccountBalance,
  saveAccountBalance,
  loadStartingBalance,
  saveStartingBalance,
  loadLanguage,
  saveLanguage,
  type OnboardingData,
  loadOnboarding,
  saveOnboarding,
} from "./store/profile";
export { type MonthlyReportRow, loadMonthlyReports } from "./store/reports";
export {
  uploadScreenshot,
  uploadMissedScreenshot,
  getScreenshotUrl,
  getScreenshotUrls,
  deleteScreenshot,
} from "./store/storage";

// ── Trustpilot review prompt state (stored on profile) — ZONE GELÉE, ne pas déplacer ──
export interface TrustpilotState {
  promptedAt: string | null;
  status: "rated" | "dismissed" | null;
}

export async function loadTrustpilotState(userId: string): Promise<TrustpilotState> {
  const { data, error } = await supabase
    .from("profiles")
    .select("trustpilot_prompted_at, trustpilot_status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const status = data?.trustpilot_status;
  return {
    promptedAt: (data?.trustpilot_prompted_at as string | null) ?? null,
    status: status === "rated" || status === "dismissed" ? status : null,
  };
}

export async function markTrustpilotPrompted(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ trustpilot_prompted_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveTrustpilotStatus(
  userId: string,
  status: "rated" | "dismissed",
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ trustpilot_status: status })
    .eq("id", userId);
  if (error) throw error;
}
