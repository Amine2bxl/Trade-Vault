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
  /**
   * Échéance ABSOLUE (epoch ms) de la question entière. Aucune tentative ne
   * démarre au-delà, aucune ne la dépasse, et aucune attente de quota ne la
   * franchit : la fonction serveur s'arrête à 300 s, et une question coupée par
   * la plateforme ne rend ni réponse honnête ni télémétrie.
   */
  deadline?: number;
  /** Override explicite (tests/routage) — ce provider uniquement. */
  provider?: AIProvider;
  /** Chaîne explicite (tests) — sinon les fournisseurs configurés. */
  providers?: AIProvider[];
  /** Contexte d'audit pour les logs (jamais de contenu sensible). */
  meta?: { trades?: number };
  /** Télémétrie — une fois par appel provider (compatible UsageEvent). */
  onUsage?: (e: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    thinkingTokens?: number;
    cachedInputTokens?: number;
    cacheWriteInputTokens?: number;
    latencyMs: number;
    ok: boolean;
  }) => void;
}

/** Les fournisseurs qui RÉFLÉCHISSENT réellement avant de répondre. */
const THINKING_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "anthropic"]);

/**
 * Le délai d'UN appel.
 *
 * 1. Le niveau de difficulté fixe son propre délai (`runtime/tiers.ts`) : il
 *    prime — une revue profonde n'a pas le délai d'un « salut ».
 * 2. Sinon, le délai du fournisseur, plus 20 s quand on lui demande de
 *    réfléchir : couper la réflexion à mi-chemin rendrait une panne là où il
 *    suffisait d'attendre. SEULEMENT pour un fournisseur qui réfléchit (bug
 *    B10) : Groq ou OpenRouter ignorent le budget, et leur accorder 25 s
 *    retardait d'autant le repli quand ils pendaient.
 */
export function callTimeoutMs(provider: AIProvider, req?: AIRequest): number {
  if (req?.timeoutMs && req.timeoutMs > 0) return req.timeoutMs;
  const base = PROVIDER_TIMEOUTS[provider.id] ?? 8_000;
  const thinks =
    (req?.reasoning !== undefined && req.reasoning !== "none") || (req?.reasoningBudget ?? 0) > 0;
  return thinks && THINKING_PROVIDERS.has(provider.id) ? base + 20_000 : base;
}

/**
 * UN QUOTA : D'ABORD UN AUTRE FOURNISSEUR, ENSUITE ATTENDRE.
 *
 * Un 429 dit combien de temps attendre. Tant qu'un autre fournisseur reste à
 * essayer, on y passe tout de suite : attendre 18 s un Gemini saturé pendant
 * que Groq répond en 2 s faisait patienter le trader pour rien. Ce n'est
 * qu'en DERNIER RECOURS — tous ont échoué — qu'on attend le plus court des
 * délais annoncés, puis qu'on réessaie ce fournisseur : une réponse un peu
 * plus lente vaut mieux qu'une panne. La fonction serveur a 300 s ; ce budget
 * en prend 30 au plus.
 */
const MAX_QUOTA_WAIT_MS = 20_000;
/** Un quota JOURNALIER épuisé écarte le fournisseur ce temps-là. */
const DAILY_QUOTA_PAUSE_MS = 30 * 60_000;
const QUOTA_WAIT_BUDGET_MS = 30_000;
/** En deçà, une tentative n'a aucune chance d'aboutir : on ne la lance pas. */
const MIN_ATTEMPT_MS = 3_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry sur le MÊME provider uniquement pour 500/réseau (transitoires). */
function shouldRetrySame(err: RuntimeError, attempts: number): boolean {
  return attempts === 0 && isTransientType(err.type) && err.type !== "timeout";
}

