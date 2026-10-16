import {
  resolveProviders,
  type AIProvider,
  type AIRequest,
  type ReasoningLevel,
} from "@/modules/ai-provider";
import type { RouteTier } from "../router/route";

/**
 * LES NIVEAUX DE MODÈLE — la meilleure intelligence au coût le plus juste.
 *
 * Jarvis appelait le même modèle, avec le même budget de réflexion, pour
 * « salut » et pour « compare mes deux derniers mois ». Le routeur
 * (`router/route.ts`) classe maintenant chaque question de 1 (simple) à 4
 * (analyse profonde) ; ce module traduit ce niveau en un EMPLACEMENT de modèle :
 *
 *   router   — le petit modèle qui tranche une question ambiguë (rare)
 *   fast     — niveau 1 : salutation, définition, fait ou chiffre simple
 *   balanced — niveau 2 : analyse d'un seul domaine
 *   strong   — niveau 3 : diagnostic croisé, comparaison, tenue du plan
 *   deep     — niveau 4 : revue complète demandée explicitement
 *
 * ── RIEN N'EST ÉCRIT EN DUR CÔTÉ PRODUIT ──────────────────────────────────
 * Chaque emplacement est une CHAÎNE ordonnée `fournisseur:modèle`, réglable
 * par variable d'environnement sans toucher au code :
 *
 *   AI_MODEL_STRONG="anthropic:claude-sonnet-5-5,gemini:gemini-2.5-pro"
 *   AI_MODEL_ROUTER=off            (désactive le routage par modèle)
 *
 * Sans réglage, la chaîne suit l'ordre des fournisseurs configurés
 * (`AI_PROVIDER` d'abord), chacun avec son modèle par défaut pour ce niveau.
 * Un fournisseur sans table de niveaux (OpenAI, Groq, OpenRouter) garde son
 * modèle unique (`OPENAI_MODEL`…) à tous les niveaux.
 *
 * Le chemin de repli multi-clés de `routeCompletion` est conservé tel quel :
 * l'emplacement ne fait que fixer, pour chaque fournisseur de la chaîne, le
 * modèle, la réflexion, le plafond de sortie et le délai.
 */

export type ModelSlot = "router" | "fast" | "balanced" | "strong" | "deep";

export const TIER_SLOT: Record<RouteTier, ModelSlot> = {
  1: "fast",
  2: "balanced",
  3: "strong",
  4: "deep",
};

export interface SlotPolicy {
  reasoning: ReasoningLevel;
  /** Plafond de sortie, réflexion comprise (elle est décomptée de la sortie). */
  maxTokens: number;
  /** Délai d'UN appel modèle. */
  timeoutMs: number;
  /** Tours modèle↔outils au plus, après les données préchargées. */
  maxToolIterations: number;
}

/**
 * La politique de chaque emplacement. Les plafonds de sortie restent sous
 * ~16 000 : au-delà, un appel non diffusé (« non-streaming ») risque le délai
 * HTTP des fournisseurs.
 */
export const SLOT_POLICY: Record<ModelSlot, SlotPolicy> = {
  router: { reasoning: "none", maxTokens: 256, timeoutMs: 6_000, maxToolIterations: 0 },
  fast: { reasoning: "none", maxTokens: 2_048, timeoutMs: 20_000, maxToolIterations: 2 },
  balanced: { reasoning: "low", maxTokens: 4_096, timeoutMs: 35_000, maxToolIterations: 3 },
  strong: { reasoning: "medium", maxTokens: 8_192, timeoutMs: 50_000, maxToolIterations: 3 },
  deep: { reasoning: "high", maxTokens: 16_000, timeoutMs: 75_000, maxToolIterations: 4 },
};

/**
 * Le modèle par défaut de chaque emplacement, par fournisseur. Seuls les
 * fournisseurs dont les gammes sont connues en ont : pour les autres, un
 * identifiant deviné serait un identifiant mort.
 *
 * Gemini — Flash-Lite pour router, Flash pour le simple et l'analyse d'un
 * domaine, Pro pour le diagnostic (l'adaptateur redescend sur Flash si la clé
 * n'a pas accès à Pro).
 * Anthropic — Haiku 4.5 pour router et le simple, Sonnet 5.5 pour l'analyse,
 * Opus 5.5 réservé à la revue profonde : jamais Opus partout.
 */
export const DEFAULT_SLOT_MODELS: Record<string, Partial<Record<ModelSlot, string>>> = {
  gemini: {
    router: "gemini-2.5-flash-lite",
    fast: "gemini-2.5-flash",
    balanced: "gemini-2.5-flash",
    strong: "gemini-2.5-pro",
    deep: "gemini-2.5-pro",
  },
  anthropic: {
    router: "claude-haiku-4-5",
    fast: "claude-haiku-4-5",
    balanced: "claude-sonnet-5-5",
    strong: "claude-sonnet-5-5",
    deep: "claude-opus-5-5",
  },
};

