import type { Trade } from "@/app/types";
import type { TradeAnalysis } from "@/modules/trading/analysis/types";
import type { DisciplineViolation, DisciplineSummary } from "@/modules/discipline/types";
import type { AppNotification } from "@/modules/notifications/types";

/**
 * Domain events — the single vocabulary every engine speaks.
 *
 * Engines never call each other directly: they emit and subscribe here.
 * Adding a feature = adding an event + a listener, never editing another
 * engine. Payloads are frozen at emit time; treat them as read-only.
 */
export interface DomainEvents {
  // ── Trading lifecycle ──────────────────────────────────────────────
  TradeCreated: { userId: string; trade: Trade; allTrades: Trade[] };
  TradeUpdated: { userId: string; trade: Trade; allTrades: Trade[] };
  TradeDeleted: { userId: string; tradeId: string };
  TradeAnalyzed: { userId: string; trade: Trade; analysis: TradeAnalysis };

  // ── Discipline engine ──────────────────────────────────────────────
  DISCIPLINE_WARNING: { userId: string; violation: DisciplineViolation; trade: Trade };
  DISCIPLINE_LIMIT_REACHED: { userId: string; violation: DisciplineViolation; trade: Trade };
  DISCIPLINE_SUCCESS: { userId: string; summary: DisciplineSummary };

  // ── Goals & progression ────────────────────────────────────────────
  GoalUpdated: { userId: string; goalKind: string };
  GoalCompleted: { userId: string; goalKind: string };

  // ── AI core ────────────────────────────────────────────────────────
  DailyBriefReady: { userId: string; briefId: string };
  WeeklyReviewReady: { userId: string; reviewId: string };
  NewPatternDetected: { userId: string; pattern: string };

  // ── Notifications ──────────────────────────────────────────────────
  NotificationCreated: { userId: string; notification: AppNotification };

  // ── Time-based ─────────────────────────────────────────────────────
  DailyReset: { userId: string; date: string };

  // ── AI Operating System ────────────────────────────────────────────
  // Payloads use primitive types on purpose: the core event bus must not
  // depend on the modules/ai layer (dependency points ai → core, never back).
  AgentRunStarted: { userId: string; runId: string; agent: string; intent: string };
  AgentRunCompleted: { userId: string; runId: string; agent: string; status: "ok" | "error" };
  AiJobEnqueued: { userId: string; jobId: string; kind: string };
  AiJobCompleted: { userId: string; jobId: string; kind: string; status: "done" | "failed" };
  DocumentIndexed: { userId: string; source: string; sourceId: string };
  AiNotificationRequested: { userId: string; agent: string; message: string };
}

export type DomainEventName = keyof DomainEvents;

export type EventHandler<K extends DomainEventName> = (
  payload: DomainEvents[K],
) => void | Promise<void>;
