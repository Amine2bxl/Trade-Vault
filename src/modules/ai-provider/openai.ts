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
   * Classe les modèles RÉELLEMENT servis dans la liste `/models` du fournisseur,
   * du meilleur au moins bon, quand le modèle configuré est refusé. Absent :
   * pas de découverte.
   */
  pickModels?: (models: ListedModel[], needsTools: boolean) => string[];
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

/**
 * LES MODÈLES REFUSÉS SONT RETENUS, par fournisseur.
 *
 * Mesuré en production : la découverte retenait le premier modèle gratuit de
 * la liste d'OpenRouter, qui répondait 403 (« only available on agentic
 * harnesses »). Sans mémoire, chaque question redécouvrait le même modèle
 * mort. Un refus écarte le modèle un moment, et la découverte passe au suivant.
 */
const refusedModels = new Map<string, number>();
const MODEL_REFUSAL_MS = 30 * 60_000;
/** Candidats essayés au plus par question : au-delà, on laisse la place au
 *  fournisseur suivant plutôt que d'égrener tout un catalogue. */
const MAX_DISCOVERY_TRIES = 3;

const refusalKey = (provider: string, model: string) => `${provider}:${model}`;
function isModelRefused(provider: string, model: string): boolean {
  const until = refusedModels.get(refusalKey(provider, model));
  if (!until) return false;
  if (Date.now() < until) return true;
  refusedModels.delete(refusalKey(provider, model));
  return false;
}

/** Tests uniquement. */
export function resetOpenAICompatibleMemory(): void {
  discovered.clear();
  refusedModels.clear();
}

/**
 * UN REFUS QUI TIENT AU MODÈLE — pas à la requête, pas au débit.
 *
 * L'ancien test cherchait le mot « model » dans le message d'erreur. Or le 413
 * de Groq (« Request too large for MODEL… ») le contient aussi : une requête
 * trop grosse passait pour un modèle retiré, et la découverte partait vers un
 * modèle… à la limite encore plus basse. Seuls le statut ET le motif décident.
 */
export function isModelRefusal(status: number | undefined, body: string): boolean {
  if (status === 404) return true;
  if (status === 400 || status === 403)
    return /unavailable for free|not found|does not exist|decommissioned|deprecated|agentic|not available|no endpoints|invalid model|model_not_found/i.test(
      body,
    );
  return false;
}

/**
 * LA LIMITE PAR MINUTE COMPTE LA RÉPONSE DEMANDÉE.
 *
 * Groq (offre à la demande) plafonne les tokens PAR MINUTE, et compte
 * `max_tokens` dans la requête : « Limit 8000, Requested 13725 » pour ~7 600
 * tokens d'entrée et 6 144 de sortie autorisée. La requête tient si l'on
 * demande moins de sortie. On lit la limite dans le refus et on recalcule.
 */
