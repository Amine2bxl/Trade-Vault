import { supabase } from "@/integrations/supabase/client";
import { Trade, DEFAULT_CONFLUENCES, MissedOpportunity } from "./types";
import type { MonthlyReportData } from "./utils/monthlyReport";

export function generateId(): string {
  // Real UUID — required because some tables (e.g. missed_opportunities.id) use the uuid type.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (very rare): RFC4122-ish from Math.random.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Sub-accounts ──
export type AccountType = "personal" | "prop" | "demo" | "live";
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  currency: string;
  color: string;
  isDefault: boolean;
}

// The active account is ambient module state so every trade/missed/balance
// query scopes to it without threading an id through every call site. The
// AccountContext keeps it in sync and triggers re-fetches on switch.
let _activeAccountId: string | null = null;
export function setActiveAccountId(id: string | null): void {
  _activeAccountId = id;
}
export function getActiveAccountId(): string | null {
  return _activeAccountId;
}

interface AccountRow {
  id: string;
  name: string;
  type: string;
  starting_balance: number;
  currency: string;
  color: string;
  is_default: boolean;
}
function rowToAccount(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    type: (r.type as AccountType) ?? "personal",
    startingBalance: Number(r.starting_balance),
    currency: r.currency ?? "USD",
    color: r.color ?? "#22d3ee",
    isDefault: !!r.is_default,
  };
}

export async function loadAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, starting_balance, currency, color, is_default")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToAccount(r as AccountRow));
}

export async function createAccount(
  userId: string,
  input: {
    name: string;
    type: AccountType;
    startingBalance: number;
    currency?: string;
    color?: string;
  },
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      starting_balance: input.startingBalance,
      currency: input.currency ?? "USD",
      color: input.color ?? "#22d3ee",
      is_default: false,
    })
    .select("id, name, type, starting_balance, currency, color, is_default")
    .single();
  if (error) throw error;
  return rowToAccount(data as AccountRow);
}

export async function updateAccount(
  userId: string,
  id: string,
  patch: Partial<{
    name: string;
    type: AccountType;
    startingBalance: number;
    currency: string;
    color: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.startingBalance !== undefined) row.starting_balance = patch.startingBalance;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (patch.color !== undefined) row.color = patch.color;
  const { error } = await supabase
    .from("accounts")
    .update(row as never)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// Deletes an account and (via FK cascade) all its trades/missed opportunities.
export async function deleteAccount(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function loadActiveAccountId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("active_account_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.active_account_id as string | null) ?? null;
}

export async function saveActiveAccountId(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ active_account_id: id })
    .eq("id", userId);
  if (error) throw error;
}

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
    account_id: _activeAccountId ?? null,
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
  if (_activeAccountId) q = q.eq("account_id", _activeAccountId);
  const { data, error } = await q.order("trade_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: TradeRow) => rowToTrade(r));
}

export async function upsertTrade(userId: string, trade: Trade): Promise<void> {
  const { error } = await supabase.from("trades").upsert(tradeToRow(trade, userId));
  if (error) throw error;
}

// Storage paths (non data: URLs) referenced by rows must be removed together
// with the rows, otherwise files pile up as unreachable orphans in the bucket.
function storagePathsOf(screenshots: string[] | null | undefined): string[] {
  return (screenshots ?? []).filter((s) => !s.startsWith("data:"));
}

async function removeScreenshotFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Best-effort: a failed storage cleanup should never block the row delete.
  try {
    await supabase.storage.from(SCREENSHOTS_BUCKET).remove(paths);
  } catch {
    /* ignore */
  }
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
  let selectQ = supabase.from("trades").select("screenshots").eq("user_id", userId);
  if (_activeAccountId) selectQ = selectQ.eq("account_id", _activeAccountId);
  const { data } = await selectQ;
  let delQ = supabase.from("trades").delete().eq("user_id", userId);
  if (_activeAccountId) delQ = delQ.eq("account_id", _activeAccountId);
  const { error } = await delQ;
  if (error) throw error;
  const all = (data ?? []).flatMap((r: { screenshots: string[] }) => storagePathsOf(r.screenshots));
  await removeScreenshotFiles(all);
}

// ── Confluences (stored on profile) ──
export async function loadConfluences(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("confluences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const list = data?.confluences as string[] | undefined;
  return list && list.length > 0 ? list : [...DEFAULT_CONFLUENCES];
}

export async function saveConfluences(userId: string, confluences: string[]): Promise<void> {
  const { error } = await supabase.from("profiles").update({ confluences }).eq("id", userId);
  if (error) throw error;
}

// ── Account balance (stored on profile) ──
export async function loadAccountBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const bal = data?.account_balance as number | undefined;
  return typeof bal === "number" ? bal : 25000;
}

