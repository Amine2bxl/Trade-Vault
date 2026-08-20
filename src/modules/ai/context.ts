/**
 * AI context contract — everything the AI Core may know about a trader,
 * gathered client-side (where the data already lives) and shipped to the
 * server functions. Every field is optional: services degrade gracefully
 * and the context builder only sends what the feature needs.
 */

export interface AITradeSummary {
  date: string;
  symbol: string;
  direction: string;
  pnl: number;
  rMultiple: number;
  strategy: string;
  mistakes: string[];
  setupQuality: number;
  confluences: string[];
  notes?: string;
}

export interface AIUserContext {
  /** Compact trade history (most recent first, capped by the caller). */
  trades?: AITradeSummary[];
  /** Precomputed stats snapshot (from computeStats/computeQuantStats). */
  stats?: Record<string, number | string | null>;
  /** Active goals and their progress. */
  goals?: { kind: string; target: number; current: number }[];
  /** Recurring mistakes with how often they occur and their net cost. */
  mistakes?: { name: string; count: number; totalPnl: number }[];
  /**
   * Precomputed behaviour signals — the deterministic "why" behind the stats
   * (weekday/session edge, size drift after a loss, cost of over-trading…).
   * Shape is owned by the caller: this layer stays business-agnostic and only
   * serializes whatever structured object it is handed.
   */
  signals?: Record<string, unknown>;
  /**
   * Tenue MESURÉE des règles sur la fenêtre récente. Ce qui transforme un
   * rappel (« tu as violé ta règle ») en progression (« tenue 11 fois sur 12 »).
   */
  adherence?: { text: string; kept: number; applicable: number; ratePct: number }[];
  /**
   * Intentions capturées AVANT les trades récents (snapshot figé à l'entrée :
   * setup, raisonnement, confiance, risque prévu, plan, émotion). C'est
   * « ce que je pensais avant ce trade » — la moitié intention → exécution.
   */
  intent?: {
    tradeId: string;
    symbol?: string;
    setup?: string | null;
    reasoning?: string | null;
    confidence?: number | null;
    plannedRisk?: number | null;
    plan?: string | null;
    emotion?: string | null;
  }[];
  /** Réflexions capturées APRÈS les trades récents (plan respecté, raison, note). */
  reflection?: {
    tradeId: string;
    planRespected?: "yes" | "partial" | "no" | null;
    reason?: string | null;
    note?: string | null;
  }[];
  /** Edge Score — indicateur de tête, déjà calculé par `computeEdgeScore`. */
  edge?: {
    score: number | null;
    weakest: string | null;
    windowDays: number;
    subs?: Record<string, { value: number | null; detail?: string }>;
  };
  /** Session de trading courante (état, readiness, discipline + dérivés du jour). */
  session?: {
    date: string;
    emotionalState?: string | null;
    readinessScore?: number | null;
    disciplineScore?: number | null;
    tradesToday: number;
    pnlToday: number;
  };
  /** The trader's own written rules. */
  rules?: { kind: string; text: string; enabled: boolean }[];
  /** Long-term memory entries (profile facts, recurring lessons). */
  memory?: { kind: string; content: string }[];
  /** Recent conversation turns for chat continuity. */
  conversation?: { role: "user" | "assistant"; content: string }[];
  /**
   * Échelle de représentation de l'historique quand il a été recalibré.
   * Absente = échelle d'origine. Voir `app/utils/accountCalibration.ts`.
   */
  calibration?: { originalBalance: number; currentBalance: number; scale: number };
  /**
   * Resultat DEJA calcule par le moteur probabiliste. Voir
   * `modules/probability` : le coach le lit, il ne simule jamais.
   */
  simulation?: {
    engineVersion: string;
    method: string;
    sampleSize: number;
    passProbability: number;
    riskOfRuin: number;
    medianPnl: number;
    medianDrawdown: number;
    horizonTrades: number;
    /** Le changement simule, quand la question en demandait un (« risque
     *  divise par deux »). Absent = scenario tel qu'enregistre. */
    scenario?: string;
  };
  /** UI language (ISO 639-1) — answers are written in this language. */
  language?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
  hi: "Hindi",
};

