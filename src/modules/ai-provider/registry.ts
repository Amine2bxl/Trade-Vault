import type { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";

/**
 * Provider registry — resolution order:
 *   1. AI_PROVIDER env var when set AND configured
 *   2. first configured provider in PROVIDERS order
 * Adding Mistral/DeepSeek/Ollama = one file + one line here.
 */

const PROVIDERS: AIProvider[] = [GeminiProvider, AnthropicProvider, OpenAIProvider];

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

/**
 * Toutes les providers CONFIGURÉES, dans l'ordre : la préférée (AI_PROVIDER)
 * d'abord, puis les autres. C'est la base de la chaîne de repli multi-clés :
 * avec plusieurs clés gratuites (Gemini + Groq + …), une provider qui échoue
 * (quota, panne) laisse la suivante répondre. Vide si aucune n'est configurée.
 */
export function resolveProviders(): AIProvider[] {
  const configured = PROVIDERS.filter((p) => p.isConfigured());
  const wanted = process.env.AI_PROVIDER?.toLowerCase();
  if (wanted) {
    const preferred = configured.find((p) => p.id === wanted);
    if (preferred) {
      return [preferred, ...configured.filter((p) => p.id !== wanted)];
    }
  }
  return configured;
}

/**
 * Resolve a provider that natively supports tool calling, honoring AI_PROVIDER
 * when it points at a tool-capable, configured provider; otherwise the first
 * configured tool-capable provider. Throws if none is available, so tool-driven
 * features fail loudly instead of silently dropping tools.
 */
export function resolveToolCapableProvider(): AIProvider {
  const wanted = process.env.AI_PROVIDER?.toLowerCase();
  const capable = PROVIDERS.filter((p) => p.supportsTools);
  if (wanted) {
    const match = capable.find((p) => p.id === wanted);
    if (match?.isConfigured()) return match;
  }
  const first = capable.find((p) => p.isConfigured());
  if (!first) {
    throw new Error(
      "No tool-capable AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.",
    );
  }
  return first;
}
