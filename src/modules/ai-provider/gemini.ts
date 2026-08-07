import type { AIProvider, AIRequest, AIResponse } from "./types";

/**
 * Google Gemini provider. Server-side only — reads GEMINI_API_KEY.
 * Mirrors the REST mechanics of the legacy inlined insights endpoint.
 */

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/**
 * Thinking budget (Gemini 2.5+).
 *
 * These models reason before answering and, left alone, use a DYNAMIC budget:
 * the model decides how long to think, with no ceiling we control. Those tokens
 * are produced before the first visible character and are billed as output, so
 * an unbounded budget is the single largest source of variable latency here.
 *
 * Coaching answers interpret numbers that a deterministic engine already
 * computed — they need some reasoning, but not an open-ended budget. We cap it
 * rather than disable it: `0` would remove reasoning entirely and risk flatter,
 * less accurate synthesis, which is the opposite of what we want.
 *
 * Override with `GEMINI_THINKING_BUDGET` (0 disables, -1 restores dynamic) so
 * the trade-off can be tuned in production without a code change.
 */
function getThinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw !== undefined) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 512;
}

export const GeminiProvider: AIProvider = {
  id: "gemini",

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  },

  async complete(req: AIRequest): Promise<AIResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing GEMINI_API_KEY).");

    const system = req.messages.filter((m) => m.role === "system");
    const turns = req.messages.filter((m) => m.role !== "system");

    const res = await fetch(
      // API key goes in a header, not the query string, so it never lands in
      // URL-based access logs.
      `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          ...(system.length > 0 && {
            system_instruction: { parts: system.map((m) => ({ text: m.content })) },
          }),
          contents: turns.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: req.maxTokens ?? 4096,
            // Bounded reasoning — see getThinkingBudget(). Thinking tokens are
            // charged against maxOutputTokens, so the cap also protects the
            // answer from being squeezed out by an over-long reasoning pass.
            thinkingConfig: { thinkingBudget: getThinkingBudget() },
            ...(req.temperature !== undefined && { temperature: req.temperature }),
            ...(req.json && { responseMimeType: "application/json" }),
          },
        }),
        ...(req.signal ? { signal: req.signal } : {}),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 403) throw new Error("AI access denied. Check API key and permissions.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
      "";
    return {
      text,
      provider: "gemini",
      model: getModel(),
      usage: {
        inputTokens: json?.usageMetadata?.promptTokenCount,
        outputTokens: json?.usageMetadata?.candidatesTokenCount,
      },
    };
  },
};
