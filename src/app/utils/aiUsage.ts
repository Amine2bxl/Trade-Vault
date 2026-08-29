/**
 * Jarvis daily AI usage — a lightweight, LOCAL counter (no backend, no tokens).
 *
 * La limite dépend du palier (`LIMITS.<tier>.jarvisPerDay` : 3 en gratuit, 20
 * en Pro, aucune en Elite) et elle est donc passée en paramètre — la coder en
 * dur ici la ferait diverger du catalogue au premier changement d'offre.
 *
 * Le compteur vit dans localStorage : il survit aux rechargements et se remet à
 * zéro à minuit. C'est un garde-fou de CONFORT — il sert à AFFICHER « il te
 * reste 2 analyses aujourd'hui » sans aller interroger le serveur, pas à
 * empêcher quoi que ce soit : un compteur navigateur s'efface en trois clics.
 *
 * LA BARRIÈRE RÉELLE est `backend/require-pro.ts`, qui compte le même quota
 * dans Postgres (`consume_ai_quota_scoped`, portée `daily`) à partir du palier
 * lu en base. Ce n'était PAS le cas jusqu'ici : le serveur ne connaissait qu'un
 * plafond horaire global de 60 appels, identique pour tous les paliers, soit
 * 1 440 par jour pour un compte gratuit censé en avoir 3. Le commentaire qui
 * renvoyait ici vers le serveur décrivait une protection qui n'existait pas.
 *
 * Comme le quota quotidien fait partie de l'OFFRE (3 / 20 / illimité), il n'est
 * appliqué que lorsque la monétisation est active (`AI_REQUIRE_PRO`) —
 * exactement comme le paywall. Le plafond horaire anti-abus, lui, tourne
 * toujours.
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
