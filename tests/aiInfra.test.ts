import { test, expect } from "bun:test";
import {
  buildPrompt,
  createContextBuilder,
  createRouter,
  executeToolCalls,
  formatWith,
  generate,
  registerTool,
  runWithTools,
  stripCodeFence,
  toProviderTools,
  tryParseJson,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "../src/modules/ai/infra";

// ── Context Builder ──────────────────────────────────────────────────────────

test("context builder caps memory content and keeps the last conversation turns", () => {
  const long = "x".repeat(5000);
  const turns = Array.from({ length: 30 }, (_, i) => ({
    role: "user" as const,
    content: `t${i}`,
  }));
  const ctx = createContextBuilder()
    .withMemory([{ kind: "fact", content: long }])
    .withConversation(turns)
    .withLanguage("fr")
    .build();

  expect(ctx.memory?.[0].content.length).toBe(2000);
  expect(ctx.conversation?.length).toBe(20);
  expect(ctx.conversation?.[0].content).toBe("t10"); // last 20 → starts at t10
  expect(ctx.language).toBe("fr");
});

// ── Prompt Builder ───────────────────────────────────────────────────────────

test("prompt builder inlines context without conversation", () => {
  const msgs = buildPrompt({
    identity: "ID",
    task: "TASK",
    contextBlocks: "CTX",
    userTurn: "Q?",
  });
  expect(msgs[0]).toEqual({ role: "system", content: "ID\n\nTASK" });
  expect(msgs).toHaveLength(2);
  expect(msgs[1]).toEqual({ role: "user", content: "CTX\n\nQ?" });
});

test("prompt builder seeds context as an opening exchange when there is history", () => {
  const msgs = buildPrompt({
    identity: "ID",
    contextBlocks: "CTX",
    conversation: [{ role: "user", content: "hi" }],
    userTurn: "Q?",
  });
  expect(msgs[0].role).toBe("system");
  expect(msgs[1]).toEqual({ role: "user", content: "CTX" });
  expect(msgs[2].role).toBe("assistant");
  expect(msgs[msgs.length - 1]).toEqual({ role: "user", content: "Q?" });
});

// ── Response Formatter ───────────────────────────────────────────────────────

test("response formatter strips code fences and parses JSON", () => {
  expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  const res: AIResponse = { text: '```json\n{"a":1}\n```', provider: "x", model: "m" };
  const parsed = tryParseJson<{ a: number }>(res);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.value.a).toBe(1);
  expect(formatWith("json", res).json).toEqual({ a: 1 });
});

test("response formatter reports invalid JSON instead of throwing", () => {
  const res: AIResponse = { text: "not json", provider: "x", model: "m" };
  const parsed = tryParseJson(res);
  expect(parsed.ok).toBe(false);
});

// ── Tool System ──────────────────────────────────────────────────────────────

test("tool runtime executes registered tools and errors on unknown/side-effects", async () => {
  const off = registerTool({
    name: "echo",
    description: "echo input",
    inputSchema: { type: "object", properties: { x: { type: "number" } } },
    sideEffect: false,
    source: "local",
    execute: async (input: Record<string, unknown>) => ({ echoed: input.x }),
  });

  expect(toProviderTools(["echo"])[0].name).toBe("echo");

  const ok = await executeToolCalls([{ name: "echo", arguments: { x: 7 } }], { userId: "u1" });
  expect(ok[0].output).toEqual({ echoed: 7 });

  const unknown = await executeToolCalls([{ name: "nope", arguments: {} }], { userId: "u1" });
  expect(unknown[0].error).toContain("Unknown tool");

  off();
});

// ── AI Provider Service ──────────────────────────────────────────────────────

function fakeProvider(script: AIResponse[]): AIProvider {
  let i = 0;
  return {
    id: "fake",
    supportsTools: true,
    isConfigured: () => true,
    async complete(_req: AIRequest): Promise<AIResponse> {
      return script[Math.min(i++, script.length - 1)];
    },
  };
}

test("provider service retries once on a transient error", async () => {
  let calls = 0;
  const flaky: AIProvider = {
    id: "flaky",
    isConfigured: () => true,
    async complete(): Promise<AIResponse> {
      calls++;
      if (calls === 1) throw new Error("network timeout");
      return { text: "ok", provider: "flaky", model: "m" };
    },
  };
  const res = await generate({ messages: [{ role: "user", content: "hi" }] }, { provider: flaky });
  expect(res.text).toBe("ok");
  expect(calls).toBe(2);
});

test("provider service runs the full tool loop and returns the final answer", async () => {
  const off = registerTool({
    name: "get_number",
    description: "returns a number",
    inputSchema: { type: "object", properties: {} },
    sideEffect: false,
    source: "local",
    execute: async () => 42,
  });
  const provider = fakeProvider([
    { text: "", provider: "fake", model: "m", toolCalls: [{ name: "get_number", arguments: {} }] },
    { text: "the number is 42", provider: "fake", model: "m" },
  ]);

  const res = await runWithTools(
    { messages: [{ role: "user", content: "what number?" }] },
    { provider, tools: ["get_number"], toolContext: { userId: "u1" } },
  );
  expect(res.text).toBe("the number is 42");
  off();
});

// ── Router ───────────────────────────────────────────────────────────────────

test("router routes explicit intents and falls back to chat", async () => {
  const router = createRouter();
  const explicit = await router.route({ userId: "u1", intent: "assess_risk", input: "" });
  expect(explicit.agent).toBe("risk-manager");
  expect(explicit.reason).toBe("explicit-intent");

  const fallback = await router.route({ userId: "u1", input: "freeform" });
  expect(fallback.intent).toBe("chat");
  expect(fallback.reason).toBe("fallback");
});
