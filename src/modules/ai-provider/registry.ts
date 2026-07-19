import type { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { AnthropicProvider } from "./anthropic";

/**
 * Provider registry — resolution order:
 *   1. AI_PROVIDER env var when set AND configured
 *   2. first configured provider in PROVIDERS order
 * Adding OpenAI/Mistral/DeepSeek/Ollama = one file + one line here.
 */

const PROVIDERS: AIProvider[] = [GeminiProvider, AnthropicProvider];

export function resolveProvider(): AIProvider {
  const wanted = process.env.AI_PROVIDER?.toLowerCase();
  if (wanted) {
    const match = PROVIDERS.find((p) => p.id === wanted);
    if (match?.isConfigured()) return match;
    if (match) console.warn(`[ai] AI_PROVIDER=${wanted} set but not configured — falling back.`);
  }
  const first = PROVIDERS.find((p) => p.isConfigured());
  if (!first) {
    throw new Error(
      "AI coach is not configured yet. Add a GEMINI_API_KEY (or another provider key) to enable this feature.",
    );
  }
  return first;
}
