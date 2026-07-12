import { supabase } from '@/integrations/supabase/client';
import { Trade, DEFAULT_CONFLUENCES, MissedOpportunity } from './types';

export function generateId(): string {
  // Real UUID — required because some tables (e.g. missed_opportunities.id) use the uuid type.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback (very rare): RFC4122-ish from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface TradeRow {
  id: string;
  user_id?: string;
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
}

function rowToTrade(r: TradeRow): Trade {
  const dir = r.direction === 'short' ? 'short' : r.direction === 'be' ? 'be' : 'long';
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
    notes: r.notes ?? '',
    screenshots: r.screenshots ?? [],
    entryTime: r.entry_time ?? '',
    exitTime: r.exit_time ?? '',
    confluences: r.confluences ?? [],
    confidence: r.confidence,
    mae: r.mae ?? null,
    mfe: r.mfe ?? null,
    slippage: r.slippage ?? null,
  };
}

// Money values are rounded to cents at the storage boundary so float noise
// from client-side math (risk * R) never lands in the DB numeric columns.
const toCents = (n: number) => Math.round(n * 100) / 100;

function tradeToRow(t: Trade, userId: string): TradeRow {
  return {
    id: t.id,
    user_id: userId,
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
  };
}

// ── Trades ──
export async function loadUserTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('trade_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: TradeRow) => rowToTrade(r));
}

export async function upsertTrade(userId: string, trade: Trade): Promise<void> {
  const { error } = await supabase
    .from('trades')
    .upsert(tradeToRow(trade, userId));
  if (error) throw error;
}

// Storage paths (non data: URLs) referenced by rows must be removed together
// with the rows, otherwise files pile up as unreachable orphans in the bucket.
function storagePathsOf(screenshots: string[] | null | undefined): string[] {
  return (screenshots ?? []).filter((s) => !s.startsWith('data:'));
}

async function removeScreenshotFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Best-effort: a failed storage cleanup should never block the row delete.
  try { await supabase.storage.from(SCREENSHOTS_BUCKET).remove(paths); } catch { /* ignore */ }
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  const { data } = await supabase
    .from('trades')
    .select('screenshots')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
  await removeScreenshotFiles(storagePathsOf(data?.screenshots));
}

export async function deleteAllTrades(userId: string): Promise<void> {
  const { data } = await supabase
    .from('trades')
    .select('screenshots')
    .eq('user_id', userId);
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
  const all = (data ?? []).flatMap((r: { screenshots: string[] }) => storagePathsOf(r.screenshots));
  await removeScreenshotFiles(all);
}

// ── Confluences (stored on profile) ──
export async function loadConfluences(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('confluences')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const list = data?.confluences as string[] | undefined;
  return list && list.length > 0 ? list : [...DEFAULT_CONFLUENCES];
}

export async function saveConfluences(userId: string, confluences: string[]): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ confluences })
    .eq('id', userId);
  if (error) throw error;
}

// ── Account balance (stored on profile) ──
export async function loadAccountBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_balance')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const bal = data?.account_balance as number | undefined;
  return typeof bal === 'number' ? bal : 25000;
}

export async function saveAccountBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ account_balance: balance })
    .eq('id', userId);
  if (error) throw error;
}

// ── Starting balance (account equity baseline) ──
export async function loadStartingBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('starting_balance')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const bal = data?.starting_balance as number | undefined;
  return typeof bal === 'number' ? bal : 25000;
}

export async function saveStartingBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ starting_balance: balance })
    .eq('id', userId);
  if (error) throw error;
}

// ── Language ──
export async function loadLanguage(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.language as string | undefined) || 'en';
}

export async function saveLanguage(userId: string, language: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ language })
    .eq('id', userId);
  if (error) throw error;
}

// ── Missed Opportunities ──
interface MissedRow {
  id: string;
  user_id?: string;
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
    symbol: r.symbol ?? '',
    reasonNotTaken: r.reason_not_taken ?? '',
    whatHappened: r.what_happened ?? '',
    lessonLearned: r.lesson_learned ?? '',
    nextTimePlan: r.next_time_plan ?? '',
    estimatedR: Number(r.estimated_r) || 0,
    screenshots: r.screenshots ?? [],
  };
}

function missedToRow(m: MissedOpportunity, userId: string): MissedRow {
  return {
    id: m.id,
    user_id: userId,
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
  const { data, error } = await supabase
    .from('missed_opportunities')
    .select('*')
    .eq('user_id', userId)
    .order('opportunity_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: MissedRow) => rowToMissed(r));
}

export async function upsertMissedOpportunity(userId: string, m: MissedOpportunity): Promise<void> {
  const { error } = await supabase
    .from('missed_opportunities')
    .upsert(missedToRow(m, userId));
  if (error) throw error;
}

export async function deleteMissedOpportunity(userId: string, id: string): Promise<void> {
  const { data } = await supabase
    .from('missed_opportunities')
    .select('screenshots')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const { error } = await supabase
    .from('missed_opportunities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
  await removeScreenshotFiles(storagePathsOf(data?.screenshots));
}

// ── Screenshots (Supabase Storage) ──
const SCREENSHOTS_BUCKET = 'trade-screenshots';

export async function uploadScreenshot(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadMissedScreenshot(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/missed/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getScreenshotUrl(path: string): Promise<string> {
  // Legacy trades stored inline base64 data URLs — display them as-is.
  if (path.startsWith('data:')) return path;
  const { data, error } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Batch variant: one network call for N paths instead of N calls. */
export async function getScreenshotUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const storagePaths: string[] = [];
  for (const p of paths) {
    if (p.startsWith('data:')) out[p] = p;
    else storagePaths.push(p);
  }
  if (storagePaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
    }
  }
  return out;
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
  const legacy = trades.filter((t) => t.screenshots.some((s) => s.startsWith('data:')));
  let migrated = 0;
  for (const trade of legacy) {
    try {
      const newShots: string[] = [];
      for (const shot of trade.screenshots) {
        if (!shot.startsWith('data:')) { newShots.push(shot); continue; }
        const blob = await (await fetch(shot)).blob();
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        const file = new File([blob], `legacy-${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });
        newShots.push(await uploadScreenshot(userId, file));
      }
      const updated = { ...trade, screenshots: newShots };
      await upsertTrade(userId, updated);
      onTradeMigrated?.(updated);
      migrated++;
    } catch (e) {
      // Non-fatal: the data: URL still displays; retry happens on next load.
      console.warn('[migrate] screenshot migration failed for trade', trade.id, e);
    }
  }
  return migrated;
}

export async function deleteScreenshot(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).remove([path]);
  if (error) throw error;
}
