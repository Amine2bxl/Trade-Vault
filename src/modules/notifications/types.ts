/**
 * Centralized notification model. EVERY user-facing notification flows
 * through the Notification Engine — pages never toast/push directly for
 * domain events.
 */

export type NotificationChannel = "dashboard" | "toast" | "push" | "email" | "ai_message";

export type NotificationKind =
  | "discipline_warning"
  | "discipline_limit"
  | "discipline_success"
  | "trade_analyzed"
  | "goal_completed"
  | "daily_brief"
  | "weekly_review"
  | "pattern_detected"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** In-app link target (page id or path). */
  url?: string;
  severity: "info" | "success" | "warning" | "error";
  channels: NotificationChannel[];
  createdAt: string;
  readAt?: string | null;
  /** Structured payload for rich rendering (analysis object, brief id…). */
  data?: Record<string, unknown>;
}

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  url?: string;
  severity?: AppNotification["severity"];
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
  /** Skip DB persistence (pure toast). Defaults to false. */
  ephemeral?: boolean;
}

/** Injected adapters — the engine stays free of React/hooks/server imports. */
export interface NotificationAdapters {
  /** In-app toast (ToastContext). */
  toast?: (message: string, type: "success" | "error" | "info") => void;
  /** Web-push sender (server function wrapper). */
  push?: (payload: { title: string; body: string; url?: string }) => Promise<unknown>;
  /** Persist to the notifications table. */
  persist?: (n: AppNotification) => Promise<void>;
}
