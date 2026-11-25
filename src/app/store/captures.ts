import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { CaptureExtraction } from "@/domain/capture";

/**
 * La file des captures (`capture_items`) côté client.
 *
 * Le serveur (`analyzeCapture`) crée et analyse les lignes ; le client ne fait
 * que les lire, les distribuer (lien vers le trade ou le setup manqué créé) et
 * les écarter. L'extraction d'origine n'est jamais touchée ici.
 */

export type CaptureItemRow = Tables<"capture_items">;
export type CaptureItemStatus = CaptureItemRow["status"];

export interface CaptureItem {
  id: string;
  status: CaptureItemStatus;
  source: "image" | "note" | "voice";
  target: "trade" | "missed";
  accountId: string | null;
  screenshots: string[];
  note: string | null;
  extraction: CaptureExtraction | null;
  error: string | null;
  tradeId: string | null;
  missedId: string | null;
  createdAt: string;
}

const COLS =
  "id, status, source, target, account_id, screenshots, note, extraction, error, trade_id, missed_id, created_at";

function fromRow(r: Pick<CaptureItemRow, never> & Record<string, unknown>): CaptureItem {
  return {
    id: r.id as string,
    status: r.status as CaptureItemStatus,
    source: r.source as CaptureItem["source"],
    target: r.target as CaptureItem["target"],
    accountId: (r.account_id as string | null) ?? null,
    screenshots: (r.screenshots as string[] | null) ?? [],
    note: (r.note as string | null) ?? null,
    extraction: (r.extraction as unknown as CaptureExtraction | null) ?? null,
    error: (r.error as string | null) ?? null,
    tradeId: (r.trade_id as string | null) ?? null,
    missedId: (r.missed_id as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Les éléments encore à traiter (analysés, en cours ou en échec), du plus récent au plus ancien. */
export async function loadOpenCaptures(userId: string): Promise<CaptureItem[]> {
  const { data, error } = await supabase
    .from("capture_items")
    .select(COLS)
    .eq("user_id", userId)
    .in("status", ["pending", "processing", "completed", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as unknown as Record<string, unknown>));
}

/** Les dernières opérations distribuées ou écartées — l'historique de l'Inbox. */
export async function loadCaptureHistory(userId: string, limit = 20): Promise<CaptureItem[]> {
  const { data, error } = await supabase
    .from("capture_items")
    .select(COLS)
    .eq("user_id", userId)
    .in("status", ["applied", "dismissed"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as unknown as Record<string, unknown>));
}

/** La capture d'origine d'un trade, s'il en a une (lien « capture → trade »). */
export async function captureForTrade(
  userId: string,
  tradeId: string,
): Promise<CaptureItem | null> {
  const { data, error } = await supabase
    .from("capture_items")
    .select(COLS)
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return fromRow(data as unknown as Record<string, unknown>);
}

/**
 * La capture a servi : elle pointe désormais vers ce qu'elle a rempli, et
 * garde à part ce que le trader a corrigé (matière de l'apprentissage).
 * Best-effort : un échec ne doit jamais faire échouer l'enregistrement du trade.
 */
export async function markCaptureApplied(
  itemId: string,
  link: { tradeId?: string; missedId?: string },
  corrections: Record<string, { detected: string; saved: string }>,
): Promise<void> {
  try {
    await supabase
      .from("capture_items")
      .update({
        status: "applied",
        trade_id: link.tradeId ?? null,
        missed_id: link.missedId ?? null,
        corrections: corrections as unknown as Json,
      })
      .eq("id", itemId);
  } catch {
    /* best-effort */
  }
}

export async function dismissCapture(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("capture_items")
    .update({ status: "dismissed" })
    .eq("id", itemId);
  if (error) throw error;
}

/**
 * Les corrections récentes du trader, pour ajuster les PROCHAINES propositions
 * (jamais les données déjà enregistrées).
 */
export async function loadRecentCorrections(
  userId: string,
  limit = 30,
): Promise<Record<string, { detected: string; saved: string }>[]> {
  const { data, error } = await supabase
    .from("capture_items")
    .select("corrections")
    .eq("user_id", userId)
    .eq("status", "applied")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map(
    (r) => (r.corrections ?? {}) as unknown as Record<string, { detected: string; saved: string }>,
  );
}
