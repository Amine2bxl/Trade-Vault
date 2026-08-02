/**
 * Analytics (GA4) — PRÊT, aucune donnée inventée.
 *
 * Pour activer : définir `VITE_GA4_MEASUREMENT_ID` (ex. "G-XXXXXXXXXX") dans
 * Vercel (Preview + Production), puis redéployer. Sans cette variable, rien
 * n'est injecté — le site ne charge AUCUN script analytics.
 *
 * `import.meta.env.VITE_*` est inliné au build : l'ID n'est pas exposé côté
 * serveur inutilement, et un build sans l'ID ne contient pas le snippet.
 */

type GtagFn = {
  (...args: unknown[]): void;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;

/** Injecte le script gtag + dataLayer UNE fois, si un ID est configuré. */
export function initAnalytics(): void {
  if (!MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;
  if (window.gtag) return; // déjà initialisé

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window.gtag = function gtag(..._args: any[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

/** Trace un événement (no-op si GA4 n'est pas configuré). */
export function trackEvent(event: string, params?: Record<string, unknown>): void {
  if (!MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", event, params);
}
