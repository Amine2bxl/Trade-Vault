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
    if (notification.channels.includes("push")) {
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
    title: "Rule check",
    body: violation.message,
    severity: "warning",
    channels: ["dashboard", "toast", "push"],
    url: "/",
  });
});

events.on("DISCIPLINE_LIMIT_REACHED", async ({ userId, violation }) => {
  await NotificationEngine.notify(userId, {
    kind: "discipline_limit",
    title: "Limit reached",
    body: violation.message,
    severity: "error",
    channels: ["dashboard", "toast", "push"],
    url: "/",
  });
});

events.on("DISCIPLINE_SUCCESS", async ({ userId, summary }) => {
  await NotificationEngine.notify(userId, {
    kind: "discipline_success",
    title: "Clean session",
    body: `Day closed with ${summary.tradesToday} trade(s) and zero rule breaks.`,
    severity: "success",
    channels: ["dashboard"],
  });
});

export function activeNotificationUser(): string | null {
  return currentUserId;
}
