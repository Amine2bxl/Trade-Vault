import { supabase } from "@/integrations/supabase/client";
import { Trade } from "../types";
import { getActiveAccountId } from "./accounts";
import { storagePathsOf, removeScreenshotFiles, uploadScreenshot } from "./storage";

interface TradeRow {
  id: string;
  user_id?: string;
  account_id?: string | null;
  trade_date: string;
  symbol: string;
  direction: string;
  pnl: number;
  risk_amount: number;
  r_multiple: number;
  strategy: string;
  mistakes: string[];
  setup_quality: number;
  notes: string;
  screenshots: string[];
  entry_time: string;
  exit_time: string;
  confluences: string[];
  confidence: number;
  mae?: number | null;
  mfe?: number | null;
  slippage?: number | null;
  is_example?: boolean;
}

function rowToTrade(r: TradeRow): Trade {
  const dir = r.direction === "short" ? "short" : r.direction === "be" ? "be" : "long";
  return {
    id: r.id,
    date: r.trade_date,
    symbol: r.symbol,
    direction: dir,
    pnl: Number(r.pnl),
    riskAmount: Number(r.risk_amount),
    rMultiple: Number(r.r_multiple),
    strategy: r.strategy,
    mistakes: r.mistakes ?? [],
    setupQuality: r.setup_quality,
    notes: r.notes ?? "",
    screenshots: r.screenshots ?? [],
    entryTime: r.entry_time ?? "",
    exitTime: r.exit_time ?? "",
    confluences: r.confluences ?? [],
    confidence: r.confidence,
    mae: r.mae ?? null,
    mfe: r.mfe ?? null,
    slippage: r.slippage ?? null,
    isExample: !!r.is_example,
  };
}

// Money values are rounded to cents at the storage boundary so float noise
// from client-side math (risk * R) never lands in the DB numeric columns.
const toCents = (n: number) => Math.round(n * 100) / 100;

function tradeToRow(t: Trade, userId: string): TradeRow {
  return {
    id: t.id,
    user_id: userId,
    account_id: getActiveAccountId() ?? null,
    trade_date: t.date,
    symbol: t.symbol,
    direction: t.direction,
    pnl: toCents(t.pnl),
    risk_amount: toCents(t.riskAmount),
    r_multiple: t.rMultiple,
    strategy: t.strategy,
    mistakes: t.mistakes,
    setup_quality: t.setupQuality,
    notes: t.notes,
    screenshots: t.screenshots,
    entry_time: t.entryTime,
    exit_time: t.exitTime,
    confluences: t.confluences,
    confidence: t.confidence,
    mae: t.mae != null ? toCents(t.mae) : null,
    mfe: t.mfe != null ? toCents(t.mfe) : null,
    slippage: t.slippage != null ? toCents(t.slippage) : null,
    is_example: !!t.isExample,
  };
}

// ── Trades ──
export async function loadUserTrades(userId: string): Promise<Trade[]> {
  let q = supabase.from("trades").select("*").eq("user_id", userId);
  const activeId = getActiveAccountId();
  if (activeId) q = q.eq("account_id", activeId);
  const { data, error } = await q.order("trade_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: TradeRow) => rowToTrade(r));
}

export async function upsertTrade(userId: string, trade: Trade): Promise<void> {
  const { error } = await supabase.from("trades").upsert(tradeToRow(trade, userId));
  if (error) throw error;
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  const { data } = await supabase
    .from("trades")
    .select("screenshots")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await supabase.from("trades").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  await removeScreenshotFiles(storagePathsOf(data?.screenshots));
}

// Scoped to the active account: "delete all" only clears the current account.
export async function deleteAllTrades(userId: string): Promise<void> {
  const activeId = getActiveAccountId();
  let selectQ = supabase.from("trades").select("screenshots").eq("user_id", userId);
  if (activeId) selectQ = selectQ.eq("account_id", activeId);
  const { data } = await selectQ;
  let delQ = supabase.from("trades").delete().eq("user_id", userId);
  if (activeId) delQ = delQ.eq("account_id", activeId);
  const { error } = await delQ;
  if (error) throw error;
  const all = (data ?? []).flatMap((r: { screenshots: string[] }) => storagePathsOf(r.screenshots));
  await removeScreenshotFiles(all);
}

// ── Legacy base64 → Storage migration ──
// Trades created before the Storage migration hold data: URLs inline in
// trades.screenshots (~650 KB per image, re-downloaded on every load).
// This runs once in the background after login: uploads each inline image
// to the bucket and rewrites the row to reference the storage path.
export async function migrateLegacyTradeScreenshots(
  userId: string,
  trades: Trade[],
  onTradeMigrated?: (trade: Trade) => void,
): Promise<number> {
  const legacy = trades.filter((t) => t.screenshots.some((s) => s.startsWith("data:")));
  let migrated = 0;
  for (const trade of legacy) {
    try {
      const newShots: string[] = [];
      for (const shot of trade.screenshots) {
        if (!shot.startsWith("data:")) {
          newShots.push(shot);
          continue;
        }
        const blob = await (await fetch(shot)).blob();
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const file = new File([blob], `legacy-${Date.now()}.${ext}`, {
          type: blob.type || "image/jpeg",
        });
        newShots.push(await uploadScreenshot(userId, file));
      }
      const updated = { ...trade, screenshots: newShots };
      await upsertTrade(userId, updated);
      onTradeMigrated?.(updated);
      migrated++;
    } catch (e) {
      // Non-fatal: the data: URL still displays; retry happens on next load.
      console.warn("[migrate] screenshot migration failed for trade", trade.id, e);
    }
  }
  return migrated;
}
