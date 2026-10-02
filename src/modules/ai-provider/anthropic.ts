import {
  ProviderHttpError,
  parseRetryAfterMs,
  type AIMessage,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type FinishReason,
  type ProviderToolCall,
  type ReasoningLevel,
} from "./types";

/**
 * Anthropic Claude provider. Activates when ANTHROPIC_API_KEY is set — first
 * when `AI_PROVIDER=anthropic`, otherwise as a link of the multi-key fallback
 * chain (`registry.ts`). No application code changes needed to switch.
 *
 * ── CE QUE CET ADAPTATEUR GARANTIT ─────────────────────────────────────────
 *  - APPELS D'OUTILS NATIFS. Le tour assistant d'une boucle d'outils est rejoué
 *    TEL QUEL (`providerTurn`) : blocs `thinking` signés compris — l'API refuse
 *    un historique dont on aurait retiré ou réécrit la réflexion. Les résultats
 *    partent en UN message `user` de blocs `tool_result`.
 *  - LA RÉFLEXION SELON LE MODÈLE. Les modèles 4.6+/5.x se règlent par
 *    `output_config.effort` (un budget de tokens y est refusé) ; Haiku 4.5 par
 *    un budget explicite. Aucun réglage refusé par un modèle n'est envoyé
 *    (température sur la famille 5, réflexion désactivée sur Opus 5.5, choix
 *    d'outil forcé sur les 5.5).
 *  - LE CACHE. Le préfixe stable (outils + système) porte un point de cache :
 *    les tours suivants d'une boucle d'outils ne le paient plus en entier.
 *  - LE REPLI SERVEUR sur refus de politique (`fallbacks: "default"`) pour les
 *    modèles qui l'acceptent ; un refus restant (`stop_reason: "refusal"`) est
 *    rendu VIDE avec `content_filter` — jamais un texte partiel, jamais un
 *    appel d'outil à demi écrit.
 *  - DES ERREURS QUI DISENT LEUR STATUT (`ProviderHttpError`), pour que le
 *    routeur sache attendre un 429 et réessayer un 529.
 */

function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

interface AnthropicBlock {
  type?: string;
  text?: string;
  thinking?: string;
  signature?: string;
  data?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}
interface AnthropicResponse {
  model?: string;
  content?: AnthropicBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

// ── Capacités par modèle ─────────────────────────────────────────────────────

/** Famille réglée par `effort` (réflexion adaptative) — un budget de tokens y est refusé. */
function usesEffort(model: string): boolean {
  return /^claude-(opus-5|sonnet-5|fable-5|mythos-5|opus-4-[678]|sonnet-4-6)/.test(model);
}

/** Modèles qui refusent une température (ou tout réglage d'échantillonnage) non par défaut. */
function rejectsSampling(model: string): boolean {
  return /^claude-(opus-5|sonnet-5|fable|mythos|opus-4-[78])/.test(model);
}

/** Modèles qui refusent `tool_choice` « any » / « tool ». */
function rejectsForcedTools(model: string): boolean {
  return /^claude-(opus-5-5|sonnet-5-5|fable-5-1|mythos-5-1)/.test(model);
}

/** Modèles qui acceptent le repli serveur sous sa forme « default ». */
function acceptsDefaultFallbacks(model: string): boolean {
  return /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1)(?!\d)/.test(model);
}

const EFFORT: Record<ReasoningLevel, "low" | "medium" | "high"> = {
  none: "low",
  low: "low",
  medium: "medium",
  high: "high",
};

/** Budget de réflexion explicite (Haiku 4.5) : ≥ 1 024 et < max_tokens, sinon pas de réflexion. */
function haikuThinking(level: ReasoningLevel | undefined, maxTokens: number) {
  const wanted =
    level === "high" ? 4_096 : level === "medium" ? 2_048 : level === "low" ? 1_024 : 0;
  if (wanted < 1_024 || wanted >= maxTokens) return undefined;
  return { type: "enabled", budget_tokens: wanted };
}

function mapFinish(reason: string | undefined): FinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
    case "model_context_window_exceeded":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "refusal":
      return "content_filter";
    default:
      return "unknown";
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────

type WireMessage = { role: "user" | "assistant"; content: string | unknown[] };

/**
 * Les messages du runtime → `messages` Anthropic.
 *
 * Un tour assistant NATIF (produit par Anthropic) est rejoué verbatim, et ses
 * résultats partent en blocs `tool_result`. Un tour d'outils produit par un
 * AUTRE fournisseur reste du texte (ses ids ne correspondent à aucun
 * `tool_use` connu d'Anthropic). Deux tours texte du même rôle sont fusionnés.
 */
