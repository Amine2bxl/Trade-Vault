import type { AIProvider, AIRequest, AIResponse, FinishReason, ProviderToolCall } from "./types";

/**
 * Anthropic Claude provider. Activates when ANTHROPIC_API_KEY is set and
 * AI_PROVIDER=anthropic — no application code changes needed to switch.
 *
 * Tool calling is additive: when `req.tools` is present it maps to Anthropic's
 * `tools` (JSON-Schema `input_schema`) and parses `tool_use` content blocks
 * into normalized `res.toolCalls`. Without tools the behaviour is unchanged.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

interface AnthropicBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}
interface AnthropicResponse {
  content?: AnthropicBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function mapFinish(reason: string | undefined): FinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    default:
      return "unknown";
  }
}

export const AnthropicProvider: AIProvider = {
  id: "anthropic",
  supportsTools: true,

  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async complete(req: AIRequest): Promise<AIResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing ANTHROPIC_API_KEY).");

    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const turns = req.messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: req.maxTokens ?? 4096,
        ...(system && { system }),
        ...(req.temperature !== undefined && { temperature: req.temperature }),
        ...(req.tools?.length && {
          tools: req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          })),
        }),
        messages: turns.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as AnthropicResponse;
    const blocks = json.content ?? [];
    const text = blocks.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");

    const toolCalls: ProviderToolCall[] | undefined = blocks
      .filter((b) => b.type === "tool_use" && b.name)
      .map((b) => ({ id: b.id, name: b.name ?? "", arguments: b.input ?? {} }));

    return {
      text,
      provider: "anthropic",
      model: MODEL,
      usage: {
        inputTokens: json.usage?.input_tokens,
        outputTokens: json.usage?.output_tokens,
      },
      ...(toolCalls?.length && { toolCalls }),
      finishReason: mapFinish(json.stop_reason),
    };
  },
};
