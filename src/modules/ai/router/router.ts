/**
 * Default AI Router (foundation).
 *
 * - Explicit intents route deterministically via INTENT_AGENT (config).
 * - Free-text classification is intentionally NOT implemented yet: it needs a
 *   model call, which is an AI feature. The stub throws a clear error so the
 *   wiring is obvious when someone implements it.
 *
 * The orchestration loop (retrieve → agent.run → execute tool calls → loop)
 * is described in docs/AI-ARCHITECTURE.md and lives in the runtime, not here.
 */
import type { AIRouter, RoutingDecision, RoutingRequest } from "./types";
import { INTENT_AGENT } from "./types";

export const defaultRouter: AIRouter = {
  async route(req: RoutingRequest): Promise<RoutingDecision> {
    if (req.intent) {
      const agent = INTENT_AGENT[req.intent];
      return {
        agent,
        intent: req.intent,
        useRetrieval: req.intent === "chat" || req.intent === "psychology_check",
        reason: "explicit-intent",
      };
    }
    // Foundation: no free-text intent classification yet.
    throw new Error(
      "AIRouter: free-text intent classification is not implemented yet. " +
        "Pass an explicit `intent` for now.",
    );
  },
};
