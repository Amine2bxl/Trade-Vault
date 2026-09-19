/**
 * AI Coach — agent V1.
 *
 * The first usable TradeVault agent: answers the trader's questions using ONLY
 * their real data (stats, trades, recurring mistakes, goals). It interprets the
 * deterministic numbers the engines already computed — it never invents them.
 *
 * Scope of V1 (intentionally minimal):
 *   - read stats · read trades · read mistakes · read goals · answer questions
 *   - NO long-term memory (ai_memory is not read or written here)
 *   - NO proactivity (no jobs, no notifications)
 *   - NO secondary agents
 *
 * Built entirely on the platform infra (context builder → prompt builder →
 * provider service → response formatter). Pure logic: the provider is resolved
 * (or injected via opts), so this is unit-testable without network.
 */
import { generate, runWithTools, type GenerateOptions } from "../provider-service";
import type { ToolContext } from "../tools/types";
import { buildPrompt, type ConversationTurn } from "../prompt-builder";
import { createContextBuilder } from "../context-builder";
import { toFormatted, type FormattedResponse } from "../response-formatter";
import { languageName, type AIUserContext, type AITradeSummary } from "../context";

export interface CoachInput {
  /** The trader's question. */
  question: string;
  /** ISO 639-1 UI language — the answer is written in this language. */
  language?: string;
  /** Precomputed stats snapshot (deterministic, from the engines). */
  stats?: Record<string, number | string | null>;
  /** Compact recent trades. */
  trades?: AITradeSummary[];
  /** Recurring mistakes with frequency and net cost. */
  mistakes?: { name: string; count: number; totalPnl: number }[];
  /**
   * Precomputed behaviour signals — weekday/session edge, size drift after a
   * loss, cost of over-trading, whether the trader's own grading predicts the
   * outcome. This is what lets the coach diagnose instead of summarize.
   */
  signals?: Record<string, unknown>;
  /** Active goals and progress. */
  goals?: { kind: string; target: number; current: number }[];
  /** The trader's own written rules — the standard they asked to be held to. */
  rules?: { kind: string; text: string; enabled: boolean }[];
  /**
   * Intentions capturées AVANT les trades récents (snapshot à l'entrée).
   * C'est ce qui permet de répondre « qu'est-ce que je pensais avant ce
   * trade ? » et de comparer intention → exécution → résultat.
   */
  intent?: AIUserContext["intent"];
  /** Réflexions capturées APRÈS les trades récents (plan respecté, raison). */
  reflection?: AIUserContext["reflection"];
  /** Edge Score déjà calculé. Cite-le, ne le recalcule jamais. */
  edge?: AIUserContext["edge"];
  /** Session de trading courante. */
  session?: AIUserContext["session"];
  /**
   * Tenue mesurée de ces règles sur la période récente. Sans elle, le coach ne
   * peut que rappeler la règle ; avec elle, il peut mesurer le progrès — c'est
   * la différence entre gronder et accompagner.
   */
  adherence?: { text: string; kept: number; applicable: number; ratePct: number }[];
  /**
   * Who this trader is, from their onboarding (style, market, experience,
   * declared weakness, goal, target). Injected on EVERY call so the coaching
   * is never generic — the coach opens already knowing them.
   */
  profile?: string;
  /** Recent conversation turns (in-request only — NOT persisted). */
  conversation?: ConversationTurn[];
  /**
   * Souvenirs persistants SÉLECTIONNÉS pour cette question (table `ai_memory`).
   * C'est ce qui fait la différence entre un assistant qui redécouvre le trader
   * à chaque session et un coach qui se souvient de ce qu'il lui a dit.
   */
  memory?: { kind: string; content: string }[];
  /**
   * Résultat DÉJÀ CALCULÉ par le moteur probabiliste (`modules/probability`).
   *
   * Le coach le LIT et l'explique. Il ne simule jamais : un modèle de langage
   * ne rééchantillonne pas 2 000 trajectoires, et un pourcentage qu'il produit
   * de lui-même est inventé — avec l'aplomb d'un vrai. Absent quand aucune
   * simulation n'a tourné : la consigne est alors de le DIRE.
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
}

/**
 * Persona — Jarvis, TradeVault's single AI. One identity, one personality
 * across every surface (the coaching page, the floating panel, the pre-market
 * checklist). Jarvis KNOWS this trader and grounds every claim in their data.
 */
export function coachIdentity(lang: string): string {
  return (
    `You are Jarvis, TradeVault's trading performance intelligence — the single ` +
    `AI behind everything in this product. You are THIS trader's personal coach: ` +
    `you have read every trade they logged and you remember what you told them. ` +
    `Personality: intelligent, calm, professional, quietly charismatic, ` +
    `brutally honest and demanding. A high-performance mentor — never customer ` +
    `support, never a cheerleader, never a generic assistant.\n\n` +
    `HOW YOU ANSWER — this is what separates you from a chatbot:\n` +
    `1. Open with the diagnosis, not with a preamble. First sentence names the ` +
    `specific pattern you found in THEIR data, with the number attached. Never ` +
    `open with "Great question", "Let's dive in", "Based on your data" or any ` +
    `restatement of the question.\n` +
    `2. Every claim carries a number from the blocks below (a win rate, a P&L, ` +
    `a count, a drift %). A sentence without a number is a sentence you delete.\n` +
    `3. Then give the fix: 1 to 3 actions, each concrete enough to execute ` +
    `tomorrow morning and measurable enough to check next week ("fixed size, ` +
    `max 2 trades, stop after 1 loss" — not "manage risk better").\n` +
    `4. Say the uncomfortable thing. If the data shows they are the problem, ` +
    `say so plainly and show the cost in money.\n` +
    `5. If a trader profile, goals or personal rules are provided, tie the ` +
    `advice to THEM by name: their declared weakness, their stated goal, the ` +
    `rule they wrote themselves. Advice that would fit any trader is a failure.\n` +
    `6. Short. A strong answer is 80-160 words. No filler, no recap of what ` +
    `you are about to say, no closing pleasantries.\n` +
    `7. When the data is too thin to support a claim, say exactly what is ` +
    `missing and what to log — never pad with generic trading advice.\n` +
    `8. When a recurring mistake has an obvious fix, close by proposing ONE ` +
    `concrete rule the trader could adopt in a single click — phrased as a ` +
    `commitment ("Fixed size, max 2 trades, stop after 1 loss"), never as a ` +
    `philosophy essay. Make it measurable and enforceable, not aspirational.\n` +
    `9. Vary your shape. Never open two consecutive answers the same way. ` +
    `Alternate a number-first diagnosis, a blunt verdict, a direct question. ` +
    `Predictable, interchangeable answers are your one unforgivable sin.\n\n` +
    `Write the ENTIRE written response in ${lang}.`
  );
}

/** The non-negotiable "never invent" contract. */
export const ANTI_HALLUCINATION =
  "STRICT DATA RULE: your only sources are the RECENT TRADES, RECURRING MISTAKES, " +
  "BEHAVIOUR SIGNALS, ACTIVE GOALS, THE TRADER'S OWN RULES, RULE ADHERENCE, " +
  "TRADE INTENT & REFLECTION, EDGE SCORE, CURRENT SESSION and PRECOMPUTED STATS " +
  "blocks below. Those numbers are computed by a deterministic engine — trust " +
  "them and quote them, never recompute or round them into something else. Never " +
  "invent or estimate a number, name or date that is not present there. If the " +
  "data needed to answer is missing or too thin, say so explicitly instead of " +
  "guessing. You analyze the trader's past data only — you never predict the " +
  "market or give financial advice.\n" +
  "OBSERVATION RULE: an intent or reflection covers ONE trade. A single " +
  'instance is an observation, NEVER a pattern. Only generalize ("you did this ' +
  'on N of your last M trades") when the sample in the data supports it; ' +
  "otherwise describe the single trade and say there is not enough data yet.\n" +
  "SIMULATION RULE: probabilities (chance of passing, risk of ruin, where the " +
  "P&L could land) come ONLY from the SIMULATION block. You never run, " +
  "approximate or reason your way to one. If the trader asks a what-if and no " +
  "SIMULATION block is present, answer that you have no simulation for that " +
  "yet and point them to the Simulator — do not produce a number. When you do " +
  "quote one, call it a simulated probability based on their own history, " +
  "never a prediction, and mention the sample size when it is thin.";

/**
 * LE PROTOCOLE D'OUTILS — ajouté au prompt SEULEMENT quand des outils sont
 * réellement branchés.
 *
 * Il est séparé de `ANTI_HALLUCINATION` pour une raison précise : ce dernier
 * affirme que les blocs de contexte sont les SEULES sources autorisées. Avec des
 * outils, ce n'est plus vrai — et laisser les deux consignes se contredire est
 * la manière la plus fiable de rendre un modèle timide, qui n'ose plus appeler
 * l'outil et répond « je n'ai pas cette donnée » alors qu'il pouvait l'obtenir.
 * Un prompt qui se contredit produit un assistant qui se dérobe.
 *
 * LA RÈGLE DE FOND NE BOUGE PAS. La sortie d'un outil est une donnée mesurée,
 * au même titre qu'un bloc de contexte : elle se cite, elle ne s'extrapole pas.
 * Ce qui reste interdit — inventer un chiffre, en estimer un de tête, prédire le
 * marché — l'est exactement autant avec outils que sans.
 */
export const TOOL_PROTOCOL =
  "TOOLS — you can read this trader's journal yourself. The context blocks below are a " +
  "STARTING SUMMARY, not the limit of what you know: when a question needs a number, a " +
  "period, a symbol or a mistake they do not cover, CALL THE TOOL instead of saying you " +
  "lack the data. A tool result is measured data and counts as a source, under the same " +
  "rule as the blocks: quote it, never extrapolate from it.\n" +
  "- Call get_stats before quoting any performance number you are unsure of, and twice " +
  "with different windows when the question compares periods.\n" +
  "- Call get_trades for anything about specific trades, a symbol or a date range.\n" +
  "- Call get_mistakes when the question is behavioural, and read the `weekly` series " +
  "before judging: a mistake whose series is falling is PROGRESS, and saying so is the " +
  "whole point of tracking it.\n" +
  "- Call get_edge_score rather than reasoning about their edge.\n" +
  "- Call search_memory when they refer to something said earlier or to a commitment.\n" +
  "- A tool that returns zero rows means the journal has nothing there — say so plainly. " +
  "It never means you may estimate.\n" +
  "- Stop calling tools once you can answer. Two or three calls is a good answer; ten is " +
  "a stalled one. Then write the answer in the format below.";

/**
 * Answer shape. Deliberately conversational: the previous format forced a
 * six-heading report onto every message, which is precisely what made short
 * questions get long, interchangeable answers. A coach replies like a coach —
 * a diagnosis, a plan, a push — and only writes a full report when asked for
 * one.
 */
const CHAT_FORMAT =
  "FORMAT — GitHub-flavored Markdown, and keep it conversational:\n" +
  "- 1 to 3 sentences of diagnosis first, with the numbers inline in **bold**. " +
  "No heading above them.\n" +
  "- Then a short plan under a single bold line (e.g. **Plan**): 1-3 bullets, " +
  "each one concrete and measurable.\n" +
  "- Optionally close with ONE short question that moves the trader forward " +
  "(something you would actually need to know, or a commitment to make).\n" +
  "- No tables, no emoji headings, no multi-section report — UNLESS the trader " +
  "explicitly asks for a full review, a monthly report or a complete breakdown. " +
  "In that case use clear `##` sections and a compact table.\n" +
  "- Never repeat the same opening sentence twice in one conversation.";

export interface BuildOptions {
  /** Le prompt doit-il porter le protocole d'outils ? `true` uniquement quand des
   *  outils sont effectivement remis au modèle — décrire des outils absents le
   *  pousserait à annoncer des lectures qu'il ne fera jamais. */
  tools?: boolean;
}

/** Assemble the grounded prompt from the trader's real data. Pure & testable. */
export function buildCoachMessages(input: CoachInput, opts: BuildOptions = {}) {
  const builder = createContextBuilder().withLanguage(input.language);
  if (input.stats) builder.withStats(input.stats);
  if (input.trades) builder.withTrades(input.trades);
  if (input.mistakes) builder.withMistakes(input.mistakes);
  if (input.signals) builder.withSignals(input.signals);
  if (input.goals) builder.withGoals(input.goals);
  if (input.rules) builder.withRules(input.rules);
  if (input.adherence?.length) builder.withAdherence(input.adherence);
  if (input.edge) builder.withEdge(input.edge);
  if (input.intent?.length) builder.withIntent(input.intent);
  if (input.reflection?.length) builder.withReflection(input.reflection);
  if (input.session) builder.withSession(input.session);
  // Le profil déclaré ET les souvenirs sélectionnés partagent le même bloc
  // « faits que tu connais déjà » : même sémantique, aucun tuyau supplémentaire.
  // Le profil vient EN PREMIER — c'est l'identité, elle cadre tout le reste.
  const memoryBlock = [
    ...(input.profile ? [{ kind: "profile", content: input.profile }] : []),
    ...(input.memory ?? []),
  ];
  if (memoryBlock.length) builder.withMemory(memoryBlock);

  const lang = languageName(input.language);
  return buildPrompt({
    identity: [
      coachIdentity(lang),
      ANTI_HALLUCINATION,
      ...(opts.tools ? [TOOL_PROTOCOL] : []),
    ].join("\n\n"),
    outputFormat: CHAT_FORMAT,
    contextBlocks: builder.blocks(),
    conversation: input.conversation,
    userTurn: `Question: ${input.question}`,
  });
}

export interface CoachRunOptions extends GenerateOptions {
  /**
   * Les outils que le modèle peut appeler, par nom. Vide ou absent = l'ancien
   * comportement, mot pour mot : un seul appel, sur le contexte poussé par le
   * client. C'est ce qui permet de brancher le tool-calling sans toucher aux
   * autres appelants du coach (brief, revue hebdo, checklist).
   */
  tools?: readonly string[];
  /** L'identité pour laquelle les outils s'exécutent. Requise avec `tools`. */
  toolContext?: ToolContext;
  /** Tours de dialogue modèle↔outils avant de forcer une réponse (défaut : 4). */
  maxToolIterations?: number;
}

/**
 * Run the coach end-to-end and return a normalized answer.
 *
 * ── DEUX CHEMINS, UNE SEULE RÉPONSE ────────────────────────────────────────
 * Avec outils, le modèle interroge le journal lui-même (`runWithTools`). Sans,
 * il lit le contexte que le client a poussé. Le second n'est pas un vestige :
 * c'est le chemin servi quand aucune provider ne sait appeler d'outils, et il
 * doit rester capable de répondre seul.
 *
 * ── POURQUOI LE REPLI EST ICI, ET PAS PLUS HAUT ────────────────────────────
 * `runWithTools` impose une provider capable d'outils et, ce faisant, PERD la
 * chaîne de secours multi-clés (une provider explicite désactive le cascading
 * de `routeCompletion`). Une panne de cette seule provider rendrait donc le
 * trader à la réponse déterministe, alors qu'une autre clé configurée pouvait
 * répondre. On retombe ici sur l'appel simple, qui a toute la chaîne — un appel
 * supplémentaire dans un cas rare, contre une vraie réponse au lieu d'un repli.
 */
export async function runCoach(
  input: CoachInput,
  opts?: CoachRunOptions,
): Promise<FormattedResponse> {
  // Coaching answers are short by design; the ceiling only has to leave room
  // for the occasional explicit "full review" request.
  const maxTokens = 2048;
  const genOpts: GenerateOptions = {
    provider: opts?.provider,
    onUsage: opts?.onUsage,
    meta: { trades: input.trades?.length, ...opts?.meta },
  };

  const outils = opts?.tools ?? [];
  if (outils.length > 0 && opts?.toolContext) {
    try {
      const res = await runWithTools(
        { messages: buildCoachMessages(input, { tools: true }), maxTokens },
        {
          ...genOpts,
          tools: outils,
          toolContext: opts.toolContext,
          maxIterations: opts.maxToolIterations,
          /* LECTURE SEULE, explicitement. C'est déjà le défaut du runtime, et
             tous les outils branchés déclarent `sideEffect: false` — mais un
             outil d'écriture ajouté un jour ne doit pas devenir appelable par
             le simple fait d'avoir été enregistré. */
          allowSideEffects: false,
        },
      );
      return toFormatted(res);
    } catch (err) {
      console.warn("[coach] tool loop unavailable — plain completion served", err);
    }
  }

  const res = await generate({ messages: buildCoachMessages(input), maxTokens }, genOpts);
  return toFormatted(res);
}
