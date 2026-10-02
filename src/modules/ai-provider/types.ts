/**
 * AI Provider abstraction — the application NEVER talks to a vendor API
 * directly and never knows which model answered. Swapping Gemini for
 * Claude/OpenAI/Mistral/Ollama = adding a provider file + changing the
 * AI_PROVIDER env var. Server-side only.
 *
 * Tool-calling fields are OPTIONAL and additive: providers that don't support
 * function calling simply ignore `req.tools` and never set `res.toolCalls`, so
 * every existing caller keeps compiling and behaving identically.
 */

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  /**
   * Le texte du message — TOUJOURS rempli, y compris pour un tour d'outils.
   * C'est la forme que comprend tout fournisseur (et tout faux fournisseur de
   * test) : les champs natifs ci-dessous ne sont qu'une précision en plus.
   */
  content: string;
  /** Tour assistant qui a demandé des outils : les appels, ids garantis. */
  toolCalls?: ProviderToolCall[];
  /**
   * Le tour NATIF du fournisseur qui a produit ce message (blocs Anthropic,
   * parts Gemini, `tool_calls` OpenAI), à rejouer TEL QUEL par ce même
   * fournisseur : il porte les signatures de réflexion que l'API vérifie.
   * Un autre fournisseur l'ignore et lit `content`.
   */
  providerTurn?: ProviderTurn;
  /** Message qui rend les résultats d'outils — un par appel, dans l'ordre. */
  toolResults?: ProviderToolResult[];
}

/** Un tour natif opaque : seul le fournisseur `provider` sait le relire. */
export interface ProviderTurn {
  provider: string;
  /** Le modèle qui l'a produit — les signatures de réflexion y sont liées. */
  model: string;
  raw: unknown;
}

/** Le résultat d'un appel d'outil, rendu au modèle sous forme native. */
export interface ProviderToolResult {
  /** L'id de l'appel (synthétisé par le runtime quand le fournisseur n'en donne pas). */
  id: string;
  name: string;
  output?: unknown;
  error?: string;
}

/**
 * Le niveau de réflexion demandé — une intention, traduite par chaque
 * fournisseur dans SON vocabulaire (budget Gemini, `effort` Anthropic…). Un
 * fournisseur qui ne sait pas réfléchir l'ignore.
 */
export type ReasoningLevel = "none" | "low" | "medium" | "high";

/**
 * Provider-agnostic tool spec handed to the model as its function-calling
 * manifest. `parameters` is a JSON-Schema object, which maps 1:1 onto both
 * OpenAI (`tools[].function.parameters`) and Anthropic (`tools[].input_schema`).
 */
export interface ProviderTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** How the model should decide whether to call a tool. */
export type ToolChoice = "auto" | "none" | "required";

/** A model's request to invoke a tool (normalized across providers). */
export interface ProviderToolCall {
  /** Provider-issued call id, echoed back when returning the tool result. */
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIRequest {
  /** Full conversation, system prompt included as the first message. */
  messages: AIMessage[];
  /** Soft output budget; providers map it to their own parameter. */
  maxTokens?: number;
  temperature?: number;
  /**
   * Budget de réflexion (tokens) quand le fournisseur sait « penser » avant de
   * répondre (Gemini 2.5). Absent = le budget par défaut du fournisseur. Les
   * autres fournisseurs l'ignorent.
   */
  reasoningBudget?: number;
  /** Ask the provider for a strict-JSON answer when supported. */
  json?: boolean;
  /** Function-calling manifest. Ignored by providers without tool support. */
  tools?: ProviderTool[];
  /** Tool-calling policy (default provider behaviour when omitted). */
  toolChoice?: ToolChoice;
  /** Abort signal — used by the runtime to enforce per-provider timeouts. */
  signal?: AbortSignal;
  /**
   * Le modèle à utiliser — fixé par le niveau de difficulté (`runtime/tiers.ts`)
   * et ÉPINGLÉ pendant toute une boucle d'outils : les signatures de réflexion
   * sont liées au modèle qui les a produites. Absent = le modèle par défaut du
   * fournisseur (variable d'environnement).
   */
  model?: string;
  /** Le niveau de réflexion voulu. Prioritaire sur `reasoningBudget` quand les deux sont là. */
  reasoning?: ReasoningLevel;
  /** Délai de l'appel (ms), quand le niveau en impose un autre que celui du fournisseur. */
  timeoutMs?: number;
}

/** Why the model stopped — normalized. `tool_calls` means it wants tools run. */
export type FinishReason = "stop" | "length" | "tool_calls" | "content_filter" | "unknown";

export interface AIResponse {
  text: string;
  /** Which provider actually served the call (telemetry only — never
   *  branch application logic on this). */
  provider: string;
  model: string;
  usage?: {
    /** Tokens d'entrée facturés, cache compris. */
    inputTokens?: number;
    /** Tokens de sortie VISIBLES. */
    outputTokens?: number;
    /** Tokens de réflexion, facturés comme de la sortie mais invisibles. */
    thinkingTokens?: number;
    /** Part de l'entrée servie depuis le cache du fournisseur. */
    cachedInputTokens?: number;
  };
  /** Populated only when the model requested one or more tool invocations. */
  toolCalls?: ProviderToolCall[];
  finishReason?: FinishReason;
  /**
   * Le tour natif à rejouer, quand la réponse demande des outils (voir
   * `AIMessage.providerTurn`). Hors de `toolCalls`, délibérément : la forme
   * normalisée des appels reste identique d'un fournisseur à l'autre.
   */
  providerTurn?: ProviderTurn;
}

export interface AIProvider {
  readonly id: string;
  /** True when the provider has the credentials it needs. */
  isConfigured(): boolean;
  complete(req: AIRequest): Promise<AIResponse>;
  /**
   * Whether this provider natively supports the tool-calling fields above.
   * Optional for back-compat: treated as `false` when absent.
   */
  readonly supportsTools?: boolean;
}

/**
 * Un refus HTTP d'un fournisseur, avec son STATUT et, pour un 429, le délai
 * que le fournisseur demande avant de réessayer.
 *
 * Avant, chaque adaptateur levait un `Error` au texte générique : le routeur
 * ne savait ni qu'il s'agissait d'un 429, ni combien de temps attendre. Il
 * abandonnait donc Gemini au premier dépassement de débit et basculait sur des
 * replis — dont les modèles étaient morts — au lieu d'attendre les quelques
 * secondes que Google demandait. Jarvis affichait « analyse hors ligne ».
 */
export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
    /** Quota JOURNALIER épuisé : attendre quelques secondes n'y changera rien. */
    readonly daily = false,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

/** Délai de reprise d'un 429 : `RetryInfo.retryDelay` (Google, « 7s ») ou
 *  l'en-tête `Retry-After` (secondes), selon ce que le fournisseur envoie. */
export function parseRetryAfterMs(body: string, header?: string | null): number | undefined {
  const google = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (google) return Math.ceil(Number(google[1]) * 1000);
  const seconds = Number(header);
  return header && Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : undefined;
}
