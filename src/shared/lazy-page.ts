import { lazy, type ComponentType } from "react";

/**
 * LE CODE PÉRIMÉ APRÈS UN DÉPLOIEMENT — la vraie source des « Error 500 ».
 *
 * Chaque page, la fenêtre de Jarvis, le formulaire de trade… sont des fichiers
 * chargés à la demande, et leur nom change à chaque mise en ligne. Un trader
 * qui avait l'application ouverte pendant un déploiement demande, au clic
 * suivant, un fichier qui n'existe plus. Vite signale l'échec
 * (`vite:preloadError`) ; le gestionnaire de la racine l'annulait pour
 * recharger — et l'import rendait alors `undefined` à `React.lazy`, qui
 * levait « lazy: expected a default export » : l'écran 500 s'affichait avant
 * même que le rechargement ait lieu.
 *
 * Ici, un chargement raté est reconnu comme tel : la page se recharge UNE
 * fois (garde de 10 s partagée avec la racine, pour ne jamais boucler) et le
 * composant reste en attente — le squelette reste affiché, jamais l'erreur.
 */

export const CHUNK_RELOAD_KEY = "tv-chunk-reload-at";

// Partagé par le gestionnaire Vite et les imports React.lazy DU MÊME document.
// Le garde persistant protège le document suivant, pas celui qui attend déjà
// son rechargement : sinon le second appel transforme l'import annulé en 500.
let reloadPending = false;

/** `true` si le document se recharge déjà ; `false` après un échec persistant. */
export function reloadForStaleChunk(): boolean {
  if (typeof window === "undefined") return false;
  if (reloadPending) return true;
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : on recharge quand même, une fois */
  }
  reloadPending = true;
  window.location.reload();
  return true;
}

function isChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|chunk|missing default export/i.test(
    msg,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      // Import annulé par le gestionnaire `vite:preloadError` : `undefined`.
      if (!mod || !mod.default) throw new Error("missing default export");
      return mod;
    } catch (err) {
      if (isChunkError(err) && reloadForStaleChunk()) {
        // Le rechargement est parti : rester en attente, sans rien afficher
        // d'autre que le squelette.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
