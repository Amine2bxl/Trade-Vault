import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GeminiProvider, resetGeminiModelMemory } from "../src/modules/ai-provider/gemini";
import {
  GroqProvider,
  OpenRouterProvider,
  fitMaxTokens,
  isModelRefusal,
  resetOpenAICompatibleMemory,
} from "../src/modules/ai-provider/openai";
import { ProviderHttpError } from "../src/modules/ai-provider/types";
import type { AIProvider, AIRequest } from "../src/modules/ai-provider/types";
import { routeCompletion } from "../src/modules/ai/runtime/router";
import { circuit } from "../src/modules/ai/runtime/circuit";
import { normalizeError } from "../src/modules/ai/runtime/errors";

/*
 * « The AI analysis service didn't respond » — les causes relevées dans les
 * journaux de la preview (29/09) :
 *   1. Gemini 2.5 Pro PUIS Flash répondaient 503 « high demand » ;
 *   2. Groq refusait en 413 : la limite par minute compte `max_tokens`, et le
 *      mot « model » du message déclenchait à tort la découverte d'un autre
 *      modèle, à la limite encore plus basse ;
 *   3. OpenRouter élisait un modèle gratuit réservé (403 « agentic harnesses »)
 *      et n'en essayait pas d'autre ;
 *   4. ces échecs ouvraient les trois circuits : la question suivante échouait
 *      en 0 ms sans qu'aucune requête ne parte.
 */

const realFetch = globalThis.fetch;
const env = { ...process.env };
let calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];

type Reply = { status: number; body: string };
function mockFetch(route: (url: string, body: Record<string, unknown> | null) => Reply) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ url: String(url), body });
    const r = route(String(url), body);
    return new Response(r.body, { status: r.status });
  }) as typeof fetch;
}

const okChat = JSON.stringify({
  choices: [{ message: { content: "Réponse." }, finish_reason: "stop" }],
});
const okGemini = JSON.stringify({ candidates: [{ content: { parts: [{ text: "Réponse." }] } }] });
const req: AIRequest = { messages: [{ role: "user", content: "Question ?" }], maxTokens: 6144 };

