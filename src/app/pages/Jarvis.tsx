import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Send,
  Loader2,
  Volume2,
  VolumeX,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Eraser,
  Radio,
  Wallet,
  Target,
  Gauge,
  Flame,
} from "lucide-react";
import { Trade } from "../types";
import { askCoach } from "@/backend/coach.functions";
import { buildCoachV1Payload } from "../utils/aiContext";
import { computeStats, formatPnl, formatPct } from "../utils/tradeCalcs";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { loadOnboarding, type OnboardingData } from "../store";
import { nsKey, readJSON, writeJSON, removeKey } from "../utils/persistence";
import { useJarvisVoice } from "../utils/jarvisVoice";
import { PageHeader, Metric, Card } from "@/shared/ui";
import MarkdownAnswer from "../components/MarkdownAnswer";

interface JarvisProps {
  trades: Trade[];
}

interface ChatMessage {
  role: "user" | "assistant" | "error";
  text: string;
}

/**
 * Jarvis — the coaching center. The single AI's home page: a live daily
 * briefing (deterministic, zero AI cost), the strengths/weaknesses Jarvis reads
 * from the data, quick actions, and a persistent grounded conversation with an
 * optional English voice. Every AI call is the same `askCoach` used by the
 * floating panel, so the identity, persona and grounding never diverge.
 */
