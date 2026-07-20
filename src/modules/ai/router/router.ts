/**
 * AI Router — resolves a request to a routing decision (which agent, which
 * model hint, whether to retrieve). Explicit intents route deterministically
 * via INTENT_AGENT (config); free-text is handed to an optional, injectable
 * classifier, falling back to a default intent when none is provided.
 *
 * The classifier is a seam, not a hardcoded model call, so intent inference can
 * be added/swapped without touching the router. No agent is executed here —
 * routing only. Business agents are supplied elsewhere.
 */
import type { AgentId } from "../agents/types";
import type { AIRouter, AiIntent, RoutingDecision, RoutingRequest } from "./types";
import { INTENT_AGENT } from "./types";

/** Intents that benefit from RAG retrieval before the agent runs. */
const RETRIEVAL_INTENTS: ReadonlySet<AiIntent> = new Set<AiIntent>(["chat", "psychology_check"]);

export interface RouterOptions {
  /** Optional free-text → intent classifier (e.g. a small model call). */
  classify?: (req: RoutingRequest) => Promise<AiIntent | undefined>;
  /** Used when no explicit intent and the classifier is absent/undecided. */
  fallbackIntent?: AiIntent;
  /** Optional per-intent model hint the provider layer MAY honor. */
  selectModel?: (intent: AiIntent, req: RoutingRequest) => string | undefined;
}

function decide(
  intent: AiIntent,
  req: RoutingRequest,
  opts: RouterOptions,
  reason: string,
): RoutingDecision {
  const agent: AgentId = INTENT_AGENT[intent];
  return {
    agent,
    intent,
    useRetrieval: RETRIEVAL_INTENTS.has(intent),
    ...(opts.selectModel && { model: opts.selectModel(intent, req) }),
    reason,
  };
}

/** Build a router with the given policy. */
export function createRouter(opts: RouterOptions = {}): AIRouter {
  const fallback = opts.fallbackIntent ?? "chat";
  return {
    async route(req: RoutingRequest): Promise<RoutingDecision> {
      if (req.intent) return decide(req.intent, req, opts, "explicit-intent");
      if (opts.classify) {
        const inferred = await opts.classify(req);
        if (inferred) return decide(inferred, req, opts, "classified");
      }
      return decide(fallback, req, opts, "fallback");
    },
  };
}

/** Default router: deterministic on explicit intent, falls back to `chat`. */
export const defaultRouter: AIRouter = createRouter();
