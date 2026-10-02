/**
 * LE CONTEXT ENGINE DE JARVIS — envoyer au modèle ce dont la question a besoin,
 * et rien d'autre.
 *
 * ── LE PROBLÈME ────────────────────────────────────────────────────────────
 * Le client poussait TOUT à chaque question : statistiques, 25 trades, ~12 Ko
 * de signaux, règles, objectifs, adhérence, intentions, réflexions, mémoire et
 * jusqu'à seize tours de conversation. « Salut » payait le même contexte
 * qu'une revue mensuelle — et à l'inverse, « qu'est-ce qui a changé entre août
 * et septembre ? » n'avait ni août ni septembre dans le paquet : le modèle
 * devait deviner qu'il fallait les lire.
 *
 * ── CE QUE FAIT LE MOTEUR ──────────────────────────────────────────────────
 * À partir de la route (`router/route.ts`), il décide :
 *   1. quels BLOCS poussés par le client garder (la mémoire pour une question
 *      de discipline, l'adhérence pour une question de plan…) ;
 *   2. quelles LECTURES préparer côté serveur, EN PARALLÈLE, avant le premier
 *      appel modèle — la période nommée, les deux périodes comparées, la
 *      journée citée ; le modèle n'a plus à deviner ce que TradeVault sait ;
 *   3. quels OUTILS offrir ensuite au modèle pour ce qui manquerait encore ;
 *   4. combien de tours de CONVERSATION garder ;
 *   5. quelles SOURCES ne sont pas branchées (marché, base produit) — dites
 *      au modèle pour qu'il le dise au lieu d'inventer.
 *
 * ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────────────
 * Aucun calcul : les lectures préparées sont les OUTILS existants
 * (`backend/ai-tools`, moteurs du tableau de bord), exécutés par le registre
 * sous l'identité et le compte de la requête. Aucune écriture. La planification
 * est PURE ; seule `executePrefetch` touche aux outils.
 *
 * ── LE POINT D'EXTENSION ───────────────────────────────────────────────────
 * `registerContextSource` branche une source de contexte sur un domaine sans
 * toucher au moteur. Le calendrier économique (LOT 5) et la base de
 * connaissance produit (LOT 3) s'y brancheront ; d'ici là leur domaine produit
 * un avertissement explicite.
 */
import type { QuestionRoute, RouteDomain } from "./router/route";
import { getTool, type ToolContext } from "./tools/types";

/** Les blocs que le client pousse (voir `CoachInput`). */
export type ContextBlockId =
  | "stats"
  | "trades"
  | "mistakes"
  | "signals"
  | "goals"
  | "rules"
  | "adherence"
  | "edge"
  | "intent"
  | "reflection"
  | "session"
  | "memory"
  | "profile"
  | "calibration"
  | "simulation";

/** Une lecture préparée : un outil existant, des arguments, une étiquette. */
export interface PrefetchCall {
  tool: string;
  args: Record<string, unknown>;
  /** Ce que la lecture représente, lisible par le modèle (« stats 2026-08-01..2026-08-31 »). */
  label: string;
}

export interface ContextPlan {
  /** Blocs client conservés. */
  blocks: ContextBlockId[];
  /** Sections de signaux conservées (vide = aucun signal). */
  signalKeys: string[];
  /** Lectures préparées avant le premier appel modèle. */
  prefetch: PrefetchCall[];
  /** Outils offerts au modèle pour la suite (vide = pas de boucle d'outils). */
  tools: string[];
  /** Tours de conversation gardés. */
  conversationTurns: number;
  /** Sources non branchées, à DIRE au modèle. */
  notices: string[];
}

/**
 * Une source de contexte branchée sur un domaine. Elle ajoute ses lectures et
 * ses outils au plan ; sa présence lève l'avertissement « non branché ».
 */
export interface ContextSource {
  domain: RouteDomain;
  prefetch(route: QuestionRoute): PrefetchCall[];
  tools: readonly string[];
}