export function toAnthropicMessages(messages: AIMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  let lastNative = false;
  for (const m of messages) {
    if (m.role === "system") continue;
    const native = m.providerTurn?.provider === "anthropic" && Array.isArray(m.providerTurn.raw);
    if (m.role === "assistant" && native) {
      out.push({ role: "assistant", content: m.providerTurn!.raw as unknown[] });
      lastNative = true;
      continue;
    }
    if (m.toolResults?.length && lastNative) {
      out.push({
        role: "user",
        content: m.toolResults.map((r) => ({
          type: "tool_result",
          tool_use_id: r.id,
          content: r.error !== undefined ? r.error : JSON.stringify(r.output ?? null),
          ...(r.error !== undefined ? { is_error: true } : {}),
        })),
      });
      lastNative = false;
      continue;
    }
    lastNative = false;
    const role = m.role === "assistant" ? "assistant" : "user";
    const prev = out[out.length - 1];
    if (prev && prev.role === role && typeof prev.content === "string") {
      prev.content = `${prev.content}\n\n${m.content}`;
    } else {
      out.push({ role, content: m.content });
    }
  }
  return out;
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

    const model = req.model ?? getModel();
    const maxTokens = req.maxTokens ?? 4096;
    const systemText = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const effort = usesEffort(model);
    const thinking =
      !effort && /^claude-haiku/.test(model) ? haikuThinking(req.reasoning, maxTokens) : undefined;
    const tools = req.tools?.length
      ? req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        }))
      : undefined;
    const forced =
      req.toolChoice === "required" && !rejectsForcedTools(model) && !thinking
        ? { type: "any" }
        : undefined;
    const toolChoice = tools
      ? req.toolChoice === "none"
        ? { type: "none" }
        : (forced ?? { type: "auto" })
      : undefined;
    const fallbacks = acceptsDefaultFallbacks(model);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(fallbacks ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        // Le système en bloc avec un point de cache : outils + système forment
        // le préfixe stable de toute la boucle d'outils.
        ...(systemText && {
          system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
        }),
        // Cache automatique de la fin de l'historique : chaque tour d'outils
        // relit le précédent depuis le cache au lieu de le repayer.
        cache_control: { type: "ephemeral" },
        ...(effort && { output_config: { effort: EFFORT[req.reasoning ?? "low"] } }),
        ...(thinking && { thinking }),
        // Température : seulement là où elle est acceptée (ni la famille 5, ni
        // avec la réflexion activée).
        ...(req.temperature !== undefined &&
          !rejectsSampling(model) &&
          !thinking && { temperature: req.temperature }),
        ...(tools && { tools, tool_choice: toolChoice }),
        ...(fallbacks && { fallbacks: "default" }),
        messages: toAnthropicMessages(req.messages),
      }),
      ...(req.signal ? { signal: req.signal } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      const detail = text.slice(0, 300);
      if (res.status === 429)
        throw new ProviderHttpError(
          `Rate limit reached (${model}): ${detail}`,
          429,
          parseRetryAfterMs(text, res.headers.get("retry-after")),
        );
      // 529 = surcharge Anthropic : un statut ≥ 500, donc retentable par le routeur.
      throw new ProviderHttpError(`AI request failed (${model}): ${detail}`, res.status);
    }

    const json = (await res.json()) as AnthropicResponse;
    const blocks = json.content ?? [];
    const finishReason = mapFinish(json.stop_reason);
    const served = json.model || model;
    const usage = {
      // L'entrée facturée inclut ce qui a été lu ou écrit en cache.
      inputTokens:
        (json.usage?.input_tokens ?? 0) +
        (json.usage?.cache_read_input_tokens ?? 0) +
        (json.usage?.cache_creation_input_tokens ?? 0),
      outputTokens: json.usage?.output_tokens,
      cachedInputTokens: json.usage?.cache_read_input_tokens,
    };

    // UN REFUS se rend VIDE : le texte partiel d'une réponse déclinée n'est
    // pas une réponse, et un appel d'outil peut y être tronqué.
    if (finishReason === "content_filter") {
      return { text: "", provider: "anthropic", model: served, usage, finishReason };
    }

    // Le texte VISIBLE vient des seuls blocs `text` (les 5.5 rendent le texte
    // entre deux appels d'outils comme de la réflexion).
    const text = blocks.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");
    // Des appels d'outils seulement sur un arrêt `tool_use` : sur `max_tokens`,
    // l'entrée d'un appel peut être coupée net.
    const toolCalls: ProviderToolCall[] =
      json.stop_reason === "tool_use"
        ? blocks
            .filter((b) => b.type === "tool_use" && b.name)
            .map((b) => ({ id: b.id, name: b.name ?? "", arguments: b.input ?? {} }))
        : [];

    return {
      text,
      provider: "anthropic",
      model: served,
      usage,
      ...(toolCalls.length && {
        toolCalls,
        // Le contenu ENTIER, dans l'ordre : blocs de réflexion signés compris.
        providerTurn: { provider: "anthropic", model: served, raw: blocks },
      }),
      finishReason,
    };
  },
};
