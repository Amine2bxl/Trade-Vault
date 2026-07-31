import { describe, it, expect } from "bun:test";
import { CircuitBreaker } from "../src/modules/ai/runtime/circuit";
import { normalizeError, isTransientType } from "../src/modules/ai/runtime/errors";
import { MetricsStore } from "../src/modules/ai/runtime/metrics";

describe("CircuitBreaker", () => {
  it("fermé au départ, aucun skip", () => {
    const cb = new CircuitBreaker(60_000, 2);
    expect(cb.isOpen("gemini")).toBe(false);
    expect(cb.status("gemini").state).toBe("closed");
  });

  it("s'ouvre après le seuil d'échecs puis skippe", () => {
    const cb = new CircuitBreaker(60_000, 2);
    cb.recordFailure("gemini");
    expect(cb.isOpen("gemini")).toBe(false);
    cb.recordFailure("gemini");
    expect(cb.isOpen("gemini")).toBe(true);
    expect(cb.status("gemini").state).toBe("open");
  });

  it("revient fermé après un succès", () => {
    const cb = new CircuitBreaker(60_000, 2);
    cb.recordFailure("groq");
    cb.recordFailure("groq");
    expect(cb.isOpen("groq")).toBe(true);
    cb.recordSuccess("groq");
    expect(cb.isOpen("groq")).toBe(false);
    expect(cb.status("groq").state).toBe("closed");
  });

  it("cooldown écoulé → un test (half-open) autorisé, puis rouvert sur échec", async () => {
    const cb = new CircuitBreaker(30, 2);
    cb.recordFailure("gemini");
    cb.recordFailure("gemini");
    expect(cb.isOpen("gemini")).toBe(true);
    await new Promise((r) => setTimeout(r, 40));
    // half-open : un appel test passe, un second est encore bloqué.
    expect(cb.isOpen("gemini")).toBe(false);
    cb.recordFailure("gemini");
    expect(cb.isOpen("gemini")).toBe(true);
    expect(cb.status("gemini").state).toBe("open");
  });
});

describe("normalizeError", () => {
  it("normalise les statuts HTTP", () => {
    expect(normalizeError({ status: 429 }, "gemini").type).toBe("quota");
    expect(normalizeError({ status: 401 }, "gemini").type).toBe("auth");
    expect(normalizeError({ status: 400 }, "gemini").type).toBe("invalid_payload");
    expect(normalizeError({ status: 500 }, "gemini").type).toBe("server");
  });

  it("normalise les messages connus", () => {
    expect(normalizeError(new DOMException("Aborted", "AbortError"), "groq").type).toBe("timeout");
    expect(normalizeError(new Error("fetch failed"), "groq").type).toBe("network");
    expect(normalizeError(new Error("Rate limit reached"), "groq").type).toBe("quota");
    expect(normalizeError(new Error("Unauthorized"), "groq").type).toBe("auth");
    expect(normalizeError(new Error("anything else"), "groq").type).toBe("unknown");
  });

  it("jamais de clé ni de contenu dans les messages techniques", () => {
    const err = normalizeError(
      new Error("AI request failed: key=sk-abc123 token=xyz"),
      "openrouter",
    );
    expect(err.technicalMessage).not.toContain("sk-abc123");
  });

  it("isTransientType : timeout/server/network oui, quota/auth non", () => {
    expect(isTransientType("timeout")).toBe(true);
    expect(isTransientType("server")).toBe(true);
    expect(isTransientType("network")).toBe(true);
    expect(isTransientType("quota")).toBe(false);
    expect(isTransientType("auth")).toBe(false);
    expect(isTransientType("invalid_payload")).toBe(false);
  });
});

describe("MetricsStore", () => {
  it("calcule moyenne/min/max et compte les échecs", () => {
    const m = new MetricsStore();
    m.record("gemini", "m1", 100, true);
    m.record("gemini", "m1", 300, true);
    m.record("gemini", "m1", 200, false);
    m.recordFallback("groq", "timeout");
    const snap = m.snapshot();
    expect(snap.requests).toBe(3);
    expect(snap.perProvider.gemini.count).toBe(3);
    expect(snap.perProvider.gemini.failures).toBe(1);
    expect(snap.perProvider.gemini.minMs).toBe(100);
    expect(snap.perProvider.gemini.maxMs).toBe(300);
    expect(snap.perProvider.gemini.avgMs).toBe(200);
    expect(snap.perProvider.groq.fallbacks).toBe(1);
    expect(snap.lastUsedProvider).toBe("gemini");
  });
});
