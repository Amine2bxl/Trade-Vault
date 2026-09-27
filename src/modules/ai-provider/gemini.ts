import type {
  AIProvider,
  AIRequest,
  AIResponse,
  FinishReason,
  ProviderTool,
  ProviderToolCall,
} from "./types";

/**
 * Google Gemini provider. Server-side only — reads GEMINI_API_KEY.
 * Mirrors the REST mechanics of the legacy inlined insights endpoint.
 */

function getModel(): string {
  /* 2.5 PRO, PAS FLASH. Flash est rapide et docile : il suit un format à la
     lettre au lieu de raisonner, et c'est exactement ce qui faisait répondre
     Jarvis avec la même structure à toutes les questions. Le raisonnement
     est ici le produit, pas la latence. `GEMINI_MODEL` reste le levier pour
     redescendre si la facture le demande. */
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

/* LE MODÈLE DE REPLI. 2.5 Pro n'est plus servi sur l'offre gratuite de
   l'API : une clé gratuite reçoit un refus immédiat (429, quota à 0). C'est ce
   qui a rendu Jarvis muet en production — tous les appels échouaient en ~100
   ms. Quand le modèle demandé est refusé pour une raison de modèle ou de quota,
   on redescend sur Flash, qui répondait sans faute jusque-là. Une clé payante
   garde Pro ; une clé gratuite garde une réponse. */
const FALLBACK_MODEL = "gemini-2.5-flash";

/** Refus qui tiennent au MODÈLE (accès, quota, inexistant) — pas à la requête. */
function isModelRefusal(status: number, body: string): boolean {
  return (
    status === 429 ||
    status === 404 ||
    (status === 403 && /quota|permission|model/i.test(body)) ||
    (status === 400 && /model/i.test(body) && /not (found|supported)/i.test(body))
  );
}

/**
 * Le manifeste d'outils au format Gemini (`functionDeclarations`).
 *
 * Gemini accepte un SOUS-ENSEMBLE d'OpenAPI : un champ qu'il ne connaît pas
 * (`additionalProperties`, que tous nos schémas portent) fait échouer toute la
 * requête en 400. On ne garde que ce qu'il comprend. Un outil sans argument
 * n'envoie pas de `parameters` du tout : un objet aux propriétés vides est lui
 * aussi refusé.
 */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const allowed = ["type", "description", "enum", "properties", "items", "required", "format"];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (!allowed.includes(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([p, s]) => [p, toGeminiSchema(s)]),
      );
    } else if (k === "items") {
      out.items = toGeminiSchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function toFunctionDeclarations(tools: ProviderTool[]) {
  return tools.map((t) => {
    const params = toGeminiSchema(t.parameters) as { properties?: Record<string, unknown> };
    const hasArgs = params.properties && Object.keys(params.properties).length > 0;
    return {
      name: t.name,
      description: t.description,
      ...(hasArgs ? { parameters: params } : {}),
    };
  });
}

function mapFinish(reason: string | undefined, hasCalls: boolean): FinishReason {
  if (hasCalls) return "tool_calls";
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
      return "content_filter";
    default:
      return "unknown";
  }
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { name?: string; args?: Record<string, unknown> };
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
  // L'API Gemini appelle des fonctions nativement. Sans ce drapeau, la boucle
  // d'outils de Jarvis l'écartait et partait sur Groq/OpenRouter — dont les
  // modèles configurés étaient morts : Jarvis ne pouvait plus lire le journal.
  supportsTools: true,

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  },

  async complete(req: AIRequest): Promise<AIResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing GEMINI_API_KEY).");

    const system = req.messages.filter((m) => m.role === "system");
    const turns = req.messages.filter((m) => m.role !== "system");
    const withTools = !!req.tools?.length && req.toolChoice !== "none";

    const body = JSON.stringify({
      ...(system.length > 0 && {
        system_instruction: { parts: system.map((m) => ({ text: m.content })) },
      }),
      contents: turns.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      ...(withTools && {
        tools: [{ functionDeclarations: toFunctionDeclarations(req.tools ?? []) }],
        toolConfig: {
          functionCallingConfig: { mode: req.toolChoice === "required" ? "ANY" : "AUTO" },
        },
      }),
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 4096,
        // Bounded reasoning — see getThinkingBudget(). Thinking tokens are
        // charged against maxOutputTokens, so the cap also protects the
        // answer from being squeezed out by an over-long reasoning pass.
        thinkingConfig: { thinkingBudget: getThinkingBudget() },
        ...(req.temperature !== undefined && { temperature: req.temperature }),
        // JSON strict et appels de fonction sont incompatibles côté Gemini.
        ...(req.json && !withTools && { responseMimeType: "application/json" }),
      },
    });

    const call = (model: string) =>
      fetch(
        // API key goes in a header, not the query string, so it never lands in
        // URL-based access logs.
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          ...(req.signal ? { signal: req.signal } : {}),
        },
      );

    let model = getModel();
    let res = await call(model);
    if (!res.ok && model !== FALLBACK_MODEL) {
      const refused = await res.clone().text();
      if (isModelRefusal(res.status, refused)) {
        console.warn(
          `[ai] gemini: ${model} refused (${res.status}) — falling back to ${FALLBACK_MODEL}`,
        );
        model = FALLBACK_MODEL;
        res = await call(model);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 403) throw new Error("AI access denied. Check API key and permissions.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const candidate = json?.candidates?.[0];
    const parts: GeminiPart[] = candidate?.content?.parts ?? [];
    // Les parties `thought` sont le raisonnement interne : jamais montrées.
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
    const toolCalls: ProviderToolCall[] = parts
      .filter((p) => p.functionCall?.name)
      .map((p) => ({ name: p.functionCall?.name ?? "", arguments: p.functionCall?.args ?? {} }));

    return {
      text,
      provider: "gemini",
      model,
      usage: {
        inputTokens: json?.usageMetadata?.promptTokenCount,
        outputTokens: json?.usageMetadata?.candidatesTokenCount,
      },
      ...(toolCalls.length && { toolCalls }),
      finishReason: mapFinish(candidate?.finishReason, toolCalls.length > 0),
    };
  },
};