/** Le nom de la variable d'environnement de chaque emplacement (documenté dans `.env.example`). */
const SLOT_ENV: Record<ModelSlot, string> = {
  router: "AI_MODEL_ROUTER",
  fast: "AI_MODEL_FAST",
  balanced: "AI_MODEL_BALANCED",
  strong: "AI_MODEL_STRONG",
  deep: "AI_MODEL_DEEP",
};

/**
 * Le réglage d'un emplacement, lu À CHAQUE APPEL (modifiable sans
 * redéploiement). Chaque variable est nommée en toutes lettres : une lecture
 * par clé calculée échapperait au contrôle de `.env.example`.
 */
function slotSetting(slot: ModelSlot): string {
  switch (slot) {
    case "router":
      return process.env.AI_MODEL_ROUTER ?? "";
    case "fast":
      return process.env.AI_MODEL_FAST ?? "";
    case "balanced":
      return process.env.AI_MODEL_BALANCED ?? "";
    case "strong":
      return process.env.AI_MODEL_STRONG ?? "";
    case "deep":
      return process.env.AI_MODEL_DEEP ?? "";
  }
}

export interface SlotCandidate {
  provider: AIProvider;
  /** `undefined` = le modèle par défaut du fournisseur (sa variable d'env). */
  model?: string;
}

/** Lit `fournisseur:modèle, fournisseur, …` — les entrées illisibles sont ignorées. */
export function parseSlotSpec(spec: string): { provider: string; model?: string }[] {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(":");
      if (i === -1) return { provider: part.toLowerCase() };
      const model = part.slice(i + 1).trim();
      return { provider: part.slice(0, i).trim().toLowerCase(), ...(model ? { model } : {}) };
    })
    .filter((c) => /^[a-z0-9_-]+$/.test(c.provider));
}

/**
 * Le routage par petit modèle est-il actif ? Éteint par `AI_MODEL_ROUTER=off`,
 * ou de fait quand aucun fournisseur n'est configuré.
 */
export function modelRoutingEnabled(): boolean {
  return slotSetting("router").trim().toLowerCase() !== "off";
}

/**
 * La chaîne de candidats d'un emplacement, du préféré au dernier recours. Ne
 * rend QUE des fournisseurs configurés (une clé présente).
 */
export function resolveSlotCandidates(
  slot: ModelSlot,
  providers: AIProvider[] = resolveProviders(),
): SlotCandidate[] {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const spec = slotSetting(slot).trim();
  if (spec && spec.toLowerCase() !== "off") {
    const explicit = parseSlotSpec(spec)
      .map(({ provider, model }): SlotCandidate | null => {
        const p = byId.get(provider);
        return p ? { provider: p, model: model ?? DEFAULT_SLOT_MODELS[provider]?.[slot] } : null;
      })
      .filter((c): c is SlotCandidate => c !== null);
    if (explicit.length) return explicit;
    // Réglage qui ne nomme aucun fournisseur configuré : on le DIT et on
    // retombe sur l'ordre par défaut plutôt que de rendre Jarvis muet.
    console.warn(`[ai] ${SLOT_ENV[slot]} ne nomme aucun fournisseur configuré — ordre par défaut.`);
  }
  return providers.map((p) => ({ provider: p, model: DEFAULT_SLOT_MODELS[p.id]?.[slot] }));
}

/**
 * Un fournisseur ÉPINGLÉ sur un emplacement : chaque appel reçoit le modèle,
 * la réflexion, le plafond et le délai de l'emplacement — sauf ce que la
 * requête fixe déjà (une boucle d'outils épingle le modèle qui a servi).
 *
 * Même `id` que le fournisseur d'origine : le disjoncteur, les métriques et la
 * télémétrie continuent de raisonner par fournisseur.
 */
export function pinToSlot(candidate: SlotCandidate, slot: ModelSlot): AIProvider {
  const policy = SLOT_POLICY[slot];
  const base = candidate.provider;
  return {
    id: base.id,
    supportsTools: base.supportsTools,
    isConfigured: () => base.isConfigured(),
    complete: (req: AIRequest) =>
      base.complete({
        ...req,
        model: req.model ?? candidate.model,
        reasoning: req.reasoning ?? policy.reasoning,
        maxTokens: req.maxTokens ?? policy.maxTokens,
        timeoutMs: req.timeoutMs ?? policy.timeoutMs,
      }),
  };
}

/** La chaîne prête à l'emploi pour `routeCompletion` / `runWithTools`. */
export function slotChain(slot: ModelSlot, providers?: AIProvider[]): AIProvider[] {
  return resolveSlotCandidates(slot, providers).map((c) => pinToSlot(c, slot));
}

/** Le modèle qu'un emplacement utiliserait en premier — pour le diagnostic. */
export function describeSlot(slot: ModelSlot, providers?: AIProvider[]): string[] {
  return resolveSlotCandidates(slot, providers).map(
    (c) => `${c.provider.id}:${c.model ?? "(default)"}`,
  );
}
