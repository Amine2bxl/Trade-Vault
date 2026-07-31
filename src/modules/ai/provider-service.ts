/**
 * AI Provider Service — the single entry point the platform uses to talk to a
 * model. It wraps the provider layer (`resolveProvider`) with the concerns a
 * platform needs and a chatbot skips:
 *
 *   - provider resolution (with an explicit override for tests / routing),
 *   - one automatic retry on transient failures,
 *   - a usage/telemetry hook fired on every call,
 *   - a provider-agnostic tool-calling loop (run tools → feed results → repeat).
 *
 * It stays business-agnostic: no personas, no prompts, no tools of its own.
 */
import {
  resolveProvider,
  resolveProviders,
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
  /** Retries on transient errors (default 1). */
  retries?: number;
}

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset")
  );
}

async function callOnce(
  provider: AIProvider,
  req: AIRequest,
  onUsage?: (e: UsageEvent) => void,
): Promise<AIResponse> {
  const started = Date.now();
  try {
    const res = await provider.complete(req);
    onUsage?.({
      provider: res.provider,
      model: res.model,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
      latencyMs: Date.now() - started,
      ok: true,
    });
    return res;
  } catch (e) {
    onUsage?.({
      provider: provider.id,
      model: "unknown",
      latencyMs: Date.now() - started,
      ok: false,
    });
    throw e;
  }
}

/** One completion, with provider resolution, retry and telemetry.
 *  Multi-clés : si la provider active échoue (quota, panne), on bascule
 *  automatiquement sur la suivante configurée — toutes les clés gratuites
 *  sont réellement utilisées, aucune erreur ne se voit dans le chat. */
export async function generate(req: AIRequest, opts: GenerateOptions = {}): Promise<AIResponse> {
  // Un override explicite (tests/routage) reste dédié : pas de bascule.
  const providers = opts.provider ? [opts.provider] : resolveProviders();
  const maxRetries = opts.retries ?? 1;
  let lastErr: unknown;

  for (const provider of providers) {
    let attempt = 0;
    while (true) {
      try {
        return await callOnce(provider, req, opts.onUsage);
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries && isTransient(e)) {
          attempt += 1;
          continue;
        }
        break; // provider en échec → suivante
      }
    }
    console.warn(`[ai] provider "${provider.id}" failed — trying the next one`, lastErr);
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("AI coach is not configured yet. Add a GEMINI_API_KEY (or another provider key).");
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
      { provider, onUsage: opts.onUsage, retries: opts.retries },
    );
    if (!res.toolCalls?.length) return res;

    const results = await executeToolCalls(res.toolCalls, opts.toolContext, {
      allowSideEffects: opts.allowSideEffects,
    });
    messages.push(toolCallsToAssistantMessage(res.toolCalls), resultsToMessage(results));
  }

  // Budget exhausted — force a final answer without tools.
  return generate({ ...req, messages }, { provider, onUsage: opts.onUsage, retries: opts.retries });
}
