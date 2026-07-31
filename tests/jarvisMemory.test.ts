import { describe, it, expect, beforeEach } from "bun:test";
import {
  SessionJarvisMemoryStore,
  sessionJarvisMemory,
} from "../src/app/components/jarvis/insights/memory";
import type { JarvisMemory, JarvisMemoryStore } from "../src/app/components/jarvis/insights/types";

// sessionStorage n'existe pas en environnement bun : on injecte un mock mémoire.
function installStorageMock() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  } as Storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;
  return () => data.clear();
}

describe("SessionJarvisMemoryStore", () => {
  beforeEach(() => {
    installStorageMock();
  });

  it("returns the default memory when nothing is stored", async () => {
    const store: JarvisMemoryStore = sessionJarvisMemory();
    const mem = await store.read();
    expect(mem.lastShownDate).toBe("");
    expect(mem.lastPattern).toBeNull();
    expect(mem.lastPriority).toBeNull();
    expect(mem.ignoredPatterns).toEqual([]);
    expect(mem.seenCount).toBe(0);
  });

  it("round-trips a memory object through the store", async () => {
    const store: JarvisMemoryStore = new SessionJarvisMemoryStore();
    const mem: JarvisMemory = {
      lastShownDate: "2026-07-31",
      lastPattern: "risk_after_loss",
      lastPriority: 1,
      ignoredPatterns: ["overtrading"],
      seenCount: 3,
    };
    await store.write(mem);
    expect(await store.read()).toEqual(mem);
  });

  it("survives a partial/invalid payload with defaults", async () => {
    const store: JarvisMemoryStore = sessionJarvisMemory();
    await store.write({ seenCount: 2 } as JarvisMemory);
    const mem = await store.read();
    expect(mem.seenCount).toBe(2);
    expect(mem.lastShownDate).toBe("");
  });
});
