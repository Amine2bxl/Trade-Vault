import { expect, test } from "bun:test";
import { CHUNK_RELOAD_KEY, reloadForStaleChunk } from "../src/shared/lazy-page";

test("la récupération Vite et React.lazy partage le rechargement sans afficher 500", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  let reloads = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { reload: () => reloads++ } },
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    // Le nouveau document ne boucle pas si le rechargement précédent a échoué.
    values.set(CHUNK_RELOAD_KEY, String(Date.now()));
    expect(reloadForStaleChunk()).toBe(false);
    expect(reloads).toBe(0);
    values.delete(CHUNK_RELOAD_KEY);

    // Vite lance le rechargement et annule l'import. React.lazy reçoit ensuite
    // ce résultat vide : son second appel doit patienter, pas lever une erreur.
    expect(reloadForStaleChunk()).toBe(true);
    expect(reloadForStaleChunk()).toBe(true);
    expect(reloadForStaleChunk()).toBe(true);
    expect(reloads).toBe(1);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
