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
  resolveToolCapableProviders,
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
import { circuit } from "./runtime/circuit";

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
  const all = opts.provider ? [opts.provider] : resolveToolCapableProviders();
  /* Les fournisseurs dont le circuit est ouvert passent en DERNIER, pas nulle
     part : chacun est appelé avec un fournisseur imposé, qui court-circuite le
     tri du routeur — sans ce classement, la boucle réessayait d'abord celui qui
     venait de tomber. */
  const candidates = [
    ...all.filter((p) => !circuit.isCoolingDown(p.id)),
    ...all.filter((p) => circuit.isCoolingDown(p.id)),
  ];
  if (candidates.length === 0) {
    throw new Error(
      "No tool-capable AI provider is configured. Set GEMINI_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY.",
    );
  }
  const manifest = toProviderTools(opts.tools);
  const maxIterations = opts.maxIterations ?? 4;
  const messages = [...req.messages];

  /* LE PREMIER TOUR CHOISIT LE FOURNISSEUR. On essaie chaque fournisseur
     capable d'outils, dans l'ordre, jusqu'à ce que l'un réponde ; la suite de
     la conversation reste sur celui-là (changer de modèle au milieu d'une
     boucle d'outils mélangerait deux raisonnements). */
  let provider: AIProvider = candidates[0];
  let res: AIResponse | null = null;
  let lastErr: unknown = null;
  for (const candidate of candidates) {
    try {
      res = await generate(
        { ...req, messages, tools: manifest, toolChoice: "auto" },
        { provider: candidate, onUsage: opts.onUsage },
      );
      provider = candidate;
      break;
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] tool loop: ${candidate.id} failed, trying next provider`);
    }
  }
  if (!res) throw lastErr ?? new Error("No tool-capable AI provider answered.");

  for (let i = 0; i < maxIterations; i++) {
    if (i > 0) {
      res = await generate(
        { ...req, messages, tools: manifest, toolChoice: "auto" },
        { provider, onUsage: opts.onUsage },
      );
    }
    if (!res.toolCalls?.length) return res;

    const results = await executeToolCalls(res.toolCalls, opts.toolContext, {
      allowSideEffects: opts.allowSideEffects,
    });
    messages.push(toolCallsToAssistantMessage(res.toolCalls), resultsToMessage(results));
  }

  // Budget exhausted — force a final answer without tools.
  return generate({ ...req, messages }, { provider, onUsage: opts.onUsage });
}
