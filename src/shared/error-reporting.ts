/**
 * Point d'entrée UNIQUE du report d'erreur applicative.
 *
 * Toute erreur remontée par le produit passe ici — error boundaries React,
 * échecs de préchargement de chunk, erreurs non capturées du navigateur. Un
 * seul entonnoir, donc **un seul endroit à modifier le jour où un fournisseur
 * (Sentry ou équivalent) est branché** : une variable d'environnement et cette
 * fonction, rien d'autre. Même principe que le routeur IA — l'application ne
 * sait jamais qui reçoit.
 *
 * ÉTAT ACTUEL : la destination est la console. C'est volontairement documenté
 * comme une limite dans `GO-LIVE.md` §2.5 : un plantage en production reste
 * invisible tant qu'aucun fournisseur n'est configuré, et brancher un
 * fournisseur demande une clé, donc une décision qui n'est pas technique.
 */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[App Error]", error, {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
  });
}

let installed = false;

/**
 * Branche les erreurs NON CAPTURÉES du navigateur sur le même entonnoir.
 *
 * POURQUOI. Les error boundaries React ne voient qu'une partie des pannes :
 * elles interceptent les erreurs de rendu, pas celles qui surviennent dans un
 * gestionnaire d'événement, un `setTimeout` ou une promesse non attendue. Or
 * l'application en contient beaucoup — chargements best-effort, écritures
 * optimistes, télémétrie. Ces erreurs-là disparaissaient entièrement : ni
 * boundary, ni report, rien.
 *
 * Le jour où un fournisseur est configuré, elles arriveront avec le reste,
 * sans nouveau câblage.
 *
 * IDEMPOTENT : appelable plusieurs fois sans empiler les écouteurs (React 18
 * monte deux fois les effets en mode strict).
 */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    // `event.error` est absent pour les erreurs de chargement de ressource
    // (image, script) : on retombe sur le message plutôt que de rapporter
    // `undefined`, qui ne dirait rien.
    reportAppError(event.error ?? event.message, {
      source: "window_error",
      filename: event.filename,
      line: event.lineno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportAppError(event.reason, { source: "unhandled_rejection" });
  });
}
