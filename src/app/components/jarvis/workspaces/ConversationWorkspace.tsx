import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Eraser, Send, Loader2, Mic, MicOff } from "lucide-react";
import { askCoach } from "@/backend/coach.functions";
import { buildCoachV1Payload, seedProfileMemory } from "../../../utils/aiContext";
import { fallbackCoachAnswer, type FallbackPayload } from "@/modules/ai/fallback-coach";
import { useTradingRules } from "../../../hooks/useTradingRules";
import { cn } from "../../../utils/cn";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { loadOnboarding, type OnboardingData } from "../../../store";
import { effectiveCopyLang } from "../prefs";
import { sessionConversationStore } from "../conversations";
import { BlockList } from "../BlockRenderer";
import type { JarvisMessage } from "../blocks";
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
  const rules = useTradingRules();
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
      const priorTurns = messages
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role as "user" | "assistant", content: textOf(m) }));
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
      });
      try {
        let res;
        try {
          res = await askCoach({ data: { question: query, ...payload } });
        } catch (firstErr) {
          // Une erreur 4xx (quota, validation, session) ne se résout pas avec un
          // retry — on ne double pas la consommation de quota.
          if (!isTransient(firstErr)) throw firstErr;
          console.warn("[coach] first attempt failed, retrying", firstErr);
          await new Promise((r) => setTimeout(r, 1500));
          res = await askCoach({ data: { question: query, ...payload } });
        }
        push("assistant", res.answer || t("ai.noResponse"));
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
          // DEBUG (temporaire, pré-lancement) : la cause de l'échec est visible
          // dans la réponse pour identifier le blocage sur la preview.
          const reason =
            e instanceof Error
              ? e.message
              : typeof e === "string"
                ? e
                : (JSON.stringify(e) ?? "[erreur]");
          push(
            "assistant",
            `${fallbackCoachAnswer(fallbackPayload)}\n\n> ⚠️ debug IA : ${reason.slice(0, 300)}`,
          );
        } catch {
          push("error", t("ai.genericError"));
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, loaded, context.trades, context.profile, lang, t, onboarding, rules],
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-5">
        {!loaded ? (
          <div className="text-sm text-slate-500">{t("assistant.empty")}</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-slate-500 leading-relaxed">{t("assistant.empty")}</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role !== "user" && (
                <div className="relative shrink-0 mb-1">
                  <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
                  <div className="relative grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user" &&
                    "bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium",
                  m.role === "assistant" &&
                    "bg-white/[0.04] border border-white/[0.08] text-slate-200",
                  m.role === "error" && "bg-red-500/10 border border-red-500/20 text-red-300",
                )}
              >
                {m.role === "assistant" ? <BlockList blocks={m.blocks} /> : textOf(m) || ""}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="relative shrink-0 mb-1">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5">
              <span className="thinking-dot" />
              <span className="thinking-dot" style={{ animationDelay: "0.15s" }} />
              <span className="thinking-dot" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Saisie */}
      <div className="p-3 md:p-4 border-t border-white/[0.06] shrink-0">
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
