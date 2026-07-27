import { generateId } from "@/app/store";
import { events } from "@/modules/events";
import type { AppNotification, NotificationAdapters, NotificationInput } from "./types";

/**
 * Notification Engine — single funnel for everything the user is told.
 *
 * - Channels are adapters injected at app bootstrap (configure()): the
 *   engine has zero knowledge of React contexts or server functions.
 * - Domain listeners (discipline, AI…) are wired here, in ONE place —
 *   removing the scattered toast/push calls from pages.
 * - Each dispatched notification also emits NotificationCreated so any
 *   surface (badge counter, inbox page) can react live.
 */

let adapters: NotificationAdapters = {};
let currentUserId: string | null = null;

function toToastType(sev: AppNotification["severity"]): "success" | "error" | "info" {
  return sev === "success" ? "success" : sev === "info" ? "info" : "error";
}

/** UI language for notification copy — same source as the rule messages (tv.lang).
 *  Only fr/en, matching what the localized rule `body` actually produces. */
function isFr(): boolean {
  try {
    return (localStorage.getItem("tv.lang") ?? "en") === "fr";
  } catch {
    return false;
  }
}

/**
 * Push anti-spam: at most one push per dedupKey per day. Stored in localStorage
 * so it survives reloads; the record resets each calendar day. Returns true if
 * a push for this key was already sent today (i.e. it should be suppressed).
 */
const PUSH_LOG_KEY = "tv.notif.pushed";
function alreadyPushedToday(dedupKey: string): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(PUSH_LOG_KEY);
    const log = raw ? (JSON.parse(raw) as { date: string; keys: string[] }) : null;
    if (!log || log.date !== today) {
      localStorage.setItem(PUSH_LOG_KEY, JSON.stringify({ date: today, keys: [dedupKey] }));
      return false;
    }
    if (log.keys.includes(dedupKey)) return true;
    log.keys.push(dedupKey);
    localStorage.setItem(PUSH_LOG_KEY, JSON.stringify(log));
    return false;
  } catch {
    return false; // storage unavailable — fail open, never block a push
  }
}

export const NotificationEngine = {
  /** Called once at app bootstrap (and again when the user changes). */
  configure(userId: string | null, next: NotificationAdapters): void {
    currentUserId = userId;
    adapters = next;
  },

  /** Central dispatch — every channel fans out from here. */
  async notify(userId: string, input: NotificationInput): Promise<AppNotification> {
    const notification: AppNotification = {
      id: generateId(),
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      url: input.url,
      severity: input.severity ?? "info",
      channels: input.channels ?? ["dashboard", "toast"],
      createdAt: new Date().toISOString(),
      readAt: null,
      data: input.data,
    };

    if (notification.channels.includes("toast")) {
      adapters.toast?.(notification.body, toToastType(notification.severity));
    }
    // Push is deduplicated (once per key per day); toast + persist are not.
    const suppressPush = input.dedupKey ? alreadyPushedToday(input.dedupKey) : false;
    if (notification.channels.includes("push") && !suppressPush) {
      await adapters
        .push?.({ title: notification.title, body: notification.body, url: notification.url })
        .catch(() => {});
    }
    if (!input.ephemeral && notification.channels.includes("dashboard")) {
      await adapters.persist?.(notification).catch((e) => {
        console.error("[notifications] persist failed", e);
      });
    }

    events.emit("NotificationCreated", { userId, notification });
    return notification;
  },
};

// ── Domain wiring — the ONLY place discipline events become user-facing ──────

events.on("DISCIPLINE_WARNING", async ({ userId, violation }) => {
  await NotificationEngine.notify(userId, {
    kind: "discipline_warning",
    title: isFr() ? "Rappel de règle" : "Rule check",
    body: violation.message,
    severity: "warning",
    channels: ["dashboard", "toast", "push"],
    url: "/",
    // One push per broken rule kind per day — recurring breaks don't spam.
    dedupKey: `discipline_warning:${violation.rule.kind}`,
  });
});

events.on("DISCIPLINE_LIMIT_REACHED", async ({ userId, violation }) => {
  await NotificationEngine.notify(userId, {
    kind: "discipline_limit",
    title: isFr() ? "Limite atteinte" : "Limit reached",
    body: violation.message,
    severity: "error",
    channels: ["dashboard", "toast", "push"],
    url: "/",
    dedupKey: `discipline_limit:${violation.rule.kind}`,
  });
});

events.on("DISCIPLINE_SUCCESS", async ({ userId, summary }) => {
  await NotificationEngine.notify(userId, {
    kind: "discipline_success",
    title: isFr() ? "Séance propre" : "Clean session",
    body: isFr()
      ? `Journée clôturée : ${summary.tradesToday} trade(s), zéro écart.`
      : `Day closed with ${summary.tradesToday} trade(s) and zero rule breaks.`,
    severity: "success",
    channels: ["dashboard"],
  });
});

export function activeNotificationUser(): string | null {
  return currentUserId;
}
