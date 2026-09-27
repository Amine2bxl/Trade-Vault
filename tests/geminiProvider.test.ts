import { afterEach, beforeEach, expect, test } from "bun:test";
import { GeminiProvider } from "../src/modules/ai-provider/gemini";
import { resolveToolCapableProviders } from "../src/modules/ai-provider/registry";

/*
 * Gemini est devenu le fournisseur d'outils de Jarvis : 2.5 Pro refusé sur
 * l'offre gratuite et Groq/OpenRouter mal configurés, c'était lui ou rien.
 * Ces tests fixent les trois contrats dont dépend la boucle d'outils.
 */

type Call = { url: string; body: Record<string, unknown> };
const realFetch = globalThis.fetch;
const env = { ...process.env };
let calls: Call[] = [];

function mockFetch(responses: Array<{ status: number; json?: unknown; text?: string }>) {
  let i = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    const r = responses[Math.min(i++, responses.length - 1)];
    const payload = r.json !== undefined ? JSON.stringify(r.json) : (r.text ?? "");
    return new Response(payload, { status: r.status });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  delete process.env.AI_PROVIDER;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

test("Gemini déclare les outils sans `additionalProperties` et rend les appels de fonction", async () => {
  mockFetch([
    {
      status: 200,
      json: {
        candidates: [
          {
            content: {
              parts: [{ functionCall: { name: "get_day", args: { date: "2026-09-12" } } }],
            },
            finishReason: "STOP",
          },
        ],
      },
    },
  ]);
  const res = await GeminiProvider.complete({
    messages: [{ role: "user", content: "What did I note on Sep 12?" }],
    tools: [
      {
        name: "get_day",
        description: "Read one day.",
        parameters: {
          type: "object",
          properties: { date: { type: "string" } },
          additionalProperties: false,
        },
      },
      {
        name: "get_profile",
        description: "Who the trader is.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    ],
    toolChoice: "auto",
  });

  const decl = (calls[0].body.tools as Array<{ functionDeclarations: unknown[] }>)[0]
    .functionDeclarations as Array<Record<string, unknown>>;
  expect(JSON.stringify(decl)).not.toContain("additionalProperties");
  // Un outil sans argument n'envoie pas de `parameters` (Gemini refuse un objet vide).
  expect(decl.find((d) => d.name === "get_profile")?.parameters).toBeUndefined();
  expect(res.toolCalls).toEqual([{ name: "get_day", arguments: { date: "2026-09-12" } }]);
  expect(res.finishReason).toBe("tool_calls");
});

test("un refus de modèle (429 sur 2.5 Pro gratuit) redescend sur Flash", async () => {
  mockFetch([
    { status: 429, text: '{"error":{"message":"Quota exceeded, limit: 0"}}' },
    {
      status: 200,
      json: { candidates: [{ content: { parts: [{ text: "Your name is Amine." }] } }] },
    },
  ]);
  const res = await GeminiProvider.complete({ messages: [{ role: "user", content: "My name?" }] });
  expect(calls[0].url).toContain("gemini-2.5-pro");
  expect(calls[1].url).toContain("gemini-2.5-flash");
  expect(res.text).toBe("Your name is Amine.");
  expect(res.model).toBe("gemini-2.5-flash");
});

test("le raisonnement interne (`thought`) n'est jamais rendu au trader", async () => {
  mockFetch([
    {
      status: 200,
      json: {
        candidates: [
          {
            content: {
              parts: [{ text: "internal reasoning…", thought: true }, { text: "Answer." }],
            },
          },
        ],
      },
    },
  ]);
  const res = await GeminiProvider.complete({ messages: [{ role: "user", content: "?" }] });
  expect(res.text).toBe("Answer.");
});

test("Gemini fait partie des fournisseurs d'outils quand sa clé est posée", () => {
  expect(resolveToolCapableProviders().map((p) => p.id)).toContain("gemini");
});
