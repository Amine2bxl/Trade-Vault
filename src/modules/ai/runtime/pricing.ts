/**
 * LE COÛT ESTIMÉ D'UNE QUESTION — pour la télémétrie, jamais pour le trader.
 *
 * `ai_agent_runs` comptait des tokens mais aucun coût : impossible de savoir
 * combien coûte une question, ni ce que rapporte le routage par niveaux. Ce
 * module traduit les tokens en dollars, PAR MODÈLE.
 *
 * ── D'OÙ VIENNENT LES PRIX ─────────────────────────────────────────────────
 *  - Claude : grille publique Anthropic (référence de septembre 2026). Les
 *    écritures en cache (TTL 5 min, le seul que l'adaptateur pose) coûtent
 *    1,25 × l'entrée ; les lectures, le tarif « cache » de la table.
 *  - Gemini : prix publics de lancement de la gamme 2.5 — VALEURS DE
 *    RÉFÉRENCE À RECONFIRMER sur la grille Google en vigueur.
 *  - Les autres (OpenAI, Groq, OpenRouter, modèles gratuits) : inconnus ici ;
 *    le coût est alors `null`, jamais inventé.
 *
 * `AI_MODEL_PRICES` (JSON `{ "modèle": [entrée, sortie, entrée en cache] }`,
 * en $ par million de tokens) remplace ou complète la table sans redéploiement.
 * C'est une ESTIMATION d'exploitation : elle ne sert qu'aux arbitrages de
 * coût, elle n'apparaît nulle part dans l'interface.
 */

/** [entrée, sortie, entrée lue en cache] en $ par million de tokens. */
type Price = [input: number, output: number, cachedInput: number];

const DEFAULT_PRICES: Record<string, Price> = {
  // Anthropic — grille publique (cache lu ≈ 10 % de l'entrée).
  "claude-opus-5-5": [4, 20, 0.2],
  "claude-opus-5": [5, 25, 0.5],
  // Modèle de repli serveur (`fallbacks: "default"`) — le modèle qui a SERVI
  // est celui de la réponse : sans son prix, tout le coût devenait `null`.
  "claude-opus-4-8": [5, 25, 0.5],
  "claude-sonnet-5-5": [2, 10, 0.2],
  "claude-sonnet-5": [2, 10, 0.2],
  "claude-haiku-4-5": [1, 5, 0.1],
  // Gemini 2.5 — prix publics de lancement, à reconfirmer.
  "gemini-2.5-pro": [1.25, 10, 0.31],
  "gemini-2.5-flash": [0.3, 2.5, 0.075],
  "gemini-2.5-flash-lite": [0.1, 0.4, 0.025],
};

function overrides(): Record<string, Price> {
  const raw = process.env.AI_MODEL_PRICES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Price> = {};
    for (const [model, v] of Object.entries(parsed)) {
      if (
        Array.isArray(v) &&
        v.length >= 2 &&
        v.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
      ) {
        out[model] = [v[0], v[1], v[2] ?? v[0]] as Price;
      }
    }
    return out;
  } catch {
    console.warn("[ai] AI_MODEL_PRICES illisible — table par défaut.");
    return {};
  }
}

/** Le prix d'un modèle, en tolérant un suffixe de version (« claude-haiku-4-5-20251001 »). */
export function priceOf(model: string): Price | null {
  const table = { ...DEFAULT_PRICES, ...overrides() };
  if (table[model]) return table[model];
  const key = Object.keys(table)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : null;
}

export interface UsageForCost {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  cachedInputTokens?: number;
  cacheWriteInputTokens?: number;
}

/** Multiplicateur d'une écriture en cache Anthropic (TTL 5 minutes). */
const CACHE_WRITE_MULTIPLIER = 1.25;

/**
 * Coût estimé d'un appel, en dollars, ou `null` quand le prix du modèle est
 * inconnu. La réflexion est facturée comme de la sortie ; l'entrée lue en cache
 * l'est au tarif du cache, l'entrée ÉCRITE en cache à 1,25 × l'entrée (les
 * deux sont comprises dans `inputTokens`).
 */
export function estimateCostUsd(u: UsageForCost): number | null {
  const price = priceOf(u.model);
  if (!price) return null;
  const [inP, outP, cacheP] = price;
  const input = u.inputTokens ?? 0;
  const cached = Math.min(u.cachedInputTokens ?? 0, input);
  const writes = Math.min(u.cacheWriteInputTokens ?? 0, input - cached);
  const output = (u.outputTokens ?? 0) + (u.thinkingTokens ?? 0);
  return (
    ((input - cached - writes) * inP +
      writes * inP * CACHE_WRITE_MULTIPLIER +
      cached * cacheP +
      output * outP) /
    1_000_000
  );
}