const sources = new Map<RouteDomain, ContextSource>();

/** Branche une source (une par domaine). Rend la fonction de débranchement. */
export function registerContextSource(source: ContextSource): () => void {
  sources.set(source.domain, source);
  return () => {
    if (sources.get(source.domain) === source) sources.delete(source.domain);
  };
}

/** Avertissements pour les domaines sans source branchée. */
export const UNAVAILABLE_NOTICE: Partial<Record<RouteDomain, string>> = {
  market:
    "MARKET DATA NOT CONNECTED: the economic calendar, release times and market news are not " +
    "available to you here. Do not state, guess or recall any event, time, forecast, actual " +
    "figure or market move. Say plainly that you cannot see the calendar from here, and that " +
    "the Economic News page of TradeVault shows it. You may still analyse the trader's own " +
    "journal for the rest of the question.",
  product:
    "PRODUCT KNOWLEDGE NOT CONNECTED: no verified TradeVault product information is available " +
    "to you here. Never state a TradeVault price, plan content, usage limit, feature or page " +
    "behaviour from memory. If the question needs one, say you don't have enough information " +
    "to confirm it, and point the trader to the relevant page of the app (Pricing, Settings…).",
};

// ── Recettes par domaine ─────────────────────────────────────────────────────

interface Recipe {
  blocks: ContextBlockId[];
  signals?: string[];
  tools: string[];
  prefetch?: (route: QuestionRoute) => PrefetchCall[];
}

const ALL_SIGNALS = [
  "byWeekday",
  "bySession",
  "bySymbol",
  "byStrategy",
  "riskAfterLoss",
  "overtrading",
  "setupQuality",
  "conviction",
  "disciplinePct",
  "recentForm",
];

/** Arguments d'outil pour une période de la route. */
function periodArgs(p: { since: string; until: string }): Record<string, unknown> {
  return { since: p.since, until: p.until };
}

function statsFor(route: QuestionRoute): PrefetchCall[] {
  const p = route.entities.period;
  return p
    ? [{ tool: "get_stats", args: periodArgs(p), label: `stats ${p.since}..${p.until}` }]
    : [];
}

function mistakesFor(route: QuestionRoute): PrefetchCall[] {
  const p = route.entities.period;
  return [
    p
      ? { tool: "get_mistakes", args: periodArgs(p), label: `mistakes ${p.since}..${p.until}` }
      : { tool: "get_mistakes", args: { days: 90 }, label: "mistakes last 90 days" },
  ];
}

