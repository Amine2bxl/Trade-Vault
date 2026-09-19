import type { ToolDefinition, ToolContext } from "@/modules/ai/tools/types";
import type { Trade } from "@/app/types";
import { serviceClient } from "@/backend/billing.server";
import { loadTrades, type AnyClient } from "./trades";
import { computeStats } from "@/app/utils/tradeCalcs";
import { computeQuantStats, statsBySession } from "@/app/utils/quantStats";
import { computeBehavioral } from "@/app/utils/behavioral";
import { computeEdgeScore, EDGE_WINDOW_DAYS } from "@/app/utils/edgeScore";
import { todayLocalDate } from "@/shared/calendar-date";

/**
 * LES OUTILS DE JARVIS — ce qui le sépare d'un texte pré-rempli.
 *
 * ── CE QUI CHANGE ──────────────────────────────────────────────────────────
 * Jusqu'ici, le client CALCULAIT le contexte et le POUSSAIT dans la requête :
 * stats, trades récents, erreurs, tout était décidé avant que le modèle ait lu
 * la question. Conséquence directe, et c'est exactement ce que le trader
 * reprochait à Jarvis : il ne pouvait répondre qu'aux questions dont la réponse
 * se trouvait déjà dans le paquet. « Combien j'ai perdu sur l'or en mars ? »
 * n'avait aucune chance — mars n'était pas dans les vingt derniers trades.
 *
 * Un outil inverse le sens de la flèche : le modèle DEMANDE. Il choisit la
 * fenêtre, le symbole, la profondeur, et il peut demander deux fois si la
 * première réponse ne suffit pas. C'est la différence entre lire une fiche et
 * consulter un journal.
 *
 * ── LES QUATRE RÈGLES QUI TIENNENT CE MODULE ───────────────────────────────
 *
 * 1. LECTURE SEULE. `sideEffect: false` partout. Aucun outil n'écrit, ne
 *    supprime, ne facture. Un modèle qui se trompe de fenêtre rend une réponse
 *    fausse ; un modèle qui se trompe en écrivant abîme le journal du trader.
 *    L'écriture viendra, sous confirmation explicite, et pas dans ce module.
 *
 * 2. CLOISONNEMENT PAR `ctx.userId`, TOUJOURS. Le client de service contourne
 *    la RLS : c'est donc le code qui porte l'isolation. Aucun outil n'accepte
 *    d'identifiant d'utilisateur en argument — le modèle ne peut pas en
 *    inventer un, puisqu'il n'a pas de champ pour l'écrire. C'est la seule
 *    défense qui résiste à une injection dans la question du trader.
 *
 * 3. AUCUN CALCUL ICI. Les chiffres viennent des moteurs déterministes déjà
 *    testés (`tradeCalcs`, `quantStats`, `behavioral`, `edgeScore`). Un outil
 *    qui recalculerait une moyenne « à sa façon » créerait un deuxième chiffre
 *    divergent — la faute que ce projet interdit en premier.
 *
 * 4. DES SORTIES BORNÉES. Chaque outil plafonne ce qu'il rend, parce que sa
 *    sortie retourne dans le prompt : un outil qui rend mille trades fait
 *    exploser le coût et noie la question. Le plafond est dans le code, pas
 *    dans la description — le modèle ne peut pas le relever.
 */

/** Plafonds de sortie. Le modèle peut demander moins, jamais plus. */
const LIMITES = {
  /** Lignes de trades rendues en une fois. */
  trades: 50,
  /** Erreurs distinctes rendues. Au-delà, la liste n'est plus une liste. */
  mistakes: 15,
  /** Souvenirs rendus. Même budget que la sélection client. */
  memory: 12,
  /** Fenêtre par défaut, en jours, quand la question n'en nomme aucune. */
  joursDefaut: 90,
  /** Fenêtre maximale — 5 ans couvre tout historique réel. */
  joursMax: 1825,
} as const;

