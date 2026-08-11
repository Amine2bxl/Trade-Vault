import type { Trade, TradeStats } from "../types";
import { computeStats, toInsightTradesPayload } from "./tradeCalcs";
import { computeBehaviorSignals } from "./behaviorSignals";
import type { TradingRule } from "./tradingRules";
import { remember } from "@/modules/ai/memory";
import { selectMemories, type MemoryLike } from "@/modules/ai/memory-select";
import { slimSignals } from "./signalContext";
import { loadOnboarding, loadJarvisProfile, type OnboardingData } from "../store";

/**
 * Coach context builder — the glue that turns the coach from a stateless Q&A
 * box into a mentor that KNOWS the trader. It assembles the grounded context
 * the rich `aiChat` server function expects:
 *
 *   recent trades · compact scalar stats · long-term memory (ai_memory) ·
 *   the running conversation · the UI language
 *
 * Memory is best-effort: any DB hiccup degrades gracefully to "no memory"
 * rather than blocking the coach. RLS (owner-only) still applies to every read.
 */

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Instantané scalaire que le coach peut citer — ni tableaux ni maps (schéma + taille).
 *
 * Reçoit les stats DÉJÀ calculées : les recalculer ici en faisait la troisième
 * exécution de `computeStats` pour une seule question, sur le thread principal.
 */
function compactStats(s: TradeStats): Record<string, number | string | null> {
  return {
    totalPnl: round(s.totalPnl),
    winRatePct: round(s.winRate * 100),
    totalTrades: s.totalTrades,
    wins: s.wins,
    losses: s.losses,
    breakEven: s.breakEven,
    avgWin: round(s.avgWin),
    avgLoss: round(s.avgLoss),
    profitFactor: round(s.profitFactor),
    avgRR: round(s.avgRR),
    maxDrawdown: round(s.maxDrawdown),
    currentStreak: s.currentStreak,
    currentStreakType: s.currentStreakType,
  };
}

/**
 * Seed a one-line `profile` memory from the onboarding answers so the coach
 * "knows" the trader from the very first message — deterministic, zero AI cost,
 * idempotent (only writes if no profile memory exists yet). Best-effort.
 */
