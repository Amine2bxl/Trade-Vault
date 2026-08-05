import {
  resolveProviders,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "@/modules/ai-provider";
import { circuit } from "./circuit";
import { metrics } from "./metrics";
import { logRuntime } from "./logger";
import { isTransientType, normalizeError, type RuntimeError } from "./errors";

/**
 * AI Router Runtime (V2).
 *
 * `routeCompletion` est le chemin unique de complétion : providers ordonnés
 * (Gemini → Groq → OpenRouter…), circuit breaker par provider, timeout propre
 * à chacun (AbortController), métriques, logs structurés, erreurs normalisées.
 *
 * Aucune clé, aucun secret, aucun contenu de conversation n'est jamais loggé.
 * Extensible : ajouter un fournisseur = une entrée dans le registre ; la
 * détection de tâche et le choix de modèle (futur) viendront ici sans refonte.
 */

/**
 * Timeout (ms) par provider — configurable, valeurs par défaut saines.
 *
 * Gemini a une marge plus large que les autres, et c'est délibéré : c'est le
 * provider PRIMAIRE, et abandonner à 10 s une génération qui aboutissait à
 * 10,5 s jette le travail déjà payé pour servir un repli déterministe
 * générique. Le trader ne perçoit pas « c'était lent », il perçoit « il a
 * répondu à côté » — le coût de crédibilité est bien plus élevé que les 4 s
 * supplémentaires. Le budget de *thinking* étant coupé côté provider, une
 * réponse normale arrive très en dessous de ce plafond : cette marge ne sert
 * qu'aux pics réseau, elle n'allonge pas le cas courant.
 */
const PROVIDER_TIMEOUTS: Record<string, number> = {
  gemini: 14_000,
  groq: 5_000,
  openrouter: 8_000,
  openai: 8_000,
  anthropic: 8_000,
};

export interface RouteOptions {
  /** Override explicite (tests/routage) — ce provider uniquement. */
  provider?: AIProvider;
  /** Contexte d'audit pour les logs (jamais de contenu sensible). */
  meta?: { trades?: number };
  /** Télémétrie — une fois par appel provider (compatible UsageEvent). */
  onUsage?: (e: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs: number;
    ok: boolean;
  }) => void;
}

function timeoutMs(provider: AIProvider): number {
  return PROVIDER_TIMEOUTS[provider.id] ?? 8_000;
}

/** Retry sur le MÊME provider uniquement pour 500/réseau (transitoires). */
function shouldRetrySame(err: RuntimeError, attempts: number): boolean {
  return attempts === 0 && isTransientType(err.type) && err.type !== "timeout";
}

export async function routeCompletion(
  req: AIRequest,
  opts: RouteOptions = {},
): Promise<AIResponse> {
  const providers = opts.provider ? [opts.provider] : resolveProviders();
  const requested = providers[0]?.id ?? "none";
  const started = Date.now();
  const payloadBytes = JSON.stringify(req).length;
  let lastErr: RuntimeError | null = null;

  if (providers.length === 0) {
    const err: RuntimeError = {
      type: "provider_unavailable",
      provider: "none",
      userMessage: "L'IA n'est pas encore configurée.",
      technicalMessage: "No AI provider is configured (no API key set).",
    };
    metrics.recordError(err.type);
    logRuntime({
      requested,
      used: "none",
      latencyMs: 0,
      payloadBytes,
      messages: req.messages.length,
      trades: opts.meta?.trades,
      errorType: err.type,
      totalMs: Date.now() - started,
    });
    throw err;
  }

  for (const provider of providers) {
    // Circuit ouvert → provider suivant, sans payer la latence.
    if (circuit.isOpen(provider.id)) {
      metrics.recordFallback(provider.id, "circuit_open");
      logRuntime({
        requested,
        used: provider.id,
        latencyMs: 0,
        payloadBytes,
        messages: req.messages.length,
        trades: opts.meta?.trades,
        fallbackReason: "circuit_open",
        totalMs: Date.now() - started,
      });
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs(provider));
    const attemptStart = Date.now();
    let attempts = 0;

    while (true) {
      try {
        const res = await provider.complete({ ...req, signal: controller.signal });
        const latencyMs = Date.now() - attemptStart;
        // Réponse VIDE SANS appels d'outils = échec utile (rien à montrer au
        // trader) : on ouvre le circuit et on passe au provider suivant. Une
        // réponse d'outils (texte vide + toolCalls) est valide et conservée.
        if (!res.text?.trim() && !res.toolCalls?.length) {
          clearTimeout(timer);
          circuit.trip(provider.id);
          const err: RuntimeError = {
            type: "unknown",
            provider: provider.id,
            userMessage: "Réponse vide du fournisseur.",
            technicalMessage: `empty response from ${provider.id}`,
          };
          lastErr = err;
          metrics.record(provider.id, res.model || "unknown", latencyMs, false);
          if (provider.id !== requested) metrics.recordFallback(provider.id, "empty_response");
          opts.onUsage?.({
            provider: provider.id,
            model: res.model || "unknown",
            latencyMs,
            ok: false,
          });
          logRuntime({
            requested,
            used: provider.id,
            model: res.model,
            latencyMs,
            payloadBytes,
            messages: req.messages.length,
            trades: opts.meta?.trades,
            fallbackReason: "empty_response",
            errorType: "empty_response",
            totalMs: Date.now() - started,
          });
          break; // provider suivant
        }
        clearTimeout(timer);
        circuit.recordSuccess(provider.id);
        metrics.record(provider.id, res.model, latencyMs, true);
        opts.onUsage?.({
          provider: res.provider,
          model: res.model,
          inputTokens: res.usage?.inputTokens,
          outputTokens: res.usage?.outputTokens,
          latencyMs,
          ok: true,
        });
        logRuntime({
          requested,
          used: provider.id,
          model: res.model,
          latencyMs,
          payloadBytes,
          messages: req.messages.length,
          trades: opts.meta?.trades,
          totalMs: Date.now() - started,
        });
        return res;
      } catch (e) {
        attempts += 1;
        const err = normalizeError(e, provider.id);
        lastErr = err;
        circuit.recordFailure(provider.id);
        const latencyMs = Date.now() - attemptStart;
        metrics.record(provider.id, "unknown", latencyMs, false);
        if (provider.id !== requested) metrics.recordFallback(provider.id, err.type);
        opts.onUsage?.({ provider: provider.id, model: "unknown", latencyMs, ok: false });
        const httpStatus = (e as { status?: number })?.status;
        logRuntime({
          requested,
          used: provider.id,
          latencyMs,
          payloadBytes,
          messages: req.messages.length,
          trades: opts.meta?.trades,
          fallbackReason: err.type,
          httpStatus,
          errorType: err.type,
          totalMs: Date.now() - started,
        });
        if (shouldRetrySame(err, attempts - 1)) continue; // 500/réseau → 1 retry même provider
        clearTimeout(timer);
        break; // timeout/quota/4xx → provider suivant
      }
    }
  }

  metrics.recordError(lastErr?.type ?? "unknown");
  if (lastErr) throw lastErr;
  throw new Error("AI coach is not configured yet (no provider available).");
}
