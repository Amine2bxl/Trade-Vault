/**
 * L'ORCHESTRATION DE JARVIS — Question → intention → données → calcul → réponse vérifiée.
 *
 * C'est le chemin unique d'une question posée à Jarvis (`backend/coach.functions.ts`).
 * Il n'ajoute aucune seconde architecture : il enchaîne les briques existantes
 * dans l'ordre où un analyste travaillerait.
 *
 *   1. COMPRENDRE  — `router/route.ts` : domaines, niveau, période, symboles.
 *                    Un petit modèle n'est consulté QUE si la question est
 *                    ambiguë (`runtime/tiers.ts`, emplacement « router »).
 *   2. CHOISIR     — `context-engine.ts` : les blocs utiles, les lectures à
 *                    préparer, les outils à offrir, la profondeur d'historique.
 *   3. LIRE        — les lectures préparées partent EN PARALLÈLE, sous
 *                    l'identité ET le compte actif de la requête : le modèle
 *                    n'a plus à deviner ce que TradeVault sait déjà.
 *   4. RAISONNER   — `runCoach` avec le modèle du NIVEAU (rapide, équilibré,
 *                    puissant, profond) et, au besoin, ses outils natifs.
 *   5. VÉRIFIER    — `validation.ts` : chaque chiffre de la réponse doit se
 *                    retrouver dans les données reçues ; sinon UNE réparation,
 *                    puis, s'il reste un doute, une mention honnête.
 *   6. MESURER     — une trace sans contenu (domaines, niveau, outils, tokens,
 *                    coût estimé, validation) pour `ai_agent_runs`.
 *
 * Jamais de chaîne de pensée exposée ou journalisée : la trace ne contient que
 * des métadonnées.
 */
import type { AIProvider } from "@/modules/ai-provider";
import { checkCausalLanguage } from "@/modules/patterns/language";
import { generate, type UsageEvent } from "../provider-service";
import { tryParseJson } from "../response-formatter";
import {
  ambiguityPrompt,
  isJournalDomain,
  mergeModelRoute,
  routeQuestion,
  type QuestionRoute,
} from "../router/route";
import {
  executePrefetch,
  pickSignals,
  planContext,
  prefetchBlocks,
  type ContextPlan,
  type PrefetchResult,
} from "../context-engine";
import {
  SLOT_POLICY,
  TIER_SLOT,
  modelRoutingEnabled,
  slotChain,
  type ModelSlot,
} from "../runtime/tiers";
import { estimateCostUsd } from "../runtime/pricing";
import { repairInstruction, unverifiedNotice, validateAnswer } from "../validation";
import type { ToolResult } from "../tools/types";
import { buildCoachMessages, runCoach, type CoachInput } from "./coach.agent";

/** La trace d'une question — UNIQUEMENT des métadonnées, jamais de contenu. */
export interface JarvisTrace {
  domains: string[];
  tier: number;
  slot: ModelSlot;
  ambiguous: boolean;
  modelRouted: boolean;
  /** Étiquettes du routeur (lexique reconnu) — pas le texte de la question. */
  signals: string[];
  /** Fournisseur et modèle qui ont servi la réponse finale. */
  provider: string;
  model: string;
  /** Appels modèle (routage, boucle d'outils, réparation). */
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedInputTokens: number;
  /** Coût estimé en $, `null` si un modèle utilisé a un prix inconnu. */
  costUsd: number | null;
  /** Outils exécutés par la boucle (nom, succès, durée). */
  tools: { name: string; ok: boolean; ms: number }[];
  /** Lectures préparées (outil, succès, durée). */
  prefetch: { tool: string; ok: boolean; ms: number }[];
  /** Blocs client gardés / offerts. */
  blocksKept: string[];
  /** Taille du contexte envoyé au premier appel, en caractères. */
  contextChars: number;
  validation: "ok" | "repaired" | "flagged" | "skipped";
  unsupportedFigures: number;
  causalPhrases: number;
  /** Durée réelle vécue par le trader, de la question à la réponse. */
  totalMs: number;
}

