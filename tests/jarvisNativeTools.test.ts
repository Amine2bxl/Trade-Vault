import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AnthropicProvider, toAnthropicMessages } from "../src/modules/ai-provider/anthropic";
import {
  GeminiProvider,
  resetGeminiModelMemory,
  toGeminiContents,
} from "../src/modules/ai-provider/gemini";
import { toOpenAIMessages } from "../src/modules/ai-provider/openai";
import { runWithTools } from "../src/modules/ai/provider-service";
import { registerTool } from "../src/modules/ai/tools/types";
import type { AIMessage, AIProvider, AIRequest, AIResponse } from "../src/modules/ai-provider";

/**
 * LOT 2 — LES APPELS D'OUTILS NATIFS.
 *
 * Jusqu'ici, un appel d'outil revenait au modèle en TEXTE (« TOOL RESULTS… ») :
 * le fournisseur perdait le lien entre son appel et le résultat, et — pour les
 * modèles qui réfléchissent — la réflexion signée du tour précédent. Chaque
 * adaptateur rejoue désormais le tour d'outils dans SA forme native, en
 * gardant le texte pour les autres. Ces tests figent le format envoyé sur le
 * fil, fournisseur par fournisseur, et le comportement de la boucle.
 */

type Captured = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
const realFetch = globalThis.fetch;
const env = { ...process.env };
let captured: Captured[] = [];

function mockFetch(responses: unknown[]) {
  let i = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    captured.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    const payload = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
}

beforeEach(() => {
  captured = [];
  resetGeminiModelMemory();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

const STATS_TOOL = {
  name: "get_stats",
  description: "Read stats.",
  parameters: { type: "object", properties: { days: { type: "number" } } },
};

// ── Anthropic ────────────────────────────────────────────────────────────────

describe("Anthropic", () => {
  const thinking = {
    type: "thinking",
    thinking: "Il faut la fenêtre de 30 jours.",
    signature: "sig-abc",
  };
  const toolUse = { type: "tool_use", id: "toolu_01", name: "get_stats", input: { days: 30 } };
  const history: AIMessage[] = [
    { role: "system", content: "PERSONA + RÈGLES" },
    { role: "system", content: "PERIOD: septembre" },
    { role: "user", content: "Mon P&L de septembre ?" },
    {
      role: "assistant",
      content: 'Calling tools: get_stats({"days":30})',
      toolCalls: [{ id: "toolu_01", name: "get_stats", arguments: { days: 30 } }],
      providerTurn: { provider: "anthropic", model: "claude-sonnet-5-5", raw: [thinking, toolUse] },
    },
    {
      role: "user",
      content: "TOOL RESULTS (measured data …)",
      toolResults: [{ id: "toolu_01", name: "get_stats", output: { totalPnl: 1250 } }],
    },
  ];

  test("le tour d'outils est rejoué TEL QUEL, réflexion signée comprise, puis les tool_result", () => {
    const wire = toAnthropicMessages(history);
    expect(wire.length).toBe(3);
    expect(wire[1]).toEqual({ role: "assistant", content: [thinking, toolUse] });
    expect(wire[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_01", content: '{"totalPnl":1250}' }],
    });
  });

  test("un tour d'outils d'un AUTRE fournisseur reste du texte", () => {
    const foreign = history.map((m) =>
      m.providerTurn ? { ...m, providerTurn: { ...m.providerTurn, provider: "gemini" } } : m,
    );
    const wire = toAnthropicMessages(foreign);
    expect(wire.every((w) => typeof w.content === "string")).toBe(true);
  });

  test("requête Sonnet 5.5 : effort, système en blocs avec cache, pas de température, choix « none »", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    mockFetch([
      {
        model: "claude-sonnet-5-5",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Septembre : +1 250 €." }],
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 900,
          cache_creation_input_tokens: 0,
        },
      },
    ]);
    const res = await AnthropicProvider.complete({
      messages: history,
      model: "claude-sonnet-5-5",
      reasoning: "medium",
      temperature: 0.3,
      tools: [STATS_TOOL],
      toolChoice: "none",
    });
    const { body, headers } = captured[0];
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body.temperature).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(body.tool_choice).toEqual({ type: "none" });
    const system = body.system as { text: string; cache_control?: unknown }[];
    expect(system.map((s) => s.text)).toEqual(["PERSONA + RÈGLES", "PERIOD: septembre"]);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[1].cache_control).toBeUndefined();
    expect(body.fallbacks).toBe("default");
    expect(headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    // L'entrée facturée inclut le cache ; la part lue en cache est remontée à part.
    expect(res.usage).toMatchObject({
      inputTokens: 1_000,
      outputTokens: 20,
      cachedInputTokens: 900,
    });
    expect(res.text).toBe("Septembre : +1 250 €.");
    expect(res.providerTurn).toBeUndefined();
  });

  test("réponse d'outils : appels normalisés + tour brut à rejouer", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    mockFetch([
      {
        model: "claude-sonnet-5-5",
        stop_reason: "tool_use",
        content: [thinking, { type: "text", text: "Je regarde." }, toolUse],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    ]);
    const res = await AnthropicProvider.complete({
      messages: [{ role: "user", content: "x" }],
      model: "claude-sonnet-5-5",
      tools: [STATS_TOOL],
    });
    expect(res.toolCalls).toEqual([{ id: "toolu_01", name: "get_stats", arguments: { days: 30 } }]);
    expect(res.providerTurn).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      raw: [thinking, { type: "text", text: "Je regarde." }, toolUse],
    });
    expect(res.finishReason).toBe("tool_calls");
  });

  test("un refus est rendu VIDE, sans appel d'outil à demi écrit", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    mockFetch([
      {
        model: "claude-sonnet-5-5",
        stop_reason: "refusal",
        content: [{ type: "text", text: "Je ne peux pas…" }, toolUse],
      },
    ]);
    const res = await AnthropicProvider.complete({
      messages: [{ role: "user", content: "x" }],
      tools: [STATS_TOOL],
    });
    expect(res.text).toBe("");
    expect(res.toolCalls).toBeUndefined();
    expect(res.finishReason).toBe("content_filter");
  });

  test("Haiku 4.5 : budget de réflexion explicite, jamais de choix d'outil forcé avec la réflexion", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    mockFetch([
      {
        model: "claude-haiku-4-5",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
      },
    ]);
    await AnthropicProvider.complete({
      messages: [{ role: "user", content: "x" }],
      model: "claude-haiku-4-5",
      reasoning: "medium",
      maxTokens: 4_096,
      temperature: 0.2,
      tools: [STATS_TOOL],
      toolChoice: "required",
    });
    const { body, headers } = captured[0];
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 2_048 });
    expect(body.output_config).toBeUndefined();
    expect(body.tool_choice).toEqual({ type: "auto" });
    expect(body.temperature).toBeUndefined();
    // Le repli serveur « default » n'est demandé qu'aux modèles qui l'acceptent.
    expect(body.fallbacks).toBeUndefined();
    expect(headers["anthropic-beta"]).toBeUndefined();
  });
});

