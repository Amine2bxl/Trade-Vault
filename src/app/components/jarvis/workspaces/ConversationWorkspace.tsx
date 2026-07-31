import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Send, Loader2, Mic, MicOff } from "lucide-react";
import { askCoach } from "@/backend/coach.functions";
import { buildCoachV1Payload, seedProfileMemory } from "../../../utils/aiContext";
import { useTradingRules } from "../../../hooks/useTradingRules";
import { cn } from "../../../utils/cn";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { nsKey, readJSON, writeJSON, removeKey } from "../../../utils/persistence";
import { loadOnboarding, type OnboardingData } from "../../../store";
import { BlockList } from "../BlockRenderer";
import type { JarvisMessage } from "../blocks";
import type { JarvisWorkspaceProps } from "../workspaces";

/**
 * ConversationWorkspace — le module CHAT de Jarvis (Phase 0, verrouillage).
 *
 * Jarvis est une plateforme ; le chat n'est qu'UN workspace parmi d'autres.
 * Ce module est autonome (état, persistance, voix, appel `askCoach`) et ne
 * reçoit du Shell que le contexte agrégé + le prompt initial éventuel.
 *
 * Règle : aucun contenu IA n'est rendu directement — tout passe par
 * `BlockList`/`BlockRenderer` (markdown aujourd'hui, blocs riches à venir).
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

/** Migre un chat enregistré avant le modèle à blocs ({role,text}) vers JarvisMessage. */
function normalizeMessages(raw: unknown): JarvisMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m, i) => {
    const r = m as Partial<JarvisMessage> & { text?: string };
    if (r.blocks && Array.isArray(r.blocks) && r.blocks.length > 0) {
      return r as JarvisMessage;
    }
    return {
      role: (r.role as JarvisMessage["role"]) ?? "assistant",
      id: genId() + `-${i}`,
      blocks: [{ type: "markdown", content: typeof r.text === "string" ? r.text : "" }],
      createdAt: new Date().toISOString(),
    };
  });
}

function textOf(m: JarvisMessage): string {
  const md = m.blocks.find((b) => b.type === "markdown");
  return md && md.type === "markdown" ? md.content : "";
}

const seededUsers = new Set<string>();

export default function ConversationWorkspace({ context, initialPrompt }: JarvisWorkspaceProps) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const rules = useTradingRules();
  const userId = user?.id ?? context.userId;
  const chatKey = nsKey(userId, "ai.chat");
  const inputKey = nsKey(userId, "ai.input");

  const [messages, setMessages] = useState<JarvisMessage[]>(() =>
    normalizeMessages(readJSON<unknown>(chatKey, [])),
  );
  const [question, setQuestion] = useState(() => readJSON<string>(inputKey, ""));
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const SpeechRecognitionCtor = getSpeechRecognition();

  // Reload the stored conversation when the signed-in user changes.
  useEffect(() => {
    setMessages(normalizeMessages(readJSON<unknown>(chatKey, [])));
    setQuestion(readJSON<string>(inputKey, ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Persist conversation + draft input on every change.
  useEffect(() => {
    writeJSON(chatKey, messages);
  }, [chatKey, messages]);
  useEffect(() => {
    writeJSON(inputKey, question);
  }, [inputKey, question]);

  const clearChat = useCallback(() => {
    setMessages([]);
    removeKey(chatKey);
  }, [chatKey]);

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

  // The onboarding answers travel with every coach call.
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
      if (!query || loading) return;
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
        language: lang,
        onboarding,
        jarvisProfile: context.profile,
        rules,
      });
      try {
        let res;
        try {
          res = await askCoach({ data: { question: query, ...payload } });
        } catch (firstErr) {
          // One automatic retry after a short backoff — most coach failures are
          // transient (cold serverless function, network blip, brief 5xx).
          console.warn("[coach] first attempt failed, retrying", firstErr);
          await new Promise((r) => setTimeout(r, 1500));
          res = await askCoach({ data: { question: query, ...payload } });
        }
        push("assistant", res.answer || t("ai.noResponse"));
      } catch (e) {
        // Never surface raw provider/rate-limit text — one calm message.
        console.error("[coach] request failed after retry", e);
        push("error", t("ai.genericError"));
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, context.trades, context.profile, lang, t, onboarding, rules],
  );

  // A page (Checklist, Missed…) opened Jarvis with a ready-made prompt.
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialPrompt && askedRef.current !== initialPrompt) {
      askedRef.current = initialPrompt;
      void ask(initialPrompt);
    }
  }, [initialPrompt, ask]);

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
      {/* Toolbar du workspace (actions propres à la conversation) */}
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 leading-relaxed">{t("assistant.empty")}</div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" &&
                  "bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium",
                m.role === "assistant" &&
                  "bg-white/[0.04] border border-white/[0.08] text-slate-200",
                m.role === "error" && "bg-red-500/10 border border-red-500/20 text-red-300",
              )}
            >
              {m.role === "assistant" ? (
                <BlockList blocks={m.blocks} />
              ) : (
                textOf(m) || m.blocks.map((b) => (b.type === "markdown" ? b.content : "")).join(" ")
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("assistant.thinking")}
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
