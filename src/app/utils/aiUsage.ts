/**
 * Jarvis daily AI usage — a lightweight, LOCAL counter (no backend, no tokens).
 *
 * La limite dépend du palier (`LIMITS.<tier>.jarvisPerDay` : 3 en gratuit, 20
 * en Pro, aucune en Elite) et elle est donc passée en paramètre — la coder en
 * dur ici la ferait diverger du catalogue au premier changement d'offre.
 *
 * Le compteur vit dans localStorage : il survit aux rechargements et se remet à
 * zéro à minuit. C'est un garde-fou de CONFORT, pas une barrière de sécurité —
 * le vrai contrôle est côté serveur (`backend/require-pro.ts`), parce qu'un
 * compteur navigateur s'efface en trois clics.
 */

import { LIMITS, type Tier } from "@/domain/plans";

/** La limite quotidienne d'un palier. `Infinity` = aucune. */
export function jarvisDailyLimit(tier: Tier): number {
  return LIMITS[tier].jarvisPerDay;
}

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

/** Analyses used today. */
export function aiUsageToday(userId: string | undefined): number {
  const day = read(userId);
  return day.date === todayKey() ? day.count : 0;
}

/** True when today's allowance for this tier is spent. */
export function exceedsDailyLimit(userId: string | undefined, limit: number): boolean {
  if (!Number.isFinite(limit)) return false;
  return aiUsageToday(userId) >= limit;
}

/** Record one AI analysis. */
export function incrementAiUsage(userId: string | undefined): number {
  const day = read(userId);
  day.count += 1;
  write(userId, day);
  return day.count;
}

/** Analyses remaining today for this tier. */
export function aiUsageRemaining(userId: string | undefined, limit: number): number {
  if (!Number.isFinite(limit)) return Infinity;
  return Math.max(0, limit - aiUsageToday(userId));
}