export interface OrchestrateOptions {
  /** L'utilisateur authentifié — sans lui, aucune lecture serveur. */
  userId?: string;
  /** Le compte que le trader regarde : toutes les lectures y sont cloisonnées. */
  accountId?: string | null;
  /** Les outils OFFRABLES au modèle (vide = pas de boucle d'outils, ex. `AI_TOOLS=off`). */
  modelTools: readonly string[];
  /** Les lectures préparées sont-elles possibles (outils enregistrés côté serveur) ? */
  prefetch: boolean;
  /** Fournisseurs injectés (tests) : remplacent toutes les chaînes de niveau. */
  providers?: AIProvider[];
  /** Validation + réparation des chiffres (défaut : actives). */
  validate?: boolean;
}

export interface OrchestrateResult {
  text: string;
  trace: JarvisTrace;
}

/** Ne garde du contexte client que ce que le plan retient. */
export function selectInputForPlan(input: CoachInput, plan: ContextPlan): CoachInput {
  const keep = new Set(plan.blocks);
  return {
    question: input.question,
    language: input.language,
    currency: input.currency,
    today: input.today,
    ...(keep.has("stats") && input.stats ? { stats: input.stats } : {}),
    ...(keep.has("trades") && input.trades ? { trades: input.trades } : {}),
    ...(keep.has("mistakes") && input.mistakes ? { mistakes: input.mistakes } : {}),
    ...(keep.has("signals") ? { signals: pickSignals(input.signals, plan.signalKeys) } : {}),
    ...(keep.has("goals") && input.goals ? { goals: input.goals } : {}),
    ...(keep.has("rules") && input.rules ? { rules: input.rules } : {}),
    ...(keep.has("adherence") && input.adherence ? { adherence: input.adherence } : {}),
    ...(keep.has("edge") && input.edge ? { edge: input.edge } : {}),
    ...(keep.has("intent") && input.intent ? { intent: input.intent } : {}),
    ...(keep.has("reflection") && input.reflection ? { reflection: input.reflection } : {}),
    ...(keep.has("session") && input.session ? { session: input.session } : {}),
    ...(keep.has("memory") && input.memory ? { memory: input.memory } : {}),
    ...(keep.has("profile") && input.profile ? { profile: input.profile } : {}),
    // L'échelle accompagne TOUT montant : elle ne se retire jamais d'une
    // réponse qui cite de l'argent.
    ...(input.calibration ? { calibration: input.calibration } : {}),
    ...(keep.has("simulation") && input.simulation ? { simulation: input.simulation } : {}),
    conversation: (input.conversation ?? []).slice(-plan.conversationTurns),
  };
}

/**
 * Les consignes propres à la question (second message système) : la période
 * résolue, la forme de réponse attendue, les sources non branchées.
 */
export function routeGuidance(route: QuestionRoute, plan: ContextPlan): string {
  const lines: string[] = [];
  const e = route.entities;
  if (e.comparison) {
    lines.push(
      `COMPARISON: ${e.comparison[0].label} (${e.comparison[0].since}..${e.comparison[0].until}) vs ` +
        `${e.comparison[1].label} (${e.comparison[1].since}..${e.comparison[1].until}). Compare the ` +
        `two MEASURED blocks figure by figure.`,
    );
  } else if (e.period) {
    lines.push(
      `PERIOD: "${e.period.label}" = ${e.period.since}..${e.period.until} (trader's local dates). ` +
        `Quote the figures of that period, not all-time ones.`,
    );
  }
  if (e.weekdays.length) lines.push(`WEEKDAY FOCUS: ${e.weekdays.join(", ")} (1 = Monday).`);
  if (e.symbols.length) lines.push(`SYMBOLS MENTIONED: ${e.symbols.join(", ")}.`);
  if (e.sessions.length) lines.push(`SESSIONS MENTIONED: ${e.sessions.join(", ")}.`);
  if (route.tier === 1) {
    lines.push(
      "ANSWER SHAPE: direct and short — the fact or figure first, one or two sentences, no " +
        "headings. Greetings get a greeting.",
    );
  } else {
    lines.push(
      "ANSWER SHAPE (analysis): lead with what the data shows (figures with their n), then why " +
        "it matters (how it compares, how much it weighs), then what it suggests (worded as a " +
        "likely explanation, never as a certainty), and end with ONE concrete action only when " +
        "it follows from the data. Skip any part that has nothing to say. Look for what is " +
        "concentrated, recurring or asymmetric in the data rather than restating totals.",
    );
  }
  lines.push(...plan.notices);
  return lines.join("\n");
}

