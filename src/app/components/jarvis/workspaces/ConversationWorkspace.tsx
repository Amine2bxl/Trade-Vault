import { getCurrency } from "@/shared/currency";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Eraser, RotateCcw, Square, Volume2, Zap } from "lucide-react";
import { JarvisMark, JarvisOrb, type JarvisOrbState } from "@/shared/ui";
import Composer from "../Composer";
import TypedAnswer from "../TypedAnswer";
import { setJarvisActivity } from "../activity";
import { useJarvisVoice } from "../../../utils/jarvisVoice";
import { askCoach } from "@/backend/coach.functions";
import { extractMemory } from "@/backend/memory.functions";
import { buildCoachV1Payload, seedProfileMemory } from "../../../utils/aiContext";
import { useAccounts } from "../../../contexts/AccountContext";
import { loadScenarios } from "../../../store/simulations";
import { buildDataset } from "@/modules/probability/dataset";
import { ENGINE_VERSION, runSimulation, type SimulationConfig } from "@/modules/probability/engine";
import type { SimDataset } from "@/modules/probability/dataset";
import { detectWhatIf } from "@/modules/probability/intent";
import { applyLever } from "@/modules/probability/sensitivity";
import type { CoachV1Payload } from "../../../utils/aiContext";
import { isCalibrated } from "../../../utils/accountCalibration";
import { loadMemory, remember, type MemoryEntry } from "@/modules/ai/memory";
import { useTradingRules } from "../../../hooks/useTradingRules";
import { useGoalProgress } from "../../../hooks/useGoalProgress";
import { computeRuleAdherence } from "../../../utils/ruleAdherence";
import { loadTradingRules, saveTradingRules } from "../../../utils/tradingRules";
import { computeBehaviorSignals } from "../../../utils/behaviorSignals";
import { computeStats } from "../../../utils/tradeCalcs";
import { useSubscription } from "../../../hooks/useSubscription";
import { useEdgeScore } from "../../../hooks/useEdgeScore";
import { EDGE_WINDOW_DAYS } from "../../../utils/edgeScore";
import { loadTodaySession } from "../../../store";
import {
  loadTradeIntents,
  loadTradeReflections,
  type TradeIntent,
  type TradeReflection,
} from "../../../store/tradeIntel";
import { buildSuggestions } from "../insights/suggestions";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { loadOnboarding, type OnboardingData } from "../../../store";
import { exceedsDailyLimit, incrementAiUsage, jarvisDailyLimit } from "../../../utils/aiUsage";
import { effectiveCopyLang, readAutoSpeak } from "../prefs";
import { jarvisConversationStore } from "../conversations";
import { INTENT_STEPS, classifyQuestion } from "../intent";
import type { TKey } from "../../../i18n/translations";
import {
  listenJarvisThread,
  pendingQuestion,
  startJarvisRequest,
  type JarvisResult,
} from "../pending";
import { BlockList } from "../BlockRenderer";
import { historyTextOf } from "../history";
import type { JarvisMessage, JarvisToolBlock } from "../blocks";
import type { JarvisWorkspaceProps } from "../workspaces";
import { todayLocalDate } from "@/shared/calendar-date";

/**
 * ConversationWorkspace — le module CHAT de Jarvis (multi-conversations).
 *
 * Jarvis est une plateforme ; le chat n'est qu'UN workspace parmi d'autres.
 * Chaque conversation est identifiée par `context.conversationId` et persistée
 * via le ConversationStore. Aucun contenu IA n'est rendu directement — tout
 * passe par `BlockList`.
 */

// Minimal typing for the Web Speech API — not in lib.dom.d.ts.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Texte affichable d'un message (bulle utilisateur). */
function textOf(m: JarvisMessage): string {
  const md = m.blocks.find((b) => b.type === "markdown");
  return md && md.type === "markdown" ? md.content : "";
}

/** Le texte d'une réponse tel qu'il se DIT : sans Markdown, borné à la limite
 *  de la voix (600 caractères). Une voix qui lit « astérisque astérisque » ou
 *  des barres de tableau ne se lit plus comme un agent. */
function spokenOf(m: JarvisMessage): string {
  return textOf(m)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\|[^\n]*\|/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/** 4xx (quota, validation, auth) → non rétentable ; 5xx/réseau → rétentable. */
/**
 * Ce que le serveur a VRAIMENT répondu. Tout finissait en « Something went
 * wrong » : un quota atteint, une session expirée et une panne réseau se
 * lisaient pareil, et le trader ne savait pas s'il devait attendre, se
 * reconnecter ou passer Pro.
 */
type CoachErrorKind = "quota" | "pro" | "rate" | "auth" | "network" | "busy" | "outage";

/**
 * Le serveur a répondu, mais SANS l'IA (fournisseur saturé ou en panne).
 * C'était servi comme une réponse, coiffée d'un bandeau « analyse hors
 * ligne » : le trader croyait lire une analyse. C'est une erreur, dite comme
 * telle, avec « Réessayer ».
 */
class CoachUnavailableError extends Error {
  constructor(readonly reason: "busy" | "outage") {
    super(`AI_UNAVAILABLE:${reason}`);
    this.name = "CoachUnavailableError";
  }
}

function coachErrorKind(err: unknown): CoachErrorKind {
  const msg = err instanceof Error ? err.message : String(err);
  if (/AI_UNAVAILABLE:busy/.test(msg)) return "busy";
  if (/AI_UNAVAILABLE/.test(msg)) return "outage";
  if (/DAILY_QUOTA_REACHED/.test(msg)) return "quota";
  if (/PRO_REQUIRED/.test(msg)) return "pro";
  if (/RATE_LIMITED/.test(msg)) return "rate";
  if (/Unauthorized/i.test(msg)) return "auth";
  return "network";
}

/** Seule une panne réseau / serveur mérite une seconde tentative automatique :
 *  un refus (quota, abonnement, session) ne change pas en 400 ms. */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return status >= 500 || status === 0;
  return coachErrorKind(err) === "network";
}

