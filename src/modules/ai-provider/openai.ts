import type {
  AIProvider,
  AIRequest,
  AIResponse,
  FinishReason,
  ProviderToolCall,
} from "./types";

/**
 * OpenAI-compatible provider. Talks the Chat Completions API, so it works with
 * OpenAI itself AND any OpenAI-compatible endpoint (OpenRouter, Together, Groq,
 * a local Ollama/vLLM server…) by pointing OPENAI_BASE_URL at it.
 *
 * Env:
 *   OPENAI_API_KEY   — credential (required to activate)
 *   OPENAI_MODEL     — model id (default "gpt-4o-mini")
 *   OPENAI_BASE_URL  — API root (default "https://api.openai.com/v1")
 *
 * Supports native function calling: `req.tools` → `tools`, and the model's
 * `tool_calls` → normalized `res.toolCalls`.
 */

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

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

export const OpenAIProvider: AIProvider = {
  id: "openai",
  supportsTools: true,

  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  async complete(req: AIRequest): Promise<AIResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing OPENAI_API_KEY).");

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
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
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
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
      provider: "openai",
      model: MODEL,
      usage: {
        inputTokens: json.usage?.prompt_tokens,
        outputTokens: json.usage?.completion_tokens,
      },
      ...(toolCalls?.length && { toolCalls }),
      finishReason: mapFinish(choice?.finish_reason),
    };
  },
};