/** Consulter un petit modèle pour une question ambiguë — borné, jamais bloquant. */
async function resolveAmbiguity(
  route: QuestionRoute,
  question: string,
  providers: AIProvider[] | undefined,
  onUsage: (e: UsageEvent) => void,
): Promise<{ route: QuestionRoute; used: boolean }> {
  if (!route.ambiguous || !modelRoutingEnabled()) return { route, used: false };
  const chain = providers ?? slotChain("router");
  if (chain.length === 0) return { route, used: false };
  const policy = SLOT_POLICY.router;
  const p = ambiguityPrompt(question);
  try {
    const res = await generate(
      {
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
        json: true,
        maxTokens: policy.maxTokens,
        reasoning: policy.reasoning,
        timeoutMs: policy.timeoutMs,
      },
      { providers: chain, onUsage },
    );
    const parsed = tryParseJson(res);
    if (!parsed.ok) return { route, used: false };
    const merged = mergeModelRoute(route, parsed.value);
    return { route: merged, used: merged !== route };
  } catch {
    return { route, used: false };
  }
}

/** Le corpus de vérification : tout ce que le modèle a reçu, plus la question. */
function evidenceCorpus(
  input: CoachInput,
  prefetched: string,
  toolOutputs: readonly ToolResult[],
): string {
  const messages = buildCoachMessages(input, { prefetched });
  return [
    ...messages.filter((m) => m.role !== "system").map((m) => m.content),
    ...toolOutputs.map((r) => JSON.stringify(r.output ?? r.error ?? null)),
    input.question,
  ].join("\n");
}