export async function routeCompletion(
  req: AIRequest,
  opts: RouteOptions = {},
): Promise<AIResponse> {
  const providers = opts.provider ? [opts.provider] : (opts.providers ?? resolveProviders());
  const requested = providers[0]?.id ?? "none";
  const started = Date.now();
  const payloadBytes = JSON.stringify(req).length;
  let lastErr: RuntimeError | null = null;
  let quotaWaited = 0;
  const timeLeft = () =>
    opts.deadline === undefined ? Number.POSITIVE_INFINITY : opts.deadline - Date.now();

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

  /** Les fournisseurs qui ont répondu « quota, réessaie dans N ms ». */
  const deferred: { provider: AIProvider; wait: number; at: number }[] = [];

  /**
   * UNE TENTATIVE SUR UN FOURNISSEUR (plus un retry pour une panne réseau/5xx).
   * Rend la réponse, ou `null` pour passer au suivant.
   */
  const tryProvider = async (
    provider: AIProvider,
    isLastResort: boolean,
  ): Promise<AIResponse | null> => {
    let attempts = 0;
    while (true) {
      // L'échéance de la question : plus le temps d'une vraie tentative, on
      // s'arrête — l'appelant sert alors la réponse honnête « indisponible ».
      const left = timeLeft();
      if (left < MIN_ATTEMPT_MS) {
        lastErr ??= {
          type: "timeout",
          provider: provider.id,
          userMessage: "Le temps imparti à la question est écoulé.",
          technicalMessage: "question time budget exhausted",
        };
        return null;
      }
      // Un délai par TENTATIVE : une attente de quota ne doit pas consommer le
      // temps de la tentative suivante. Jamais au-delà de l'échéance.
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(callTimeoutMs(provider, req), left),
      );
      const attemptStart = Date.now();
      try {
        const res = await provider.complete({ ...req, signal: controller.signal });
        clearTimeout(timer);
        const latencyMs = Date.now() - attemptStart;
        // Réponse VIDE SANS appels d'outils = échec utile (rien à montrer au
        // trader). Une réponse d'outils (texte vide + toolCalls) est valide.
        if (!res.text?.trim() && !res.toolCalls?.length) {
          // Elle tient le plus souvent à LA requête (réflexion qui mange le
          // budget, filtre de sécurité), pas à la santé du fournisseur : un
          // échec compté, pas un circuit ouvert d'office pour tout le monde.
          circuit.recordFailure(provider.id);
          lastErr = {
            type: "unknown",
            provider: provider.id,
            userMessage: "Réponse vide du fournisseur.",
            technicalMessage: `empty response from ${provider.id}`,
          };
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
          return null;
        }
        circuit.recordSuccess(provider.id);
        metrics.record(provider.id, res.model, latencyMs, true);
        opts.onUsage?.({
          provider: res.provider,
          model: res.model,
          inputTokens: res.usage?.inputTokens,
          outputTokens: res.usage?.outputTokens,
          thinkingTokens: res.usage?.thinkingTokens,
          cachedInputTokens: res.usage?.cachedInputTokens,
          cacheWriteInputTokens: res.usage?.cacheWriteInputTokens,
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
        clearTimeout(timer);
        attempts += 1;
        const err = normalizeError(e, provider.id);
        lastErr = err;
        const latencyMs = Date.now() - attemptStart;
        metrics.record(provider.id, "unknown", latencyMs, false);
        if (provider.id !== requested) metrics.recordFallback(provider.id, err.type);
        opts.onUsage?.({ provider: provider.id, model: "unknown", latencyMs, ok: false });
        const httpStatus = (e as { status?: number })?.status;
        const daily = err.type === "quota" && (e as { daily?: boolean })?.daily === true;
        const wait = err.type === "quota" && !daily ? err.retryAfterMs : undefined;
        // Dernier recours seulement : on attend le délai annoncé puis on
        // réessaie CE fournisseur. Tant qu'un autre fournisseur reste à
        // essayer, attendre ferait patienter le trader pour rien.
        const canWaitNow =
          isLastResort &&
          wait !== undefined &&
          attempts === 1 &&
          wait <= MAX_QUOTA_WAIT_MS &&
          quotaWaited + wait <= QUOTA_WAIT_BUDGET_MS &&
          wait + MIN_ATTEMPT_MS < timeLeft();
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
          errorReason: err.technicalMessage,
          ...(canWaitNow ? { quotaWaitMs: wait } : {}),
          totalMs: Date.now() - started,
        });
        if (canWaitNow && wait !== undefined) {
          quotaWaited += wait;
          await sleep(wait + 250);
          continue;
        }
        if (daily) {
          // Quota JOURNALIER épuisé : inutile de le redemander à chaque
          // question pendant des heures — le fournisseur est écarté un moment.
          circuit.pause(provider.id, DAILY_QUOTA_PAUSE_MS);
        } else if (wait !== undefined && !isLastResort) {
          deferred.push({ provider, wait, at: Date.now() });
        }
        // Un quota n'est pas une panne : il n'ouvre pas le circuit. Une requête
        // refusée pour sa TAILLE (413) ou sa forme (4xx) non plus : elle tient à
        // CETTE question, pas à la santé du fournisseur — mesuré en production,
        // deux 413 de Groq fermaient Groq à toutes les questions suivantes.
        if (err.type !== "quota" && err.type !== "invalid_payload")
          circuit.recordFailure(provider.id);
        if (shouldRetrySame(err, attempts - 1)) continue; // 500/réseau → 1 retry même provider
        return null; // timeout/quota/4xx → fournisseur suivant
      }
    }
  };

  const healthy = providers.filter((p) => {
    if (!circuit.isOpen(p.id)) return true;
    // Circuit ouvert → écarté sans payer la latence.
    metrics.recordFallback(p.id, "circuit_open");
    logRuntime({
      requested,
      used: p.id,
      latencyMs: 0,
      payloadBytes,
      messages: req.messages.length,
      trades: opts.meta?.trades,
      fallbackReason: "circuit_open",
      totalMs: Date.now() - started,
    });
    return false;
  });

  /* TOUS LES CIRCUITS OUVERTS : on essaie quand même. Le disjoncteur sert à
     ne pas PERDRE de temps sur un fournisseur en panne quand un autre répond ;
     quand aucun ne reste, sauter tout le monde rendait une erreur en 0 ms
     (« no provider available ») sans qu'aucune requête ne soit partie — alors
     qu'une saturation de la minute précédente était souvent déjà levée. */
  const usable = healthy.length > 0 ? healthy : providers;

  for (let i = 0; i < usable.length; i += 1) {
    const res = await tryProvider(usable[i], i === usable.length - 1 && deferred.length === 0);
    if (res) return res;
  }

  /* DERNIER RECOURS : tous les fournisseurs ont échoué, mais certains ont dit
     « quota, réessaie dans N secondes ». On attend le plus court de ces délais
     (dans le budget) et on retente celui-là — une réponse un peu plus lente
     vaut mieux qu'une panne. */
  deferred.sort((x, y) => x.wait - y.wait);
  for (const d of deferred) {
    const remaining = Math.max(0, d.wait - (Date.now() - d.at));
    if (
      d.wait > MAX_QUOTA_WAIT_MS ||
      quotaWaited + remaining > QUOTA_WAIT_BUDGET_MS ||
      remaining + MIN_ATTEMPT_MS >= timeLeft()
    )
      continue;
    quotaWaited += remaining;
    if (remaining > 0) await sleep(remaining + 250);
    const res = await tryProvider(d.provider, false);
    if (res) return res;
  }

  // `lastErr` est écrit dans `tryProvider` : TypeScript ne suit pas les
  // affectations faites dans une fermeture.
  const finalErr = lastErr as RuntimeError | null;
  metrics.recordError(finalErr?.type ?? "unknown");
  if (finalErr) throw finalErr;
  throw new Error("AI coach is not configured yet (no provider available).");
}