// ── Gemini ───────────────────────────────────────────────────────────────────

describe("Gemini", () => {
  const callPart = {
    functionCall: { name: "get_day", args: { date: "2026-09-12" } },
    thoughtSignature: "sig-g",
  };
  const turn = (model: string): AIMessage => ({
    role: "assistant",
    content: 'Calling tools: get_day({"date":"2026-09-12"})',
    toolCalls: [{ id: "tvcall_0", name: "get_day", arguments: { date: "2026-09-12" } }],
    providerTurn: { provider: "gemini", model, raw: [callPart] },
  });
  const results: AIMessage = {
    role: "user",
    content: "TOOL RESULTS …",
    toolResults: [
      { id: "tvcall_0", name: "get_day", output: [{ pnl: 120 }] },
      { id: "fc_7", name: "get_stats", error: "Database unavailable" },
    ],
  };

  test("parts natives rejouées telles quelles, réponses de fonction appariées", () => {
    const contents = toGeminiContents(
      [
        { role: "system", content: "S" },
        { role: "user", content: "Le 12 ?" },
        turn("gemini-2.5-pro"),
        results,
      ],
      "gemini-2.5-pro",
    );
    expect(contents[1]).toEqual({ role: "model", parts: [callPart] });
    expect(contents[2]).toEqual({
      role: "user",
      parts: [
        // Id synthétique : jamais renvoyé à Gemini.
        { functionResponse: { name: "get_day", response: { output: [{ pnl: 120 }] } } },
        {
          functionResponse: {
            id: "fc_7",
            name: "get_stats",
            response: { error: "Database unavailable" },
          },
        },
      ],
    });
  });

  test("Gemini 3 : un appel produit par un autre modèle reçoit la signature sentinelle", () => {
    const contents = toGeminiContents(
      [{ role: "user", content: "x" }, turn("gemini-2.5-flash")],
      "gemini-3-pro",
    );
    expect(contents[1].parts[0].thoughtSignature).toBe("skip_thought_signature_validator");
  });

  test("requête : outils gardés en mode NONE, réflexion bornée ; réponse : signatures conservées", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockFetch([
      {
        candidates: [
          {
            content: { parts: [{ text: "pensée", thought: true }, callPart] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 800,
          candidatesTokenCount: 40,
          thoughtsTokenCount: 300,
          cachedContentTokenCount: 500,
        },
      },
    ]);
    const res = await GeminiProvider.complete({
      messages: [{ role: "user", content: "Le 12 ?" }],
      model: "gemini-2.5-flash",
      reasoning: "medium",
      tools: [STATS_TOOL],
      toolChoice: "none",
    });
    const body = captured[0].body as {
      toolConfig: { functionCallingConfig: { mode: string } };
      generationConfig: { thinkingConfig: { thinkingBudget: number } };
      tools: unknown[];
    };
    expect(captured[0].url).toContain("/models/gemini-2.5-flash:generateContent");
    expect(body.tools.length).toBe(1);
    expect(body.toolConfig.functionCallingConfig.mode).toBe("NONE");
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(2_048);
    expect(res.text).toBe("");
    expect(res.toolCalls).toEqual([{ name: "get_day", arguments: { date: "2026-09-12" } }]);
    expect(res.providerTurn?.raw).toEqual([{ text: "pensée", thought: true }, callPart]);
    // B9 : la réflexion et le cache sont enfin comptés.
    expect(res.usage).toMatchObject({
      inputTokens: 800,
      outputTokens: 40,
      thinkingTokens: 300,
      cachedInputTokens: 500,
    });
  });
});

// ── OpenAI-compatibles ───────────────────────────────────────────────────────

describe("OpenAI-compatibles", () => {
  test("tool_calls rejoués et résultats en messages `tool`, un par appel", () => {
    const raw = {
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_stats", arguments: '{"days":30}' },
        },
      ],
      reasoning: "groq reasoning",
    };
    const wire = toOpenAIMessages(
      [
        { role: "user", content: "x" },
        {
          role: "assistant",
          content: "Calling tools",
          providerTurn: { provider: "groq", model: "m", raw },
        },
        {
          role: "user",
          content: "TOOL RESULTS",
          toolResults: [{ id: "call_1", name: "get_stats", output: { n: 3 } }],
        },
      ],
      "groq",
    );
    expect(wire[1]).toEqual({
      role: "assistant",
      content: null,
      tool_calls: raw.tool_calls,
      reasoning: "groq reasoning",
    });
    expect(wire[2]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: '{"output":{"n":3}}',
    });
  });

  test("le tour d'un autre fournisseur reste du texte", () => {
    const wire = toOpenAIMessages(
      [
        {
          role: "assistant",
          content: "Calling tools",
          providerTurn: { provider: "gemini", model: "m", raw: [] },
        },
        {
          role: "user",
          content: "TOOL RESULTS",
          toolResults: [{ id: "tvcall_0", name: "x", output: 1 }],
        },
      ],
      "openai",
    );
    expect(wire).toEqual([
      { role: "assistant", content: "Calling tools" },
      { role: "user", content: "TOOL RESULTS" },
    ]);
  });
});

