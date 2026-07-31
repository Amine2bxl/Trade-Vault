import type { JarvisMemory, JarvisMemoryStore } from "./types";

/**
 * SessionJarvisMemoryStore — implémentation Phase 1 de JarvisMemoryStore.
 *
 * Stockage : sessionStorage (par onglet/session, réinitialisé à la fermeture).
 * L'Insight Engine ne connaît que l'interface `JarvisMemoryStore` : migrer vers
 * Supabase plus tard = une nouvelle implémentation, aucun changement du moteur.
 */

const STORAGE_KEY = "tv:jarvis:memory";

const DEFAULT_MEMORY: JarvisMemory = {
  lastShownDate: "",
  lastPattern: null,
  lastPriority: null,
  ignoredPatterns: [],
  seenCount: 0,
};

export class SessionJarvisMemoryStore implements JarvisMemoryStore {
  async read(): Promise<JarvisMemory> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_MEMORY };
      const parsed = JSON.parse(raw) as Partial<JarvisMemory>;
      return { ...DEFAULT_MEMORY, ...parsed };
    } catch {
      return { ...DEFAULT_MEMORY };
    }
  }

  async write(memory: JarvisMemory): Promise<void> {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
      // best-effort : une mémoire qui ne persiste pas ne doit jamais casser Jarvis
    }
  }
}

/** Fabrique : l'orchestrateur obtient un store sans connaître la classe. */
export function sessionJarvisMemory(): JarvisMemoryStore {
  return new SessionJarvisMemoryStore();
}
