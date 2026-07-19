/**
 * AI Router — decides WHICH agent (and model hint) handles a request, and
 * orchestrates the tool-calling / RAG loop around it. It separates "what
 * should answer this" from "how the answer is produced", so intents and
 * agents evolve independently.
 *
 * FOUNDATION ONLY: contracts + a deterministic intent→agent map (config, not
 * AI). Free-text intent inference is left unimplemented on purpose.
 */
import type { AgentId } from "../agents/types";

/** The set of things the AI OS can be asked to do. Explicit intents route
 *  deterministically; a free-text ask is classified by the router. */
export type AiIntent =
  | "chat"
  | "analyze_trade"
  | "daily_brief"
  | "weekly_review"
  | "detect_patterns"
  | "performance_review"
  | "psychology_check"
  | "assess_risk";

export interface RoutingRequest {
  userId: string;
  /** When set, routing is deterministic; when omitted, the router classifies. */
  intent?: AiIntent;
  input: string;
  language?: string;
  sessionId?: string;
}

export interface RoutingDecision {
  agent: AgentId;
  intent: AiIntent;
  /** Optional model hint the provider layer MAY honor (never required). */
  model?: string;
  /** Whether RAG retrieval should run before the agent. */
  useRetrieval: boolean;
  reason?: string;
}

export interface AIRouter {
  route(req: RoutingRequest): Promise<RoutingDecision>;
}

/** Deterministic mapping for explicit intents — pure configuration. */
export const INTENT_AGENT: Record<AiIntent, AgentId> = {
  chat: "coach",
  analyze_trade: "coach",
  daily_brief: "coach",
  weekly_review: "performance-analyst",
  detect_patterns: "pattern-finder",
  performance_review: "performance-analyst",
  psychology_check: "psychologist",
  assess_risk: "risk-manager",
};
