import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Eraser, Send, Loader2, Mic, MicOff, Zap } from "lucide-react";
import { askCoach } from "@/backend/coach.functions";
import { buildCoachV1Payload, seedProfileMemory } from "../../../utils/aiContext";
import { loadMemory, remember, type MemoryEntry } from "@/modules/ai/memory";
import { fallbackCoachAnswer, type FallbackPayload } from "@/modules/ai/fallback-coach";
import { useTradingRules } from "../../../hooks/useTradingRules";
import { loadTradingRules, saveTradingRules } from "../../../utils/tradingRules";
import { computeBehaviorSignals } from "../../../utils/behaviorSignals";
import { computeStats } from "../../../utils/tradeCalcs";
import { answerToBlocks } from "../insights/answerToBlocks";
import { buildSuggestions } from "../insights/suggestions";
import { cn } from "../../../utils/cn";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { loadOnboarding, type OnboardingData } from "../../../store";
import {
  exceedsDailyLimit,
  incrementAiUsage,
  aiUsageToday,
  FREE_DAILY_LIMIT,
} from "../../../utils/aiUsage";
import { effectiveCopyLang } from "../prefs";
import { sessionConversationStore } from "../conversations";
import { BlockList } from "../BlockRenderer";
import { historyTextOf } from "../history";
import type { JarvisMessage, JarvisToolBlock } from "../blocks";
import type { JarvisWorkspaceProps } from "../workspaces";

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

/** 4xx (quota, validation, auth) → non rétentable ; 5xx/réseau → rétentable. */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return status >= 500 || status === 0;
  const msg = err instanceof Error ? err.message : String(err);
  return !/RATE_LIMITED|PRO_REQUIRED|Unauthorized|400|422/i.test(msg);
}

const seededUsers = new Set<string>();

