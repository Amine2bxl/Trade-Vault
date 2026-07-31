/**
 * Logger runtime structuré.
 *
 * Une ligne JSON par requête IA, exploitable en production. NE JAMAIS logger :
 * clés API, secrets, contenu complet des conversations. On ne journalise que
 * des champs numériques/courts (latence, modèle, statut, raison, tailles).
 */

export interface RuntimeLogEntry {
  requested: string;
  used: string;
  model?: string;
  latencyMs: number;
  payloadBytes: number;
  messages: number;
  trades?: number;
  fallbackReason?: string;
  httpStatus?: number;
  errorType?: string;
  totalMs: number;
}

/** Défense : redact tout champ qui ressemblerait à un secret (clé, token…). */
const SECRET_PATTERN = /(sk-|gsk_|AIza|key|token|secret|authorization)/i;

function redact(value: unknown, key: string): unknown {
  if (
    typeof value === "string" &&
    SECRET_PATTERN.test(key) &&
    !/reason|type|model|provider/.test(key)
  ) {
    return "[redacted]";
  }
  if (typeof value === "string" && value.length > 64 && !/reason|type|model/.test(key)) {
    return `${value.slice(0, 32)}…`;
  }
  return value;
}

export function logRuntime(entry: RuntimeLogEntry): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    safe[k] = redact(v, k);
  }

  console.info("[Jarvis Runtime]", JSON.stringify(safe));
}
