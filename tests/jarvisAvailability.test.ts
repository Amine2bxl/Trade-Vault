import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GeminiProvider, resetGeminiModelMemory } from "../src/modules/ai-provider/gemini";
import { ProviderHttpError, parseRetryAfterMs } from "../src/modules/ai-provider/types";
import type { AIProvider, AIRequest } from "../src/modules/ai-provider/types";
import { routeCompletion } from "../src/modules/ai/runtime/router";
import { circuit } from "../src/modules/ai/runtime/circuit";
import { toInsightTradesPayload } from "../src/domain/tradeCalcs";
import { TradesSchema } from "../src/backend/ai-payload";
import type { Trade } from "../src/app/types";

/*
 * « Analyse hors ligne » — les causes relevées dans les journaux de prod :
 *   1. une note de trade > 1 500 caractères faisait rejeter tout le contexte ;
 *   2. chaque question payait un appel perdu à 2.5 Pro (404) ;
 *   3. un 429 de Gemini faisait abandonner Gemini au lieu d'attendre ;
 *   4. les replis (OpenRouter) pointaient vers un modèle retiré.
 */

const realFetch = globalThis.fetch;
const env = { ...process.env };
let urls: string[] = [];

function mockFetch(responses: Array<{ status: number; body: string }>) {
  let i = 0;
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(r.body, { status: r.status });
  }) as typeof fetch;
}

const ok = JSON.stringify({ candidates: [{ content: { parts: [{ text: "Réponse." }] } }] });
const req: AIRequest = { messages: [{ role: "user", content: "Question ?" }] };

beforeEach(() => {
  urls = [];
  resetGeminiModelMemory();
  circuit.reset();
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

describe("Gemini", () => {
  test("un modèle refusé (404) est retenu : la question suivante va droit à Flash", async () => {
    mockFetch([
      { status: 404, body: '{"error":{"message":"models/gemini-2.5-pro is not found"}}' },
      { status: 200, body: ok },
      { status: 200, body: ok },
    ]);
    await GeminiProvider.complete(req);
    await GeminiProvider.complete(req);
    expect(urls.map((u) => u.match(/models\/([^:]+)/)?.[1])).toEqual([
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash",
    ]);
  });

  test("un 429 porte son statut et le délai demandé par Google", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    const body = JSON.stringify({
      error: {
        code: 429,
        details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" }],
      },
    });
    mockFetch([{ status: 429, body }]);
    const err = await GeminiProvider.complete(req).catch((e) => e);
    expect(err instanceof ProviderHttpError).toBe(true);
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(7000);
  });

  test("délai de reprise : RetryInfo Google ou en-tête Retry-After", () => {
    expect(parseRetryAfterMs('{"retryDelay": "2.5s"}')).toBe(2500);
    expect(parseRetryAfterMs("", "3")).toBe(3000);
    expect(parseRetryAfterMs("nothing")).toBeUndefined();
  });
});

describe("routeur", () => {
  function fakeProvider(outcomes: Array<Error | string>): AIProvider & { calls: number } {
    const p = {
      id: "fake",
      supportsTools: true,
      calls: 0,
      isConfigured: () => true,
      async complete() {
        const o = outcomes[Math.min(p.calls++, outcomes.length - 1)];
        if (o instanceof Error) throw o;
        return { text: o, provider: "fake", model: "m" };
      },
    };
    return p;
  }

  test("un quota avec délai court : on attend, puis on réessaie le MÊME fournisseur", async () => {
    const p = fakeProvider([new ProviderHttpError("Rate limit", 429, 20), "Réponse après attente"]);
    const res = await routeCompletion(req, { provider: p });
    expect(res.text).toBe("Réponse après attente");
    expect(p.calls).toBe(2);
  });

  test("un quota passe d'abord au fournisseur suivant, SANS attendre", async () => {
    const saturated = fakeProvider([new ProviderHttpError("Rate limit", 429, 18_000), "jamais"]);
    const backup = fakeProvider(["Réponse du repli"]);
    (backup as { id: string }).id = "backup";
    const t0 = Date.now();
    const res = await routeCompletion(req, { providers: [saturated, backup] });
    expect(res.text).toBe("Réponse du repli");
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(saturated.calls).toBe(1);
  });

  test("tous en échec : on attend le plus court délai annoncé, puis on réessaie", async () => {
    const a = fakeProvider([new ProviderHttpError("Rate limit", 429, 30), "Réponse après attente"]);
    const b = fakeProvider([new ProviderHttpError("Bad model", 404)]);
    (b as { id: string }).id = "b";
    const res = await routeCompletion(req, { providers: [a, b] });
    expect(res.text).toBe("Réponse après attente");
    expect(a.calls).toBe(2);
  });

  test("un quota JOURNALIER écarte le fournisseur au lieu de l'attendre", async () => {
    const day = fakeProvider([new ProviderHttpError("PerDay", 429, undefined, true)]);
    (day as { id: string }).id = "daily";
    const backup = fakeProvider(["ok"]);
    (backup as { id: string }).id = "backup2";
    await routeCompletion(req, { providers: [day, backup] });
    expect(circuit.status("daily").state).toBe("open");
  });

  test("un quota n'ouvre pas le circuit du fournisseur", async () => {
    const p = fakeProvider([new ProviderHttpError("Rate limit", 429)]);
    await routeCompletion(req, { provider: p }).catch(() => {});
    await routeCompletion(req, { provider: p }).catch(() => {});
    expect(circuit.status("fake").state).toBe("closed");
  });

  test("un délai trop long n'est pas attendu : l'erreur remonte", async () => {
    const p = fakeProvider([new ProviderHttpError("Rate limit", 429, 120_000), "jamais"]);
    const err = await routeCompletion(req, { provider: p }).catch((e) => e);
    expect(err.type).toBe("quota");
    expect(p.calls).toBe(1);
  });
});

describe("contexte envoyé à Jarvis", () => {
  test("une note très longue est bornée : le contexte passe le schéma du serveur", () => {
    const trade = {
      date: "2026-09-28",
      symbol: "NQ",
      direction: "long",
      pnl: 100,
      rMultiple: 1,
      strategy: "x".repeat(80),
      mistakes: Array.from({ length: 30 }, () => "m".repeat(150)),
      setupQuality: 3,
      confluences: [],
      notes: "n".repeat(4000),
    } as unknown as Trade;
    const payload = toInsightTradesPayload([trade]);
    expect(payload[0].notes?.length).toBe(1500);
    expect(TradesSchema.safeParse(payload).success).toBe(true);
  });
});
