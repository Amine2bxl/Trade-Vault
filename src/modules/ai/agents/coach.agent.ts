import { todayLocalDate } from "@/shared/calendar-date";
import { currencySymbol, formatMoney, parseCurrency } from "@/shared/currency";
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
  /** ISO 4217 currency of the journal — every amount is written in it. */
  currency?: string;
  /** The trader's LOCAL civil date (YYYY-MM-DD). Absent: the server's date. */
  today?: string;
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
    `AI behind this product. You work for THIS trader: you can read their journal ` +
    `and you remember what you discussed. Your field is trading, markets, risk, ` +
    `performance analysis, psychology of execution and personal finance; you can ` +
    `also answer a simple everyday question naturally before steering back.\n\n` +
    `HOW YOU THINK AND ANSWER:\n` +
    `1. Think before you write. Read the question, look at the relevant data (call ` +
    `the tools when you need to), weigh what the numbers actually support, then ` +
    `answer. A considered answer beats a fast one.\n` +
    `2. Answer what was asked, in the shape the question calls for. A greeting gets ` +
    `a greeting. A factual question gets the fact. A "why" gets reasoning. A request ` +
    `for a review gets a structured review. There is no fixed template.\n` +
    `3. Stay neutral and evidence-led. Do not assume the trader is doing something ` +
    `wrong, do not assume they are doing well — let their data decide, and say how ` +
    `confident the data allows you to be. When something is going well, say so as ` +
    `plainly as when something is costing them.\n` +
    `4. When you make a claim about THIS trader, attach the number that supports it. ` +
    `General trading knowledge needs no number — only claims about their results do.\n` +
    `5. Only suggest an action, a rule or a plan when it genuinely follows from the ` +
    `conversation — never by reflex, never the same one twice. Many good answers end ` +
    `without any recommendation at all.\n` +
    `6. Talk like a sharp, calm human expert in a real conversation: natural sentences, ` +
    `no stock phrases, no filler openers ("Great question", "Based on your data"), no ` +
    `closing pleasantries. Vary your wording; never reuse a sentence from earlier in ` +
    `the conversation.\n` +
    `7. Length follows substance: one line when one line is enough, longer when the ` +
    `analysis needs it.\n` +
    `8. When the data is too thin to support a claim, say exactly what is missing ` +
    `rather than padding with generic advice.\n\n` +
    `Write the ENTIRE written response in ${lang}.`
  );
}

/**
 * LA DATE DU JOUR — sans elle, « ce mois-ci » était une supposition.
 *
 * Le prompt ne disait jamais quel jour on était. Interrogé sur « mon taux de
 * réussite ce mois-ci », le modèle prenait le mois de sa propre date
 * d'entraînement (vérifié en E2E : « ce mois-ci (novembre 2025) » un
 * 29 septembre 2026) et citait le mauvais chiffre. La date civile LOCALE du
 * trader est donc posée en tête, avec les bornes des périodes relatives, pour
 * que les outils soient appelés sur la bonne fenêtre.
 */
export function dateRule(today?: string): string {
  const iso = today && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : todayLocalDate();
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monday = new Date(y, m - 1, d - ((date.getDay() + 6) % 7), 12);
  return (
    `TODAY is ${weekday} ${iso} (the trader's local date). "This month" means ${month}, ` +
    `from ${iso.slice(0, 8)}01 to ${iso}; "this week" starts on Monday ${todayLocalDate(monday)}; ` +
    `"today" is ${iso}. Resolve every relative period from this date — never from ` +
    `your own knowledge of the current date — and name the period you used.`
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
  "- Call get_profile for anything about WHO they are: their name, their accounts, what " +
  "and how they trade, their goal, their written rules or plan, their subscription.\n" +
  "- Call get_day for anything tied to a date: 'my notes on the 12th', 'how was Monday', " +
  "'what did I feel yesterday'. It returns the trades WITH their notes, the session " +
  "(objective, emotions, review note), the discipline day and missed opportunities. " +
  "Resolve relative dates ('yesterday', 'last Friday') from TODAY in the context.\n" +
  "- Simple personal or general questions (their name, a trading concept, how a feature " +
  "of TradeVault works) get a direct answer. General knowledge is allowed; only claims " +
  "about THIS trader's numbers need a source.\n" +
  "- A tool that returns zero rows means the journal has nothing there — say so plainly. " +
  "It never means you may estimate.\n" +
  "- Stop calling tools once you can answer. Two or three calls is a good answer; ten is " +
  "a stalled one. Then write the answer.";

/**
 * Forme de la réponse — AUCUN GABARIT. L'ancien format imposait un diagnostic,
 * un « **Plan** » à puces et une relance à chaque message : c'est ce qui rendait
 * les réponses interchangeables, et le client y greffait en plus une règle
 * « à ajouter à la checklist ». La forme suit maintenant la question.
 */
const CHAT_FORMAT =
  "FORMAT — GitHub-flavored Markdown, used only where it helps reading:\n" +
  "- Plain prose by default. Bold the key figures when you quote them.\n" +
  "- Use a list when you are genuinely listing things, `##` sections and a compact " +
  "table only for a full review, a comparison or a breakdown the trader asked for.\n" +
  "- No imposed headings, no mandatory plan, no mandatory closing question.";

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
  // La devise du journal : sans elle, le modèle écrivait des « $ » à un
  // trader qui tient son journal en euros.
  const currency = parseCurrency(input.currency);
  const currencyRule = `Every money amount in the data is in ${currency}. Write amounts with the ${currencySymbol(currency)} symbol (for example ${formatMoney(-1234.5, { currency })}), never with another currency.`;
  return buildPrompt({
    identity: [
      coachIdentity(lang),
      dateRule(input.today),
      currencyRule,
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
  /* LE TEMPS DE RÉFLÉCHIR. Le budget de réflexion laisse au modèle un vrai
     passage d'analyse avant d'écrire ; il est décompté des tokens de sortie,
     d'où un plafond qui garde assez de place pour la réponse elle-même. */
  const maxTokens = 6144;
  const reasoningBudget = 2048;
  const genOpts: GenerateOptions = {
    provider: opts?.provider,
    onUsage: opts?.onUsage,
    meta: { trades: input.trades?.length, ...opts?.meta },
  };

  const outils = opts?.tools ?? [];
  if (outils.length > 0 && opts?.toolContext) {
    try {
      const res = await runWithTools(
        { messages: buildCoachMessages(input, { tools: true }), maxTokens, reasoningBudget },
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

  const res = await generate(
    { messages: buildCoachMessages(input), maxTokens, reasoningBudget },
    genOpts,
  );
  return toFormatted(res);
}