// ── La boucle ────────────────────────────────────────────────────────────────

describe("runWithTools", () => {
  function scripted(id: string, responses: AIResponse[], seen: AIRequest[]): AIProvider {
    let i = 0;
    return {
      id,
      supportsTools: true,
      isConfigured: () => true,
      async complete(req) {
        seen.push(req);
        return responses[Math.min(i++, responses.length - 1)];
      },
    };
  }
  const askTool = (model: string): AIResponse => ({
    text: "",
    provider: "p",
    model,
    finishReason: "tool_calls",
    toolCalls: [{ name: "test_native_echo", arguments: { n: 1 } }],
    providerTurn: { provider: "p", model, raw: { native: true } },
  });

  test("modèle épinglé, ids synthétiques appariés, dernier appel sans nouvel outil (outils déclarés, choix « none »)", async () => {
    const off = registerTool({
      name: "test_native_echo",
      description: "echo",
      inputSchema: { type: "object" },
      sideEffect: false,
      source: "local",
      execute: async (input) => ({ echo: input }),
    });
    try {
      const seen: AIRequest[] = [];
      const provider = scripted(
        "native-loop-1",
        [
          askTool("model-served"),
          askTool("model-served"),
          { text: "Réponse.", provider: "p", model: "model-served" },
        ],
        seen,
      );
      const res = await runWithTools(
        { messages: [{ role: "user", content: "go" }] },
        { provider, tools: ["test_native_echo"], toolContext: { userId: "u1" }, maxIterations: 2 },
      );
      expect(res.text).toBe("Réponse.");
      expect(seen.length).toBe(3);
      expect(seen[0].model).toBeUndefined();
      expect(seen[1].model).toBe("model-served");
      expect(seen[2].model).toBe("model-served");
      expect(seen[2].toolChoice).toBe("none");
      expect(seen[2].tools?.map((t) => t.name)).toEqual(["test_native_echo"]);
      const assistant = seen[1].messages[1];
      expect(assistant.toolCalls?.[0].id).toBe("tvcall_0");
      expect(assistant.providerTurn).toEqual({
        provider: "p",
        model: "model-served",
        raw: { native: true },
      });
      const results = seen[1].messages[2];
      expect(results.toolResults).toEqual([
        { id: "tvcall_0", name: "test_native_echo", output: { echo: { n: 1 } } },
      ]);
      expect(results.content).toContain("TOOL RESULTS");
    } finally {
      off();
    }
  });

  test("un refus n'exécute aucun outil", async () => {
    let executed = 0;
    const off = registerTool({
      name: "test_native_echo",
      description: "echo",
      inputSchema: { type: "object" },
      sideEffect: false,
      source: "local",
      execute: async () => {
        executed += 1;
        return null;
      },
    });
    try {
      const seen: AIRequest[] = [];
      const provider = scripted(
        "native-loop-2",
        [{ ...askTool("m"), finishReason: "content_filter" }],
        seen,
      );
      const res = await runWithTools(
        { messages: [{ role: "user", content: "go" }] },
        { provider, tools: ["test_native_echo"], toolContext: { userId: "u1" } },
      );
      expect(res.finishReason).toBe("content_filter");
      expect(executed).toBe(0);
      expect(seen.length).toBe(1);
    } finally {
      off();
    }
  });

  test("une réponse coupée (« length ») n'exécute pas ses appels tronqués", async () => {
    let executed = 0;
    const off = registerTool({
      name: "test_native_echo",
      description: "echo",
      inputSchema: { type: "object" },
      sideEffect: false,
      source: "local",
      execute: async () => {
        executed += 1;
        return null;
      },
    });
    try {
      const seen: AIRequest[] = [];
      const provider = scripted(
        "native-loop-3",
        [
          { ...askTool("m"), finishReason: "length" },
          { text: "Fin.", provider: "p", model: "m" },
        ],
        seen,
      );
      const res = await runWithTools(
        { messages: [{ role: "user", content: "go" }] },
        { provider, tools: ["test_native_echo"], toolContext: { userId: "u1" } },
      );
      expect(res.text).toBe("Fin.");
      expect(executed).toBe(0);
      expect(seen[1].toolChoice).toBe("none");
    } finally {
      off();
    }
  });

  test("les appels d'un même tour s'exécutent en parallèle", async () => {
    const off = registerTool({
      name: "test_native_echo",
      description: "echo",
      inputSchema: { type: "object" },
      sideEffect: false,
      source: "local",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 120));
        return null;
      },
    });
    try {
      const seen: AIRequest[] = [];
      const three: AIResponse = {
        ...askTool("m"),
        toolCalls: [1, 2, 3].map((n) => ({ name: "test_native_echo", arguments: { n } })),
      };
      const provider = scripted(
        "native-loop-4",
        [three, { text: "ok", provider: "p", model: "m" }],
        seen,
      );
      const started = Date.now();
      await runWithTools(
        { messages: [{ role: "user", content: "go" }] },
        { provider, tools: ["test_native_echo"], toolContext: { userId: "u1" } },
      );
      expect(Date.now() - started).toBeLessThan(300);
      expect(seen[1].messages[2].toolResults?.map((r) => r.id)).toEqual([
        "tvcall_0",
        "tvcall_1",
        "tvcall_2",
      ]);
    } finally {
      off();
    }
  });
});
