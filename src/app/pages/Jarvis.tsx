import { Bot, Send, TrendingUp, Shield, Zap, MessageSquare } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useTrades } from "../hooks/useTrades";
import { useTradeStats } from "../hooks/useTradeStats";
import { useEdgeScore } from "../hooks/useEdgeScore";
import { PageContainer } from "@/shared/ui";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { cn } from "../utils/cn";

// Jarvis est la page de synthèse du coach : PAS un décor. Chaque chiffre vient
// des trades réels du compte actif — zéro valeur codée en dur. Le vrai dialogue
// s'ouvre via le CTA (AiAssistant), cette page donne le contexte que le coach
// a déjà en tête avant même qu'on lui parle.

export default function Jarvis() {
  const { user } = useAuth();
  const { activeId, ready: accountsReady } = useAccounts();
  const { trades, tradesLoading } = useTrades(user?.id, activeId, accountsReady);
  const stats = useTradeStats(trades);
  const edge = useEdgeScore(trades, user?.id);

  const cards = [
    {
      icon: TrendingUp,
      label: "P&L total",
      value: formatPnl(stats.totalPnl),
      tone: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
      sub: `${stats.totalTrades} trades`,
    },
    {
      icon: Zap,
      label: "Win rate",
      value: stats.totalTrades > 0 ? formatPct(stats.winRate) : "—",
      tone: "text-cyan-300",
      sub: `${stats.wins}W · ${stats.losses}L`,
    },
    {
      icon: Shield,
      label: "Profit factor",
      value: stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "—",
      tone: stats.profitFactor >= 1 ? "text-emerald-400" : "text-amber-400",
      sub: "≥ 1.0 = rentable",
    },
    {
      icon: Bot,
      label: "Edge score",
      value: edge.score !== null ? `${edge.score}/100` : "—",
      tone: "text-cyan-300",
      sub: "discipline + risque",
    },
  ];

  return (
    <PageContainer>
      {/* ── En-tête : Jarvis, avec son état dérivé des données ── */}
      <div className="flex items-center gap-3 mb-4 md:mb-5">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
          <Bot className="h-5 w-5 text-white" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">Jarvis</h1>
          <p className="text-[11px] text-slate-500">
            Ton coach lit les mêmes données que toi — et il te les résume ici.
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          ONLINE
        </span>
      </div>

      {/* ── Les quatre chiffres que Jarvis surveille ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
        {cards.map(({ icon: Icon, label, value, tone, sub }) => (
          <div key={label} className="stat-card card-premium p-3.5 md:p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                {label}
              </span>
            </div>
            <div
              className={cn("font-display text-lg md:text-xl font-extrabold tabular-nums", tone)}
            >
              {value}
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Verdict du coach, en une phrase honnête ── */}
      <div className="glass-strong rounded-3xl p-5 md:p-6 mb-4 md:mb-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
            <Shield className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white mb-1">Ce que Jarvis voit</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              {tradesLoading
                ? "Lecture de ton journal…"
                : stats.totalTrades === 0
                  ? "Aucun trade pour l'instant — ajoute ton premier trade et Jarvis pourra te coacher."
                  : stats.profitFactor >= 1.2 && edge.score !== null && edge.score >= 60
                    ? "Ta discipline et ton edge tiennent la route. Jarvis peut maintenant t'aider à passer à l'échelle sans casser ce qui marche."
                    : stats.totalPnl >= 0
                      ? "Tu es en positif, mais la marge est fine. Parle à Jarvis pour solidifier ton process avant que la variance ne parle."
                      : "Le compte recule. C'est exactement le moment d'ouvrir le coach : un œil extérieur sur ton journal vaut mieux qu'un trade de plus pour « se refaire »."}
            </p>
          </div>
        </div>
      </div>

      {/* ── CTA : ouvrir le vrai coach ── */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("tv:open-jarvis"))}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
        style={{
          background: "linear-gradient(135deg, #06b6d4, #10b981)",
          boxShadow: "0 0 32px 4px rgba(6,182,212,0.18)",
        }}
      >
        <MessageSquare className="w-4 h-4" />
        Ouvrir le coach
        <Send className="w-4 h-4" />
      </button>
    </PageContainer>
  );
}
