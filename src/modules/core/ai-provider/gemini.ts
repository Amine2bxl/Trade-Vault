import type { AIProvider, AIRequest, AIResponse } from "./types";

/**
 * Google Gemini provider. Server-side only — reads GEMINI_API_KEY.
 * Mirrors the REST mechanics previously inlined in ai-insights.functions.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
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
            ...(req.temperature !== undefined && { temperature: req.temperature }),
            ...(req.json && { responseMimeType: "application/json" }),
          },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402 || res.status === 403)
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
      model: MODEL,
      usage: {
        inputTokens: json?.usageMetadata?.promptTokenCount,
        outputTokens: json?.usageMetadata?.candidatesTokenCount,
      },
    };
  },
};