export function fitMaxTokens(body: string, maxTokens: number): number | undefined {
  const m = /Limit\s+(\d+),\s*Requested\s+(\d+)/i.exec(body);
  if (!m) return undefined;
  const limit = Number(m[1]);
  const requested = Number(m[2]);
  const input = requested - maxTokens;
  // Marge de 5 % : le décompte du fournisseur n'est pas le nôtre au token près.
  const room = Math.floor(limit * 0.95) - input;
  // Moins de 700 tokens de réponse : une analyse n'y tient pas. Autant laisser
  // la place au fournisseur suivant.
  return room >= 700 && room < maxTokens ? room : undefined;
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

  const discoverModels = async (apiKey: string, needsTools: boolean): Promise<string[]> => {
    if (!cfg.pickModels) return [];
    try {
      const res = await fetch(`${getBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: ListedModel[] };
      return cfg.pickModels(json.data ?? [], needsTools);
    } catch {
      return [];
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

      const attempt = async (
        model: string,
        maxTokens = req.maxTokens ?? 4096,
      ): Promise<AIResponse> => {
        const res = await fetch(`${getBaseUrl()}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(cfg.id === "openrouter" ? { "HTTP-Referer": "https://tradevault.be" } : {}),
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
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
          // 400 caractères : le 413 de Groq place « Limit N, Requested M » au-delà
          // du 190e — tronqué à 200, le chiffre utile était coupé.
          const detail = text.slice(0, 400);
          // Le statut voyage avec l'erreur : les journaux disent enfin POURQUOI
          // un repli a échoué (clé invalide, modèle retiré, débit…).
          if (res.status === 429)
            throw new ProviderHttpError(
              `Rate limit reached (${model}): ${detail}`,
              429,
              parseRetryAfterMs(text, res.headers.get("retry-after")),
            );
          if (res.status === 402)
            throw new ProviderHttpError(`AI credits exhausted (${model}): ${detail}`, 402);
          if (res.status === 403)
            throw new ProviderHttpError(`AI access refused (${model}): ${detail}`, 403);
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

      /** Un appel, avec UNE seconde chance si la limite par minute se lève en
       *  demandant moins de sortie (413 de Groq). */
      const fitted = async (model: string): Promise<AIResponse> => {
        const max = req.maxTokens ?? 4096;
        try {
          return await attempt(model, max);
        } catch (e) {
          if ((e as { status?: number })?.status !== 413) throw e;
          const smaller = fitMaxTokens(e instanceof Error ? e.message : String(e), max);
          if (!smaller) throw e;
          console.warn(
            `[ai] ${cfg.id}: ${model} over its per-minute limit — retrying with max_tokens ${smaller}`,
          );
          return attempt(model, smaller);
        }
      };

      const known = discovered.get(cfg.id);
      const configured = getModel();
      const first =
        known && Date.now() < known.until && !isModelRefused(cfg.id, known.model)
          ? known.model
          : configured;
      const tried = new Set<string>();
      let lastErr: unknown;
      if (!isModelRefused(cfg.id, first)) {
        tried.add(first);
        try {
          return await fitted(first);
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (!isModelRefusal(status, e instanceof Error ? e.message : String(e))) throw e;
          refusedModels.set(refusalKey(cfg.id, first), Date.now() + MODEL_REFUSAL_MS);
          discovered.delete(cfg.id);
          lastErr = e;
        }
      }

      // Modèle refusé (retiré, plus gratuit, réservé) → on demande au
      // fournisseur ce qu'il sert AUJOURD'HUI, et on essaie les meilleurs
      // candidats l'un après l'autre.
      const candidates = (await discoverModels(apiKey, !!req.tools?.length)).filter(
        (m) => !tried.has(m) && !isModelRefused(cfg.id, m),
      );
      if (
        candidates.length === 0 &&
        configured !== cfg.defaultModel &&
        !tried.has(cfg.defaultModel)
      )
        candidates.push(cfg.defaultModel);
      for (const model of candidates.slice(0, MAX_DISCOVERY_TRIES)) {
        try {
          console.warn(`[ai] ${cfg.id}: ${first} refused — trying ${model}`);
          const res = await fitted(model);
          discovered.set(cfg.id, { model, until: Date.now() + DISCOVERY_TTL_MS });
          return res;
        } catch (e) {
          lastErr = e;
          const status = (e as { status?: number })?.status;
          if (!isModelRefusal(status, e instanceof Error ? e.message : String(e))) throw e;
          refusedModels.set(refusalKey(cfg.id, model), Date.now() + MODEL_REFUSAL_MS);
        }
      }
      throw lastErr ?? new ProviderHttpError(`No model available on ${cfg.id}`, 404);
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
  pickModels: (models) => {
    const ids = models
      .map((m) => m.id)
      .filter((id) => !/guard|whisper|tts|embed|orpheus|prompt/i.test(id));
    const prefer = [
      /llama-3\.3-70b/,
      /llama-4/,
      /gpt-oss-120b/,
      /qwen/,
      /kimi/,
      /gpt-oss/,
      /llama/,
    ];
    const out: string[] = [];
    for (const re of prefer)
      for (const id of ids) if (re.test(id) && !out.includes(id)) out.push(id);
    return out;
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
  // Des modèles GRATUITS (la clé n'a pas de crédits), capables d'outils si la
  // requête en porte. Les grandes familles généralistes passent devant : le
  // plus grand contexte seul avait élu un modèle réservé à d'autres clients.
  pickModels: (models, needsTools) => {
    const family = (id: string) => {
      const order = [
        /deepseek/,
        /llama-3\.3|llama-4/,
        /qwen/,
        /gemini|gemma/,
        /mistral/,
        /gpt-oss/,
        /glm|kimi/,
      ];
      const i = order.findIndex((re) => re.test(id));
      return i === -1 ? order.length : i;
    };
    return models
      .filter((m) => m.id.endsWith(":free"))
      .filter((m) => !needsTools || (m.supported_parameters ?? []).includes("tools"))
      .sort(
        (a, b) => family(a.id) - family(b.id) || (b.context_length ?? 0) - (a.context_length ?? 0),
      )
      .map((m) => m.id);
  },
});
