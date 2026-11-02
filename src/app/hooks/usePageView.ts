import { useCallback, useState } from "react";
import { readJSON, writeJSON } from "@/app/utils/persistence";

/**
 * LA SOUS-VUE D'UNE PAGE, MÉMORISÉE.
 *
 * Une page qui tient dans l'écran range ses blocs lourds en sous-vues
 * (`SubNav`). On revient sur la page là où on l'avait laissée : la vue choisie
 * est gardée dans le stockage local (préférence d'interface, pas une donnée).
 * Une valeur inconnue (vue renommée, stockage vide ou refusé) retombe sur
 * `fallback`.
 */
export function usePageView<T extends string>(
  key: string,
  ids: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const storageKey = `tv.view.${key}`;
  const [view, setViewState] = useState<T>(() => {
    const saved = readJSON<string>(storageKey, fallback);
    return (ids as readonly string[]).includes(saved) ? (saved as T) : fallback;
  });
  const setView = useCallback(
    (next: T) => {
      setViewState(next);
      writeJSON(storageKey, next);
    },
    [storageKey],
  );
  return [view, setView];
}