/** Input shape for the AI Coach V1 server function (`askCoach`). */
export interface CoachV1Payload {
  stats?: Record<string, number | string | null>;
  trades?: ReturnType<typeof toInsightTradesPayload>;
  mistakes?: { name: string; count: number; totalPnl: number }[];
  /** Deterministic behaviour signals — the evidence behind a real diagnosis. */
  signals?: Record<string, unknown>;
  /** The rules the trader wrote for themselves, so the coach can enforce them. */
  rules?: { kind: string; text: string; enabled: boolean }[];
  /**
   * Objectifs actifs et progression MESURÉE. Lus depuis `goal_plans` (source de
   * vérité unique) — jamais mémorisés : un objectif atteint à 40 % hier ne l'est
   * plus aujourd'hui.
   */
  goals?: { kind: string; target: number; current: number }[];
  /**
   * Tenue des règles sur la fenêtre récente. C'est ce qui permet à Jarvis de
   * dire « tu l'as tenue 11 fois sur 12 » au lieu de « tu as violé ta règle » —
   * la différence entre un outil qui gronde et un coach qui accompagne.
   */
  adherence?: { text: string; kept: number; applicable: number; ratePct: number }[];
  conversation?: { role: "user" | "assistant"; content: string }[];
  profile?: string;
  /**
   * Souvenirs SÉLECTIONNÉS pour cette question précise — jamais l'historique
   * complet. Le tri et le budget de tokens sont appliqués par
   * `modules/ai/memory-select`, sous contrainte dure.
   */
  memory?: { kind: string; content: string }[];
  /**
   * Échelle de représentation de l'historique, quand elle a été recalibrée.
   *
   * SANS ce bloc, Jarvis comparerait des montants d'échelles différentes sans
   * le savoir : « ton risque moyen est passé de 250 $ à 500 $, tu sur-risques »
   * alors que le trader a simplement changé de taille de compte et risque
   * toujours 1 %. Le diagnostic serait faux ET accusateur.
   *
   * Les montants transmis sont DÉJÀ à l'échelle courante (la conversion a lieu
   * en amont, dans `useTrades`) : ce bloc sert à l'expliquer, pas à convertir.
   */
  calibration?: { originalBalance: number; currentBalance: number; scale: number };
  /**
   * Résultat de simulation DÉJÀ CALCULÉ par le moteur probabiliste.
   *
   * RÈGLE ABSOLUE : Jarvis LIT ce bloc, il ne simule jamais. Un modèle de
   * langage ne sait pas rééchantillonner 2 000 trajectoires ; s'il produit un
   * pourcentage de sa propre initiative, ce pourcentage est inventé — et il
   * aura l'air aussi assuré qu'un vrai. Le champ `method` et `engineVersion`
   * voyagent avec le chiffre pour que la réponse puisse dire d'où il vient.
   *
   * Absent quand aucune simulation n'a été lancée. Jarvis doit alors répondre
   * qu'il n'en a pas encore, PAS estimer de tête.
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
  };
  language?: string;
}

/**
 * One-line trader profile from the onboarding answers + the Jarvis remembered
 * profile — sent with every coach call so the coaching addresses THIS trader
 * (their name, style, declared weakness, strength, goal and target) instead of
 * sounding generic. Pure, sync, no IO.
 */
export function describeProfile(
  onb: (OnboardingData & { monthlyTarget?: number | null }) | null | undefined,
  jarvis?: {
    firstName?: string | null;
    style?: string | null;
    weakness?: string | null;
    strength?: string | null;
    goal?: string | null;
  } | null,
): string | undefined {
  const parts: string[] = [];
  if (jarvis?.firstName) parts.push(`first name: ${jarvis.firstName}`);
  if (onb?.style || jarvis?.style) parts.push(`style: ${onb?.style || jarvis?.style}`);
  if (onb?.experience) parts.push(`experience: ${onb.experience}`);
  if (onb?.assets?.length) parts.push(`markets: ${onb.assets.slice(0, 5).join(", ")}`);
  if (onb?.usesIct) parts.push("uses ICT concepts");
  if (onb?.goal || jarvis?.goal) parts.push(`goal: ${onb?.goal || jarvis?.goal}`);
  if (onb?.pain || jarvis?.weakness)
    parts.push(`declared weakness to police: ${onb?.pain || jarvis?.weakness}`);
  if (jarvis?.strength) parts.push(`strength to build on: ${jarvis.strength}`);
  if (typeof onb?.monthlyTarget === "number" && onb.monthlyTarget > 0)
    parts.push(`monthly target: ${onb.monthlyTarget}%`);
  if (!parts.length) return undefined;
  return `Trader profile — ${parts.join("; ")}.`;
}

/**
 * Build the grounded payload for AI Coach V1 — stats, trades, recurring
 * mistakes (derived from the same deterministic engine), the running
 * conversation and the language. No long-term memory (V1 scope): synchronous,
 * no DB read, so it never blocks the coach.
 */
/**
 * Garde les signaux sous le plafond serveur (~12 KB, Zod) : un journal riche
 * (beaucoup de symboles/stratégies) dépassait la limite → la requête était
 * rejetée (400) → « une erreur est survenue ». On borne les buckets et on
 * retire en dernier les sections les moins critiques.
 */
/* La sélection des signaux vit dans `signalContext.ts` — module pur, testable
   sans dépendance DB. Voir ce fichier pour la stratégie de conservation. */

export function buildCoachV1Payload(opts: {
  trades: Trade[];
  conversation?: CoachTurn[];
  language?: string;
  maxTurns?: number;
  /** Onboarding answers — makes the coaching personal on every single call. */
  onboarding?: (OnboardingData & { monthlyTarget?: number | null }) | null;
  /** The Jarvis remembered profile (first name, strength, goal…). */
  jarvisProfile?: {
    firstName?: string | null;
    style?: string | null;
    weakness?: string | null;
    strength?: string | null;
    goal?: string | null;
  } | null;
  /** The trader's own rules, so the coach holds them to their own standard. */
  rules?: TradingRule[];
  /** Objectifs déjà mesurés par `useGoalProgress` — recalculés, jamais stockés. */
  goals?: { kind: string; target: number; current: number }[];
  /** Adhérence déjà mesurée par `computeRuleAdherence` — recalculée à chaque fois. */
  adherence?: { text: string; kept: number; applicable: number; ratePct: number }[];
  /**
   * La question posée — nécessaire pour choisir les souvenirs UTILES à
   * celle-ci plutôt que d'envoyer toute la mémoire.
   */
  question?: string;
  /** Souvenirs bruts déjà chargés par l'appelant (lecture Supabase asynchrone). */
  memory?: MemoryLike[];
  /**
   * Signaux comportementaux DÉJÀ calculés par l'appelant. L'appelant les a
   * presque toujours sous la main (memo du workspace) : les recalculer ici
   * doublait un parcours complet des trades à chaque question.
   */
  signals?: ReturnType<typeof computeBehaviorSignals>;
  /**
   * Edge Score déjà calculé (hook `useEdgeScore`).
   *
   * C'est l'indicateur de TÊTE du tableau de bord — le premier chiffre que le
   * trader voit. Jusqu'ici Jarvis l'ignorait : « pourquoi mon Edge Score
   * baisse ? » recevait la réponse d'un coach qui ne savait pas ce qu'est ce
   * score. Il n'est PAS recalculé ici (une seule définition, cf. `useEdgeScore`).
   */
  edge?: { score: number | null; weakest: string | null };
  /**
   * Simulation déjà produite par `modules/probability`. L'appelant la passe
   * telle quelle : rien n'est recalculé ici, et surtout pas par le modèle.
   */
  simulation?: CoachV1Payload["simulation"];
  /** Calibration du compte actif — omise quand l'historique est à son échelle
   *  d'origine, ce qui est le cas de l'immense majorité des comptes. */
  calibration?: { originalBalance: number; currentBalance: number; scale: number } | null;
}): CoachV1Payload {
  const {
    trades,
    conversation = [],
    language,
    maxTurns = 16,
    onboarding,
    jarvisProfile,
    rules,
    goals,
    adherence,
    question,
    memory,
    signals: providedSignals,
    edge,
    calibration,
    simulation,
  } = opts;
  // UNE seule exécution, réutilisée pour les erreurs récurrentes ET l'instantané.
  const stats = trades.length ? computeStats(trades) : null;
  const mistakes = stats
    ? Object.entries(stats.mistakeStats)
        .map(([name, v]) => ({ name, count: v.count, totalPnl: round(v.totalPnl) }))
        .sort((a, b) => a.totalPnl - b.totalPnl)
        .slice(0, 40)
    : [];
  // The behavioural read is what turns "here are your stats" into "here is why
  // you lose on Fridays". Computed deterministically, never by the model.
  const baseSignals = providedSignals ?? computeBehaviorSignals(trades);
  // L'Edge Score rejoint les SIGNAUX : c'est exactement leur nature — une
  // mesure déterministe déjà calculée, que le modèle interprète sans jamais la
  // recalculer. Aucun nouveau canal, aucun nouveau contrat.
  const signals = edge && edge.score !== null ? { ...baseSignals, edgeScore: edge } : baseSignals;
  return {
    // Les 25 derniers trades suffisent pour les exemples du coach (les stats et
    // signaux portent la vue d'ensemble). Un payload plus léger = l'IA répond
    // plus vite et reste sous les limites de temps (serverless Vercel ~10s).
    trades: toInsightTradesPayload(trades.slice(-25)),
    stats: stats ? compactStats(stats) : undefined,
    // Mémoire : on n'envoie QUE les souvenirs utiles à cette question, sous
    // budget de tokens strict. Envoyer l'historique complet noierait le modèle
    // et ferait exploser la latence sans rien améliorer.
    memory:
      memory?.length && question
        ? selectMemories(memory, question).selected.map((m) => ({
            kind: m.kind,
            content: m.content,
          }))
        : undefined,
    mistakes: mistakes.length ? mistakes : undefined,
    goals: goals?.length ? goals.slice(0, 10) : undefined,
    // 5 règles suffisent : au-delà, le coach dilue son message au lieu de
    // pointer celle qui coûte le plus.
    adherence: adherence?.length ? adherence.slice(0, 5) : undefined,
    signals: Object.keys(signals).length ? slimSignals(signals) : undefined,
    rules: rules?.length
      ? rules
          .slice(0, 30)
          .map((r) => ({ kind: r.kind, text: r.text.slice(0, 300), enabled: r.enabled }))
      : undefined,
    conversation: conversation
      .slice(-maxTurns)
      .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 8000) })),
    profile: describeProfile(onboarding, jarvisProfile),
    // Omise quand l'échelle est d'origine : ne pas encombrer le prompt d'un
    // bloc qui, dans ce cas, ne dit rien.
    calibration: calibration && calibration.scale !== 1 ? calibration : undefined,
    // Omise quand aucune simulation n'existe : mieux vaut que Jarvis dise
    // « je n'ai pas encore de simulation là-dessus » que d'avoir un bloc vide
    // à interpréter, ce qu'un modèle comble volontiers tout seul.
    simulation,
    language,
  };
}

