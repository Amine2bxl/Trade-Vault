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
export async function loadUserTrades(
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<Trade[]> {
  let q = supabase
    .from("trades")
    .select(
      "id,user_id,account_id,trade_date,symbol,direction,pnl,risk_amount,r_multiple,strategy,mistakes,setup_quality,notes,screenshots,entry_time,exit_time,confluences,confidence,mae,mfe,slippage,is_example,created_at,updated_at",
    )
    .eq("user_id", userId);
  const activeId = getActiveAccountId();
  if (activeId) q = q.eq("account_id", activeId);
  if (opts?.limit || opts?.offset) {
    const start = opts?.offset ?? 0;
    const end = start + (opts?.limit ?? 50) - 1;
    q = q.range(start, end);
  }
  const { data, error } = await q.order("trade_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: TradeRow) => rowToTrade(r));
}

export async function upsertTrade(userId: string, trade: Trade): Promise<void> {
  // RLS ensures auth.uid() = user_id on both INSERT and UPDATE.
  // The row's user_id is always set from the authenticated userId param.
  const { error } = await supabase.from("trades").upsert(tradeToRow(trade, userId));
  if (error) throw error;
}

/** Taille d'un lot d'import. Assez gros pour être rapide, assez petit pour
 *  qu'un échec réseau ne fasse pas perdre tout le fichier. */
export const IMPORT_BATCH_SIZE = 100;

/**
 * Écrit un import en LOTS SÉQUENTIELS.
 *
 * POURQUOI. L'import lançait auparavant une requête par trade, toutes en
 * parallèle : un fichier de 2 000 trades ouvrait 2 000 requêtes simultanées,
 * que le navigateur et Supabase finissaient par refuser. L'utilisateur voyait
 * « import réussi » avec la moitié de son historique manquante.
 *
 * Les lots avancent l'un après l'autre et rapportent leur progression, ce qui
 * donne enfin une barre de progression honnête. Un lot qui échoue est
 * retenté trade par trade : une seule ligne fautive ne doit pas emporter
 * les 99 autres.
 */
export async function importTrades(
  userId: string,
  trades: readonly Trade[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ saved: Trade[]; failed: number }> {
  const saved: Trade[] = [];
  let failed = 0;
  for (let i = 0; i < trades.length; i += IMPORT_BATCH_SIZE) {
    const batch = trades.slice(i, i + IMPORT_BATCH_SIZE);
    const { error } = await supabase.from("trades").upsert(batch.map((t) => tradeToRow(t, userId)));
    if (!error) {
      saved.push(...batch);
    } else {
      // Repli ligne à ligne pour isoler la ou les lignes réellement fautives.
      console.error("Batch import failed, retrying row by row", error);
      const results = await Promise.allSettled(
        batch.map((t) => supabase.from("trades").upsert(tradeToRow(t, userId))),
      );
      results.forEach((r, k) => {
        if (r.status === "fulfilled" && !r.value.error) saved.push(batch[k]);
        else failed++;
      });
    }
    onProgress?.(Math.min(i + batch.length, trades.length), trades.length);
  }
  return { saved, failed };
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  const { data } = await supabase
    .from("trades")
    .select("screenshots")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.screenshots?.length) {
    await removeScreenshotFiles(storagePathsOf(data.screenshots));
  }
  const { error } = await supabase.from("trades").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// Scoped to the active account: "delete all" only clears the current account.
export async function deleteAllTrades(userId: string): Promise<void> {
  const activeId = getActiveAccountId();
  let selectQ = supabase.from("trades").select("screenshots").eq("user_id", userId);
  if (activeId) selectQ = selectQ.eq("account_id", activeId);
  const { data } = await selectQ;
  const allPaths = (data ?? []).flatMap((r: { screenshots: string[] }) =>
    storagePathsOf(r.screenshots),
  );
  if (allPaths.length) {
    await removeScreenshotFiles(allPaths);
  }
  let delQ = supabase.from("trades").delete().eq("user_id", userId);
  if (activeId) delQ = delQ.eq("account_id", activeId);
  const { error } = await delQ;
  if (error) throw error;
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
