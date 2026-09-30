import type {
  AppNotification,
  NotificationCategory,
  NotificationKind,
} from "@/modules/notifications/types";
import type { TKey } from "@/app/i18n/translations";
import { encodeFilter, type UnifiedFilter } from "@/app/trading/tradeFilter";

/* Ce que la boîte de réception et le popup de détail partagent : le nom de
   chaque catégorie, la raison d'être de chaque kind, et la destination d'une
   notification. */

/** Le libellé de chaque catégorie — partagé avec la boîte de réception. */
export const CATEGORY_LABEL: Record<NotificationCategory, TKey> = {
  discipline: "inbox.filterDiscipline",
  goals: "inbox.filterGoals",
  risk: "inbox.filterRisk",
  jarvis: "inbox.filterJarvis",
  economic: "inbox.filterEconomic",
  activity: "inbox.filterActivity",
  system: "inbox.catSystem",
};

/**
 * POURQUOI CETTE NOTIFICATION EXISTE — la règle qui l'a émise, en une ligne.
 * « On ne comprend pas pourquoi elles apparaissent » : chaque kind porte
 * désormais sa raison, affichée sous le texte.
 */
export const WHY_KEY: Partial<Record<NotificationKind, TKey>> = {
  risk_loss_streak: "inbox.why.lossStreak",
  recurring_mistake: "inbox.why.recurringMistake",
  risk_max_loss: "inbox.why.costliestMistake",
  activity_lull: "inbox.why.activityLull",
  weekly_review: "inbox.why.weeklyReview",
  daily_review: "inbox.why.dailyReview",
  pattern_detected: "inbox.why.pattern",
  discipline_warning: "inbox.why.ruleClose",
  discipline_limit: "inbox.why.ruleBroken",
  discipline_success: "inbox.why.rulesArmed",
  after_trade_insight: "inbox.why.afterTrade",
  economic_event: "inbox.why.economic",
};

function pageFrom(n: AppNotification): string {
  const cta = (n.data?.ctaPage as string | undefined) ?? "";
  if (
    [
      "dashboard",
      "inbox",
      "journal",
      "checklist",
      "calendar",
      "analytics",
      "mistakes",
      "missed",
      "insights",
      "news",
      "seasonality",
      "calculator",
      "settings",
      "reports",
      "goals",
      "tradingplan",
      "appearance",
      "subscription",
      "profile",
    ].includes(cta)
  )
    return cta;
  const url = n.url ?? "";
  if (url.startsWith("/journal")) return "journal";
  if (url.startsWith("/mistakes")) return "mistakes";
  if (url.startsWith("/checklist")) return "checklist";
  if (url.startsWith("/reports")) return "reports";
  if (url.startsWith("/inbox")) return "inbox";
  return "dashboard";
}

/** Où mène une notification : la page, et le FILTRE du deep-link (ex. « voir
 *  CE trade ») porté par le canal `tv:navigate`, qui pose `?f=`. */
export function notificationTarget(n: AppNotification): { page: string; filter?: string } {
  const filter = (n.data?.filter as UnifiedFilter | undefined) ?? undefined;
  return { page: pageFrom(n), ...(filter ? { filter: encodeFilter(filter) } : {}) };
}
