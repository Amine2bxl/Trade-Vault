/**
 * AI telemetry — audit trail of every agent invocation (ai_agent_runs).
 *
 * Why a first-class record: an AI OS spends money and makes claims about a
 * user's trading, so every run must be observable (latency, tokens, cost),
 * attributable (which agent, which model), and reproducible (input/output
 * summaries). It also feeds per-user rate/cost governance later.
 *
 * FOUNDATION ONLY: the record shape + a recorder contract. No writer yet.
 */
import type { AgentId } from "./agents/types";
import type { AiIntent } from "./router/types";

export interface AgentRun {
  id: string;
  userId: string;
  agent: AgentId;
  intent: AiIntent;
  provider: string;
  model: string;
  status: "ok" | "error";
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  /** Short, non-sensitive summaries — never the full prompt/answer. */
  inputSummary?: string;
  outputSummary?: string;
  error?: string;
  createdAt: string;
}

export interface TelemetryRecorder {
  record(run: Omit<AgentRun, "id" | "createdAt">): Promise<void>;
}