export default function ConversationWorkspace({ context, initialPrompt }: JarvisWorkspaceProps) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const rules = useTradingRules();
  // Signaux comportementaux — recalculés à partir des trades du contexte, pour
  // adosser la preuve chiffrée (📊) des réponses à de vraies données.
  const signals = useMemo(() => computeBehaviorSignals(context.trades), [context.trades]);
  const stats = useMemo(() => computeStats(context.trades), [context.trades]);
  const userId = user?.id ?? context.userId;
  const conversationId = context.conversationId ?? null;
  // Store STABLE par utilisateur : le recréer à chaque rendu ferait tourner
  // l'effet de sauvegarde en boucle (save → événement → re-render → nouveau
  // store → save…), ce qui gelait le site au changement de workspace.
  const store = useMemo(() => (userId ? sessionConversationStore(userId) : null), [userId]);

  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  // Limite gratuite 5/j : la bannière Premium apparaît quand la limite est
  // atteinte, pour inviter à l'upgrade plutôt que de bloquer en silence.
  const [quotaBanner, setQuotaBanner] = useState(false);
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
      setLoaded(true);
      return;
    }
    let active = true;
    setLoaded(false);
    setQuestion(readDraft(draftKey));
    void store
      .get(conversationId)
      .then((conv) => {
        if (!active) return;
        setMessages(conv?.messages ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
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
          `A accepté la règle « ${ruleText} » le ${new Date().toISOString().slice(0, 10)}.`,
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
          edge: null,
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

  const ask = useCallback(
    async (q: string) => {
      const query = q.trim();
      if (!query || loading || !loaded) return;
      // Quota gratuit : au-delà de 5 analyses/jour, on explique et on oriente
      // vers Premium — aucune requête n'est envoyée (0 token consommé).
      if (exceedsDailyLimit(userId)) {
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
        conversation: priorTurns,
        language: effectiveCopyLang(lang),
        onboarding,
        jarvisProfile: context.profile,
        rules,
        question: query,
        memory: memoryRef.current,
      });
      // La réponse du coach devient une INTERFACE VIVANTE : analyse (🧠) + preuve
      // chiffrée déterministe (📊) + plan (🎯) + action exécutable. Repli gracieux
      // sur un simple bloc markdown si rien ne peut être structuré.
      const pushAnswer = (text: string, degraded = false) => {
        const { blocks } = answerToBlocks({
          answer: text || t("ai.noResponse"),
          question: query,
          lang: effectiveCopyLang(lang),
          signals,
          stats: payload.stats,
          mistakes: payload.mistakes,
        });
        // Honnêteté : quand la réponse vient du moteur déterministe (provider
        // indisponible, quota, timeout), on le DIT. Les chiffres restent vrais
        // — ils viennent des mêmes signaux — mais le raisonnement est plus
        // pauvre, et laisser croire le contraire abîmerait la confiance.
        const withNotice: typeof blocks = degraded
          ? [{ type: "alert", level: "info", message: t("ai.offlineAnalysis") }, ...blocks]
          : blocks;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            id: genId(),
            blocks: withNotice,
            createdAt: new Date().toISOString(),
          },
        ]);
      };
      try {
        // Une analyse consommée — comptée localement, jamais d'appel réseau.
        incrementAiUsage(userId);
        let res;
        try {
          res = await askCoach({ data: { question: query, ...payload } });
        } catch (firstErr) {
          // Une erreur 4xx (quota, validation, session) ne se résout pas avec un
          // retry — on ne double pas la consommation de quota.
          if (!isTransient(firstErr)) throw firstErr;
          console.warn("[coach] first attempt failed, retrying", firstErr);
          // Backoff court : ce retry ne concerne que les erreurs transitoires
          // (5xx/réseau). 1,5 s s'ajoutait à une attente déjà longue pour un
          // gain de fiabilité nul — 400 ms absorbe un pic réseau tout autant.
          await new Promise((r) => setTimeout(r, 400));
          res = await askCoach({ data: { question: query, ...payload } });
        }
        // Le serveur indique déjà si la réponse vient de l'IA ou du moteur
        // déterministe — on ne le devine pas, on lit `source`.
        pushAnswer(res.answer || t("ai.noResponse"), res.source !== "ai");
      } catch (e) {
        // Jamais d'erreur visible : on répond de façon déterministe depuis les
        // mêmes données (quota, session, transport…). La console garde la cause.
        console.error("[coach] request failed — serving deterministic answer", e);
        try {
          const fallbackPayload: FallbackPayload = {
            question: query,
            language: effectiveCopyLang(lang),
            stats: payload.stats,
            mistakes: payload.mistakes,
            trades: payload.trades as FallbackPayload["trades"],
          };
          pushAnswer(fallbackCoachAnswer(fallbackPayload), true);
        } catch {
          push("error", t("ai.genericError"));
        }
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      messages,
      loaded,
      context.trades,
      context.profile,
      lang,
      t,
      onboarding,
      rules,
      userId,
      signals,
    ],
  );

  // A page (Checklist, Missed…) opened Jarvis with a ready-made prompt.
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialPrompt && askedRef.current !== initialPrompt && loaded) {
      askedRef.current = initialPrompt;
      void ask(initialPrompt);
    }
  }, [initialPrompt, ask, loaded]);

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
      {/* Toolbar du workspace */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b border-white/[0.04] shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
          {t("jarvis.conversation")}
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            aria-label={t("assistant.clear")}
            title={t("assistant.clear")}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages — rendus UNIQUEMENT via les blocs */}
      {/* `aria-live="polite"` : les réponses arrivent de façon asynchrone. Sans
          région live, une réponse de Jarvis n'existe tout simplement PAS pour un
          lecteur d'écran — l'utilisateur envoie sa question et n'apprend jamais
          qu'on lui a répondu. `polite` et non `assertive` pour ne pas couper la
          lecture en cours ; `relevant="additions"` pour n'annoncer que les
          nouveaux messages, pas le re-rendu de tout le fil. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-5"
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
          /* ── État vide premium ──
             Premier écran vu : il doit poser l'identité de Jarvis ET enseigner
             quoi demander, à partir des données réelles du trader. */
          <div className="animate-fade-in-up">
            <div className="relative">
              <div className="pointer-events-none absolute -top-8 left-0 h-24 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <span className="relative shrink-0">
                  <span className="absolute -inset-1.5 rounded-2xl bg-cyan-500/35 blur-md" />
                  <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
                    <Bot className="w-5 h-5 text-white" />
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold text-white tracking-tight">
                    {t("assistant.title")}
                  </p>
                  <p className="text-xs text-slate-400">{t("jarvis.copilot")}</p>
                </div>
              </div>
              <p className="relative mt-3 text-sm text-slate-300 leading-relaxed max-w-lg">
                {t("assistant.empty")}
              </p>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-500">
                  {t("jarvisHome.suggestions")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void ask(s.prompt)}
                      className="min-h-11 text-left rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-[13px] text-slate-200 hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] active:scale-[0.99] transition-all"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              /* L'utilisateur garde la bulle : l'asymétrie devient le repère de
                 tour, sans enfermer le contenu analytique de Jarvis. */
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-medium text-white">
                  {textOf(m) || ""}
                </div>
              </div>
            ) : (
              /* Jarvis : CANVAS pleine largeur. Plus de bulle autour des cartes
                 — fin des cartes-dans-une-carte, les blocs respirent enfin. */
              <div
                key={m.id}
                className={cn("animate-fade-in-up", i > 0 && "border-t border-white/[0.05] pt-5")}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-cyan-400/80">
                    {t("assistant.title")}
                  </span>
                </div>
                {m.role === "assistant" ? (
                  <BlockList blocks={m.blocks} onTool={handleTool} />
                ) : (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                    {textOf(m) || ""}
                  </div>
                )}
              </div>
            ),
          )
        )}

        {/* Relances : Jarvis oriente au lieu d'attendre. */}
        {loaded && !loading && messages.length > 0 && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.slice(0, 3).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void ask(s.prompt)}
                className="min-h-9 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/30 hover:text-white active:scale-[0.98] transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          /* Chargement informatif : on annonce ce que Jarvis lit réellement. */
          <div className="animate-fade-in border-t border-white/[0.05] pt-5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
                <Bot className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-cyan-400/80">
                {t("assistant.title")}
              </span>
              <span className="flex items-center gap-1">
                <span className="thinking-dot" />
                <span className="thinking-dot" style={{ animationDelay: "0.15s" }} />
                <span className="thinking-dot" style={{ animationDelay: "0.3s" }} />
              </span>
            </div>
            <p className="text-[13px] text-slate-400">
              {t("jarvisHome.analyzing").replace("{n}", String(context.trades.length))}
            </p>
            <div className="mt-3 space-y-2">
              <div className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Saisie */}
      <div className="p-3 md:p-4 border-t border-white/[0.06] shrink-0">
        {(quotaBanner || aiUsageToday(userId) >= FREE_DAILY_LIMIT) && (
          <div className="mb-2.5 rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.08] to-amber-500/[0.03] px-3.5 py-3 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-amber-200 leading-snug">
                {t("credits.exhausted")}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {t("credits.exhaustedBody")}
              </p>
            </div>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tv:navigate", { detail: { page: "subscription" } }),
                )
              }
              className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all"
            >
              {t("credits.upgrade")}
            </button>
          </div>
        )}
        {listening && (
          <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold mb-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />{" "}
            {t("assistant.listening")}
          </div>
        )}
        <div className="flex items-center gap-2">
          {SpeechRecognitionCtor && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={t("common.voiceInput")}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                listening
                  ? "bg-red-500/15 text-red-400"
                  : "bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]",
              )}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(question);
            }}
            placeholder={t("assistant.placeholder")}
            disabled={loading}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            aria-label={t("common.send")}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white shrink-0 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function readDraft(key: string | null): string {
  if (!key || typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, value: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* best-effort */
  }
}
