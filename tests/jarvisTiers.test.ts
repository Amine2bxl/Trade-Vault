import { afterEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_SLOT_MODELS,
  SLOT_POLICY,
  TIER_SLOT,
  describeSlot,
  modelRoutingEnabled,
  parseSlotSpec,
  pinToSlot,
  slotChain,
} from "../src/modules/ai/runtime/tiers";
import { estimateCostUsd, priceOf } from "../src/modules/ai/runtime/pricing";
import { callTimeoutMs } from "../src/modules/ai/runtime/router";
import { recordAgentRun } from "../src/backend/telemetry.server";
import type { AIProvider, AIRequest, AIResponse } from "../src/modules/ai-provider";

/**
 * LOT 2 — NIVEAUX DE MODÈLE, COÛT ET TÉLÉMÉTRIE (B9/B10).
 *
 * Le modèle se choisit par la DIFFICULTÉ de la question, jamais un seul modèle
 * pour tout : un petit modèle route, un rapide répond au simple, un puissant
 * analyse. Chaque emplacement se règle par variable d'environnement, sans
 * redéploiement. Ces tests figent la politique et la chaîne de repli.
 */

const ENV_KEYS = ["AI_MODEL_ROUTER", "AI_MODEL_STRONG", "AI_MODEL_PRICES"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function fakeProvider(id: string, seen: AIRequest[] = []): AIProvider {
  return {
    id,
    supportsTools: true,
    isConfigured: () => true,
    async complete(req: AIRequest): Promise<AIResponse> {
      seen.push(req);
      return { text: "ok", provider: id, model: req.model ?? "default" };
    },
  };
}

describe("niveaux → emplacements", () => {
  test("quatre niveaux, quatre emplacements, une politique croissante", () => {
    expect(TIER_SLOT).toEqual({ 1: "fast", 2: "balanced", 3: "strong", 4: "deep" });
    const order = ["fast", "balanced", "strong", "deep"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(SLOT_POLICY[order[i]].maxTokens).toBeGreaterThanOrEqual(
        SLOT_POLICY[order[i - 1]].maxTokens,
      );
      expect(SLOT_POLICY[order[i]].timeoutMs).toBeGreaterThan(SLOT_POLICY[order[i - 1]].timeoutMs);
    }
    expect(SLOT_POLICY.router.maxToolIterations).toBe(0);
    expect(SLOT_POLICY.fast.reasoning).toBe("none");
  });

  test("jamais le modèle le plus cher partout : il est réservé à la revue profonde", () => {
    const anthropic = DEFAULT_SLOT_MODELS.anthropic;
    expect(anthropic.deep).toBe("claude-opus-5-5");
    for (const slot of ["router", "fast", "balanced", "strong"] as const)
      expect(anthropic[slot]).not.toContain("opus");
    expect(DEFAULT_SLOT_MODELS.gemini.router).toBe("gemini-2.5-flash-lite");
  });
});

describe("chaîne d'un emplacement", () => {
  test("par défaut : l'ordre des fournisseurs, avec le modèle de l'emplacement", () => {
    delete process.env.AI_MODEL_STRONG;
    const providers = [fakeProvider("gemini"), fakeProvider("anthropic"), fakeProvider("groq")];
    expect(describeSlot("strong", providers)).toEqual([
      "gemini:gemini-2.5-pro",
      "anthropic:claude-sonnet-5-5",
      "groq:(default)",
    ]);
  });

  test("AI_MODEL_<SLOT> réordonne et fixe les modèles, sans redéploiement", () => {
    process.env.AI_MODEL_STRONG = "anthropic:claude-opus-5-5, gemini";
    const providers = [fakeProvider("gemini"), fakeProvider("anthropic")];
    expect(describeSlot("strong", providers)).toEqual([
      "anthropic:claude-opus-5-5",
      "gemini:gemini-2.5-pro",
    ]);
  });

  test("un réglage qui ne nomme aucun fournisseur configuré retombe sur l'ordre par défaut", () => {
    process.env.AI_MODEL_STRONG = "mistral:large";
    const providers = [fakeProvider("gemini")];
    expect(describeSlot("strong", providers)).toEqual(["gemini:gemini-2.5-pro"]);
  });

  test("lecture tolérante du réglage", () => {
    expect(parseSlotSpec(" Gemini:gemini-2.5-pro ,anthropic, bad id:x ,")).toEqual([
      { provider: "gemini", model: "gemini-2.5-pro" },
      { provider: "anthropic" },
    ]);
  });

  test("AI_MODEL_ROUTER=off coupe le routage par petit modèle", () => {
    delete process.env.AI_MODEL_ROUTER;
    expect(modelRoutingEnabled()).toBe(true);
    process.env.AI_MODEL_ROUTER = "off";
    expect(modelRoutingEnabled()).toBe(false);
  });

  test("un fournisseur épinglé reçoit la politique de l'emplacement — sauf ce que la requête fixe", async () => {
    const seen: AIRequest[] = [];
    const pinned = pinToSlot(
      { provider: fakeProvider("gemini", seen), model: "gemini-2.5-pro" },
      "strong",
    );
    expect(pinned.id).toBe("gemini");
    await pinned.complete({ messages: [{ role: "user", content: "x" }] });
    expect(seen[0]).toMatchObject({
      model: "gemini-2.5-pro",
      reasoning: "medium",
      maxTokens: 8_192,
      timeoutMs: 50_000,
    });
    // Une boucle d'outils épingle le modèle qui a servi : il n'est pas remplacé.
    await pinned.complete({
      messages: [{ role: "user", content: "x" }],
      model: "gemini-2.5-flash",
    });
    expect(seen[1].model).toBe("gemini-2.5-flash");
    expect(slotChain("fast", [fakeProvider("anthropic")]).length).toBe(1);
  });
});

describe("B10 — délai d'un appel", () => {
  const p = (id: string) => fakeProvider(id);
  const msg = [{ role: "user" as const, content: "x" }];

  test("le délai du niveau prime", () => {
    expect(callTimeoutMs(p("gemini"), { messages: msg, timeoutMs: 50_000 })).toBe(50_000);
  });

  test("+20 s de réflexion seulement pour un fournisseur qui réfléchit vraiment", () => {
    expect(callTimeoutMs(p("gemini"), { messages: msg, reasoning: "medium" })).toBe(34_000);
    expect(callTimeoutMs(p("anthropic"), { messages: msg, reasoningBudget: 2048 })).toBe(28_000);
    // Groq ignore le budget : lui accorder 25 s retardait d'autant le repli.
    expect(callTimeoutMs(p("groq"), { messages: msg, reasoning: "high" })).toBe(5_000);
    expect(callTimeoutMs(p("openrouter"), { messages: msg, reasoningBudget: 4096 })).toBe(8_000);
    expect(callTimeoutMs(p("anthropic"), { messages: msg, reasoning: "none" })).toBe(8_000);
  });
});

describe("B9 — coût estimé", () => {
  test("par modèle, version datée comprise ; la réflexion est facturée comme de la sortie", () => {
    expect(priceOf("claude-haiku-4-5-20251001")).toEqual([1, 5, 0.1]);
    expect(
      estimateCostUsd({ model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0 }),
    ).toBeCloseTo(1, 6);
    expect(
      estimateCostUsd({
        model: "claude-sonnet-5-5",
        outputTokens: 500_000,
        thinkingTokens: 500_000,
      }),
    ).toBeCloseTo(10, 6);
    // L'entrée lue en cache est au tarif du cache.
    expect(
      estimateCostUsd({
        model: "claude-sonnet-5-5",
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
      }),
    ).toBeCloseTo(0.2, 6);
  });

  test("un modèle au prix inconnu rend `null`, jamais un coût inventé", () => {
    expect(estimateCostUsd({ model: "llama-3.3-70b", inputTokens: 1000 })).toBeNull();
  });

  test("AI_MODEL_PRICES complète la table", () => {
    process.env.AI_MODEL_PRICES = JSON.stringify({ "llama-3.3-70b": [0.59, 0.79] });
    expect(estimateCostUsd({ model: "llama-3.3-70b", inputTokens: 1_000_000 })).toBeCloseTo(
      0.59,
      6,
    );
  });
});

describe("B9 — écriture de la télémétrie", () => {
  test("base en retard sur la migration : la mesure historique est quand même écrite", async () => {
    const realFetch = globalThis.fetch;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = "http://telemetry.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const href =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!href.startsWith("http://telemetry.test/")) return realFetch(input, init);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      if ("tier" in body)
        return new Response(
          JSON.stringify({
            code: "PGRST204",
            message: "Could not find the 'tier' column of 'ai_agent_runs' in the schema cache",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      return new Response(null, { status: 201 });
    }) as typeof fetch;
    try {
      await recordAgentRun({
        userId: "u1",
        agent: "coach",
        intent: "chat",
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        status: "ok",
        inputTokens: 5_200,
        outputTokens: 640,
        latencyMs: 4_100,
        tier: 3,
        slot: "strong",
        thinkingTokens: 900,
        costUsd: 0.0234,
        validation: "ok",
      });
    } finally {
      globalThis.fetch = realFetch;
      if (url === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = url;
      if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    }
    expect(bodies.length).toBe(2);
    expect(bodies[0]).toMatchObject({
      tier: 3,
      slot: "strong",
      thinking_tokens: 900,
      cost_usd: 0.0234,
    });
    expect("tier" in bodies[1]).toBe(false);
    expect(bodies[1]).toMatchObject({ input_tokens: 5_200, output_tokens: 640, status: "ok" });
  });
});
