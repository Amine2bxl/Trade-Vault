import {
  ProviderHttpError,
  parseRetryAfterMs,
  type AIMessage,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type FinishReason,
  type ProviderTool,
  type ProviderToolCall,
  type ReasoningLevel,
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
/** Le dernier maillon : plus léger, servi sur une capacité distincte. */
const LITE_MODEL = "gemini-2.5-flash-lite";
/** Une saturation (503) se résorbe vite : on ne boude le modèle que 2 min. */
const OVERLOAD_MEMORY_MS = 2 * 60_000;

/** Modèle saturé : 503 « UNAVAILABLE / high demand / overloaded ». */
function isOverloaded(status: number, body: string): boolean {
  return status === 503 || (status === 500 && /overloaded|high demand|unavailable/i.test(body));
}

/**
 * LES MODÈLES REFUSÉS SONT RETENUS.
 *
 * Chaque question commençait par un appel à 2.5 Pro, refusé en 404 sur cette
 * clé, avant de redescendre sur Flash — deux à trois fois par question avec
 * la boucle d'outils. Ces appels perdus comptaient dans le débit gratuit et
 * précipitaient le 429 qui rendait Jarvis « hors ligne ». Un refus est
 * maintenant retenu un moment : les questions suivantes vont directement au
 * modèle qui répond. La mémoire est celle de l'instance serveur, et expire —
 * une clé passée en payant retrouve Pro sans redéploiement.
 */
const refusedUntil = new Map<string, number>();
const REFUSAL_MEMORY_MS = 15 * 60_000;

function isRefused(model: string): boolean {
  const until = refusedUntil.get(model);
  if (!until) return false;
  if (Date.now() < until) return true;
  refusedUntil.delete(model);
  return false;
}

/** Tests uniquement. */
export function resetGeminiModelMemory(): void {
  refusedUntil.clear();
}

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
  /** Signature de réflexion — SŒUR de `functionCall` dans la même part, à rejouer telle quelle. */
  thoughtSignature?: string;
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/**
 * Le préfixe des ids d'appel SYNTHÉTISÉS par le runtime (`tools/runtime.ts`).
 * Gemini 2.5 ne rend en général pas d'id : on n'en renvoie un dans la réponse
 * de fonction que si l'appel en portait un.
 */
const SYNTHETIC_CALL_ID = /^tvcall_/;

/** La valeur sentinelle documentée quand un appel est rejoué sans sa signature
 *  d'origine (historique produit par un autre modèle) — exigée par Gemini 3. */
const SKIP_SIGNATURE = "skip_thought_signature_validator";

/**
 * Les messages du runtime → `contents` Gemini.
 *
 * - Un tour assistant qui porte un tour NATIF Gemini est rejoué TEL QUEL
 *   (parts, signatures de réflexion comprises).
 * - Un message de résultats devient UN contenu `user` de parts
 *   `functionResponse`, une par appel, dans l'ordre, sans texte ajouté.
 * - Tout le reste reste du texte, comme avant.
 */
export function toGeminiContents(messages: AIMessage[], model: string): GeminiContent[] {
  const out: GeminiContent[] = [];
  const strict = model.startsWith("gemini-3");
  for (const m of messages) {
    if (m.role === "system") continue;
    const native = m.providerTurn?.provider === "gemini" && Array.isArray(m.providerTurn.raw);
    if (m.role === "assistant" && native) {
      const parts = (m.providerTurn!.raw as GeminiPart[]).map((p) =>
        // Une signature est liée au modèle qui l'a produite. Gemini 3 refuse un
        // appel rejoué sans la sienne : on pose la sentinelle documentée.
        strict && p.functionCall && m.providerTurn!.model !== model
          ? { ...p, thoughtSignature: SKIP_SIGNATURE }
          : p,
      );
      out.push({ role: "model", parts });
      continue;
    }
    if (m.toolResults?.length) {
      out.push({
        role: "user",
        parts: m.toolResults.map((r) => ({
          functionResponse: {
            ...(r.id && !SYNTHETIC_CALL_ID.test(r.id) ? { id: r.id } : {}),
            name: r.name,
            // `response` DOIT être un objet : un tableau de trades est enveloppé.
            response: r.error !== undefined ? { error: r.error } : { output: r.output ?? null },
          },
        })),
      });
      continue;
    }
    const role = m.role === "assistant" ? "model" : "user";
    const prev = out[out.length - 1];
    // Deux tours texte du même rôle à la suite (une conversation qui finit sur
    // une question) sont fusionnés : jamais une part de texte dans un contenu
    // de réponses de fonction.
    if (
      prev &&
      prev.role === role &&
      prev.parts.every((p) => typeof p.text === "string" && !p.thoughtSignature)
    ) {
      prev.parts.push({ text: m.content });
    } else {
      out.push({ role, parts: [{ text: m.content }] });
    }
  }
  return out;
}

/**
 * Budget de réflexion par défaut (Gemini 2.5) quand rien d'autre n'est demandé.
 *
 * Ces modèles réfléchissent avant de répondre et, laissés seuls, choisissent
 * leur budget sans plafond — facturé en sortie, et première source de latence
 * variable. On le borne plutôt que de le couper.
 *
 * `GEMINI_THINKING_BUDGET` est le levier d'EXPLOITATION (0 coupe, -1 rend la
 * main au modèle) : quand il est posé, il PRIME sur tout, y compris sur le
 * niveau choisi par le routeur. Il ne servait plus à rien depuis que le coach
 * imposait 2 048 (bug B10) — c'est corrigé : un réglage de coût posé en
 * production doit toujours être obéi.
 */
function envThinkingBudget(): number | undefined {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw === undefined || raw.trim() === "") return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const DEFAULT_THINKING_BUDGET = 512;

/** Niveau de réflexion → budget de tokens (Gemini 2.5). */
const LEVEL_BUDGET: Record<ReasoningLevel, number> = {
  none: 0,
  low: 512,
  medium: 2_048,
  high: 8_192,
};

/**
 * Borne un budget aux plages ACCEPTÉES par chaque modèle 2.5 — une valeur hors
 * plage est un refus 400 :
 *   - 2.5 Pro : la réflexion ne se coupe pas, 128–32 768 (ou -1) ;
 *   - 2.5 Flash : 0–24 576 ;
 *   - 2.5 Flash-Lite : 0, ou 512–24 576.
 */
export function clampThinkingBudget(model: string, budget: number): number {
  if (budget === -1) return -1;
  if (/flash-lite/.test(model)) return budget <= 0 ? 0 : Math.min(Math.max(budget, 512), 24_576);
  if (/flash/.test(model)) return Math.min(Math.max(budget, 0), 24_576);
  // Pro (et tout modèle inconnu de la famille 2.5) : jamais 0.
  return Math.min(Math.max(budget, 128), 32_768);
}

/**
 * La configuration de réflexion d'UN modèle.
 *
 * Gemini 3 se règle par NIVEAU (`thinkingLevel`), jamais avec un budget en
 * même temps (refus 400) ; la famille 2.5 par budget, borné par modèle.
 */
export function thinkingConfigFor(model: string, req: AIRequest): Record<string, unknown> {
  const env = envThinkingBudget();
  if (model.startsWith("gemini-3")) {
    if (env !== undefined) return { thinkingBudget: env };
    const level = req.reasoning ?? (req.reasoningBudget ? "medium" : "low");
    const flash = /flash/.test(model);
    const map: Record<ReasoningLevel, string> = flash
      ? { none: "minimal", low: "low", medium: "medium", high: "high" }
      : { none: "low", low: "low", medium: "high", high: "high" };
    return { thinkingLevel: map[level] };
  }
  const budget =
    env ??
    (req.reasoning !== undefined
      ? LEVEL_BUDGET[req.reasoning]
      : (req.reasoningBudget ?? DEFAULT_THINKING_BUDGET));
  return { thinkingBudget: clampThinkingBudget(model, budget) };
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
    const withTools = !!req.tools?.length;

    /* LE CORPS EST CONSTRUIT PAR MODÈLE. La réflexion se règle différemment
       selon le modèle (budget borné en 2.5, niveau en 3) : un corps unique
       réutilisé le long de la chaîne Pro → Flash → Flash-Lite enverrait à
       Flash-Lite un budget que seul Pro accepte. */
    const bodyFor = (model: string) =>
      JSON.stringify({
        ...(system.length > 0 && {
          system_instruction: { parts: system.map((m) => ({ text: m.content })) },
        }),
        contents: toGeminiContents(req.messages, model),
        ...(withTools && {
          tools: [{ functionDeclarations: toFunctionDeclarations(req.tools ?? []) }],
          /* « none » GARDE les outils et passe en mode NONE : retirer les
             déclarations alors que l'historique contient des appels natifs
             ferait refuser la requête. */
          toolConfig: {
            functionCallingConfig: {
              mode:
                req.toolChoice === "none" ? "NONE" : req.toolChoice === "required" ? "ANY" : "AUTO",
            },
          },
        }),
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 4096,
          // Réflexion bornée — voir `thinkingConfigFor`. Les tokens de réflexion
          // sont décomptés de `maxOutputTokens` : la borne protège aussi la
          // réponse d'une réflexion qui mangerait tout.
          thinkingConfig: thinkingConfigFor(model, req),
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
          body: bodyFor(model),
          ...(req.signal ? { signal: req.signal } : {}),
        },
      );

    /* LA CHAÎNE DE MODÈLES. Mesuré en production : 2.5 Pro puis 2.5 Flash
       répondaient tous deux 503 (« This model is currently experiencing high
       demand ») — une saturation PAR MODÈLE, pas une panne de Google. Flash-Lite
       a sa propre capacité : il répond quand les deux autres sont saturés. On
       descend la chaîne tant que le refus tient au modèle ou à sa charge.

       Le modèle DEMANDÉ (`req.model`, fixé par le niveau de difficulté) ouvre
       la chaîne ; à défaut, `GEMINI_MODEL`. */
    const chain = [req.model ?? getModel(), FALLBACK_MODEL, LITE_MODEL].filter(
      (m, i, all) => all.indexOf(m) === i,
    );
    const usable = chain.filter((m) => !isRefused(m));
    const order = usable.length > 0 ? usable : [chain[chain.length - 1]];
    let model = order[0];
    let res = await call(model);
    for (let i = 1; i < order.length && !res.ok; i++) {
      const refused = await res.clone().text();
      const overloaded = isOverloaded(res.status, refused);
      if (!overloaded && !isModelRefusal(res.status, refused)) break;
      // Un 429 de DÉBIT se lève vite ; un 404/403 (modèle absent de l'offre)
      // dure ; une saturation (503) passe en quelques minutes. On retient le
      // refus le temps qui correspond.
      const retry = parseRetryAfterMs(refused, res.headers.get("retry-after"));
      refusedUntil.set(
        model,
        Date.now() +
          (overloaded
            ? OVERLOAD_MEMORY_MS
            : res.status === 429 && retry
              ? retry
              : REFUSAL_MEMORY_MS),
      );
      console.warn(
        `[ai] gemini: ${model} ${overloaded ? "overloaded" : "refused"} (${res.status}) — falling back to ${order[i]}`,
      );
      model = order[i];
      res = await call(model);
    }

    if (!res.ok) {
      const text = await res.text();
      const detail = text.slice(0, 200);
      if (res.status === 429) {
        // Quota JOURNALIER (« …PerDay… ») : le délai annoncé ne sert à rien,
        // la limite ne se relève qu'au jour suivant.
        const daily = /PerDay/i.test(text);
        throw new ProviderHttpError(
          `Rate limit reached (${model}): ${detail}`,
          429,
          daily ? undefined : parseRetryAfterMs(text, res.headers.get("retry-after")),
          daily,
        );
      }
      if (res.status === 403) throw new ProviderHttpError(`AI access denied: ${detail}`, 403);
      if (res.status === 402) throw new ProviderHttpError(`AI credits exhausted: ${detail}`, 402);
      throw new ProviderHttpError(`AI request failed: ${detail}`, res.status);
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
      .map((p) => ({
        // Un id seulement s'il existe : la forme normalisée reste `{name, arguments}`.
        ...(p.functionCall?.id ? { id: p.functionCall.id } : {}),
        name: p.functionCall?.name ?? "",
        arguments: p.functionCall?.args ?? {},
      }));
    const usage = json?.usageMetadata ?? {};

    return {
      text,
      provider: "gemini",
      model,
      usage: {
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        // Facturés comme de la sortie, et jusqu'ici jamais comptés (bug B9).
        thinkingTokens: usage.thoughtsTokenCount,
        cachedInputTokens: usage.cachedContentTokenCount,
      },
      ...(toolCalls.length && {
        toolCalls,
        // Les parts BRUTES, signatures comprises — à rejouer telles quelles.
        providerTurn: { provider: "gemini", model, raw: parts },
      }),
      finishReason: mapFinish(candidate?.finishReason, toolCalls.length > 0),
    };
  },
};
