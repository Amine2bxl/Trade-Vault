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
import { localDateOf, todayLocalDate } from "@/shared/calendar-date";
import type { CalendarEvent } from "../economic-calendar/types";
import { reglesEconomiques } from "./economic";

export interface RuleContext {
  trades: Array<{ date: string; pnl: number; mistakes: string[] }>;
  stats: {
    totalPnl: number;
    winRate: number;
    tradeCount: number;
    mistakeStats: Record<string, { count: number; totalPnl: number }>;
  };
  rulesEnabled: number;
  /**
   * Tendance PAR erreur, déjà calculée par `computeBehavioral`. Optionnel :
   * une absence signifie « pas mesuré », jamais « pas de progrès ».
   */
  mistakeTrends?: { mistake: string; deltaPct: number; recent: number; previous: number }[];
  /** Tenue des règles, déjà calculée par `computeRuleAdherence`. */
  adherence?: { text: string; kept: number; applicable: number; ratePct: number }[];
  /**
   * Le calendrier économique de la semaine en cours.
   *
   * C'est la SEULE donnée du contexte qui ne vienne pas du journal : le trader
   * ne peut pas la déduire de ses trades, et elle porte une heure limite. Tout
   * le reste peut attendre qu'il ouvre la page ; une publication à fort impact
   * dans un quart d'heure, non.
   *
   * Optionnel : une absence signifie « calendrier pas encore chargé », jamais
   * « aucun événement ». Rien ne doit être affirmé sur cette base.
   */
  economicEvents?: CalendarEvent[];
}

/**
 * Seuils d'émission — délibérément HAUTS.
 *
 * Une observation notifiée tous les jours devient du bruit, et un canal
 * bruyant se fait désactiver : on perd alors le canal ENTIER, y compris les
 * alertes qui comptent. Mieux vaut se taire souvent et être écouté quand on
 * parle.
 */
const TREND_NOTIFY_PCT = 30;
const ADHERENCE_NOTIFY_PCT = 60;
/** Sous ce nombre d'occurrences, une variation n'est pas un signal. */
const MIN_SAMPLE = 3;

export interface CodedRule {
  key: string;
  input: NotificationInput;
  /**
   * UNE RÈGLE QUI INTERROMPT NE SE RÉPÈTE PAS TOUS LES JOURS.
   *
   * ── LE DÉFAUT QUE CE DRAPEAU CORRIGE ───────────────────────────────────
   *
   * Le journal de déduplication est remis à zéro chaque jour, et les clés des
   * deux règles `error` portaient la DATE (`…:${today}`). Conséquence : une
   * condition qui DURE — trois pertes d'affilée, une erreur répétée dans les
   * quinze derniers trades — repartait à chaque nouvelle journée. Le trader
   * recevait donc le même popup interrompant à chaque connexion, parfois
   * pendant des semaines, pour un fait qui n'avait pas bougé. Le popup a
   * cessé de vouloir dire « regarde ça » pour devenir « bonjour ».
   *
   * Un popup se mérite : il doit signaler qu'une chose vient d'ARRIVER, pas
   * qu'une chose reste vraie. Les règles marquées `once` sont donc dédupliquées
   * sur une clé qui décrit l'ÉVÉNEMENT (sa magnitude, sa date d'occurrence) et
   * dans un journal qui SURVIT au changement de jour. Tant que rien de nouveau
   * ne se produit, la clé est identique et rien ne repart ; dès que la série
   * s'allonge ou que l'erreur est refaite, la clé change et l'alerte revient.
   */
  once?: boolean;
}

/**
 * Au-delà de ce nombre de jours, un fait ne justifie plus d'interrompre.
 *
 * Une série de pertes vieille de trois semaines est de l'histoire : elle a sa
 * place dans la boîte de réception et dans les statistiques, pas dans un
 * popup au milieu de l'écran. Sans ce garde-fou, un compte laissé de côté puis
 * rouvert accueillait son propriétaire par une alerte sur des trades qu'il
 * avait oubliés.
 */
