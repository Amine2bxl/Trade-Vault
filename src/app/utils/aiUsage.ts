/**
 * Jarvis daily AI usage — a lightweight, LOCAL counter (no backend, no tokens).
 *
 * The free tier gives the trader 5 AI analyses per calendar day. Everything
 * here lives in localStorage so it survives reloads and resets at midnight:
 * the UI reads `aiUsageToday()` to render the quota bar and the conversation
 * enforces `exceedsDailyLimit()` before burning a request.
 */

export const FREE_DAILY_LIMIT = 5;

const KEY = (userId: string) => `tv:jarvis:usage:${userId}`;

interface UsageDay {
  /** YYYY-MM-DD local date of this bucket. */
  date: string;
  count: number;
}

function todayKey(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function read(userId: string | undefined): UsageDay {
  if (!userId) return { date: todayKey(), count: 0 };
  try {
    const raw = localStorage.getItem(KEY(userId));
    const parsed = raw ? (JSON.parse(raw) as UsageDay) : null;
    if (parsed && parsed.date === todayKey()) return parsed;
  } catch {
    /* storage unavailable */
  }
  return { date: todayKey(), count: 0 };
}

function write(userId: string | undefined, day: UsageDay): void {
  if (!userId) return;
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(day));
  } catch {
    /* best-effort */
  }
}

/** Analyses used today (0..FREE_DAILY_LIMIT). */
export function aiUsageToday(userId: string | undefined): number {
  const day = read(userId);
  return day.date === todayKey() ? Math.min(day.count, FREE_DAILY_LIMIT) : 0;
}

/** True when today's free allowance is spent. */
export function exceedsDailyLimit(userId: string | undefined): boolean {
  return aiUsageToday(userId) >= FREE_DAILY_LIMIT;
}

/** Record one AI analysis. Idempotent at the cap — never over-counts. */
export function incrementAiUsage(userId: string | undefined): number {
  const day = read(userId);
  day.count = Math.min(day.count + 1, FREE_DAILY_LIMIT);
  write(userId, day);
  return day.count;
}

/** Analyses remaining today. */
export function aiUsageRemaining(userId: string | undefined): number {
  return Math.max(0, FREE_DAILY_LIMIT - aiUsageToday(userId));
}
