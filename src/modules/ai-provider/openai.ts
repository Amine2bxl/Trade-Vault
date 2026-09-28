import {
  ProviderHttpError,
  parseRetryAfterMs,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type FinishReason,
  type ProviderToolCall,
} from "./types";

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
  /**
   * Choisit un modèle RÉELLEMENT servi dans la liste `/models` du fournisseur,
   * quand le modèle configuré est refusé. Absent : pas de découverte.
   */
  pickModel?: (models: ListedModel[], needsTools: boolean) => string | undefined;
}

/** Une entrée de `GET /models` (format OpenAI, champs OpenRouter en plus). */
interface ListedModel {
  id: string;
  context_length?: number;
  supported_parameters?: string[];
}

/**
 * LE MODÈLE DÉCOUVERT, RETENU UNE HEURE PAR FOURNISSEUR.
 *
 * Les modèles gratuits d'OpenRouter disparaissent sans préavis (« This model
 * is unavailable for free ») : un slug écrit en dur finit toujours par mourir,
 * et avec lui le repli de Jarvis. Quand le modèle configuré est refusé, on
 * demande au fournisseur ce qu'il sert AUJOURD'HUI.
 */
const discovered = new Map<string, { model: string; until: number }>();
const DISCOVERY_TTL_MS = 60 * 60_000;

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

  const discoverModel = async (
    apiKey: string,
    needsTools: boolean,
    refused: string,
  ): Promise<string | undefined> => {
    if (!cfg.pickModel) return undefined;
    try {
      const res = await fetch(`${getBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as { data?: ListedModel[] };
      const models = (json.data ?? []).filter((m) => m.id !== refused);
      return cfg.pickModel(models, needsTools);
    } catch {
      return undefined;
    }
  };

  return {
    id: cfg.id,
    supportsTools: true,

    isConfigured() {
      return Boolean(process.env[cfg.apiKeyEnv]);
    },

    async complete(req: AIRequest): Promise<AIResponse> {
      const apiKey = process.env[cfg.apiKeyEnv];
      if (!apiKey) throw new Error(`AI is not configured (missing ${cfg.apiKeyEnv}).`);

      const attempt = async (model: string): Promise<AIResponse> => {
        const res = await fetch(`${getBaseUrl()}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(cfg.id === "openrouter" ? { "HTTP-Referer": "https://tradevault.be" } : {}),
          },
          body: JSON.stringify({
            model,
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
          const detail = text.slice(0, 200);
          // Le statut voyage avec l'erreur : les journaux disent enfin POURQUOI
          // un repli a échoué (clé invalide, modèle retiré, débit…).
          if (res.status === 429)
            throw new ProviderHttpError(
              `Rate limit reached (${model}): ${detail}`,
              429,
              parseRetryAfterMs(text, res.headers.get("retry-after")),
            );
          if (res.status === 402 || res.status === 403)
            throw new ProviderHttpError(`AI credits exhausted (${model}): ${detail}`, res.status);
          throw new ProviderHttpError(`AI request failed (${model}): ${detail}`, res.status);
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
          model,
          usage: {
            inputTokens: json.usage?.prompt_tokens,
            outputTokens: json.usage?.completion_tokens,
          },
          ...(toolCalls?.length && { toolCalls }),
          finishReason: mapFinish(choice?.finish_reason),
        };
      };

      const known = discovered.get(cfg.id);
      const first = known && Date.now() < known.until ? known.model : getModel();
      try {
        return await attempt(first);
      } catch (e) {
        // Modèle refusé (retiré, plus gratuit, inexistant) → on demande au
        // fournisseur la liste de ce qu'il sert, et on en prend un.
        const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
        const modelIssue = /model|unavailable for free|not found|decommissioned/i.test(msg);
        if (!modelIssue) throw e;
        discovered.delete(cfg.id);
        const replacement = await discoverModel(apiKey, !!req.tools?.length, first);
        if (!replacement) {
          if (first !== cfg.defaultModel) return attempt(cfg.defaultModel);
          throw e;
        }
        console.warn(`[ai] ${cfg.id}: ${first} refused — using ${replacement}`);
        const res = await attempt(replacement);
        discovered.set(cfg.id, { model: replacement, until: Date.now() + DISCOVERY_TTL_MS });
        return res;
      }
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
  // Groq ne publie pas les capacités par modèle : on préfère les grands
  // modèles généralistes connus pour l'appel de fonctions, dans cet ordre.
  pickModel: (models) => {
    const ids = models.map((m) => m.id);
    const prefer = [/llama-3\.3-70b/, /gpt-oss-120b/, /llama-4/, /qwen/, /gpt-oss/, /llama/];
    for (const re of prefer) {
      const hit = ids.find((id) => re.test(id) && !/guard|whisper|tts|embed/i.test(id));
      if (hit) return hit;
    }
    return undefined;
  },
});

/** OpenRouter — des dizaines de modèles libres (:free) derrière une clé.
 *  Les modèles `:free` changent chez OpenRouter ; ce slug est un choix fiable
 *  actuel, remplaçable via OPENROUTER_MODEL. */
export const OpenRouterProvider = createOpenAICompatibleProvider({
  id: "openrouter",
  apiKeyEnv: "OPENROUTER_API_KEY",
  baseUrlEnv: "OPENROUTER_BASE_URL",
  modelEnv: "OPENROUTER_MODEL",
  defaultModel: "deepseek/deepseek-chat-v3-0324:free",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  // Un modèle GRATUIT (la clé n'a pas de crédits), capable d'outils si la
  // requête en porte, et au plus grand contexte : le journal y tient.
  pickModel: (models, needsTools) =>
    models
      .filter((m) => m.id.endsWith(":free"))
      .filter((m) => !needsTools || (m.supported_parameters ?? []).includes("tools"))
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))[0]?.id,
});
