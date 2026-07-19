/**
 * Background Jobs — durable, retryable async work for AI that must not block a
 * request: nightly Daily Briefs, Weekly Reviews, embedding backfills, periodic
 * pattern/risk scans. Jobs are rows (ai_jobs) so they survive restarts and are
 * claimed by a worker; the existing Vercel cron endpoints are the trigger.
 *
 * A JobHandler is a plug-in keyed by JobKind — same registry idiom as agents,
 * tools, and providers: add a handler, no scheduler rewrite.
 *
 * FOUNDATION ONLY: contracts + handler registry. No job runs anything yet.
 */

export type JobKind =
  | "daily_brief"
  | "weekly_review"
  | "embed_backfill"
  | "pattern_scan"
  | "risk_scan";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface AiJob<P = Record<string, unknown>> {
  id: string;
  userId: string;
  kind: JobKind;
  status: JobStatus;
  payload: P;
  /** When the job becomes eligible to run (defaults to now). */
  scheduledFor?: string;
  attempts: number;
  lastError?: string;
}

export interface JobHandler<P = Record<string, unknown>> {
  readonly kind: JobKind;
  /** Max attempts before the job is parked as failed. */
  readonly maxAttempts: number;
  run(job: AiJob<P>): Promise<void>;
}

/** Persistence contract for the queue (implemented over ai_jobs later). */
export interface JobQueue {
  enqueue<P>(userId: string, kind: JobKind, payload: P, scheduledFor?: string): Promise<string>;
  /** Atomically claim due jobs for this worker tick. */
  claimDue(limit: number): Promise<AiJob[]>;
  complete(id: string, result?: unknown): Promise<void>;
  fail(id: string, error: string): Promise<void>;
}

// ── Handler registry ─────────────────────────────────────────────────────────
const handlers = new Map<JobKind, JobHandler>();

export function registerJobHandler(handler: JobHandler): () => void {
  handlers.set(handler.kind, handler as JobHandler);
  return () => {
    if (handlers.get(handler.kind) === handler) handlers.delete(handler.kind);
  };
}

export function getJobHandler(kind: JobKind): JobHandler | undefined {
  return handlers.get(kind);
}
