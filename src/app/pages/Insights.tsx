import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Trade } from "../types";
import { askCoach } from "@/backend/coach.functions";
import { buildCoachV1Payload } from "../utils/aiContext";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import MarkdownAnswer from "../components/MarkdownAnswer";

interface InsightsProps {
  trades: Trade[];
}

export default function Insights({ trades }: InsightsProps) {
  const { t, lang } = useT();
  const { user } = useAuth();
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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const payload = buildCoachV1Payload({ trades, language: lang });
      const res = await askCoach({ data: { question: query, ...payload } });
      setAnswer(res.answer || t("ai.noResponse"));
    } catch (e: any) {
      setError(e?.message || t("ai.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-glow">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("insights.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500">{t("insights.subtitle")}</p>
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-4 md:p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-white block mb-2">
            {t("insights.askLabel")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask(question);
              }}
              placeholder={t("insights.placeholder")}
              disabled={loading}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={() => ask(question)}
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden md:inline">{t("insights.analyze")}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setQuestion(p.q);
                ask(p.q);
              }}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs md:text-sm text-slate-300 hover:bg-white/[0.08] hover:border-cyan-500/30 hover:text-white transition-all disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "rounded-xl border p-4 min-h-[140px] text-sm",
            error
              ? "border-red-500/20 bg-red-500/5 text-red-300"
              : answer
                ? "border-white/[0.08] bg-white/[0.02] text-slate-200"
                : "border-white/[0.06] bg-white/[0.02] text-slate-500",
          )}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("insights.analyzing")}
            </div>
          ) : error ? (
            error
          ) : answer ? (
            <MarkdownAnswer content={answer} />
          ) : (
            t("insights.empty")
          )}
        </div>

        {trades.length === 0 && !loading && !answer && (
          <p className="text-[11px] text-slate-600">{t("insights.tip")}</p>
        )}
      </div>
    </div>
  );
}