const INTERRUPT_MAX_AGE_DAYS = 3;

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
  const today = todayLocalDate();

  /* ── ÉCONOMIE — la seule alerte DATÉE du produit ────────────────────────
     Elle passe en tête parce qu'elle est la seule à avoir une heure limite :
     une fuite dans le journal se lira aussi bien demain, une publication à
     fort impact dans quinze minutes, non. Voir `economic.ts` pour ce qui
     déclenche et, surtout, pour tout ce qui se tait. */
  if (ctx.economicEvents?.length) {
    rules.push(...reglesEconomiques(ctx.economicEvents, new Date(), fr));
  }

  const sorted = [...ctx.trades].sort((a, b) => b.date.localeCompare(a.date));

  // ── RISK — série de pertes (3 consécutives) ─────────────────────────────
  let streak = 0;
  for (const t of sorted) {
    if (t.pnl < 0) streak += 1;
    else break;
    if (streak >= 3) break;
  }
  // La série n'interrompt QUE si elle est fraîche, et sa clé porte la date de
  // la dernière perte : la même série reste silencieuse, une perte de plus la
  // rallonge et redéclenche, une nouvelle série plus tard redéclenche aussi.
  if (streak >= 3 && daysAgo(sorted[0].date) <= INTERRUPT_MAX_AGE_DAYS) {
    rules.push({
      once: true,
      key: `risk_loss_streak:${streak}:${sorted[0].date}`,
      input: jarvis({
        kind: "risk_loss_streak",
        title: fr ? "Série de pertes détectée" : "Losing streak detected",
        body: fr
          ? `${streak} pertes consécutives. C'est un signal de tilt ou de sur-trading — pas une fatalité.`
          : `${streak} consecutive losses. A tilt or over-trading signal — not bad luck.`,
        /* `error`, PAS `warning` — et c'est la seule règle qui l'obtienne.
           Trois pertes d'affilée est le seul moment où le produit doit
           INTERROMPRE : c'est là qu'un compte se perd, et un toast de trois
           secondes ne suffit pas. La sévérité `error` ouvre le popup de
           détail à l'écran (voir `App.tsx`), avec le plan d'action.
           Les autres règles restent en `warning` : un popup par séance ne
           voudrait plus rien dire. */
        severity: "error",
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

  // ── RISK — un pattern d'erreur QUI SE RÉPÈTE (à ne plus refaire) ───────
  // « Erreur ultime » : la même erreur revient au moins trois fois sur les
  // quinze derniers trades. C'est plus précis que la fuite cumulée — ça isole
  // une HABITUDE en train de se répéter, ici et maintenant, et la seule bonne
  // réponse est « il faut agir ». Sévérité `error` : elle ouvre le popup.
  const motive = [...sorted.slice(0, 15).reverse()]; // 15 plus récents, en ordre
  const recentMistakes = new Map<string, number>();
  for (const t of motive)
    for (const m of t.mistakes) recentMistakes.set(m, (recentMistakes.get(m) ?? 0) + 1);
  const repeated = [...recentMistakes.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, n }))[0];
  // La date de la DERNIÈRE fois où cette erreur a été commise — c'est elle qui
  // identifie l'événement. Tant que le trader ne la refait pas, la clé ne
  // bouge pas et le popup reste fermé ; il la refait, la clé change, l'alerte
  // repart. C'est exactement le moment où elle sert à quelque chose.
  const derniereOccurrence = repeated
    ? (sorted.find((t) => t.mistakes.includes(repeated.name))?.date ?? "")
    : "";
  if (repeated && derniereOccurrence && daysAgo(derniereOccurrence) <= INTERRUPT_MAX_AGE_DAYS) {
    rules.push({
      once: true,
      key: `recurring_mistake:${repeated.name}:${derniereOccurrence}`,
      input: jarvis({
        kind: "recurring_mistake",
        title: fr
          ? `« ${repeated.name} » : tu le refais encore`
          : `"${repeated.name}": you keep doing this`,
        body: fr
          ? `${repeated.n} fois sur tes 15 derniers trades. C'est ton erreur la plus répétée — tant qu'elle revient, elle te coûte.`
          : `${repeated.n} times in your last 15 trades. It's your most repeated mistake — as long as it returns, it costs you.`,
        severity: "error",
        url: "/mistakes",
        category: "risk",
        data: {
          plan: fr
            ? `Ajoute « ${repeated.name} » en règle de checklist et bloque 1 trade dès qu'elle réapparaît.`
            : `Add "${repeated.name}" as a checklist rule and pause 1 trade the moment it reappears.`,
          ctaLabel: fr ? "Corriger ce pattern" : "Fix this pattern",
          ctaPage: "mistakes",
          mistake: repeated.name,
          count: repeated.n,
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
      key: `weekly_review:${localDateOf(monday)}`,
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

  // ── JARVIS — bilan de la dernière journée TRADÉE (une fois / jour) ──────
  // La revue de fin de journée (Step 6C). Ne se déclenche que pour une journée
  // TERMINÉE (≥1 jour) : on ne commente pas une journée encore en cours. Une
  // seule priorité citée — jamais une liste de conseils.
  if (last && daysAgo(last) >= 1) {
    const dayTrades = ctx.trades.filter((t) => t.date === last);
    const dayPnl = dayTrades.reduce((s, t) => s + t.pnl, 0);
    const counts = new Map<string, number>();
    for (const t of dayTrades) for (const m of t.mistakes) counts.set(m, (counts.get(m) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const sign = dayPnl >= 0 ? "+" : "";
    const body = fr
      ? `${dayTrades.length} trade(s), ${sign}${Math.round(dayPnl)} $.${top ? ` Point à corriger : « ${top[0]} » (${top[1]}×).` : ""}`
      : `${dayTrades.length} trade(s), ${sign}$${Math.round(dayPnl)}.${top ? ` Fix this: "${top[0]}" (${top[1]}×).` : ""}`;
    rules.push({
      key: `daily_review:${last}`,
      input: jarvis({
        kind: "daily_review",
        title: fr ? "Ton bilan de la veille" : "Yesterday's review",
        body,
        severity: dayPnl < 0 ? "warning" : "info",
        url: "/journal",
        category: "jarvis",
        data: {
          plan: top
            ? fr
              ? `Une seule priorité demain : éliminer « ${top[0]} ».`
              : `One priority tomorrow: eliminate "${top[0]}".`
            : fr
              ? "Garde le même process demain."
              : "Keep the same process tomorrow.",
          ctaLabel: fr ? "Voir le journal" : "Open journal",
          ctaPage: "journal",
        },
      }),
    });
  }

  // ── PROGRÈS — une erreur RECULE nettement ──────────────────────────────
  // Le produit dit déjà les choses dures. Il doit aussi reconnaître un progrès
  // réel : c'est ce qui donne envie de continuer, et c'est chiffré, donc
  // crédible. On ne félicite JAMAIS sans preuve.
  const improving = (ctx.mistakeTrends ?? [])
    .filter((m) => m.deltaPct <= -TREND_NOTIFY_PCT && m.previous >= MIN_SAMPLE)
    .sort((a, b) => a.deltaPct - b.deltaPct)[0];
  if (improving) {
    const pct = Math.abs(improving.deltaPct);
    rules.push({
      key: `pattern_improving:${improving.mistake}:${today}`,
      input: jarvis({
        kind: "pattern_detected",
        title: fr ? "Une de tes fuites recule" : "One of your leaks is receding",
        body: fr
          ? `« ${improving.mistake} » : ${improving.previous} fois sur la période précédente, ${improving.recent} sur la récente — ${pct} % de moins.`
          : `"${improving.mistake}": ${improving.previous} times last period, ${improving.recent} now — ${pct}% fewer.`,
        severity: "success",
        url: "/mistakes",
        category: "discipline",
        data: {
          plan: fr
            ? "Ce que tu fais différemment fonctionne. Identifie-le et garde-le."
            : "Whatever you changed is working. Name it and keep it.",
          ctaLabel: fr ? "Voir mes erreurs" : "View mistakes",
          ctaPage: "mistakes",
        },
      }),
    });
  }

  // ── DISCIPLINE — une règle MAL tenue ───────────────────────────────────
  // La règle la moins tenue, et seulement si elle a été réellement éprouvée.
  // Sans le seuil d'échantillon, un seul écart sur deux trades déclencherait
  // une alerte — le trader apprendrait à les ignorer.
  const slipping = (ctx.adherence ?? [])
    .filter((a) => a.ratePct < ADHERENCE_NOTIFY_PCT && a.applicable >= MIN_SAMPLE)
    .sort((a, b) => a.ratePct - b.ratePct)[0];
  if (slipping) {
    rules.push({
      key: `adherence_low:${slipping.text.slice(0, 40)}:${today}`,
      input: jarvis({
        kind: "discipline_warning",
        title: fr ? "Une règle t'échappe" : "A rule is slipping",
        body: fr
          ? `« ${slipping.text} » : tenue ${slipping.kept} fois sur ${slipping.applicable}.`
          : `"${slipping.text}": kept ${slipping.kept} of ${slipping.applicable} times.`,
        severity: "warning",
        url: "/checklist",
        category: "discipline",
        data: {
          plan: fr
            ? "Une règle qu'on ne tient pas est une règle mal calibrée, ou une règle qu'on ne veut pas. Ajuste-la ou retire-la."
            : "A rule you don't keep is either miscalibrated or unwanted. Adjust it or drop it.",
          ctaLabel: fr ? "Revoir mes règles" : "Review my rules",
          ctaPage: "checklist",
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
/**
 * Le journal des règles qui INTERROMPENT — celui qui ne se vide pas à minuit.
 *
 * Borné : une clé par événement, et seules les plus récentes sont conservées.
 * Sans plafond, le stockage local d'un trader actif depuis deux ans finirait
 * par porter des milliers d'entrées mortes.
 */
const ONCE_KEY = "tv.notif.once";
const ONCE_MAX = 200;

function lireJournalUnique(): string[] {
  try {
    const raw = localStorage.getItem(ONCE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Le runner déduplique et livre via l'engine (persist → inbox).
 *
 *  DEUX JOURNAUX, parce qu'il y a deux natures de notification :
 *   • les ordinaires se rappellent une fois par JOUR — c'est une cadence ;
 *   • celles qui ouvrent un popup se rappellent une fois par ÉVÉNEMENT, et
 *     l'événement ne se périme pas à minuit (voir `CodedRule.once`). */
export async function dispatchCodedNotifications(
  userId: string,
  ctx: RuleContext,
  notify: (userId: string, input: NotificationInput) => Promise<unknown>,
): Promise<number> {
  const candidates = evaluateNotificationRules(ctx);
  if (candidates.length === 0) return 0;

  const today = todayLocalDate();
  let log: { date: string; keys: string[] } = { date: today, keys: [] };
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) log = JSON.parse(raw) as typeof log;
    if (log.date !== today) log = { date: today, keys: [] };
  } catch {
    /* best-effort */
  }
  const once = lireJournalUnique();

  let sent = 0;
  for (const rule of candidates) {
    const journal = rule.once ? once : log.keys;
    if (journal.includes(rule.key)) continue;
    try {
      await notify(userId, rule.input);
      journal.push(rule.key);
      sent += 1;
    } catch (e) {
      console.error("[notifications] coded rule failed", e);
    }
  }
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    localStorage.setItem(ONCE_KEY, JSON.stringify(once.slice(-ONCE_MAX)));
  } catch {
    /* best-effort */
  }
  return sent;
}