export async function saveAccountBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ account_balance: balance })
    .eq("id", userId);
  if (error) throw error;
}

// ── Starting balance (account equity baseline) ──
// Per active account (falls back to the profile baseline when no account set).
export async function loadStartingBalance(userId: string): Promise<number> {
  if (_activeAccountId) {
    const { data, error } = await supabase
      .from("accounts")
      .select("starting_balance")
      .eq("id", _activeAccountId)
      .maybeSingle();
    if (error) throw error;
    const bal = data?.starting_balance as number | undefined;
    if (typeof bal === "number") return bal;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("starting_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const bal = data?.starting_balance as number | undefined;
  return typeof bal === "number" ? bal : 25000;
}

export async function saveStartingBalance(userId: string, balance: number): Promise<void> {
  if (_activeAccountId) {
    const { error } = await supabase
      .from("accounts")
      .update({ starting_balance: balance })
      .eq("id", _activeAccountId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ starting_balance: balance })
    .eq("id", userId);
  if (error) throw error;
}

// ── Language ──
export async function loadLanguage(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.language as string | undefined) || "en";
}

export async function saveLanguage(userId: string, language: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ language }).eq("id", userId);
  if (error) throw error;
}

// ── Onboarding (stored on profile) ──
export interface OnboardingData {
  goal: string | null;
  assets: string[];
  style: string | null;
  experience: string | null;
  usesIct: boolean;
  brokers: string[];
  pain: string | null;
  /** Realistic monthly performance target in % (onboarding Q3). */
  monthlyTarget: number | null;
  onboardedAt: string | null;
  skipped: boolean;
}

const EMPTY_ONBOARDING: OnboardingData = {
  goal: null,
  assets: [],
  style: null,
  experience: null,
  usesIct: false,
  brokers: [],
  pain: null,
  monthlyTarget: null,
  onboardedAt: null,
  skipped: false,
};

interface OnboardingRow {
  onboarding_goal: string | null;
  onboarding_assets: string[] | null;
  onboarding_style: string | null;
  onboarding_experience: string | null;
  onboarding_uses_ict: boolean | null;
  onboarding_brokers: string[] | null;
  onboarding_pain: string | null;
  onboarding_monthly_target: number | null;
  onboarded_at: string | null;
  onboarding_skipped: boolean | null;
}

export async function loadOnboarding(userId: string): Promise<OnboardingData> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "onboarding_goal, onboarding_assets, onboarding_style, onboarding_experience, onboarding_uses_ict, onboarding_brokers, onboarding_pain, onboarding_monthly_target, onboarded_at, onboarding_skipped",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_ONBOARDING };
  const r = data as OnboardingRow;
  return {
    goal: r.onboarding_goal ?? null,
    assets: r.onboarding_assets ?? [],
    style: r.onboarding_style ?? null,
    experience: r.onboarding_experience ?? null,
    usesIct: !!r.onboarding_uses_ict,
    brokers: r.onboarding_brokers ?? [],
    pain: r.onboarding_pain ?? null,
    monthlyTarget:
      r.onboarding_monthly_target !== null ? Number(r.onboarding_monthly_target) : null,
    onboardedAt: r.onboarded_at ?? null,
    skipped: !!r.onboarding_skipped,
  };
}

// Persists the collected answers and stamps `onboarded_at` so the flow never
// shows again. `skipped` records that the user bailed with defaults.
export async function saveOnboarding(
  userId: string,
  d: OnboardingData,
  opts: { skipped?: boolean } = {},
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_goal: d.goal,
      onboarding_assets: d.assets,
      onboarding_style: d.style,
      onboarding_experience: d.experience,
      onboarding_uses_ict: d.usesIct,
      onboarding_brokers: d.brokers,
      onboarding_pain: d.pain,
      onboarding_monthly_target: d.monthlyTarget,
      onboarding_skipped: opts.skipped ?? false,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;

  // J+0 welcome email, personalized from the answers just saved. Fire and
  // forget: the server dedupes via email_log, a failure never blocks the app.
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch("/api/emails/welcome", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort — the user experience never depends on the email
    }
  })();
}

// ── Trustpilot review prompt state (stored on profile) ──
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
    account_id: _activeAccountId ?? null,
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
  if (_activeAccountId) q = q.eq("account_id", _activeAccountId);
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

// ── Screenshots (Supabase Storage) ──
const SCREENSHOTS_BUCKET = "trade-screenshots";

export async function uploadScreenshot(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadMissedScreenshot(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/missed/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getScreenshotUrl(path: string): Promise<string> {
  // Legacy trades stored inline base64 data URLs — display them as-is.
  if (path.startsWith("data:")) return path;
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
    if (p.startsWith("data:")) out[p] = p;
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

export async function deleteScreenshot(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).remove([path]);
  if (error) throw error;
}
