/**
 * Coded notification rules — Jarvis "thinks" locally, without any AI call.
 *
 * A deterministic rule engine turns the trader's real data into short,
 * contextualized notifications written in Jarvis's voice. Zero tokens, zero
 * network, fully personalized. Categories covered: Risk, Activité, Jarvis
 * (revue hebdo) — Discipline is already handled by the live discipline events
 * (DISCIPLINE_WARNING / LIMIT / SUCCESS in the engine).
 *
 * Every rule returns a STABLE key so the runner can fire it once per day
 * (dedup in localStorage) — no inbox spam.
 */

import type { NotificationInput } from "./types";

export interface RuleContext {
  trades: Array<{ date: string; pnl: number; mistakes: string[] }>;
  stats: {
    totalPnl: number;
    winRate: number;
    tradeCount: number;
    mistakeStats: Record<string, { count: number; totalPnl: number }>;
  };
  rulesEnabled: number;
}

export interface CodedRule {
  key: string;
  input: NotificationInput;
}

function isFr(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (localStorage.getItem("tv.lang") ?? "en") === "fr";
  } catch {
    return false;
  }
}

const daysAgo = (iso: string): number => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
};

/** Jarvis signs everything: short title, actionable body, plan d'action. */
function jarvis(partial: NotificationInput): NotificationInput {
  return {
    channels: ["dashboard"],
    category: "jarvis",
    url: "/",
    data: {},
    ...partial,
  };
}

/**
 * Pure evaluation — given the trader's data, which notifications SHOULD exist
 * today? Returns stable keys + fully-formed inputs. No side effects.
 */