const RECIPES: Record<RouteDomain, Recipe> = {
  smalltalk: { blocks: ["profile"], tools: [] },
  knowledge: { blocks: ["profile"], tools: [] },
  product: { blocks: [], tools: [] },
  identity: {
    blocks: ["profile"],
    tools: ["get_profile"],
    prefetch: () => [
      { tool: "get_profile", args: {}, label: "profile, accounts, plan, rules, goals" },
    ],
  },
  trade: {
    blocks: ["trades", "intent", "reflection", "rules", "profile", "calibration"],
    signals: ["setupQuality", "conviction"],
    tools: ["get_trades", "get_day"],
    prefetch: (r) => {
      const p = r.entities.period;
      const sym = r.entities.symbols[0];
      return [
        {
          tool: "get_trades",
          args: { limit: 5, ...(p ? periodArgs(p) : {}), ...(sym ? { symbol: sym } : {}) },
          label: `latest trades${p ? ` ${p.since}..${p.until}` : ""}${sym ? ` ${sym}` : ""}`,
        },
      ];
    },
  },
  day: {
    blocks: ["session", "rules", "profile", "memory", "calibration"],
    tools: ["get_day", "get_trades", "get_stats", "get_mistakes"],
    prefetch: (r) => {
      const p = r.entities.period;
      if (!p) return [];
      // `get_day` couvre 14 jours au plus : au-delà, c'est une période.
      const days =
        (Date.parse(`${p.until}T12:00:00`) - Date.parse(`${p.since}T12:00:00`)) / 86_400_000;
      return days <= 13
        ? [
            {
              tool: "get_day",
              args: p.since === p.until ? { date: p.since } : periodArgs(p),
              label: `day ${p.label}`,
            },
          ]
        : statsFor(r);
    },
  },
  performance: {
    blocks: ["stats", "mistakes", "goals", "calibration"],
    tools: ["get_stats", "get_trades", "get_mistakes"],
    prefetch: statsFor,
  },
  comparison: {
    blocks: ["profile", "calibration"],
    signals: ["recentForm"],
    tools: ["get_stats", "get_mistakes", "get_trades"],
    prefetch: (r) => {
      const c = r.entities.comparison;
      if (!c) return [];
      return c.flatMap((p) => [
        {
          tool: "get_stats",
          args: periodArgs(p),
          label: `stats ${p.label} (${p.since}..${p.until})`,
        },
        {
          tool: "get_mistakes",
          args: periodArgs(p),
          label: `mistakes ${p.label} (${p.since}..${p.until})`,
        },
      ]);
    },
  },
  mistakes: {
    blocks: ["mistakes", "intent", "reflection", "adherence", "memory"],
    signals: ["riskAfterLoss", "overtrading", "disciplinePct"],
    tools: ["get_mistakes", "get_trades", "get_day"],
    prefetch: mistakesFor,
  },
  psychology: {
    blocks: ["mistakes", "intent", "reflection", "session", "memory", "profile"],
    signals: ["riskAfterLoss", "overtrading", "conviction", "disciplinePct"],
    tools: ["get_mistakes", "get_day", "search_memory"],
    prefetch: mistakesFor,
  },
  risk: {
    blocks: ["edge", "rules", "stats", "calibration", "profile"],
    signals: ["riskAfterLoss", "overtrading"],
    tools: ["get_stats", "get_profile", "get_trades", "get_edge_score"],
    prefetch: () => [{ tool: "get_profile", args: {}, label: "written plan and rules" }],
  },
  plan: {
    blocks: ["adherence", "rules", "edge", "mistakes", "memory", "profile"],
    signals: ["riskAfterLoss", "overtrading", "disciplinePct"],
    tools: ["get_profile", "get_stats", "get_trades", "get_mistakes"],
    prefetch: (r) => [
      { tool: "get_profile", args: {}, label: "written plan and rules" },
      ...(r.entities.period
        ? statsFor(r)
        : [{ tool: "get_stats", args: { days: 30 }, label: "stats last 30 days" }]),
    ],
  },
  rules: {
    blocks: ["rules", "adherence", "memory", "profile"],
    tools: ["get_profile", "search_memory"],
    prefetch: () => [{ tool: "get_profile", args: {}, label: "written plan and rules" }],
  },
  goals: {
    blocks: ["goals", "stats", "profile", "calibration"],
    signals: ["recentForm"],
    tools: ["get_profile", "get_stats"],
  },
  simulation: {
    blocks: ["simulation", "stats", "calibration"],
    tools: ["get_stats"],
  },
  market: { blocks: [], tools: [] },
  memory: {
    blocks: ["memory", "profile"],
    tools: ["search_memory"],
  },
  sessions: {
    blocks: ["stats"],
    signals: ["bySession"],
    tools: ["get_stats", "get_trades"],
    prefetch: (r) =>
      statsFor(r).length
        ? statsFor(r)
        : [{ tool: "get_stats", args: { days: 90 }, label: "stats last 90 days" }],
  },
  patterns: {
    blocks: ["mistakes", "edge", "stats"],
    signals: ALL_SIGNALS,
    tools: ["get_mistakes", "get_stats", "get_trades"],
    prefetch: mistakesFor,
  },
};