export function languageName(code?: string): string {
  return LANG_NAMES[code ?? "en"] ?? "English";
}

/** Serializes the context into grounded prompt blocks (data the model may cite). */
export function contextBlocks(ctx: AIUserContext): string {
  const blocks: string[] = [];
  if (ctx.memory?.length) {
    blocks.push(
      `LONG-TERM MEMORY about this trader (facts you already know — use them):\n${ctx.memory
        .map((m) => `- [${m.kind}] ${m.content}`)
        .join("\n")}`,
    );
  }
  if (ctx.adherence?.length) {
    blocks.push(
      `RULE ADHERENCE (measured over the recent window — cite these, they prove progress):\n${ctx.adherence
        .map((a) => `- "${a.text}": kept ${a.kept}/${a.applicable} (${a.ratePct}%)`)
        .join("\n")}`,
    );
  }
  if (ctx.rules?.length) {
    blocks.push(
      `THE TRADER'S OWN RULES:\n${ctx.rules
        .map((r) => `- ${r.text}${r.enabled ? "" : " (disabled)"}`)
        .join("\n")}`,
    );
  }
  if (ctx.goals?.length) {
    blocks.push(
      `ACTIVE GOALS:\n${ctx.goals
        .map((g) => `- ${g.kind}: ${g.current} → target ${g.target}`)
        .join("\n")}`,
    );
  }
  if (ctx.mistakes?.length) {
    blocks.push(
      `RECURRING MISTAKES (name · times · net P&L — trust these numbers):\n${ctx.mistakes
        .map((m) => `- ${m.name}: ${m.count}×, net ${m.totalPnl}`)
        .join("\n")}`,
    );
  }
  // Placé AVANT les chiffres : le modèle doit connaître l'échelle avant de
  // lire le premier montant, sinon il interprète des dollars recalibrés comme
  // s'ils avaient été tradés tels quels.
  if (ctx.calibration && ctx.calibration.scale !== 1) {
    const c = ctx.calibration;
    blocks.push(
      "ACCOUNT SCALE — this history has been RECALIBRATED. It was actually " +
        `traded on a ${c.originalBalance} account and is now represented on a ` +
        `${c.currentBalance} account (${c.scale}× scale). Every monetary value ` +
        "below is ALREADY expressed at the current scale — never convert them " +
        "yourself. Ratios (R multiple, risk %, win rate) and behaviour " +
        "(mistakes, rule adherence, streaks) are UNAFFECTED by recalibration: " +
        "never explain a change in them by the scale change. Do not claim the " +
        "trader increased their risk just because dollar amounts grew — their " +
        "relative risk is unchanged. Mention the recalibration only when the " +
        "question is about monetary amounts or account size.",
    );
  }
  if (ctx.stats && Object.keys(ctx.stats).length) {
    blocks.push(`PRECOMPUTED STATS (trust these numbers):\n${JSON.stringify(ctx.stats)}`);
  }
  if (ctx.signals && Object.keys(ctx.signals).length) {
    blocks.push(
      "BEHAVIOUR SIGNALS (precomputed by the deterministic engine — trust these " +
        "numbers and cite them; they are the evidence behind every diagnosis. " +
        "P&L values are in account currency, winRatePct and driftPct are " +
        `percentages):\n${JSON.stringify(ctx.signals)}`,
    );
  }
  if (ctx.edge && ctx.edge.score !== null) {
    const subs = ctx.edge.subs
      ? Object.entries(ctx.edge.subs)
          .filter(([, s]) => s.value !== null)
          .map(([k, s]) => `${k}=${s.value}${s.detail ? ` (${s.detail})` : ""}`)
          .join(", ")
      : "";
    blocks.push(
      `EDGE SCORE (precomputed 0-100 discipline score over the last ` +
        `${ctx.edge.windowDays} traded days — measures behaviour, never PnL. ` +
        `Cite it but never recompute it. Weakest component: ` +
        `${ctx.edge.weakest ?? "none"}${subs ? ` | sub-scores: ${subs}` : ""}): ` +
        `${ctx.edge.score}`,
    );
  }
  if (ctx.intent?.length || ctx.reflection?.length) {
    const byId = new Map<
      string,
      {
        intent?: NonNullable<AIUserContext["intent"]>[number];
        reflection?: NonNullable<AIUserContext["reflection"]>[number];
      }
    >();
    for (const i of ctx.intent ?? []) byId.set(i.tradeId, { intent: i });
    for (const r of ctx.reflection ?? []) {
      const cur = byId.get(r.tradeId) ?? {};
      byId.set(r.tradeId, { ...cur, reflection: r });
    }
    const lines = [...byId.values()].map(({ intent, reflection }) => {
      const tid = intent?.tradeId ?? reflection?.tradeId ?? "";
      const id = intent?.symbol ? `${intent.symbol} (${tid.slice(0, 8)}…` : tid.slice(0, 8);
      const before = intent
        ? [
            intent.setup ? `setup ${intent.setup}` : null,
            intent.emotion ? `emotion ${intent.emotion}` : null,
            intent.confidence != null ? `${intent.confidence}% confidence` : null,
            intent.plannedRisk != null ? `planned risk ${intent.plannedRisk}` : null,
            intent.plan ? `plan "${intent.plan}"` : null,
          ]
            .filter(Boolean)
            .join(", ")
        : "no intent captured";
      const after = reflection
        ? `plan respected=${reflection.planRespected ?? "n/a"}${
            reflection.reason ? `, reason "${reflection.reason}"` : ""
          }${reflection.note ? `, note "${reflection.note}"` : ""}`
        : "no reflection captured";
      return `- ${id}: BEFORE → ${before} | AFTER → ${after}`;
    });
    blocks.push(
      "TRADE INTENT & REFLECTION (what this trader planned BEFORE each recent " +
        "trade vs how they judged it AFTER — compare intent, execution and " +
        "result. A single instance is an observation, NEVER a pattern; only " +
        "generalize when the sample supports it):\n" +
        lines.join("\n"),
    );
  }
  if (ctx.session) {
    const s = ctx.session;
    blocks.push(
      `CURRENT SESSION (${s.date}): emotionalState=${s.emotionalState ?? "n/a"}, ` +
        `readiness=${s.readinessScore ?? "n/a"}, ` +
        `discipline=${s.disciplineScore ?? "n/a"}, ` +
        `tradesToday=${s.tradesToday}, pnlToday=${s.pnlToday}`,
    );
  }
  if (ctx.simulation) {
    // Le seul endroit d'ou une probabilite a le droit de venir. Le bloc porte
    // sa methode et sa taille d'echantillon pour que la reponse puisse dire
    // d'ou sort le chiffre — « 62 % simule sur tes 140 trades », jamais
    // « 62 % de chances ».
    blocks.push(
      "SIMULATION (produced by the deterministic Monte-Carlo engine — the ONLY " +
        "source of any probability. Never recompute, never estimate another " +
        "one. passProbability and riskOfRuin are 0..1; medianPnl and " +
        "medianDrawdown are in account currency; sampleSize is how many real " +
        "trades were resampled — say so when it is thin. When `scenario` is " +
        "present, this simulation answers the change the trader just asked " +
        "about, not their saved setup — say which change it reflects):\n" +
        JSON.stringify(ctx.simulation),
    );
  }
  if (ctx.trades?.length) {
    const maxTrades = 30;
    const display = ctx.trades.slice(0, maxTrades);
    const omitted = ctx.trades.length - maxTrades;
    const json = JSON.stringify(display, null, 1);
    const suffix = omitted > 0 ? `\n<${omitted} older trades omitted>` : "";
    blocks.push(`RECENT TRADES (${ctx.trades.length}, JSON):\n${json}${suffix}`);
  } else if (ctx.trades) {
    blocks.push("The user has no trades logged yet.");
  }
  return blocks.join("\n\n");
}
