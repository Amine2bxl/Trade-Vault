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
  | "goal_milestone"
  | "daily_brief"
  | "daily_review"
  | "after_trade_insight"
  | "weekly_review"
  | "pattern_detected"
  | "risk_loss_streak"
  | "risk_max_loss"
  | "activity_lull"
  | "economic_event"
  | "system";

/** Catégorie produit — pilote les filtres de la boîte de réception. */
export type NotificationCategory =
  | "discipline"
  | "goals"
  | "risk"
  | "jarvis"
  | "economic"
  | "activity"
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
  /** Catégorie de la boîte de réception (dérivée par défaut depuis `kind`). */
  category: NotificationCategory;
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
  category?: NotificationCategory;
  /** Structured payload: `plan` (plan d'action court), `ctaLabel`, `ctaPage`,
   *  et toute valeur métier utile au popup de détail. */
  data?: Record<string, unknown>;
  /** Skip DB persistence (pure toast). Defaults to false. */
  ephemeral?: boolean;
  /**
   * Anti-spam key for the PUSH channel only. When set, at most one push is
   * sent per key per day — the in-app toast and dashboard record still fire
   * every time (immediate feedback), but the phone isn't buzzed repeatedly
   * for the same recurring rule break.
   */
  dedupKey?: string;
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
