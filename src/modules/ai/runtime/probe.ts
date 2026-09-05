import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/backend/require-admin";
import { resolveProviders } from "@/modules/ai-provider";
import { routeCompletion } from "./router";
import { normalizeError } from "./errors";

/**
 * Test ciblé d'un fournisseur — pour la page de diagnostic /dev/ai.
 *
 * Lance un mini appel IA contre le provider demandé et renvoie le résultat ou
 * l'erreur normalisée. Aucune clé, aucun secret, aucun contenu sensible.
 *
 * RÉSERVÉ AUX ADMINISTRATEURS. Cette fonction déclenche un APPEL MODÈLE RÉEL,
 * facturé, sur le fournisseur que l'appelant désigne. Elle n'avait aucune
 * garde : n'importe qui, non authentifié, pouvait la boucler et faire monter
 * la facture d'IA sans jamais créer de compte.
 */

export const aiRuntimeProbe = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => {
    const id = (input as { provider?: string })?.provider;
    if (typeof id !== "string" || !id) throw new Error("provider required");
    return { provider: id };
  })
  .handler(async ({ data }) => {
    const provider = resolveProviders().find((p) => p.id === data.provider);
    if (!provider) {
      return {
        ok: false,
        provider: data.provider,
        error: {
          type: "provider_unavailable",
          technicalMessage: "Clé non configurée sur ce déploiement.",
        },
      };
    }
    const started = Date.now();
    try {
      const res = await routeCompletion(
        { messages: [{ role: "user", content: "Reply with exactly: PONG" }], maxTokens: 16 },
        { provider },
      );
      return {
        ok: true,
        provider: res.provider,
        model: res.model,
        latencyMs: Date.now() - started,
        text: res.text.trim().slice(0, 40),
      };
    } catch (e) {
      const err = normalizeError(e, data.provider);
      return {
        ok: false,
        provider: data.provider,
        error: { type: err.type, technicalMessage: err.technicalMessage },
      };
    }
  });
