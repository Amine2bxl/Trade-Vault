import type { AIProvider, AIRequest, AIResponse, FinishReason, ProviderToolCall } from "./types";

/**
 * Fournisseurs OpenAI-compatibles (Chat Completions API).
 *
 * Le même protocole sert OpenAI, Groq, OpenRouter, Together, un Ollama/vLLM
 * local… : une seule fabrique, une instance par fournisseur. Chaque instance
 * lit sa propre clé (jamais partagée) et son propre endpoint/modèle.
 *
 * Env par instance :
 *   openai      → OPENAI_API_KEY · OPENAI_BASE_URL · OPENAI_MODEL
 *   groq        → GROQ_API_KEY · GROQ_BASE_URL · GROQ_MODEL
 *   openrouter  → OPENROUTER_API_KEY · OPENROUTER_BASE_URL · OPENROUTER_MODEL
 */

interface OpenAIProviderConfig {
  id: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  modelEnv: string;
  defaultModel: string;
  defaultBaseUrl: string;
}

interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}
interface OpenAIChoice {
  message?: { content?: string | null; tool_calls?: OpenAIToolCall[] };
  finish_reason?: string;
}
interface OpenAIResponse {
  choices?: OpenAIChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function mapFinish(reason: string | undefined): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "content_filter":
      return "content_filter";
    default:
      return "unknown";
  }
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function createOpenAICompatibleProvider(cfg: OpenAIProviderConfig): AIProvider {
  const getModel = (): string => process.env[cfg.modelEnv] || cfg.defaultModel;
  const getBaseUrl = (): string =>
    (process.env[cfg.baseUrlEnv] || cfg.defaultBaseUrl).replace(/\/$/, "");

  return {
    id: cfg.id,
    supportsTools: true,

    isConfigured() {
      return Boolean(process.env[cfg.apiKeyEnv]);
    },

    async complete(req: AIRequest): Promise<AIResponse> {
      const apiKey = process.env[cfg.apiKeyEnv];
      if (!apiKey) throw new Error(`AI is not configured (missing ${cfg.apiKeyEnv}).`);

      const res = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(cfg.id === "openrouter" ? { "HTTP-Referer": "https://tradevault.be" } : {}),
        },
        body: JSON.stringify({
          model: getModel(),
          max_tokens: req.maxTokens ?? 4096,
          ...(req.temperature !== undefined && { temperature: req.temperature }),
          ...(req.json && { response_format: { type: "json_object" } }),
          ...(req.tools?.length && {
            tools: req.tools.map((t) => ({
              type: "function",
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
            tool_choice: req.toolChoice ?? "auto",
          }),
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        ...(req.signal ? { signal: req.signal } : {}),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429)
          throw new Error("Rate limit reached. Please try again in a moment.");
        if (res.status === 402 || res.status === 403)
          throw new Error("AI credits exhausted. Please add credits to continue.");
        throw new Error(`AI request failed: ${text.slice(0, 200)}`);
      }

      const json = (await res.json()) as OpenAIResponse;
      const choice = json.choices?.[0];
      const text = choice?.message?.content ?? "";

      const toolCalls: ProviderToolCall[] | undefined = choice?.message?.tool_calls
        ?.filter((c) => c.function?.name)
        .map((c) => ({
          id: c.id,
          name: c.function?.name ?? "",
          arguments: parseArguments(c.function?.arguments),
        }));

      return {
        text,
        provider: cfg.id,
        model: getModel(),
        usage: {
          inputTokens: json.usage?.prompt_tokens,
          outputTokens: json.usage?.completion_tokens,
        },
        ...(toolCalls?.length && { toolCalls }),
        finishReason: mapFinish(choice?.finish_reason),
      };
    },
  };
}

export const OpenAIProvider = createOpenAICompatibleProvider({
  id: "openai",
  apiKeyEnv: "OPENAI_API_KEY",
  baseUrlEnv: "OPENAI_BASE_URL",
  modelEnv: "OPENAI_MODEL",
  defaultModel: "gpt-4o-mini",
  defaultBaseUrl: "https://api.openai.com/v1",
});

/** Groq — modèles libres ultra-rapides (Llama, Mixtral…), OpenAI-compatible. */
export const GroqProvider = createOpenAICompatibleProvider({
  id: "groq",
  apiKeyEnv: "GROQ_API_KEY",
  baseUrlEnv: "GROQ_BASE_URL",
  modelEnv: "GROQ_MODEL",
  defaultModel: "llama-3.3-70b-versatile",
  defaultBaseUrl: "https://api.groq.com/openai/v1",
});

/** OpenRouter — des dizaines de modèles libres (:free) derrière une clé. */
export const OpenRouterProvider = createOpenAICompatibleProvider({
  id: "openrouter",
  apiKeyEnv: "OPENROUTER_API_KEY",
  baseUrlEnv: "OPENROUTER_BASE_URL",
  modelEnv: "OPENROUTER_MODEL",
  defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
});