/** Le client de service, ou une erreur NOMMÉE : un outil muet ferait croire au
 *  modèle que le trader n'a pas de données, et il le lui dirait. */
function client(): AnyClient {
  const sb = serviceClient();
  if (!sb) throw new Error("Database unavailable: server Supabase credentials are missing.");
  return sb;
}

function entier(v: unknown, defaut: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return defaut;
  return Math.min(Math.floor(n), max);
}

/** Une date `YYYY-MM-DD` venant du modèle, ou `undefined`. Jamais de `Date`
 *  reconstruite : une chaîne mal formée doit être ignorée, pas devenir 1970. */
function date(v: unknown): string | undefined {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

function texte(v: unknown, max = 60): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

/** Le début d'une fenêtre de N jours, en date locale — jamais en découpant un
 *  `toISOString()`, qui décale la journée d'un fuseau à l'autre. */
function depuis(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return todayLocalDate(d);
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Le bloc de fenêtre commun à toutes les sorties : sans lui, le modèle citerait
 *  un chiffre sans dire sur quoi il porte. */
function fenetre(jours: number, trades: Trade[]) {
  return {
    windowDays: jours,
    since: depuis(jours),
    until: todayLocalDate(),
    tradesInWindow: trades.length,
  };
}

async function tradesDe(
  ctx: ToolContext,
  opts: { jours?: number; since?: string; until?: string } = {},
): Promise<Trade[]> {
  return loadTrades(client(), ctx.userId, {
    accountId: ctx.accountId ?? null,
    since: opts.since ?? (opts.jours ? depuis(opts.jours) : undefined),
    until: opts.until,
  });
}

// ── get_trades ───────────────────────────────────────────────────────────────

/**
 * Les trades eux-mêmes, filtrés comme le modèle le demande.
 *
 * C'est l'outil qui débloque les questions que le trader posait déjà et
 * auxquelles Jarvis ne pouvait pas répondre : un symbole, un mois, une erreur
 * précise. Les filtres sont appliqués APRÈS lecture pour `symbol`, `outcome` et
 * `mistake` — ces trois-là portent sur des colonnes que la base stocke sans
 * normalisation (casse libre, tableau d'erreurs), et un filtre SQL approximatif
 * rendrait « aucun trade sur XAUUSD » à un trader qui a tout saisi en « xauusd ».
 */
export const getTrades: ToolDefinition = {
  name: "get_trades",
  description:
    "Read the trader's own logged trades, most recent first. Use it whenever a question " +
    "concerns specific trades, a symbol, a period or a mistake — do not guess from the " +
    "summary blocks. Filters: since/until (YYYY-MM-DD market dates), symbol, outcome " +
    "(win/loss/be), mistake (exact mistake label). Returns at most 50 trades.",
  inputSchema: {
    type: "object",
    properties: {
      since: { type: "string", description: "Inclusive start market date, YYYY-MM-DD." },
      until: { type: "string", description: "Inclusive end market date, YYYY-MM-DD." },
      symbol: { type: "string", description: "Instrument, case-insensitive (e.g. XAUUSD)." },
      outcome: { type: "string", enum: ["win", "loss", "be"] },
      mistake: { type: "string", description: "Exact mistake label, e.g. 'Revenge trade'." },
      limit: { type: "number", description: "1–50, default 20." },
    },
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input, ctx) {
    const args = (input ?? {}) as Record<string, unknown>;
    const since = date(args.since);
    const until = date(args.until);
    const limit = entier(args.limit, 20, LIMITES.trades);
    const symbol = texte(args.symbol, 20)?.toUpperCase();
    const mistake = texte(args.mistake, 100)?.toLowerCase();
    const outcome = texte(args.outcome, 10);

    let trades = await tradesDe(ctx, {
      since,
      until,
      jours: since || until ? undefined : LIMITES.joursMax,
    });
    const total = trades.length;
    if (symbol) trades = trades.filter((t) => t.symbol.toUpperCase() === symbol);
    if (mistake) trades = trades.filter((t) => t.mistakes.some((m) => m.toLowerCase() === mistake));
    if (outcome === "win") trades = trades.filter((t) => t.pnl > 0);
    else if (outcome === "loss") trades = trades.filter((t) => t.pnl < 0);
    else if (outcome === "be") trades = trades.filter((t) => t.pnl === 0);

    const matched = trades.length;
    return {
      // Le décompte AVANT plafonnement : « 50 trades » et « 50 trades sur 312 »
      // ne se commentent pas de la même façon, et le modèle doit pouvoir le dire.
      matched,
      returned: Math.min(matched, limit),
      totalInScope: total,
      netPnl: arrondi(trades.reduce((s, t) => s + t.pnl, 0)),
      trades: trades.slice(0, limit).map((t) => ({
        date: t.date,
        symbol: t.symbol,
        direction: t.direction,
        pnl: arrondi(t.pnl),
        rMultiple: arrondi(t.rMultiple),
        strategy: t.strategy || null,
        mistakes: t.mistakes,
        setupQuality: t.setupQuality,
        entryTime: t.entryTime || null,
      })),
    };
  },
};

// ── get_stats ────────────────────────────────────────────────────────────────

/**
 * Les statistiques, sur la fenêtre que le modèle choisit.
 *
 * `computeStats` et `computeQuantStats` sont les MÊMES fonctions que celles du
 * tableau de bord. Ce n'est pas une commodité : c'est la garantie qu'un chiffre
 * cité par Jarvis correspond, au centime, à celui que le trader a sous les yeux.
 */
export const getStats: ToolDefinition = {
  name: "get_stats",
  description:
    "Compute the trader's performance statistics over a window, from the same " +
    "deterministic engines the dashboard uses. Call it before quoting any number, and " +
    "call it twice with different windows to compare periods. Args: days (default 90), " +
    "or explicit since/until market dates, and startingBalance when known.",
  inputSchema: {
    type: "object",
    properties: {
      days: { type: "number", description: "Window length in days, default 90." },
      since: { type: "string", description: "Inclusive start market date, YYYY-MM-DD." },
      until: { type: "string", description: "Inclusive end market date, YYYY-MM-DD." },
      startingBalance: {
        type: "number",
        description: "Account starting balance; unlocks drawdown %.",
      },
    },
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input, ctx) {
    const args = (input ?? {}) as Record<string, unknown>;
    const since = date(args.since);
    const until = date(args.until);
    const jours = entier(args.days, LIMITES.joursDefaut, LIMITES.joursMax);
    const trades = await tradesDe(ctx, { since, until, jours: since || until ? undefined : jours });
    const balance = typeof args.startingBalance === "number" ? args.startingBalance : 0;

    const s = computeStats(trades);
    const q = computeQuantStats(trades, balance);
    const sessions = statsBySession(trades);

    return {
      window:
        since || until
          ? { since: since ?? null, until: until ?? null, tradesInWindow: trades.length }
          : fenetre(jours, trades),
      totalPnl: arrondi(s.totalPnl),
      winRatePct: arrondi(s.winRate * 100),
      totalTrades: s.totalTrades,
      wins: s.wins,
      losses: s.losses,
      breakEven: s.breakEven,
      avgWin: arrondi(s.avgWin),
      avgLoss: arrondi(s.avgLoss),
      profitFactor: arrondi(s.profitFactor),
      avgRR: arrondi(s.avgRR),
      maxDrawdown: arrondi(s.maxDrawdown),
      currentStreak: s.currentStreak,
      currentStreakType: s.currentStreakType,
      expectancy: arrondi(q.expectancy),
      expectancyR: arrondi(q.expectancyR),
      sharpe: q.sharpe === null ? null : arrondi(q.sharpe),
      sortino: q.sortino === null ? null : arrondi(q.sortino),
      maxDrawdownPct: q.maxDrawdownPct === null ? null : arrondi(q.maxDrawdownPct),
      consistencyScore: q.consistencyScore === null ? null : arrondi(q.consistencyScore),
      /** Part des trades SANS erreur cochée — PAS l'adhérence aux règles. */
      cleanTradesPct: arrondi(q.cleanTrades * 100),
      bySession: Object.fromEntries(
        Object.entries(sessions).map(([k, b]) => [
          k,
          {
            trades: b.count,
            netPnl: arrondi(b.pnl),
            wins: b.wins,
            breakEven: b.breakEven,
            losses: b.count - b.wins - b.breakEven,
          },
        ]),
      ),
    };
  },
};

// ── get_mistakes ─────────────────────────────────────────────────────────────

/**
 * Le rapport comportemental, avec LA PENTE.
 *
 * `weekly` est la série semaine par semaine de chaque erreur — la même que la
 * page Erreurs affiche. C'est ce qui permet à Jarvis de dire « elle recule » au
 * lieu de « tu la fais encore », et de le PROUVER par la série. Sans elle, il ne
 * pourrait que constater un total, ce qui décourage un trader qui progresse.
 */
export const getMistakes: ToolDefinition = {
  name: "get_mistakes",
  description:
    "Read the trader's logged mistakes over a window: frequency, net cost, severity, " +
    "trend vs the previous window, and the week-by-week series (oldest→newest) that shows " +
    "whether each mistake is receding. Also returns win rate with vs without mistakes. " +
    "Args: days (default 90).",
  inputSchema: {
    type: "object",
    properties: { days: { type: "number", description: "Window length in days, default 90." } },
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input, ctx) {
    const args = (input ?? {}) as Record<string, unknown>;
    const jours = entier(args.days, LIMITES.joursDefaut, LIMITES.joursMax);
    const trades = await tradesDe(ctx, { jours });
    const b = computeBehavioral(trades);
    return {
      window: fenetre(jours, trades),
      totalIncidents: b.totalIncidents,
      totalCost: arrondi(b.totalCost),
      tradesWithMistakes: b.tradesWithMistakes,
      cleanTrades: b.cleanTrades,
      cleanWinRatePct: b.cleanWinRate === null ? null : arrondi(b.cleanWinRate * 100),
      mistakeWinRatePct: b.mistakeWinRate === null ? null : arrondi(b.mistakeWinRate * 100),
      /** Score de journalisation propre — ce n'est PAS un score de discipline. */
      cleanJournalScore: b.cleanJournalScore,
      weeks: b.weeklyTrend.map((w) => w.week),
      mistakes: b.rows.slice(0, LIMITES.mistakes).map((r) => ({
        name: r.mistake,
        severity: r.severity,
        count: r.count,
        netPnl: arrondi(r.totalPnl),
        avgPnl: arrondi(r.avgPnl),
        trend: r.trend,
        weekly: r.weekly,
      })),
    };
  },
};

// ── get_edge_score ───────────────────────────────────────────────────────────

/**
 * L'Edge Score, tel que le produit l'affiche — jamais recalculé autrement.
 *
 * Le trader voit ce chiffre sur son tableau de bord. S'il demande « pourquoi
 * 62 ? », Jarvis doit lire LE 62, avec ses quatre composantes et leur
 * dénominateur, et non produire une estimation qui tomberait à 58.
 */
export const getEdgeScore: ToolDefinition = {
  name: "get_edge_score",
  description:
    `Read the trader's Edge Score over its own ${EDGE_WINDOW_DAYS}-traded-day window, with ` +
    "its four weighted components (clean trades 35%, risk 25%, clean days 25%, routine 15%) " +
    "and the weakest one. Quote this number verbatim — it is the one shown in the app. " +
    "Args: maxRiskPct and startingBalance from the written plan, when known.",
  inputSchema: {
    type: "object",
    properties: {
      maxRiskPct: { type: "number", description: "Max risk per trade in %, from the plan." },
      startingBalance: { type: "number", description: "Account starting balance." },
    },
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input, ctx) {
    const args = (input ?? {}) as Record<string, unknown>;
    // La fenêtre de l'Edge Score se compte en JOURS TRADÉS, pas en jours
    // calendaires : on lui donne largement de quoi les trouver, il coupe seul.
    const trades = await tradesDe(ctx, { jours: 365 });
    const e = computeEdgeScore(trades, {
      maxRiskPct: typeof args.maxRiskPct === "number" ? args.maxRiskPct : null,
      startingBalance: typeof args.startingBalance === "number" ? args.startingBalance : null,
    });
    return {
      score: e.score,
      windowTradedDays: EDGE_WINDOW_DAYS,
      tradedDays: e.tradedDays,
      cleanDays: e.cleanDays,
      weakest: e.weakest,
      subs: e.subs,
      /* La routine vient de la checklist, stockée sur l'APPAREIL du trader :
         elle n'existe pas côté serveur. Le dire évite que Jarvis interprète un
         `null` comme « tu ne fais jamais ta routine ». */
      note: "The `routine` component is device-local and unavailable server-side; treat a null value as unmeasured, never as zero.",
    };
  },
};

// ── search_memory ────────────────────────────────────────────────────────────

interface MemoryRow {
  kind: string;
  content: string;
  importance: number | null;
  confidence: number | null;
  source: string | null;
  updated_at: string | null;
  created_at: string;
}

/** Sous ce seuil, un souvenir est une croyance contestée — même règle que
 *  `modules/ai/memory.ts`, dont ce module ne peut pas hériter (client). */
const MIN_CONFIANCE = 0.3;

/**
 * Ce que Jarvis sait déjà du trader, et qu'aucun calcul ne redonnerait.
 *
 * Les engagements pris, les leçons acceptées, le profil déclaré. Le client en
 * pousse déjà une sélection à chaque question ; cet outil permet au modèle
 * d'aller chercher CE souvenir-là quand la question le nomme — « qu'est-ce que
 * je t'avais promis sur la taille de position ? ».
 */
export const searchMemory: ToolDefinition = {
  name: "search_memory",
  description:
    "Search what you already know about this trader (their declared profile, durable " +
    "facts, lessons they accepted, commitments they made, preferences). Use it when the " +
    "question refers to something said before, or to a commitment. Args: query (substring), " +
    "kind, limit (max 12). These are beliefs, not measurements — never quote one as a number.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Substring to look for in the memory content." },
      kind: {
        type: "string",
        enum: ["profile", "fact", "lesson", "decision", "preference", "conversation"],
      },
      limit: { type: "number", description: "1–12, default 8." },
    },
    additionalProperties: false,
  },
  sideEffect: false,
  source: "local",
  async execute(input, ctx) {
    const args = (input ?? {}) as Record<string, unknown>;
    const limit = entier(args.limit, 8, LIMITES.memory);
    const kind = texte(args.kind, 20);
    const query = texte(args.query, 120);

    let q = client()
      .from("ai_memory")
      .select("kind, content, importance, confidence, source, updated_at, created_at")
      .eq("user_id", ctx.userId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (kind) q = q.eq("kind", kind);
    // `%` et `_` sont des jokers pour `ilike` : les échapper évite qu'une
    // question contenant un pourcentage ne renvoie la mémoire entière.
    if (query) q = q.ilike("content", `%${query.replace(/[%_\\]/g, "\\$&")}%`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as MemoryRow[]).filter((r) => (r.confidence ?? 1) >= MIN_CONFIANCE);
    return {
      matched: rows.length,
      memories: rows.map((r) => ({
        kind: r.kind,
        content: r.content,
        importance: r.importance ?? 3,
        source: r.source ?? "unknown",
        updatedAt: r.updated_at ?? r.created_at,
      })),
    };
  },
};

/** Les outils, dans l'ordre où ils servent. */
export const JARVIS_TOOL_DEFS: readonly ToolDefinition[] = [
  getStats,
  getTrades,
  getMistakes,
  getEdgeScore,
  searchMemory,
];