export function evaluateNotificationRules(ctx: RuleContext): CodedRule[] {
  const fr = isFr();
  const rules: CodedRule[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const sorted = [...ctx.trades].sort((a, b) => b.date.localeCompare(a.date));

  // ── RISK — série de pertes (3 consécutives) ─────────────────────────────
  let streak = 0;
  for (const t of sorted) {
    if (t.pnl < 0) streak += 1;
    else break;
    if (streak >= 3) break;
  }
  if (streak >= 3) {
    rules.push({
      key: `risk_loss_streak:${today}`,
      input: jarvis({
        kind: "risk_loss_streak",
        title: fr ? "Série de pertes détectée" : "Losing streak detected",
        body: fr
          ? `${streak} pertes consécutives. C'est un signal de tilt ou de sur-trading — pas une fatalité.`
          : `${streak} consecutive losses. A tilt or over-trading signal — not bad luck.`,
        severity: "warning",
        url: "/journal",
        category: "risk",
        data: {
          plan: fr
            ? "Arrête de trader, réduis la taille (moitié), et revois le setup AVANT le prochain trade."
            : "Stop trading, halve your size, and review the setup BEFORE the next trade.",
          ctaLabel: fr ? "Revoir mes trades" : "Review my trades",
          ctaPage: "journal",
          streak,
        },
      }),
    });
  }

  // ── RISK — la fuite la plus coûteuse ────────────────────────────────────
  const worst = Object.entries(ctx.stats.mistakeStats ?? {})
    .map(([name, v]) => ({ name, ...v }))
    .filter((m) => m.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl)[0];
  if (worst) {
    rules.push({
      key: `risk_leak:${worst.name}:${today}`,
      input: jarvis({
        kind: "risk_max_loss",
        title: fr ? "La fuite qui te coûte le plus" : "Your most expensive leak",
        body: fr
          ? `« ${worst.name} » t'a coûté ${Math.abs(Math.round(worst.totalPnl))} $ en ${worst.count} fois. C'est le premier truc à corriger.`
          : `"${worst.name}" cost you $${Math.abs(Math.round(worst.totalPnl))} across ${worst.count} trades. Fix this first.`,
        severity: "warning",
        url: "/mistakes",
        category: "risk",
        data: {
          plan: fr
            ? `Ajoute une règle contre « ${worst.name} » dans ta checklist, puis vérifie-la avant chaque trade.`
            : `Add a rule against "${worst.name}" to your checklist, then check it before every trade.`,
          ctaLabel: fr ? "Voir les erreurs" : "View mistakes",
          ctaPage: "mistakes",
          mistake: worst.name,
        },
      }),
    });
  }

  // ── ACTIVITÉ — aucune session depuis 5 jours ────────────────────────────
  const last = sorted[0]?.date;
  if (last && daysAgo(last) >= 5) {
    rules.push({
      key: `activity_lull:${today}`,
      input: jarvis({
        kind: "activity_lull",
        title: fr ? "Cinq jours sans session" : "Five days without a session",
        body: fr
          ? "Une pause est saine, mais ta discipline se construit à la fréquence. Reprends avec un mini-objectif."
          : "Breaks are healthy, but discipline compounds with frequency. Resume with a mini-goal.",
        severity: "info",
        url: "/dashboard",
        category: "activity",
        data: {
          plan: fr
            ? "Planifie 1 session, 2 trades max, et note le setup attendu avant de cliquer."
            : "Plan 1 session, max 2 trades, and write the setup you are waiting for before clicking.",
          ctaLabel: fr ? "Ouvrir le tableau de bord" : "Open dashboard",
          ctaPage: "dashboard",
          days: daysAgo(last),
        },
      }),
    });
  }

  // ── JARVIS — revue hebdomadaire (le lundi) ──────────────────────────────
  const week = new Date();
  const monday = new Date(week);
  monday.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  if (week.getDay() === 1 && ctx.stats.tradeCount >= 5) {
    rules.push({
      key: `weekly_review:${monday.toISOString().slice(0, 10)}`,
      input: jarvis({
        kind: "weekly_review",
        title: fr ? "Ta revue de la semaine" : "Your weekly review",
        body: fr
          ? `${ctx.stats.tradeCount} trades, ${Math.round((ctx.stats.winRate ?? 0) * 100)}% gagnés, ${Math.round(ctx.stats.totalPnl)} $ au total.`
          : `${ctx.stats.tradeCount} trades, ${Math.round((ctx.stats.winRate ?? 0) * 100)}% win rate, $${Math.round(ctx.stats.totalPnl)} net.`,
        severity: "info",
        url: "/reports",
        category: "jarvis",
        data: {
          plan: fr
            ? "Compare tes 3 meilleurs trades à tes 3 pires : qu'est-ce qui les sépare vraiment ?"
            : "Compare your 3 best trades to your 3 worst: what really separates them?",
          ctaLabel: fr ? "Ouvrir mes rapports" : "Open reports",
          ctaPage: "reports",
        },
      }),
    });
  }

  // ── DISCIPLINE — règle(s) armée(s) : Jarvis veille ─────────────────────
  if (ctx.rulesEnabled > 0) {
    rules.push({
      key: `discipline_armed:${today}`,
      input: jarvis({
        kind: "discipline_success",
        title: fr ? "Ta discipline est armée" : "Your discipline is armed",
        body: fr
          ? `${ctx.rulesEnabled} règle${ctx.rulesEnabled > 1 ? "s" : ""} active${ctx.rulesEnabled > 1 ? "s" : ""} : chaque trade sera vérifié automatiquement.`
          : `${ctx.rulesEnabled} rule${ctx.rulesEnabled > 1 ? "s" : ""} active: every trade is checked automatically.`,
        severity: "success",
        url: "/checklist",
        category: "discipline",
        data: {
          plan: fr
            ? "Rien à faire : continue à logger tes trades, Jarvis signale les écarts."
            : "Nothing to do: keep logging trades, Jarvis flags the breaks.",
          ctaLabel: fr ? "Voir ma checklist" : "View checklist",
          ctaPage: "checklist",
        },
      }),
    });
  }

  return rules;
}

const LOG_KEY = "tv.notif.coded";

/** Le runner déduplique par jour et livre via l'engine (persist → inbox). */
export async function dispatchCodedNotifications(
  userId: string,
  ctx: RuleContext,
  notify: (userId: string, input: NotificationInput) => Promise<unknown>,
): Promise<number> {
  const candidates = evaluateNotificationRules(ctx);
  if (candidates.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let log: { date: string; keys: string[] } = { date: today, keys: [] };
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) log = JSON.parse(raw) as typeof log;
    if (log.date !== today) log = { date: today, keys: [] };
  } catch {
    /* best-effort */
  }

  let sent = 0;
  for (const rule of candidates) {
    if (log.keys.includes(rule.key)) continue;
    try {
      await notify(userId, rule.input);
      log.keys.push(rule.key);
      sent += 1;
    } catch (e) {
      console.error("[notifications] coded rule failed", e);
    }
  }
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* best-effort */
  }
  return sent;
}
