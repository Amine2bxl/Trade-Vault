/**
 * Erreurs runtime IA — normalisées.
 *
 * Chaque échec est ramené à un type connu, avec un message utilisateur calme
 * (jamais technique) et un message technique pour les logs/diagnostics.
 * Aucune clé, aucun secret, aucun contenu de conversation n'est jamais porté
 * par ces erreurs.
 */

export type RuntimeErrorType =
  | "timeout"
  | "quota"
  | "provider_unavailable"
  | "invalid_payload"
  | "network"
  | "server"
  | "auth"
  | "unknown";

export interface RuntimeError {
  type: RuntimeErrorType;
  provider: string;
  /** Message utilisateur — calme, non technique, localisable plus tard. */
  userMessage: string;
  /** Message technique — logs et page de diagnostic uniquement. */
  technicalMessage: string;
}

/** Ces types justifient un retry sur le même provider (ou la bascule suivante). */
export function isTransientType(t: RuntimeErrorType): boolean {
  return t === "timeout" || t === "server" || t === "network";
}

/** Retire toute chaîne ressemblant à un secret d'un message technique. */
const SECRET_RE =
  /\b(sk-[A-Za-z0-9_-]{6,}|gsk_[A-Za-z0-9_-]{6,}|AIza[A-Za-z0-9_-]{6,}|x-api-key[=: ]+[A-Za-z0-9._-]{6,}|authorization[=: ]+[A-Za-z0-9._-]{6,}|bearer\s+[A-Za-z0-9._-]{6,})\b/gi;

export function redactSecrets(text: string): string {
  return text.replace(SECRET_RE, "[redacted]");
}

export function normalizeError(err: unknown, provider: string): RuntimeError {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  const low = msg.toLowerCase();
  const technical = (s: string) => redactSecrets(s.slice(0, 300));

  if (typeof status === "number") {
    if (status === 429)
      return {
        type: "quota",
        provider,
        userMessage: "Quota atteint — réessaie dans un instant.",
        technicalMessage: technical(`HTTP 429: ${msg}`),
      };
    if (status === 401 || status === 403)
      return {
        type: "auth",
        provider,
        userMessage: "Session ou clé invalide — reconnecte-toi.",
        technicalMessage: technical(`HTTP ${status}: ${msg}`),
      };
    if (status >= 500)
      return {
        type: "server",
        provider,
        userMessage: "Le service IA est momentanément indisponible.",
        technicalMessage: technical(`HTTP ${status}: ${msg}`),
      };
    if (status >= 400)
      return {
        type: "invalid_payload",
        provider,
        userMessage: "Requête invalide — reformule.",
        technicalMessage: technical(`HTTP ${status}: ${msg}`),
      };
  }

  // Timeout réél : notre propre AbortController (signal annulé) → provider suivant.
  if (msg.includes("AbortError") || low.includes("aborted"))
    return {
      type: "timeout",
      provider,
      userMessage: "L'IA met trop de temps à répondre.",
      technicalMessage: technical(`timeout: ${msg}`),
    };
  if (
    low.includes("timeout") ||
    low.includes("fetch failed") ||
    low.includes("network") ||
    low.includes("econnreset") ||
    low.includes("load failed") ||
    low.includes("socket")
  )
    return {
      type: "network",
      provider,
      userMessage: "Réseau indisponible — vérifie ta connexion.",
      technicalMessage: technical(`network: ${msg}`),
    };
  if (
    low.includes("rate limit") ||
    low.includes("quota") ||
    low.includes("credits exhausted") ||
    low.includes("402")
  )
    return {
      type: "quota",
      provider,
      userMessage: "Quota atteint — réessaie dans un instant.",
      technicalMessage: technical(`quota: ${msg}`),
    };
  if (low.includes("unauthorized") || low.includes("401") || low.includes("invalid api key"))
    return {
      type: "auth",
      provider,
      userMessage: "Session ou clé invalide — reconnecte-toi.",
      technicalMessage: technical(`auth: ${msg}`),
    };
  if (low.includes("not configured") || low.includes("no provider") || low.includes("model"))
    return {
      type: "provider_unavailable",
      provider,
      userMessage: "L'IA n'est pas encore configurée.",
      technicalMessage: technical(`provider: ${msg}`),
    };

  return {
    type: "unknown",
    provider,
    userMessage: "Une erreur inattendue est survenue.",
    technicalMessage: technical(msg),
  };
}
