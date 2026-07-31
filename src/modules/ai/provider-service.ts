/**
 * AI Provider Service — the single entry point the platform uses to talk to a
 * model. It wraps the AI Runtime (`routeCompletion`) with the concerns a
 * platform needs and a chatbot skips:
 *
 *   - provider resolution (with an explicit override for tests / routing),
 *   - circuit breaker + per-provider timeouts + fallback chain,
 *   - a usage/telemetry hook fired on every call,
 *   - a provider-agnostic tool-calling loop (run tools → feed results → repeat).
 *
 * It stays business-agnostic: no personas, no prompts, no tools of its own.
 */
import {
  resolveToolCapableProvider,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "@/modules/ai-provider";
import type { ToolContext } from "./tools/types";
import {
  executeToolCalls,
  resultsToMessage,
  toProviderTools,
  toolCallsToAssistantMessage,
} from "./tools/runtime";
import { routeCompletion } from "./runtime/router";

export interface UsageEvent {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  ok: boolean;
}

export interface GenerateOptions {
  /** Override provider resolution (e.g. force a model family, or inject a fake in tests). */
  provider?: AIProvider;
  /** Fired once per provider call — the seam for `ai_agent_runs` telemetry. */
  onUsage?: (event: UsageEvent) => void;
  /** Contexte d'audit pour les logs runtime (jamais de contenu sensible). */
  meta?: { trades?: number };
}

/** One completion, routed through the AI Runtime (circuit breaker, per-provider
 *  timeouts, fallback chain, metrics, structured logs). Multi-clés : si la
 *  provider active échoue (quota, panne, timeout), bascule automatiquement sur
 *  la suivante configurée — aucune erreur ne se voit dans le chat. */
export async function generate(req: AIRequest, opts: GenerateOptions = {}): Promise<AIResponse> {
  return routeCompletion(req, { provider: opts.provider, meta: opts.meta, onUsage: opts.onUsage });
}

export interface ToolLoopOptions extends GenerateOptions {
  /** Names of registered tools the model may call. */
  tools: readonly string[];
  /** Identity/audit context passed to every tool execution. */
  toolContext: ToolContext;
  /** Max provider round-trips before forcing a final text answer (default 4). */
  maxIterations?: number;
  /** Allow side-effecting tools in this loop (default false — read-only). */
  allowSideEffects?: boolean;
}

/**
 * Runs the full tool-calling loop against a tool-capable provider:
 * call → if the model requested tools, execute them and feed results back →
 * repeat until the model answers or `maxIterations` is hit (then one final
 * tool-free call forces a text answer). Provider-agnostic.
 */
export async function runWithTools(req: AIRequest, opts: ToolLoopOptions): Promise<AIResponse> {
  const provider = opts.provider ?? resolveToolCapableProvider();
  const manifest = toProviderTools(opts.tools);
  const maxIterations = opts.maxIterations ?? 4;
  const messages = [...req.messages];

  for (let i = 0; i < maxIterations; i++) {
    const res = await generate(
      { ...req, messages, tools: manifest, toolChoice: "auto" },
      { provider, onUsage: opts.onUsage },
    );
    if (!res.toolCalls?.length) return res;

    const results = await executeToolCalls(res.toolCalls, opts.toolContext, {
      allowSideEffects: opts.allowSideEffects,
    });
    messages.push(toolCallsToAssistantMessage(res.toolCalls), resultsToMessage(results));
  }

  // Budget exhausted — force a final answer without tools.
  return generate({ ...req, messages }, { provider, onUsage: opts.onUsage });
}