export async function seedProfileMemory(userId: string): Promise<void> {
  try {
    // Plus de garde « écrire une seule fois » : elle figeait le profil à vie.
    // Si le trader corrige sa faiblesse déclarée ou sa cible mensuelle, le
    // souvenir doit suivre. L'upsert par clé rend l'opération idempotente —
    // réécrire le même contenu ne crée pas de doublon.
    const [onb, jarvis] = await Promise.all([
      loadOnboarding(userId).catch(() => null),
      loadJarvisProfile(userId).catch(() => null),
    ]);
    const parts: string[] = [];
    if (jarvis?.firstName) parts.push(`first name: ${jarvis.firstName}`);
    if (onb?.style || jarvis?.style) parts.push(`style: ${onb?.style || jarvis?.style}`);
    if (onb?.pain || jarvis?.weakness)
      parts.push(`main weakness to watch: ${onb?.pain || jarvis?.weakness}`);
    if (jarvis?.strength) parts.push(`strength to build on: ${jarvis.strength}`);
    if (typeof onb?.monthlyTarget === "number") parts.push(`monthly target: ${onb.monthlyTarget}%`);
    if (onb?.experience) parts.push(`experience: ${onb.experience}`);
    if (onb?.usesIct) parts.push("uses ICT concepts");
    if (!parts.length) return;

    await remember(userId, "profile", `Trader profile — ${parts.join("; ")}.`, {
      // Clé stable : il n'existe qu'UN profil par trader, par construction.
      key: "trader_profile",
      // Importance maximale : c'est l'identité, elle cadre toute réponse.
      importance: 5,
      // Confiance élevée mais pas totale — le trader s'est décrit lui-même,
      // et une auto-description peut être optimiste.
      confidence: 0.9,
      source: "onboarding",
    });
  } catch {
    // Best-effort: seeding must never surface an error to the user.
  }
}
