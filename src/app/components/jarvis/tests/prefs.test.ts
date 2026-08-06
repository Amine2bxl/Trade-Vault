import { describe, it, expect, beforeEach } from "bun:test";
import {
  readResponseLang,
  writeResponseLang,
  effectiveCopyLang,
  type JarvisResponseLang,
} from "../prefs";

function installStorageMock() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  } as Storage;
  // La préférence est PERSISTANTE (localStorage) : une langue choisie qui se
  // réinitialise à chaque onglet n'est pas une préférence.
  (globalThis as Record<string, unknown>).localStorage = storage;
  return () => data.clear();
}

describe("prefs — langue de réponse", () => {
  beforeEach(() => {
    installStorageMock();
  });

  it("défaut : automatique (suit la langue de l'app)", () => {
    expect(readResponseLang()).toBe("auto");
    expect(effectiveCopyLang("fr")).toBe("fr");
    expect(effectiveCopyLang("en")).toBe("en");
    expect(effectiveCopyLang("de")).toBe("en"); // toute autre langue → en
  });

  it("force fr ou en quand défini", () => {
    writeResponseLang("en");
    expect(effectiveCopyLang("fr")).toBe("en");
    writeResponseLang("fr");
    expect(effectiveCopyLang("en")).toBe("fr");
  });

  it("revient à auto en effaçant la préférence", () => {
    writeResponseLang("fr");
    writeResponseLang("auto");
    expect(effectiveCopyLang("de")).toBe("en");
  });
});