/** Tours de conversation gardés, par niveau : une salutation n'a pas besoin de l'historique. */
const TURNS_BY_TIER: Record<number, number> = { 1: 4, 2: 8, 3: 12, 4: 16 };

/** Au-delà, les lectures préparées deviennent un coût : le modèle peut demander le reste. */
const MAX_PREFETCH = 6;

/**
 * Le plan de contexte d'une question. PUR et déterministe.
 *
 * `hasEdgeBlock` : quand le client a envoyé l'Edge Score (identique au tableau
 * de bord, routine de la checklist comprise), l'outil serveur — qui ne voit pas
 * la checklist — n'est pas offert.
 */
export function planContext(
  route: QuestionRoute,
  opts: { hasEdgeBlock?: boolean } = {},
): ContextPlan {
  const blocks = new Set<ContextBlockId>();
  const signalKeys = new Set<string>();
  const tools = new Set<string>();
  const prefetch: PrefetchCall[] = [];
  const notices: string[] = [];

  for (const domain of route.domains) {
    const recipe = RECIPES[domain];
    for (const b of recipe.blocks) blocks.add(b);
    for (const s of recipe.signals ?? []) signalKeys.add(s);
    for (const t of recipe.tools) tools.add(t);
    prefetch.push(...(recipe.prefetch?.(route) ?? []));
    const source = sources.get(domain);
    if (source) {
      prefetch.push(...source.prefetch(route));
      for (const t of source.tools) tools.add(t);
    } else if (UNAVAILABLE_NOTICE[domain]) {
      notices.push(UNAVAILABLE_NOTICE[domain]!);
    }
  }

  // Un « pourquoi » sur la performance : les signaux de comportement sont la
  // preuve d'un diagnostic, pas d'un chiffre.
  if (route.asksWhy && (blocks.has("stats") || route.domains.includes("day"))) {
    for (const s of ["byWeekday", "bySession", "bySymbol", "byStrategy", "recentForm"])
      signalKeys.add(s);
    blocks.add("mistakes");
    blocks.add("rules");
  }
  // Les entités ciblent les sections : un jour de semaine, une session, un symbole.
  if (route.entities.weekdays.length) signalKeys.add("byWeekday");
  if (route.entities.sessions.length) signalKeys.add("bySession");
  if (route.entities.symbols.length && route.personal) signalKeys.add("bySymbol");
  if (signalKeys.size) blocks.add("signals");

  // Une période nommée : les chiffres viennent de la lecture DE CETTE PÉRIODE.
  // Les statistiques client couvrent tout l'historique ; les garder à côté
  // inviterait le modèle à citer le mauvais chiffre.
  if (route.entities.period || route.entities.comparison) blocks.delete("stats");

  // Edge Score : le bloc client EST le chiffre du tableau de bord.
  if (opts.hasEdgeBlock) tools.delete("get_edge_score");

  // Les analyses profondes ont droit à tous les outils : on ne sait pas
  // d'avance ce qu'un diagnostic croisé ira chercher.
  if (route.tier >= 3 && route.domains.some((d) => RECIPES[d].tools.length > 0)) {
    for (const t of [
      "get_profile",
      "get_day",
      "get_stats",
      "get_trades",
      "get_mistakes",
      "get_edge_score",
      "search_memory",
    ])
      if (!(opts.hasEdgeBlock && t === "get_edge_score")) tools.add(t);
  }

  // Lectures dédoublonnées (même outil, mêmes arguments) et bornées.
  const seen = new Set<string>();
  const uniquePrefetch = prefetch.filter((c) => {
    const key = `${c.tool}:${JSON.stringify(c.args)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    blocks: [...blocks],
    signalKeys: [...signalKeys],
    prefetch: uniquePrefetch.slice(0, MAX_PREFETCH),
    tools: [...tools],
    conversationTurns: TURNS_BY_TIER[route.tier] ?? 8,
    notices,
  };
}

// ── Exécution des lectures préparées ─────────────────────────────────────────

export interface PrefetchResult {
  call: PrefetchCall;
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

/** Délai d'une lecture préparée : une base lente ne doit pas retarder la réponse. */
const PREFETCH_TIMEOUT_MS = 6_000;

/**
 * Exécute les lectures préparées EN PARALLÈLE, chacune bornée dans le temps.
 * Ne lève jamais : une lecture ratée est rendue comme telle (et dite au
 * modèle), jamais comme une absence de données.
 */
export async function executePrefetch(
  calls: readonly PrefetchCall[],
  ctx: ToolContext,
  timeoutMs = PREFETCH_TIMEOUT_MS,
): Promise<PrefetchResult[]> {
  return Promise.all(
    calls.map(async (call): Promise<PrefetchResult> => {
      const started = Date.now();
      const tool = getTool(call.tool);
      if (!tool) return { call, ok: false, error: `unknown tool ${call.tool}`, durationMs: 0 };
      // Lecture seule, toujours : une source branchée ne peut pas écrire par ici.
      if (tool.sideEffect)
        return { call, ok: false, error: "side-effecting tool refused", durationMs: 0 };
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const output = await Promise.race([
          tool.execute(call.args, ctx),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("prefetch timeout")), timeoutMs);
          }),
        ]);
        return { call, ok: true, output, durationMs: Date.now() - started };
      } catch (e) {
        return {
          call,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - started,
        };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );
}

/** Plafond de caractères d'UNE lecture dans le prompt. */
const PREFETCH_BLOCK_CHARS = 8_000;

/**
 * Une sortie d'outil, bornée pour le prompt. Les listes longues (trades,
 * erreurs) sont raccourcies et le DISENT — jamais tronquées en silence.
 */
export function compactOutput(output: unknown, maxChars = PREFETCH_BLOCK_CHARS): string {
  let json = JSON.stringify(output) ?? "null";
  if (json.length <= maxChars || !output || typeof output !== "object" || Array.isArray(output))
    return json.length <= maxChars ? json : `${json.slice(0, maxChars)}…(truncated)`;
  const copy: Record<string, unknown> = { ...(output as Record<string, unknown>) };
  for (const key of ["trades", "mistakes", "missedOpportunities", "sessions", "memories"]) {
    const list = copy[key];
    if (!Array.isArray(list)) continue;
    let n = list.length;
    while (n > 1 && JSON.stringify({ ...copy, [key]: list.slice(0, n) }).length > maxChars)
      n = Math.floor(n * 0.7);
    if (n < list.length) {
      copy[key] = list.slice(0, n);
      copy[`${key}ShownForBrevity`] = `${n} of ${list.length}`;
    }
    json = JSON.stringify(copy);
    if (json.length <= maxChars) return json;
  }
  return json.length <= maxChars ? json : `${json.slice(0, maxChars)}…(truncated)`;
}

/**
 * Les lectures préparées, en blocs de prompt. Chaque bloc dit sa provenance
 * (MESURÉ par les moteurs de TradeVault) et sa portée (compte actif, période).
 */
export function prefetchBlocks(results: readonly PrefetchResult[]): string {
  if (!results.length) return "";
  return results
    .map((r) =>
      r.ok
        ? `MEASURED — ${r.call.label} (tool ${r.call.tool}, read for you from the active account by TradeVault's deterministic engines — the same numbers the app shows; quote, never recompute):\n${compactOutput(r.output)}`
        : `UNAVAILABLE — ${r.call.label}: this read failed (${(r.error ?? "error").slice(0, 120)}). Do NOT treat it as "no data"; say it could not be read, or call the tool again.`,
    )
    .join("\n\n");
}

/** Filtre un objet de signaux aux sections retenues. */
export function pickSignals(
  signals: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (!signals || keys.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (signals[k] !== undefined) out[k] = signals[k];
  return Object.keys(out).length ? out : undefined;
}
