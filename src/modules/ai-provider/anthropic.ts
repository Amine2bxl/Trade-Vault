import type { AIProvider, AIRequest, AIResponse } from "./types";

/**
 * Anthropic Claude provider. Activates when ANTHROPIC_API_KEY is set and
 * AI_PROVIDER=anthropic — no application code changes needed to switch.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export const AnthropicProvider: AIProvider = {
  id: "anthropic",

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
        messages: turns.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const text: string = (json?.content ?? [])
      .map((b: { type?: string; text?: string }) => (b.type === "text" ? (b.text ?? "") : ""))
      .join("");
    return {
      text,
      provider: "anthropic",
      model: MODEL,
      usage: {
        inputTokens: json?.usage?.input_tokens,
        outputTokens: json?.usage?.output_tokens,
      },
    };
  },
};
