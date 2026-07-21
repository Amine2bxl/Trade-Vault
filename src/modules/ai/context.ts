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
  /** The trader's own written rules. */
  rules?: { kind: string; text: string; enabled: boolean }[];
  /** Deterministic behavioral findings (significant only), one line each. */
  behavior?: string[];
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
  if (ctx.behavior?.length) {
    blocks.push(
      `BEHAVIORAL PATTERNS (deterministic, statistically significant — trust these numbers):\n${ctx.behavior
        .map((line) => `- ${line}`)
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
  if (ctx.trades?.length) {
    blocks.push(
      `RECENT TRADES (${ctx.trades.length}, JSON):\n${JSON.stringify(ctx.trades, null, 1)}`,
    );
  } else if (ctx.trades) {
    blocks.push("The user has no trades logged yet.");
  }
  return blocks.join("\n\n");
}