export default function Jarvis({ trades }: JarvisProps) {
  const { t, lang } = useT();
  const { user } = useAuth();

  const chatKey = nsKey(user?.id, "jarvis.chat");
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    readJSON<ChatMessage[]>(chatKey, []),
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { speak, stop, speaking } = useJarvisVoice();

  // Onboarding rides with every call so the coaching names THIS trader.
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    loadOnboarding(user.id)
      .then((o) => active && setOnboarding(o))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Reload the stored conversation when the signed-in user changes.
  useEffect(() => {
    setMessages(readJSON<ChatMessage[]>(chatKey, []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => {
    writeJSON(chatKey, messages);
  }, [chatKey, messages]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const stats = useMemo(() => computeStats(trades), [trades]);

  /* Deterministic read of the trader's edge — no AI cost, always available.
     `priority` carries a structured kind so the display is localized while the
     spoken brief stays English (the product's one voice speaks English only). */
  const briefing = useMemo(() => {
    if (trades.length === 0) {
      return {
        priority: { kind: "log" as const },
        strengths: [] as string[],
        weakness: null as null | { name: string; totalPnl: number; count: number },
      };
    }
    // Strengths: best weekday, profit factor, win rate — grounded facts.
    const strengths: string[] = [];
    const days = Object.entries(stats.pnlByDayOfWeek);
    if (days.length) {
      const [bestDow] = days.sort((a, b) => b[1].pnl - a[1].pnl)[0];
      const dayName = new Date(2024, 0, 7 + Number(bestDow)).toLocaleDateString(lang, {
        weekday: "long",
      });
      strengths.push(t("jarvis.bestDay").replace("{day}", dayName));
    }
    if (stats.profitFactor >= 1) {
      strengths.push(t("jarvis.profitFactor").replace("{value}", stats.profitFactor.toFixed(2)));
    }

    // Weakness / priority: the recurring mistake that bleeds the most money.
    const worst = Object.entries(stats.mistakeStats)
      .map(([name, v]) => ({ name, ...v }))
      .filter((m) => m.totalPnl < 0)
      .sort((a, b) => a.totalPnl - b.totalPnl)[0];

    const priority = worst
      ? {
          kind: "fix" as const,
          mistake: worst.name,
          amount: Math.abs(worst.totalPnl),
          count: worst.count,
        }
      : { kind: "keep" as const };

    return { priority, strengths, weakness: worst ?? null };
  }, [trades.length, stats, lang, t]);

  /** Localized priority sentence for the card. */
  const priorityText = useMemo(() => {
    const p = briefing.priority;
    if (p.kind === "log") return t("jarvis.priorityLogTrades");
    if (p.kind === "keep") return t("jarvis.priorityKeepDiscipline");
    return t("jarvis.priorityFixMistake")
      .replace("{mistake}", p.mistake)
      .replace("{amount}", formatPnl(-p.amount))
      .replace("{count}", String(p.count));
  }, [briefing.priority, t]);

  /** English briefing line — the voice speaks English regardless of UI locale. */
  const englishBrief = useMemo(() => {
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const p = briefing.priority;
    let line: string;
    if (p.kind === "log") {
      line = "Log your trades and I will read your edge from the data.";
    } else if (p.kind === "keep") {
      line = "No recurring leak. Protect the streak — run the same process today.";
    } else {
      line = `Your priority: cut ${p.mistake}. It cost you around ${Math.round(
        p.amount,
      )} dollars across ${p.count} trades.`;
    }
    return `${greet}. ${line}`;
  }, [briefing.priority]);

  const toggleVoice = useCallback(() => {
    setVoiceOn((v) => {
      if (v) stop();
      return !v;
    });
  }, [stop]);

  const briefMe = useCallback(() => {
    setVoiceOn(true);
    void speak(englishBrief);
  }, [englishBrief, speak]);

  const QUICK_PROMPTS = [
    {
      label: t("insights.quick.winLoss"),
      q: "Analyze my win/loss patterns. What separates my winning trades from my losing ones?",
    },
    {
      label: t("insights.quick.days"),
      q: "Which days of the week are my best and worst performing? Why?",
    },
    {
      label: t("insights.quick.symbols"),
      q: "Break down my performance by symbol. Which should I focus on or avoid?",
    },
    {
      label: t("insights.quick.improvements"),
      q: "What are my biggest weaknesses and the top 3 concrete improvements I should make?",
    },
  ];

  const ask = useCallback(
    async (q: string) => {
      const query = q.trim();
      if (!query || loading) return;
      const priorTurns = messages
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
      setMessages((prev) => [...prev, { role: "user", text: query }]);
      setQuestion("");
      setLoading(true);
      const payload = buildCoachV1Payload({
        trades,
        conversation: priorTurns,
        language: lang,
        onboarding,
      });
      try {
        let res;
        try {
          res = await askCoach({ data: { question: query, ...payload } });
        } catch (firstErr) {
          // One silent retry — most failures are transient (cold function, blip).
          console.warn("[jarvis] first attempt failed, retrying", firstErr);
          await new Promise((r) => setTimeout(r, 1500));
          res = await askCoach({ data: { question: query, ...payload } });
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: res.answer || t("ai.noResponse") },
        ]);
      } catch (e) {
        // Never surface raw provider/rate-limit text — one calm message.
        console.error("[jarvis] request failed after retry", e);
        setMessages((prev) => [...prev, { role: "error", text: t("ai.genericError") }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, trades, lang, onboarding, t],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    removeKey(chatKey);
  }, [chatKey]);

  return (
    <div className="p-4 md:p-5 max-w-4xl mx-auto">
      <PageHeader
        icon={
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Bot className="w-5 h-5 text-white" />
          </span>
        }
        title={t("insights.title")}
        subtitle={t("insights.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVoice}
              aria-pressed={voiceOn}
              title={voiceOn ? t("jarvis.voiceOff") : t("jarvis.voiceOn")}
              className={cn(
                "flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-all",
                voiceOn
                  ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white",
              )}
            >
              {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {voiceOn ? t("jarvis.voiceOn") : t("jarvis.voiceOff")}
              </span>
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title={t("jarvis.newChat")}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <Eraser className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      />

      {/* Today's briefing — the reason to open Jarvis every day. */}
      <div className="relative overflow-hidden rounded-2xl p-4 md:p-5 mb-4 border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.07] via-white/[0.02] to-transparent">
        <div className="pointer-events-none absolute -top-16 -right-10 w-52 h-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-start gap-3.5">
          <div className="relative shrink-0">
            <span
              className={cn(
                "absolute -inset-1 rounded-2xl bg-cyan-500/30 blur-md",
                speaking ? "animate-pulse opacity-100" : "opacity-60",
              )}
            />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-400/80 font-bold">
                {t("jarvis.briefTitle")}
              </span>
              {speaking && (
                <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold">
                  <Radio className="w-3 h-3 animate-pulse" /> {t("jarvis.speaking")}
                </span>
              )}
            </div>
            <p className="text-[15px] text-slate-100 leading-relaxed">
              <span className="text-cyan-300/80 font-semibold">{t("jarvis.priority")}: </span>
              {priorityText}
            </p>
          </div>
          <button
            onClick={briefMe}
            className="shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-teal-400 hover:scale-[1.03] active:scale-95 transition-all"
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t("jarvis.brief")}</span>
          </button>
        </div>
      </div>

      {/* Live KPI strip — the numbers Jarvis coaches from, at a glance. */}
      {trades.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Metric
            title={t("stats.totalPnl")}
            value={formatPnl(stats.totalPnl)}
            trend={stats.totalPnl >= 0 ? "up" : "down"}
            icon={<Wallet className="w-4 h-4" />}
          />
          <Metric
            title={t("stats.winRate")}
            value={formatPct(stats.winRate)}
            icon={<Target className="w-4 h-4" />}
          />
          <Metric
            title={t("jarvis.pf")}
            value={stats.profitFactor.toFixed(2)}
            trend={stats.profitFactor >= 1 ? "up" : "down"}
            icon={<Gauge className="w-4 h-4" />}
          />
          <Metric
            title={t("jarvis.streak")}
            value={String(stats.currentStreak)}
            subtitle={
              stats.currentStreakType === "win"
                ? t("common.win")
                : stats.currentStreakType === "loss"
                  ? t("common.loss")
                  : undefined
            }
            trend={
              stats.currentStreakType === "win"
                ? "up"
                : stats.currentStreakType === "loss"
                  ? "down"
                  : "neutral"
            }
            icon={<Flame className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Strengths / Watch-out — deterministic read of the edge. */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">{t("jarvis.strengths")}</h3>
          </div>
          {briefing.strengths.length ? (
            <ul className="space-y-1.5">
              {briefing.strengths.map((s) => (
                <li key={s} className="text-[13px] text-slate-300 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-500">{t("jarvis.strengthNone")}</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">{t("jarvis.weaknesses")}</h3>
          </div>
          {briefing.weakness ? (
            <p className="text-[13px] text-slate-300">
              <span className="font-semibold text-amber-300">{briefing.weakness.name}</span>{" "}
              <span className="text-slate-500">
                · {formatPnl(briefing.weakness.totalPnl)} · {briefing.weakness.count}×
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-slate-500">{t("jarvis.weaknessNone")}</p>
          )}
        </Card>
      </div>

      {/* Conversation */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{t("jarvis.conversation")}</h3>
        </div>

        <div ref={scrollRef} className="max-h-[46vh] overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-slate-500 leading-relaxed">
              {trades.length === 0 ? t("jarvis.noData") : t("insights.empty")}
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user" &&
                    "bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium",
                  m.role === "assistant" &&
                    "bg-white/[0.04] border border-white/[0.08] text-slate-200 w-full max-w-full",
                  m.role === "error" && "bg-red-500/10 border border-red-500/20 text-red-300",
                )}
              >
                {m.role === "assistant" ? <MarkdownAnswer content={m.text} /> : m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("insights.analyzing")}
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => ask(p.q)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 hover:bg-white/[0.08] hover:border-cyan-500/30 hover:text-white transition-all disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/[0.06] flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(question);
            }}
            placeholder={t("insights.placeholder")}
            disabled={loading}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            aria-label={t("insights.analyze")}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white shrink-0 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
