/**
 * AI telemetry — audit trail of every agent invocation (ai_agent_runs).
 *
 * Why a first-class record: an AI OS spends money and makes claims about a
 * user's trading, so every run must be observable (latency, tokens, cost),
 * attributable (which agent, which model), and reproducible (input/output
 * summaries). It also feeds per-user rate/cost governance later.
 *
 * Le writer vit dans `backend/telemetry.server.ts` (service role) : la table
 * n'a aucune politique d'insertion, pour qu'un client ne puisse pas fabriquer
 * de fausses métriques.
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
  /**
   * `fallback` = la réponse déterministe a été servie (aucun provider
   * disponible, ou texte vide). C'est un état DISTINCT d'une erreur : le
   * trader a bien obtenu une réponse fondée sur ses données. Les confondre
   * masquerait le taux de repli, qui est précisément ce qu'il faut surveiller.
   */
  status: "ok" | "error" | "fallback";
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
