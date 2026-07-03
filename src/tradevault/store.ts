import { supabase as supabaseClient } from '@/integrations/supabase/client';
// Cast to `any` because Supabase generated types haven't synced for these tables yet.
// Runtime behavior is unchanged; RLS still enforces auth.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;
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
  };
}

function tradeToRow(t: Trade, userId: string): TradeRow {
  return {
    id: t.id,
    user_id: userId,
    trade_date: t.date,
    symbol: t.symbol,
    direction: t.direction,
    pnl: t.pnl,
    risk_amount: t.riskAmount,
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
    .upsert(tradeToRow(trade, userId) as never);
  if (error) throw error;
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAllTrades(userId: string): Promise<void> {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
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
    .update({ confluences } as never)
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
    .update({ account_balance: balance } as never)
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
    .update({ starting_balance: balance } as never)
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
    .update({ language } as never)
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
    .upsert(missedToRow(m, userId) as never);
  if (error) throw error;
}

export async function deleteMissedOpportunity(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('missed_opportunities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
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
  const { data, error } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteScreenshot(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).remove([path]);
  if (error) throw error;
}