const seededUsers = new Set<string>();

/** Ce que Jarvis recoit d'une simulation — un resume, jamais le moteur. */
type SimulationSummary = NonNullable<CoachV1Payload["simulation"]>;

export default function ConversationWorkspace({ context, initialPrompt }: JarvisWorkspaceProps) {
  const { t, lang } = useT();
  const { activeAccount, activeId: activeAccountId } = useAccounts();
  // Contexte d'échelle transmis à Jarvis. `null` — donc bloc absent du prompt —
  // tant que l'historique est à son échelle d'origine.
  const calibration = useMemo(() => {
    if (!activeAccount || !isCalibrated(activeAccount.calibrationScale)) return null;
    return {
      originalBalance: activeAccount.originalBalance,
      currentBalance: activeAccount.startingBalance,
      scale: activeAccount.calibrationScale,
    };
  }, [activeAccount]);
  const { user } = useAuth();
  const { toast } = useToast();

  // Derniere simulation enregistree pour ce compte, rejouee a l'identique
  // depuis sa graine. Jarvis LIT ce resultat ; il ne simule jamais lui-meme —
  // un pourcentage produit par un modele de langage est invente, avec l'aplomb
  // d'un vrai. Reste `undefined` tant qu'aucun scenario n'a ete enregistre, et
  // la consigne du coach est alors de le dire.
  // Une ref, et non un etat : l'envoi de la question est un `useCallback` dont
  // la liste de dependances est volontairement partielle. Passer par l'etat
  // capturerait la valeur du premier rendu, et Jarvis repondrait « je n'ai pas
  // de simulation » alors qu'elle vient d'etre chargee.
  const lastSimulationRef = useRef<SimulationSummary | undefined>(undefined);
  // La configuration de base est conservee pour pouvoir REJOUER le scenario
  // avec le changement demande par la question. Sans elle, « et si je risquais
  // moitie moins ? » ne pourrait recevoir que le rappel du scenario d'hier.
  const baseConfigRef = useRef<SimulationConfig | null>(null);
  const datasetRef = useRef<SimDataset | null>(null);

  /**
   * La simulation transmise a Jarvis pour CETTE question.
   *
   * Quand la question demande explicitement un changement (« et si je risquais
   * moitie moins ? »), le moteur rejoue le scenario avec ce changement et c'est
   * ce resultat-la qui part. Sinon, c'est le scenario enregistre tel quel.
   *
   * La reconnaissance d'intention est volontairement etroite : au moindre
   * doute, `detectWhatIf` rend `null` et on retombe sur le scenario
   * enregistre. Deviner large ferait recevoir au trader un chiffre calcule sur
   * une intention qu'il n'a pas exprimee — et il le croirait.
   */
  const simulationFor = useCallback((query: string): SimulationSummary | undefined => {
    const base = baseConfigRef.current;
    const dataset = datasetRef.current;
    if (!base || !dataset) return lastSimulationRef.current;

    const lever = detectWhatIf(query);
    if (!lever) return lastSimulationRef.current;

    const result = runSimulation(dataset, applyLever(base, lever));
    return {
      engineVersion: result.engineVersion,
      method: ENGINE_VERSION,
      sampleSize: result.sampleSize,
      passProbability: result.passProbability,
      riskOfRuin: result.riskOfRuin,
      medianPnl: result.pnl.median,
      medianDrawdown: result.drawdown.median,
      horizonTrades: base.tradesPerPath,
      scenario: lever.id,
    };
  }, []);
  const setLastSimulation = useCallback((value: SimulationSummary | undefined) => {
    lastSimulationRef.current = value;
  }, []);
  useEffect(() => {
    let alive = true;
    loadScenarios(activeAccount?.id ?? null)
      .then((list) => {
        if (!alive) return;
        const latest = list.find((s) => s.seed !== null && s.lastRunAt !== null);
        if (!latest) {
          setLastSimulation(undefined);
          return;
        }
        const dataset = buildDataset(context.trades);
        if (dataset.trades.length === 0) return;
        const perDay = Math.max(1, Math.round(dataset.tradesPerDay ?? 1));
        const horizon =
          latest.horizon.unit === "trades"
            ? latest.horizon.value
            : Math.max(1, Math.round(perDay * latest.horizon.value));
        const config: SimulationConfig = {
          rules: latest.rules,
          tradesPerPath: horizon,
          tradesPerDay: perDay,
          runs: latest.runs,
          riskMultiplier: latest.riskMultiplier,
          stopAfterLosses: latest.stopAfterLosses,
          seed: latest.seed as number,
        };
        baseConfigRef.current = config;
        datasetRef.current = dataset;
        const result = runSimulation(dataset, config);
        setLastSimulation({
          engineVersion: result.engineVersion,
          method: ENGINE_VERSION,
          sampleSize: result.sampleSize,
          passProbability: result.passProbability,
          riskOfRuin: result.riskOfRuin,
          medianPnl: result.pnl.median,
          medianDrawdown: result.drawdown.median,
          horizonTrades: horizon,
        });
      })
      .catch(() => setLastSimulation(undefined));
    return () => {
      alive = false;
    };
  }, [activeAccount?.id, context.trades, setLastSimulation]);
  const rules = useTradingRules();
  // Signaux comportementaux — recalculés à partir des trades du contexte, pour
  // adosser la preuve chiffrée (📊) des réponses à de vraies données.
  const signals = useMemo(() => computeBehaviorSignals(context.trades), [context.trades]);
  const stats = useMemo(() => computeStats(context.trades), [context.trades]);
  const userId = user?.id ?? context.userId;
  // Le quota Jarvis du jour dépend du palier — jamais d'un nombre écrit ici.
  const { tier } = useSubscription();
  const dailyLimit = jarvisDailyLimit(tier);
  // Edge Score via le hook PARTAGE avec le tableau de bord — jamais recalcule ici.
  const edge = useEdgeScore(context.trades, userId);
  // Objectifs mesurés — hook PARTAGÉ avec la page Goals. Le pipeline du coach
  // acceptait `goals` depuis le début, mais rien ne les lui envoyait : Jarvis
  // était incapable de relier ses conseils à ce que le trader vise.
  const { measured: measuredGoals, ctx: goalCtx } = useGoalProgress(context.trades, userId);
  // Tenue des règles — réutilise le vérificateur du moteur de discipline, donc
  // une seule définition de « violer une règle » dans tout le produit.
  const adherence = useMemo(
    () =>
      computeRuleAdherence(context.trades, rules, goalCtx.startingBalance + goalCtx.stats.totalPnl),
    [context.trades, rules, goalCtx.startingBalance, goalCtx.stats.totalPnl],
  );
  const conversationId = context.conversationId ?? null;
  // Intention / réflexion / session — chargées UNE FOIS par jeu de trades
  // (bulk, 2 requêtes) et lues à chaque question. La session et les capteurs
  /// du coach (6I) ne doivent jamais ralentir l'envoi : des refs, pas du state.
  const intentsRef = useRef<Record<string, TradeIntent>>({});
  const reflectionsRef = useRef<Record<string, TradeReflection>>({});
  const sessionRef = useRef<{
    date: string;
    emotionalState: string | null;
    readinessScore: number | null;
    disciplineScore: number | null;
  } | null>(null);
  useEffect(() => {
    if (!userId || context.trades.length === 0) return;
    let active = true;
    const ids = context.trades.slice(-25).map((t) => t.id);
    void Promise.all([
      loadTradeIntents(userId, ids),
      loadTradeReflections(userId, ids),
      loadTodaySession(userId).catch(() => null),
    ]).then(([intents, reflections, session]) => {
      if (!active) return;
      intentsRef.current = intents;
      reflectionsRef.current = reflections;
      sessionRef.current = session
        ? {
            date: session.sessionDate,
            emotionalState: session.emotionalState ?? null,
            readinessScore: session.readinessScore ?? null,
            disciplineScore: session.disciplineScore ?? null,
          }
        : null;
    });
    return () => {
      active = false;
    };
  }, [userId, context.trades]);

  // Store STABLE par utilisateur : le recréer à chaque rendu ferait tourner
  // l'effet de sauvegarde en boucle (save → événement → re-render → nouveau
  /// store → save…), ce qui gelait le site au changement de workspace.
  const store = useMemo(() => (userId ? jarvisConversationStore(userId) : null), [userId]);

  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  /* « Chargé » vaut POUR UN FIL : quand le fil change, `loaded` redevient
     faux dans le même rendu. Un booléen seul restait vrai le temps d'un
     rendu, et une question posée à cet instant était effacée par le
     chargement du nouveau fil. */
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const loaded = loadedFor === (conversationId ?? null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  // La voix de Jarvis — la même que partout (voir `utils/hostedVoice`).
  const voice = useJarvisVoice();
  // La réponse en cours de lecture, pour que SON bouton devienne « Stop ».
  const [readingId, setReadingId] = useState<string | null>(null);
  useEffect(() => {
    if (!voice.speaking) setReadingId(null);
  }, [voice.speaking]);
  /* L'ÉTAT DE L'AGENT, pour l'orbe. Réfléchir prime sur tout (la question est
     partie), puis parler, puis écouter. Publié dans le store partagé pour que
     l'en-tête de la fenêtre et la barre de la page s'animent aussi. */
  // La réponse qui s'écrit en ce moment (voir `TypedAnswer`).
  const [typingId, setTypingId] = useState<string | null>(null);
  const activity: JarvisOrbState = loading
    ? "thinking"
    : voice.speaking || typingId
      ? "speaking"
      : listening
        ? "listening"
        : "idle";
  useEffect(() => {
    setJarvisActivity(activity);
  }, [activity]);
  useEffect(() => () => setJarvisActivity("idle"), []);
  const readAloud = (m: JarvisMessage) => {
    if (readingId === m.id) {
      voice.stop();
      setReadingId(null);
      return;
    }
    const line = spokenOf(m);
    if (!line) return;
    setReadingId(m.id);
    void voice.speak(line);
  };
  // Limite gratuite 5/j : la bannière Premium apparaît quand la limite est
  // atteinte, pour inviter à l'upgrade plutôt que de bloquer en silence.
  const [quotaBanner, setQuotaBanner] = useState(false);
  // La dernière question envoyée — pour « Réessayer » après une panne.
  const lastQuestionRef = useRef<string>("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Mémoire persistante chargée UNE fois par utilisateur, hors du chemin de la
  // question : la sélection par intention se fait ensuite en local, à coût nul.
  // Charger au moment de l'envoi ajouterait un aller-retour réseau à CHAQUE
  // question — la mémoire doit rendre Jarvis plus pertinent, jamais plus lent.
  // Une ref plutôt qu'un state : cette donnée ne déclenche aucun rendu.
  const memoryRef = useRef<MemoryEntry[]>([]);
  const SpeechRecognitionCtor = getSpeechRecognition();
  const draftKey = conversationId ? `tv:jarvis:draft:${userId ?? "anon"}:${conversationId}` : null;

  // Charge la conversation active + son brouillon.
  useEffect(() => {
    if (!store || !conversationId) {
      setMessages([]);
      setLoadedFor(conversationId ?? null);
      return;
    }
    let active = true;
    setQuestion(readDraft(draftKey));
    void store
      .get(conversationId)
      .then((conv) => {
        if (!active) return;
        setMessages(conv?.messages ?? []);
        setLoadedFor(conversationId);
      })
      .catch(() => {
        if (active) setLoadedFor(conversationId);
      });
    return () => {
      active = false;
    };
  }, [store, conversationId, draftKey]);

  // Chargement de la mémoire persistante — best-effort et NON bloquant : si la
  // lecture échoue ou n'a pas encore abouti, Jarvis répond exactement comme
  // avant (payload sans mémoire). La mémoire enrichit, elle ne conditionne pas.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadMemory(userId)
      .then((entries) => {
        if (active) memoryRef.current = entries;
      })
      .catch(() => {
        /* la mémoire est un bonus, jamais un prérequis */
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Sauvegarde les messages dans la conversation (titrée automatiquement).
  useEffect(() => {
    if (!store || !conversationId || !loaded) return;
    void store.saveMessages(conversationId, messages).catch(() => {});
  }, [store, conversationId, messages, loaded]);

  // Brouillon de saisie par conversation.
  useEffect(() => {
    if (draftKey) writeDraft(draftKey, question);
  }, [draftKey, question]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setTypingId(null);
    if (store && conversationId) void store.saveMessages(conversationId, []);
  }, [store, conversationId]);

  // ── Action exécutable : Jarvis propose une règle, l'utilisateur l'intègre ──
  // « Ajouter cette règle à ma checklist » écrit une vraie TradingRule (dédupée)
  // et diffuse `tv-rules-updated` pour que le reste de l'app se synchronise.
  const handleTool = useCallback(
    async (block: JarvisToolBlock) => {
      // Navigation : on réutilise le canal `tv:navigate` déjà écouté par App
      // (même contrat que la CreditsBar et les notifications) — aucun second
      // mécanisme de navigation n'est introduit.
      if (block.tool === "openPage") {
        const page = block.targetPage ?? (block.payload?.page as string | undefined);
        if (page) window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page } }));
        return;
      }

      const ruleText =
        typeof block.payload?.ruleText === "string" ? block.payload.ruleText.trim() : "";
      // On LÈVE au lieu de sortir en silence : `ToolView` traite l'absence
      // d'exception comme une réussite et afficherait un ✓ alors que rien n'a
      // été écrit. Un bouton qui ment est pire qu'un bouton inerte.
      if (!userId || !ruleText) {
        throw new Error("tool: missing userId or ruleText");
      }
      const current = await loadTradingRules(userId);
      if (!current.some((r) => r.text.toLowerCase() === ruleText.toLowerCase())) {
        const next = [
          ...current,
          {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `rule-${Date.now()}`,
            kind: "custom" as const,
            value: "",
            text: ruleText,
            enabled: true,
          },
        ];
        await saveTradingRules(userId, next);
        window.dispatchEvent(new CustomEvent("tv-rules-updated", { detail: next }));

        // ── Apprentissage ──────────────────────────────────────────────────
        // La règle elle-même vit dans `profiles` (source de vérité unique, déjà
        // envoyée au coach) — on ne la duplique PAS. Ce qu'on mémorise est
        // autre chose : le fait que le trader se soit ENGAGÉ, et quand.
        // C'est une décision, elle n'est recalculable depuis aucune donnée, et
        // c'est le signal le plus fort du produit : il permettra à Jarvis de
        // revenir dessus (« tu l'as tenue 4 fois sur 5 »).
        void remember(
          userId,
          "decision",
          `A accepté la règle « ${ruleText} » le ${todayLocalDate()}.`,
          {
            // Clé dérivée du texte : ré-accepter la même règle rafraîchit la
            // date au lieu de créer un doublon.
            key: `rule:${ruleText.toLowerCase().slice(0, 80)}`,
            importance: 5,
            // Certitude : l'utilisateur a cliqué. Rien n'est déduit ni extrait.
            confidence: 1,
            source: "rule_accepted",
          },
        ).catch(() => {
          /* l'apprentissage ne doit jamais faire échouer l'action de l'utilisateur */
        });
      }
      toast(t("jarvisHome.ruleAdded"), "success");
    },
    [userId, toast, t],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Seed Jarvis's long-term memory from the profile the first time the
  // workspace opens for this user. Idempotent + best-effort.
  useEffect(() => {
    if (!userId || seededUsers.has(userId)) return;
    seededUsers.add(userId);
    void seedProfileMemory(userId);
  }, [userId]);

  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);

  // Suggestions intelligentes — `buildSuggestions` existait déjà (utilisé par
  // l'Accueil) mais n'était jamais branché ici : la conversation n'orientait
  // donc jamais le trader. Elles sont dérivées de SES données réelles (pire
  // jour, erreur la plus coûteuse, dérive de risque…), pas d'une liste figée.
  const suggestions = useMemo(
    () =>
      buildSuggestions(
        {
          trades: context.trades,
          stats,
          signals,
          rule: null,
          profile: context.profile ?? null,
          onboarding,
        },
        context.page,
        effectiveCopyLang(lang),
      ).slice(0, 4),
    [context.trades, context.profile, context.page, stats, signals, onboarding, lang],
  );

  useEffect(() => {
    if (!userId) {
      setOnboarding(null);
      return;
    }
    let active = true;
    loadOnboarding(userId)
      .then((o) => {
        if (active) setOnboarding(o);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const threadId = conversationId ?? "__jarvis_default";

  /** Une réponse (ou un échec) de Jarvis, en message de conversation. */
  const resultToMessage = useCallback(
    (r: JarvisResult): JarvisMessage => {
      if (!r.ok) {
        return {
          role: "error",
          id: genId(),
          blocks: [{ type: "markdown", content: t(`ai.error.${coachErrorKind(r.error)}`) }],
          createdAt: new Date().toISOString(),
        };
      }
      return {
        role: "assistant",
        id: genId(),
        blocks: [{ type: "markdown", content: r.answer }],
        createdAt: new Date().toISOString(),
      };
    },
    [t],
  );

  /* LE RETOUR D'UNE QUESTION — celle-ci ou une posée avant la dernière
     fermeture de la fenêtre. */
  useEffect(() => {
    if (!loaded) return;
    if (pendingQuestion(threadId)) {
      setLoading(true);
      lastQuestionRef.current = pendingQuestion(threadId) ?? "";
    }
    return listenJarvisThread(threadId, (r) => {
      setLoading(false);
      const msg = resultToMessage(r);
      setMessages((prev) => [...prev, msg]);
      if (!r.ok) {
        console.error("[coach] request failed", r.error);
        if (coachErrorKind(r.error) === "quota") setQuotaBanner(true);
        return;
      }
      setTypingId(msg.id);
      // Une analyse consommée — comptée APRÈS la réponse.
      if (r.fromAi) incrementAiUsage(userId);
      learnFrom(r.question);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, loaded, resultToMessage, userId]);

  /* ── Apprentissage ──────────────────────────────────────────────────────
     APRÈS la réponse, sans l'attendre. Éteinte par défaut côté serveur
     (`AI_MEMORY_EXTRACTION`) ; l'écriture passe par le `remember()` existant. */
  const learnFrom = (question: string) => {
    void (async () => {
      if (!userId) return;
      const known = memoryRef.current.map((m) => m.key).filter((k): k is string => !!k);
      const out = await extractMemory({ data: { userMessage: question, knownKeys: known } });
      for (const c of out.candidates) {
        await remember(userId, c.kind, c.content, {
          key: c.key,
          importance: c.importance,
          confidence: c.confidence,
          source: c.source,
        });
        memoryRef.current = [
          ...memoryRef.current,
          {
            id: c.key,
            kind: c.kind,
            content: c.content,
            key: c.key,
            importance: c.importance,
            confidence: c.confidence,
            source: c.source,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    })().catch(() => {
      /* l'apprentissage ne doit JAMAIS dégrader la conversation */
    });
  };

  const ask = useCallback(
    async (q: string) => {
      const query = q.trim();
      // Le fil est créé à l'ouverture (AiAssistant) : on n'envoie pas avant,
      // sinon la question ne serait enregistrée nulle part.
      if (!query || loading || !loaded || (store && !conversationId)) return;
      // Quota du jour (3 en gratuit, 20 en Pro, aucun en Elite) : au-delà, on
      // explique et on oriente vers l'offre supérieure — aucune requête n'est
      // envoyée, donc zéro token consommé.
      if (exceedsDailyLimit(userId, dailyLimit)) {
        setQuotaBanner(true);
        setQuestion("");
        return;
      }
      const priorTurns = messages
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role as "user" | "assistant", content: historyTextOf(m) }));
      const push = (role: JarvisMessage["role"], text: string) =>
        setMessages((prev) => [
          ...prev,
          {
            role,
            id: genId(),
            blocks: [{ type: "markdown", content: text }],
            createdAt: new Date().toISOString(),
          },
        ]);
      push("user", query);
      setQuestion("");
      setLoading(true);
      const payload = buildCoachV1Payload({
        trades: context.trades,
        // Indicateur de tête du tableau de bord — canal DÉDIÉ (avec période et
        // sous-scores pour l'interprétation), plus confondu avec les signals.
        edge: {
          score: edge.score,
          weakest: edge.weakest,
          windowDays: EDGE_WINDOW_DAYS,
          subs: Object.entries(edge.subs ?? {}).reduce<
            Record<string, { value: number | null; detail?: string }>
          >((acc, [k, v]) => {
            acc[k] = v;
            return acc;
          }, {}),
        },
        // Intentions + réflexions des 25 derniers trades — ce que le trader
        // pensait AVANT vs ce qu'il conclut APRÈS (6I). Absents si aucune
        // capture : le bâtiment ne fabrique jamais une intention que l'utilisateur
        // n'a pas saisie.
        intent: Object.values(intentsRef.current)
          .filter((i) => i.tradeId)
          .map((i) => ({
            tradeId: i.tradeId as string,
            // Texte libre saisi par le trader : borné aux limites du serveur,
            // sinon une seule longue note faisait rejeter toute la question.
            setup: i.setup?.slice(0, 100) ?? null,
            reasoning: i.reasoning?.slice(0, 500) ?? null,
            confidence: i.confidence ?? null,
            plannedRisk: i.plannedRisk ?? null,
            plan: i.plan?.slice(0, 500) ?? null,
            emotion: i.emotion?.slice(0, 40) ?? null,
          })),
        reflection: Object.values(reflectionsRef.current).map((r) => ({
          tradeId: r.tradeId,
          planRespected: r.planRespected ?? null,
          reason: r.reason?.slice(0, 40) ?? null,
          note: r.note?.slice(0, 500) ?? null,
        })),
        session: sessionRef.current,
        conversation: priorTurns,
        language: effectiveCopyLang(lang),
        onboarding,
        jarvisProfile: context.profile,
        rules,
        goals: measuredGoals,
        adherence,
        question: query.slice(0, 500),
        memory: memoryRef.current,
        // Déjà mémoïsés au-dessus : sans ça, `buildCoachV1Payload` reparcourait
        // tous les trades une seconde fois à chaque question.
        signals,
        // Sans ce contexte, Jarvis lirait des montants recalibrés comme s'ils
        // avaient été tradés tels quels et conclurait « tu as doublé ton
        // risque » alors que le trader risque toujours 1 %.
        calibration,
        // La derniere simulation enregistree pour ce compte. C'est la SEULE
        // source d'ou une probabilite a le droit de venir : sans ce bloc, la
        // consigne du coach est de dire qu'il n'a pas de simulation, pas d'en
        // estimer une.
        simulation: simulationFor(query),
      });
      lastQuestionRef.current = query;
      const accountId = activeAccountId ?? undefined;
      /* LA QUESTION PART HORS DU COMPOSANT (`pending.ts`) : fermer la fenêtre
         pendant l'analyse ne la perd plus. La réponse est remise à la
         conversation affichée si elle écoute, sinon écrite dans la
         conversation stockée. */
      const run = async (): Promise<JarvisResult> => {
        const call = () =>
          askCoach({
            data: {
              ...payload,
              question: query.slice(0, 500),
              accountId,
              currency: getCurrency(),
              // La date LOCALE : le serveur tourne en UTC, et le modèle ne
              // connaît pas le jour qu'il est.
              today: todayLocalDate(),
            },
          });
        let res;
        try {
          res = await call();
        } catch (firstErr) {
          // Une erreur 4xx (quota, validation, session) ne se résout pas avec un
          // retry — on ne double pas la consommation de quota.
          if (!isTransient(firstErr)) throw firstErr;
          console.warn("[coach] first attempt failed, retrying", firstErr);
          await new Promise((r) => setTimeout(r, 400));
          res = await call();
        }
        // Le serveur dit d'où vient la réponse — on ne le devine pas. Sans
        // l'IA, ce n'est pas une réponse : c'est une erreur, et elle se dit.
        if (res.source !== "ai") {
          throw new CoachUnavailableError(
            (res as { reason?: string }).reason === "busy" ? "busy" : "outage",
          );
        }
        return {
          ok: true,
          question: query,
          answer: res.answer || t("ai.noResponse"),
          fromAi: true,
        };
      };
      const persist = async (r: JarvisResult) => {
        if (!store || !conversationId) return;
        const conv = await store.get(conversationId);
        const prev = conv?.messages ?? [];
        await store.saveMessages(conversationId, [...prev, resultToMessage(r)]);
        if (r.ok && r.fromAi) incrementAiUsage(userId);
      };
      startJarvisRequest(threadId, query, run, persist);
    },
    [
      loading,
      messages,
      loaded,
      store,
      conversationId,
      threadId,
      resultToMessage,
      context.trades,
      context.profile,
      lang,
      t,
      onboarding,
      rules,
      userId,
      signals,
      activeAccountId,
    ],
  );

  /** Réessayer : on retire la bulle d'erreur ET la question restée sans
   *  réponse, puis on renvoie la même question. */
  const retry = () => {
    const q = lastQuestionRef.current;
    if (!q || loading) return;
    setMessages((prev) => {
      const next = prev[prev.length - 1]?.role === "error" ? prev.slice(0, -1) : [...prev];
      const last = next[next.length - 1];
      return last?.role === "user" && textOf(last) === q ? next.slice(0, -1) : next;
    });
    // Laisse React retirer les bulles avant de relancer.
    window.setTimeout(() => void ask(q), 0);
  };

  // A page (Checklist, Missed…) opened Jarvis with a ready-made prompt.
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      initialPrompt &&
      askedRef.current !== initialPrompt &&
      loaded &&
      (!store || conversationId)
    ) {
      askedRef.current = initialPrompt;
      void ask(initialPrompt);
    }
  }, [initialPrompt, ask, loaded, store, conversationId]);

  const toggleMic = useCallback(() => {
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [SpeechRecognitionCtor, listening, lang]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* LA BANDE D'OUTILS N'EXISTE QUE QUAND ELLE PORTE QUELQUE CHOSE.
          Elle occupait une hauteur pleine pour afficher le mot
          « Conversation » — un titre qui répète ce que la page est déjà, sur
          une bande qui prenait la place du dialogue. Il ne reste que le bouton
          « effacer », et seulement quand il y a quelque chose à effacer. */}
      {messages.length > 0 && (
        <div className="flex shrink-0 items-center justify-end border-b border-white/[0.04] px-4 py-1.5 md:px-6">
          <button
            onClick={clearChat}
            aria-label={t("assistant.clear")}
            title={t("assistant.clear")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Messages — rendus UNIQUEMENT via les blocs */}
      {/* `aria-live="polite"` : les réponses arrivent de façon asynchrone. Sans
          région live, une réponse de Jarvis n'existe tout simplement PAS pour un
          lecteur d'écran — l'utilisateur envoie sa question et n'apprend jamais
          qu'on lui a répondu. `polite` et non `assertive` pour ne pas couper la
          lecture en cours ; `relevant="additions"` pour n'annoncer que les
          nouveaux messages, pas le re-rendu de tout le fil. */}
      <div
        ref={scrollRef}
        /* `grid place-items-center` UNIQUEMENT sur la conversation vide : le
           bloc d'accueil se pose alors au milieu du panneau au lieu de
           s'accrocher au coin haut-gauche. Dès qu'il y a des messages, on
           repasse en flux normal — un fil de discussion se lit du haut. */
        className={
          messages.length === 0 && loaded
            ? "grid flex-1 place-items-center overflow-y-auto px-4 py-5 md:px-8"
            : "flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-8"
        }
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={loading}
      >
        {!loaded ? (
          /* Chargement de la conversation — squelette, jamais de texte gris. */
          <div className="space-y-3" aria-busy="true">
            <div className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
            <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
          </div>
        ) : messages.length === 0 ? (
          /* ── L'ACCUEIL DE LA CONVERSATION ──
             ══ CE QUI LE RENDAIT PAUVRE ══

               • L'IDENTITÉ ÉTAIT DITE DEUX FOIS. La barre de tête affiche
                 déjà « Jarvis · un coach qui a lu tes trades et dit quoi
                 corriger demain ». Le panneau reposait en dessous l'avatar,
                 le nom, et « Ton copilote IA de trading » — la même chose,
                 en moins précis, à 40px d'écart. Le commentaire en tête de
                 `Jarvis.tsx` déclarait ce défaut corrigé ; il ne l'était que
                 d'un côté.
               • TOUT ÉTAIT COLLÉ EN HAUT À GAUCHE d'un panneau plein écran.
                 Un bloc de 300px dans le coin d'une surface de 1200 se lit
                 comme une page qui n'a pas fini de charger.
               • LES SURVOLS ÉTAIENT CYAN, reste de l'identité d'avant.

             ══ CE QU'IL EST ══

             Un seul bloc, CENTRÉ dans le panneau (c'est le `grid
             place-items-center` du conteneur quand la conversation est
             vide). Pas de second avatar : l'invitation, puis les questions.
             Les questions sont les vraies — `buildSuggestions` les tire des
             motifs mesurés sur les trades du trader, pas d'une liste écrite
             d'avance — donc elles méritent d'être l'objet principal de
             l'écran plutôt qu'une note de bas de bloc. */
          <div className="jarvis-accueil animate-fade-in-up">
            {/* L'orbe : Jarvis est là, et elle s'anime dès qu'il écoute. */}
            <JarvisOrb state={activity} size={84} className="mx-auto mb-6" />
            <p className="jarvis-accueil-invite">{t("assistant.empty")}</p>

            {suggestions.length > 0 && (
              <div className="mt-7 w-full">
                <p className="tv-label mb-3 text-slate-500">{t("jarvisHome.suggestions")}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void ask(s.prompt)}
                      className="jarvis-suggestion"
                    >
                      <span className="min-w-0 flex-1">{s.label}</span>
                      <ArrowUpRight className="jarvis-suggestion-fleche" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              /* L'utilisateur garde la bulle : l'asymétrie devient le repère de
                 tour, sans enfermer le contenu analytique de Jarvis. */
              <div key={m.id} className="flex justify-end">
                {/* LA BULLE N'EST PLUS VERTE. Chaque question du trader
                    s'affichait en vert plein : dans une conversation de dix
                    messages, la couleur d'action du produit se retrouvait
                    répétée cinq fois, et elle ne désignait plus rien. La bulle
                    est une plaque neutre — l'asymétrie suffit à dire qui
                    parle, et le vert reste à Jarvis et aux boutons. */}
                <div className="jarvis-bubble-user max-w-[85%] whitespace-pre-wrap">
                  {textOf(m) || ""}
                </div>
              </div>
            ) : (
              /* Jarvis : CANVAS pleine largeur. Plus de bulle autour des cartes
                 — fin des cartes-dans-une-carte, les blocs respirent enfin. */
              <div key={m.id} className="jarvis-turn animate-fade-in-up">
                <div className="mb-2.5 flex items-center gap-2">
                  {/* La réponse EN COURS DE LECTURE porte l'orbe qui parle ;
                      les autres, la marque au repos. */}
                  {readingId === m.id ? (
                    <JarvisOrb state="speaking" size={24} />
                  ) : (
                    <span className="jarvis-avatar">
                      <JarvisMark className="h-4 w-4" />
                    </span>
                  )}
                  <span className="tv-label text-[var(--tv-highlight)]">
                    {t("assistant.title")}
                  </span>
                  {m.role === "assistant" && typingId !== m.id && spokenOf(m) && (
                    <button
                      type="button"
                      onClick={() => readAloud(m)}
                      className="jarvis-listen ml-auto"
                      aria-pressed={readingId === m.id}
                    >
                      {readingId === m.id ? (
                        <Square className="h-3 w-3" aria-hidden />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {readingId === m.id ? t("jarvis.stopListening") : t("jarvis.listen")}
                    </button>
                  )}
                </div>
                {m.role === "assistant" && typingId === m.id ? (
                  <TypedAnswer
                    content={textOf(m)}
                    onProgress={() => {
                      const el = scrollRef.current;
                      if (el) el.scrollTop = el.scrollHeight;
                    }}
                    onDone={() => {
                      setTypingId(null);
                      // Réglage « lire les réponses » : la voix part quand le
                      // texte a fini de s'écrire, jamais par-dessus.
                      if (readAutoSpeak()) readAloud(m);
                    }}
                  />
                ) : m.role === "assistant" ? (
                  <BlockList blocks={m.blocks} onTool={handleTool} />
                ) : (
                  <div className="jarvis-error">
                    <span className="min-w-0 flex-1">{textOf(m) || ""}</span>
                    {m.id === messages[messages.length - 1]?.id && lastQuestionRef.current && (
                      <button type="button" onClick={retry} className="jarvis-error-retry">
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        {t("ai.retry")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ),
          )
        )}

        {loading && (
          /* LE TEMPS DE RÉFLEXION SE VOIT. Jarvis prend le temps d'analyser
             avant d'écrire : les étapes avancent pendant qu'il lit le journal,
             au lieu d'un squelette gris qui ne dit rien. */
          <div className="jarvis-turn animate-fade-in">
            <div className="mb-3 flex items-center gap-2.5">
              <JarvisOrb state="thinking" size={28} label={t("jarvis.thinking")} />
              <span className="tv-label text-[var(--tv-highlight)]">{t("jarvis.thinking")}</span>
            </div>
            <ThinkingSteps
              key={lastQuestionRef.current}
              steps={INTENT_STEPS[classifyQuestion(lastQuestionRef.current)].map((k) =>
                t(k as TKey).replace("{n}", String(context.trades.length)),
              )}
            />
          </div>
        )}
      </div>

      {/* Saisie */}
      <div className="p-3 md:p-4 border-t border-white/[0.06] shrink-0">
        {(quotaBanner || exceedsDailyLimit(userId, dailyLimit)) && (
          /* La limite du jour : le message et l'offre dépendent du palier —
             un abonné Pro ne se voit jamais proposer « Pro ». */
          <div className="jarvis-quota mb-2.5">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-amber-200">
                {tier === "free" ? t("credits.exhausted") : t("credits.exhaustedPro")}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                {tier === "free" ? t("credits.freePitch") : t("credits.exhaustedBody")}
              </p>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
              className="jarvis-upgrade jarvis-upgrade-hot shrink-0"
            >
              {tier === "free" ? t("credits.upgrade") : t("credits.upgradePro")}
            </button>
          </div>
        )}
        {/* LE MICRO ET LE CHAMP NE FONT PLUS DEUX BLOCS. Le micro vivait à
            GAUCHE du champ, dans sa propre boîte, et le champ avait en plus un
            bouton qui faisait tourner un placeholder animé : trois contrôles
            sur une ligne pour écrire une phrase. Tout est dans le compositeur
            maintenant, à sa place — micro à gauche, envoi à droite. */}
        <Composer
          value={question}
          onChange={setQuestion}
          onSubmit={() => ask(question)}
          disabled={loading}
          listening={listening}
          onMic={toggleMic}
          micAvailable={!!SpeechRecognitionCtor}
        />
      </div>
    </div>
  );
}

/**
 * Les étapes de réflexion, qui avancent pendant que la réponse se prépare.
 * La dernière reste active tant que le serveur n'a pas répondu : elle ne
 * prétend jamais avoir fini avant lui.
 */
function ThinkingSteps({ steps }: { steps: string[] }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setAt((n) => Math.min(steps.length - 1, n + 1));
    }, 1600);
    return () => window.clearInterval(id);
  }, [steps.length]);
  return (
    <ol className="jarvis-steps">
      {steps.map((label, i) => (
        <li
          key={i}
          className="jarvis-step"
          data-state={i < at ? "done" : i === at ? "active" : "todo"}
        >
          <span className="jarvis-step-dot" aria-hidden>
            {i < at && <Check className="h-2.5 w-2.5" />}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

// Brouillons en `localStorage`, comme les conversations : une question a
// moitie ecrite perdue en fermant l'onglet est une frustration gratuite, et
// c'est souvent la question la plus difficile a formuler.
function readDraft(key: string | null): string {
  if (!key || typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* best-effort */
  }
}
