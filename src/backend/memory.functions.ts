import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProAccess } from "@/backend/require-pro";
import { runMemoryExtraction } from "@/modules/ai/agents/memory.agent";
import { shouldAttemptExtraction, type MemoryCandidate } from "@/modules/ai/memory-extract";
import { recordAgentRun } from "./telemetry.server";

/**
 * Extraction de mémoire — fonction serveur.
 *
 * Rend des CANDIDATS ; elle n'écrit rien en base. L'écriture reste au client,
 * via le `remember()` déjà en place — une seule voie d'écriture vers
 * `ai_memory`, donc un seul endroit où l'invariant de dé-doublonnage est tenu.
 * Ajouter ici un second chemin d'écriture aurait créé exactement la deuxième
 * source de vérité que le produit interdit.
 *
 * COUPE-CIRCUIT : `AI_MEMORY_EXTRACTION` doit valoir "1" pour que la
 * fonctionnalité s'active. Par défaut elle est ÉTEINTE. C'est le composant le
 * plus risqué du produit — la première protection est de pouvoir l'arrêter
 * sans redéploiement si les souvenirs produits se révèlent mauvais.
 */

const ExtractInput = z.object({
  userMessage: z.string().min(1).max(2000),
  knownKeys: z.array(z.string().max(200)).max(100).optional(),
});

export interface ExtractionResponse {
  candidates: MemoryCandidate[];
  /** Pourquoi rien n'est proposé — rend le silence diagnosticable. */
  skipped?: "disabled" | "no_marker" | "provider_error" | "all_rejected";
}

function isEnabled(): boolean {
  return process.env.AI_MEMORY_EXTRACTION === "1";
}

export const extractMemory = createServerFn({ method: "POST" })
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }): Promise<ExtractionResponse> => {
    if (!isEnabled()) return { candidates: [], skipped: "disabled" };

    // Pré-filtre déterministe AVANT toute dépense : la très grande majorité
    // des tours sont des questions et ne contiennent aucun engagement.
    if (!shouldAttemptExtraction(data.userMessage)) {
      return { candidates: [], skipped: "no_marker" };
    }

    const userId = (context as { userId?: string } | undefined)?.userId;
    let served: { provider?: string; model?: string; latencyMs?: number } = {};

    const res = await runMemoryExtraction(data, {
      onUsage: (e) => {
        served = { provider: e.provider, model: e.model, latencyMs: e.latencyMs };
      },
    });

    // Télémétrie : c'est le TAUX DE REJET qui dira si les garde-fous sont bien
    // calibrés. Un taux proche de zéro signifierait qu'ils sont trop laxistes,
    // pas que le modèle est bon.
    if (userId) {
      void recordAgentRun({
        userId,
        agent: "memory-extract",
        intent: "chat",
        provider: served.provider ?? "",
        model: served.model ?? "",
        status: res.ok ? "ok" : "error",
        latencyMs: served.latencyMs ?? 0,
        error: res.ok ? undefined : "extraction failed",
      });
    }

    if (!res.ok) return { candidates: [], skipped: "provider_error" };
    if (res.accepted.length === 0) return { candidates: [], skipped: "all_rejected" };
    return { candidates: res.accepted };
  });
