import { createServerFn } from "@tanstack/react-start";
import { isProviderConfigured, providerIds } from "@/modules/ai-provider";
import { circuit } from "./circuit";
import { metrics } from "./metrics";

/**
 * Diagnostic runtime IA — réservé au développement.
 *
 * Renvoie l'état des providers (disponible / circuit / cooldown), les métriques
 * du runtime, et la PRÉSENCE des clés (jamais leur contenu). Aucun secret, aucun
 * contenu de conversation n'est exposé.
 */

export const aiRuntimeStatus = createServerFn({ method: "GET" }).handler(async () => {
  const ids = providerIds();
  return {
    providers: ids.map((id) => {
      const circ = circuit.status(id);
      const per = metrics.snapshot().perProvider[id];
      return {
        id,
        configured: isProviderConfigured(id),
        state: circ.state,
        failures: circ.failures,
        cooldownMsLeft: circ.cooldownUntil > 0 ? Math.max(0, circ.cooldownUntil - Date.now()) : 0,
        metric: per ?? { count: 0, failures: 0, fallbacks: 0, avgMs: 0, maxMs: 0, minMs: 0 },
      };
    }),
    runtime: metrics.snapshot(),
    // Présence des variables — JAMAIS leur valeur.
    config: { present: ids.filter((id) => isProviderConfigured(id)) },
  };
});