beforeEach(() => {
  calls = [];
  resetGeminiModelMemory();
  resetOpenAICompatibleMemory();
  circuit.reset();
  process.env.GEMINI_API_KEY = "k";
  process.env.GROQ_API_KEY = "k";
  process.env.OPENROUTER_API_KEY = "k";
  delete process.env.GEMINI_MODEL;
  delete process.env.GROQ_MODEL;
  delete process.env.OPENROUTER_MODEL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

describe("refus de modèle ou de requête", () => {
  test("un 413 « too large for model » n'est PAS un refus de modèle", () => {
    expect(isModelRefusal(413, "Request too large for model `x`")).toBe(false);
    expect(isModelRefusal(429, "model rate limit")).toBe(false);
    expect(isModelRefusal(404, "")).toBe(true);
    expect(isModelRefusal(403, "only available on agentic harnesses")).toBe(true);
    expect(isModelRefusal(403, "Invalid API key")).toBe(false);
  });

  test("la limite par minute se recalcule depuis le refus de Groq", () => {
    const body = "on tokens per minute (TPM): Limit 12000, Requested 13725";
    // entrée = 13725 - 6144 = 7581 ; place = 11400 - 7581 = 3819
    expect(fitMaxTokens(body, 6144)).toBe(3819);
    // Limite 8000 : il ne resterait que ~0 token de réponse → on abandonne.
    expect(fitMaxTokens("Limit 8000, Requested 13725", 6144)).toBeUndefined();
    expect(fitMaxTokens("rien", 6144)).toBeUndefined();
  });

  test("un 403 de modèle réservé n'est pas une « session invalide »", () => {
    const e = normalizeError(
      new ProviderHttpError("AI access refused (m): only available on agentic harnesses", 403),
      "openrouter",
    );
    expect(e.type).toBe("provider_unavailable");
    const auth = normalizeError(new ProviderHttpError("Unauthorized", 401), "openrouter");
    expect(auth.type).toBe("auth");
  });
});

describe("Groq", () => {
  test("413 de débit : même modèle, sortie réduite — aucune découverte", async () => {
    mockFetch((_url, body) =>
      body && (body.max_tokens as number) > 5000
        ? {
            status: 413,
            body: '{"error":{"message":"Request too large for model `llama-3.3-70b-versatile` on tokens per minute (TPM): Limit 12000, Requested 13725"}}',
          }
        : { status: 200, body: okChat },
    );
    const res = await GroqProvider.complete(req);
    expect(res.text).toBe("Réponse.");
    expect(calls.map((c) => c.url.endsWith("/models"))).toEqual([false, false]);
    expect(calls.map((c) => c.body?.model)).toEqual([
      "llama-3.3-70b-versatile",
      "llama-3.3-70b-versatile",
    ]);
    expect(calls[1].body?.max_tokens).toBe(3819);
  });
});

describe("OpenRouter", () => {
  test("un candidat réservé (403) est écarté, le suivant répond et est retenu", async () => {
    const models = {
      data: [
        {
          id: "thinkingmachines/inkling-small:free",
          context_length: 1_000_000,
          supported_parameters: [],
        },
        { id: "qwen/qwen3-235b:free", context_length: 128_000, supported_parameters: [] },
        {
          id: "meta-llama/llama-3.3-70b-instruct:free",
          context_length: 128_000,
          supported_parameters: [],
        },
      ],
    };
    mockFetch((url, body) => {
      if (url.endsWith("/models")) return { status: 200, body: JSON.stringify(models) };
      if (body?.model === "deepseek/deepseek-chat-v3-0324:free")
        return { status: 404, body: '{"error":{"message":"No endpoints found"}}' };
      if (body?.model === "meta-llama/llama-3.3-70b-instruct:free")
        return { status: 403, body: '{"error":{"message":"only available on agentic harnesses"}}' };
      return { status: 200, body: okChat };
    });
    const res = await OpenRouterProvider.complete(req);
    expect(res.model).toBe("qwen/qwen3-235b:free");
    // La question suivante va droit au modèle retenu.
    calls = [];
    await OpenRouterProvider.complete(req);
    expect(calls.map((c) => c.body?.model)).toEqual(["qwen/qwen3-235b:free"]);
  });
});

describe("Gemini", () => {
  test("Pro puis Flash saturés (503) : Flash-Lite répond", async () => {
    const busy =
      '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}';
    mockFetch((url) =>
      /flash-lite/.test(url) ? { status: 200, body: okGemini } : { status: 503, body: busy },
    );
    const res = await GeminiProvider.complete(req);
    expect(res.model).toBe("gemini-2.5-flash-lite");
    expect(calls.map((c) => c.url.match(/models\/([^:]+)/)?.[1])).toEqual([
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]);
  });
});

describe("routeur", () => {
  const fake = (id: string, outcome: Error | string): AIProvider & { calls: number } => {
    const p = {
      id,
      supportsTools: true,
      calls: 0,
      isConfigured: () => true,
      async complete() {
        p.calls++;
        if (outcome instanceof Error) throw outcome;
        return { text: outcome, provider: id, model: "m" };
      },
    };
    return p;
  };

  test("une requête trop grosse (413) n'ouvre pas le circuit", async () => {
    const p = fake("big", new ProviderHttpError("Request too large", 413));
    await routeCompletion(req, { provider: p }).catch(() => {});
    await routeCompletion(req, { provider: p }).catch(() => {});
    expect(circuit.status("big").state).toBe("closed");
  });

  test("tous les circuits ouverts : on essaie quand même, au lieu d'échouer en 0 ms", async () => {
    circuit.trip("a");
    circuit.trip("b");
    const a = fake("a", new ProviderHttpError("down", 503));
    const b = fake("b", "Réponse réelle");
    const res = await routeCompletion(req, { providers: [a, b] });
    expect(res.text).toBe("Réponse réelle");
  });
});

describe("Jarvis connaît la date du jour", () => {
  test("« ce mois-ci » est borné par la date locale du trader, pas par celle du modèle", async () => {
    const { dateRule } = await import("../src/modules/ai/agents/coach.agent");
    const r = dateRule("2026-09-29");
    expect(r).toContain("Tuesday 2026-09-29");
    expect(r).toContain("September 2026, from 2026-09-01 to 2026-09-29");
    expect(r).toContain("Monday 2026-09-28");
  });
  test("une date invalide retombe sur la date du serveur", async () => {
    const { dateRule } = await import("../src/modules/ai/agents/coach.agent");
    expect(dateRule("n'importe quoi")).toMatch(/TODAY is \w+ \d{4}-\d{2}-\d{2}/);
  });
});