export async function orchestrateCoach(
  input: CoachInput,
  opts: OrchestrateOptions,
): Promise<OrchestrateResult> {
  const started = Date.now();
  const usage: UsageEvent[] = [];
  const onUsage = (e: UsageEvent) => {
    usage.push(e);
  };

  // 1. COMPRENDRE
  let route = routeQuestion(input.question, { today: input.today });
  const ambiguity = await resolveAmbiguity(route, input.question, opts.providers, onUsage);
  route = ambiguity.route;

  // 2. CHOISIR
  const plan = planContext(route, { hasEdgeBlock: !!input.edge && input.edge.score !== null });
  const selected = selectInputForPlan(input, plan);

  // 3. LIRE — en parallèle, sous l'identité et le compte de la requête.
  const toolContext = opts.userId
    ? { userId: opts.userId, accountId: opts.accountId ?? null }
    : undefined;
  const prefetchResults: PrefetchResult[] =
    toolContext && opts.prefetch && plan.prefetch.length
      ? await executePrefetch(plan.prefetch, toolContext)
      : [];
  const prefetched = prefetchBlocks(prefetchResults);

  // 4. RAISONNER — le modèle du niveau, et seulement les outils utiles.
  const slot = TIER_SLOT[route.tier];
  const policy = SLOT_POLICY[slot];
  const providers = opts.providers ?? slotChain(slot);
  const offered = new Set(opts.modelTools);
  const tools = toolContext ? plan.tools.filter((t) => offered.has(t)) : [];
  const toolResults: { result: ToolResult; ms: number }[] = [];
  const guidance = routeGuidance(route, plan);
  const contextChars = buildCoachMessages(selected, {
    prefetched,
    guidance,
    tools: tools.length > 0,
  }).reduce((n, m) => n + m.content.length, 0);

  const res = await runCoach(selected, {
    providers,
    tools,
    toolContext,
    maxToolIterations: policy.maxToolIterations,
    maxTokens: policy.maxTokens,
    reasoning: policy.reasoning,
    timeoutMs: policy.timeoutMs,
    prefetched,
    guidance,
    onUsage,
    onToolResult: (result, ms) => toolResults.push({ result, ms }),
  });
  let text = res.text.trim();
  let provider = res.provider;
  let model = res.model;

  // 5. VÉRIFIER
  let validation: JarvisTrace["validation"] = "skipped";
  let unsupportedFigures = 0;
  // Seules les réponses sur les DONNÉES du trader se vérifient : une
  // salutation, une définition ou une question produit n'affirment rien sur
  // son journal.
  const aboutData = route.domains.some(isJournalDomain);
  if (text && opts.validate !== false && aboutData) {
    const corpus = evidenceCorpus(
      selected,
      prefetched,
      toolResults.map((t) => t.result),
    );
    const first = validateAnswer(text, corpus);
    unsupportedFigures = first.unsupported.length;
    validation = first.ok ? "ok" : "flagged";
    if (!first.ok) {
      // UNE réparation : le brouillon, la liste des chiffres sans appui, les
      // mêmes données (sorties d'outils comprises) — sans outils, au même niveau.
      const toolBlock = toolResults
        .filter((t) => !t.result.error)
        .map((t) => `MEASURED — tool ${t.result.name}:\n${JSON.stringify(t.result.output)}`)
        .join("\n\n");
      try {
        const messages = buildCoachMessages(selected, {
          prefetched: [prefetched, toolBlock].filter(Boolean).join("\n\n"),
          guidance,
        });
        messages.push(
          { role: "assistant", content: text },
          { role: "user", content: repairInstruction(first.unsupported, input.language) },
        );
        const repaired = await generate(
          {
            messages,
            maxTokens: policy.maxTokens,
            reasoning: policy.reasoning,
            timeoutMs: policy.timeoutMs,
          },
          { providers, onUsage },
        );
        const fixed = repaired.text?.trim();
        if (fixed) {
          const second = validateAnswer(fixed, corpus);
          if (second.unsupported.length < first.unsupported.length) {
            text = fixed;
            provider = repaired.provider;
            model = repaired.model;
            unsupportedFigures = second.unsupported.length;
            validation = second.ok ? "repaired" : "flagged";
          }
        }
      } catch {
        /* la réparation est un bonus : la mention honnête suit */
      }
      if (validation === "flagged") text = `${text}\n\n${unverifiedNotice(input.language)}`;
    }
  }

  // 6. MESURER
  const ok = usage.filter((u) => u.ok);
  const costs = ok.map((u) => estimateCostUsd(u));
  const trace: JarvisTrace = {
    domains: route.domains,
    tier: route.tier,
    slot,
    ambiguous: route.ambiguous || ambiguity.used,
    modelRouted: ambiguity.used,
    signals: route.signals,
    provider,
    model,
    modelCalls: usage.length,
    inputTokens: ok.reduce((n, u) => n + (u.inputTokens ?? 0), 0),
    outputTokens: ok.reduce((n, u) => n + (u.outputTokens ?? 0), 0),
    thinkingTokens: ok.reduce((n, u) => n + (u.thinkingTokens ?? 0), 0),
    cachedInputTokens: ok.reduce((n, u) => n + (u.cachedInputTokens ?? 0), 0),
    costUsd:
      costs.length && costs.every((c) => c !== null)
        ? costs.reduce<number>((n, c) => n + (c ?? 0), 0)
        : costs.length
          ? null
          : 0,
    tools: toolResults.map((t) => ({ name: t.result.name, ok: !t.result.error, ms: t.ms })),
    prefetch: prefetchResults.map((r) => ({ tool: r.call.tool, ok: r.ok, ms: r.durationMs })),
    blocksKept: plan.blocks,
    contextChars,
    validation,
    unsupportedFigures,
    causalPhrases: checkCausalLanguage(text).ok ? 0 : 1,
    totalMs: Date.now() - started,
  };
  return { text, trace };
}
