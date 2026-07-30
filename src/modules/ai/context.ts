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
  /** The trader's own written rules. */
  rules?: { kind: string; text: string; enabled: boolean }[];
  /** Long-term memory entries (profile facts, recurring lessons). */
  memory?: { kind: string; content: string }[];
  /** Recent conversation turns for chat continuity. */
  conversation?: { role: "user" | "assistant"; content: string }[];
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
