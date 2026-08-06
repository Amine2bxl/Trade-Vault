import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, Target, Shield, TrendingUp, Activity } from "lucide-react";
import { cn } from "../utils/cn";

function JarvisAvatar() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes ring-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ring-rotate-reverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes arc-dash {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -157; }
        }
        .animate-breathe { animation: breathe 3s ease-in-out infinite; }
        .animate-ring-rotate { animation: ring-rotate 12s linear infinite; }
        .animate-ring-rotate-reverse { animation: ring-rotate-reverse 9s linear infinite; }
        .animate-dot-pulse { animation: dot-pulse 1.8s ease-in-out infinite; }
        .animate-ring-fast { animation: ring-rotate 6s linear infinite; }
        .animate-arc-dash { animation: arc-dash 2.5s linear infinite; }
      `}</style>

      {/* Outer ambient glow */}
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(6,182,212,0.5) 0%, rgba(16,185,129,0.3) 40%, transparent 70%)",
        }}
      />

      {/* Outer dashed ring — slow rotate */}
      <div
        className="animate-ring-rotate absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.15) 90deg, transparent 180deg, rgba(6,182,212,0.15) 270deg, transparent 360deg)",
          mask: "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
          WebkitMask:
            "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
        }}
      />

      {/* Middle ring — reverse rotate */}
      <div
        className="animate-ring-rotate-reverse absolute inset-[12px] rounded-full"
        style={{
          mask: "radial-gradient(circle, transparent 70%, black 71%, black 73%, transparent 74%)",
          WebkitMask:
            "radial-gradient(circle, transparent 70%, black 71%, black 73%, transparent 74%)",
          background:
            "conic-gradient(from 180deg, transparent 0deg, rgba(16,185,129,0.2) 60deg, transparent 120deg, rgba(16,185,129,0.2) 240deg, transparent 300deg, rgba(16,185,129,0.2) 360deg)",
        }}
      />

      {/* Inner fast ring */}
      <div
        className="animate-ring-fast absolute inset-[22px] rounded-full"
        style={{
          border: "1px dashed rgba(6,182,212,0.25)",
          borderWidth: "0 1px 0 0",
        }}
      />

      {/* SVG amber accent arcs */}
      <svg
        className="animate-ring-rotate-reverse absolute inset-0"
        viewBox="0 0 240 240"
        style={{ position: "absolute", width: 240, height: 240 }}
      >
        <defs>
          <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* Top-right arc */}
        <path
          d="M 170 30 A 85 85 0 0 1 210 120"
          fill="none"
          stroke="url(#amberGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="60 120"
          className="animate-arc-dash"
          style={{ strokeDashoffset: 0 }}
        />
        {/* Bottom-left arc */}
        <path
          d="M 55 190 A 85 85 0 0 1 30 100"
          fill="none"
          stroke="url(#amberGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="40 140"
          className="animate-arc-dash"
          style={{ strokeDashoffset: -40 }}
        />
      </svg>

      {/* Particle core — concentrated cyan/emerald dots via radial gradient + box shadows */}
      <div
        className="animate-breathe absolute rounded-full"
        style={{
          width: 100,
          height: 100,
          background:
            "radial-gradient(circle at 30% 30%, rgba(6,182,212,1) 0%, rgba(6,182,212,0.7) 8%, rgba(16,185,129,0.5) 20%, rgba(16,185,129,0.15) 45%, transparent 70%)",
          boxShadow: `
            0 0 20px 4px rgba(6,182,212,0.5),
            0 0 60px 12px rgba(6,182,212,0.25),
            0 0 100px 20px rgba(16,185,129,0.15),
            inset 0 0 20px 4px rgba(6,182,212,0.3)
          `,
        }}
      />

      {/* Inner bright point */}
      <div
        className="absolute rounded-full"
        style={{
          width: 18,
          height: 18,
          background:
            "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(6,182,212,0.9) 30%, transparent 70%)",
          boxShadow: "0 0 16px 6px rgba(6,182,212,0.9), 0 0 40px 12px rgba(6,182,212,0.4)",
          opacity: 0.9,
        }}
      />

      {/* Orbiting dot particles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        const distance = 55 + (i % 3) * 10;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * distance;
        const y = Math.sin(rad) * distance;
        const delay = i * 0.12;
        return (
          <div
            key={i}
            className="animate-dot-pulse absolute rounded-full"
            style={{
              width: 3 + (i % 2),
              height: 3 + (i % 2),
              background: "radial-gradient(circle, rgba(6,182,212,0.9), rgba(16,185,129,0.4))",
              boxShadow: "0 0 6px 2px rgba(6,182,212,0.5)",
              transform: `translate(${x}px, ${y}px)`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function getTradingSession(): { label: string; active: boolean; color: string } {
  const now = new Date();
  const hours = now.getUTCHours();
  if (hours >= 0 && hours < 8) return { label: "ASIAN", active: true, color: "#f59e0b" };
  if (hours >= 8 && hours < 16) return { label: "LONDON", active: true, color: "#06b6d4" };
  return { label: "NEW YORK", active: true, color: "#3b82f6" };
}

function StatusBar() {
  const session = getTradingSession();
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.15em] text-emerald-400 uppercase">
          SYSTEM ONLINE
        </span>
      </div>
      <span className="text-slate-700 select-none">|</span>
      <span
        className="text-[11px] font-medium tracking-widest uppercase"
        style={{ color: session.color }}
      >
        {session.label}
      </span>
    </div>
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function MetricsCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-4 py-3">
      <div className="flex-shrink-0 rounded-lg p-1.5" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          {label}
        </span>
        <span className="text-sm font-bold text-white">{value}</span>
        {subtitle && <span className="text-[10px] text-slate-500">{subtitle}</span>}
      </div>
    </div>
  );
}

function MetricsRow() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <MetricsCard
        icon={Target}
        label="Win Rate"
        value="64%"
        color="#06b6d4"
        subtitle="+2.1% ce mois"
      />
      <MetricsCard
        icon={TrendingUp}
        label="Sentiment"
        value="Bullish"
        color="#10b981"
        subtitle="S&P 500 & DXY"
      />
      <MetricsCard
        icon={Shield}
        label="Risque"
        value="Faible"
        color="#f59e0b"
        subtitle="Expo 1.2%"
      />
    </div>
  );
}

const QUICK_ACTIONS = [
  { icon: Activity, label: "Analyser mon portfolio" },
  { icon: Sparkles, label: "Signaux du marché" },
  { icon: Shield, label: "Gestion du risque" },
  { icon: Target, label: "Backtest rapide" },
];

export default function Jarvis() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isProcessing) return;
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsProcessing(true);

      setTimeout(
        () => {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: getAssistantResponse(content),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
        },
        800 + Math.random() * 700,
      );
    },
    [input, isProcessing],
  );

  const handleQuickAction = useCallback(
    (label: string) => {
      handleSend(label);
    },
    [handleSend],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="h-full flex flex-col lg:flex-row bg-[#060d16]">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Left Panel — Avatar + Status + Metrics */}
      <div className="relative flex-shrink-0 flex flex-col items-center justify-center gap-6 px-8 py-10 lg:w-[400px] lg:border-r lg:border-white/[0.05]">
        {/* Status bar */}
        <div className="absolute top-6 left-6 right-6">
          <StatusBar />
        </div>

        {/* Avatar */}
        <div className="mt-4">
          <JarvisAvatar />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">JARVIS</h1>
          <p className="text-xs text-slate-500 tracking-widest uppercase mt-1">
            AI Trading Copilot
          </p>
        </div>

        {/* Quick actions */}
        <div className="w-full max-w-xs flex flex-wrap gap-2 justify-center">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.label)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium",
                "border border-white/[0.06] bg-white/[0.02] text-slate-300",
                "hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-300",
                "transition-all cursor-pointer",
              )}
            >
              <action.icon className="w-3 h-3" />
              {action.label}
            </button>
          ))}
        </div>

        {/* Metrics on desktop (hidden on mobile, shown in chat header instead) */}
        <div className="hidden lg:block w-full max-w-xs">
          <MetricsRow />
        </div>
      </div>

      {/* Right Panel — Chat */}
      <div className="relative flex flex-col flex-1 min-h-0">
        {/* Mobile metrics + header */}
        <div className="lg:hidden border-b border-white/[0.05] px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <StatusBar />
          </div>
          <MetricsRow />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-60">
              <Bot className="w-10 h-10 text-cyan-500/40" />
              <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                Votre assistant de trading IA est prêt. <br />
                Posez une question ou choisissez une action rapide.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mr-2 mt-1">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-br-md"
                      : "bg-white/[0.04] border border-white/[0.06] text-slate-200 rounded-bl-md",
                    msg.role === "assistant" && "shadow-[0_0_20px_-4px_rgba(6,182,212,0.1)]",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <span
                    className={cn(
                      "block text-[10px] mt-1.5 opacity-50",
                      msg.role === "user" ? "text-right text-white/70" : "text-slate-500",
                    )}
                  >
                    {msg.role === "user" ? "Vous" : "Jarvis"}
                  </span>
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 ml-2 mt-1">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">V</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="flex-shrink-0 mr-2 mt-1">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-cyan-400"
                      style={{
                        opacity: 0.3,
                        animation: `dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-white/[0.05] p-4">
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-2 focus-within:border-cyan-500/40 focus-within:bg-white/[0.04] transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Demandez quelque chose à Jarvis..."
              disabled={isProcessing}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none disabled:opacity-40"
            />
            <button
              onClick={() => handleSend()}
              disabled={isProcessing || !input.trim()}
              className={cn(
                "flex-shrink-0 p-2 rounded-xl transition-all cursor-pointer",
                input.trim() && !isProcessing
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105"
                  : "bg-white/[0.04] text-slate-600",
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function getAssistantResponse(userInput: string): string {
  const lower = userInput.toLowerCase();

  if (lower.includes("portfolio")) {
    return `**Analyse du Portfolio**\n\n📊 Votre portfolio montre une exposition diversifiée avec 7 positions ouvertes.\n\n• **NZD/JPY** : +2.4% — tendance haussière intacte\n• **XAU/USD** : -0.8% — consolidation, tenir\n• **EUR/USD** : +1.1% — breakout confirmé\n\n💡 La corrélation globale est bien équilibrée. Je vous suggère de surveiller le NZD/JPY qui approche de son objectif.`;
  }

  if (lower.includes("signal") || lower.includes("marché")) {
    return `**Signaux du Marché**\n\n🔍 Scan multi-timeframe terminé :\n\n• **S&P 500** : Signal haussier (H4) — momentum positif\n• **DXY** : Zone de résistance clé à 105.50\n• **Or** : Configuration bullish flag sur H1\n\n⚡ Signal principal : **BUY XAU/USD** — entrée 2485, SL 2470, TP 2510.\n\nConfiance : 72% basée sur confluence MAs + structure.`;
  }

  if (lower.includes("risque") || lower.includes("gestion")) {
    return `**Gestion du Risque**\n\n🛡️ Votre profil actuel :\n\n• Exposition totale : **4.2%** du capital (max recommandé 5%)\n• Risque par trade moyen : **0.8%**\n• Ratio Sharpe (30j) : **1.42**\n\n✅ Tous les indicateurs sont dans le vert. Votre discipline de risk management est excellente. Continuez à respecter la règle du 1% par position.`;
  }

  if (lower.includes("backtest")) {
    return `**Backtest Rapide**\n\n📈 La stratégie "EMA Cross + RSI filter" que vous avez testée :\n\n• Période : 6 mois (Jan-Juin 2025)\n• Trades : 47\n• Win rate : 61.7%\n• Profit factor : 1.83\n• Drawdown max : -8.4%\n\n⚡ Résultat : Stratégie rentable avec une bonne constance. Le filtre RSI améliore la performance de 22% par rapport à l'EMA cross simple.`;
  }

  return `Je comprends votre question. En tant qu'assistant de trading IA, je peux vous aider avec l'analyse de marché, l'évaluation des risques, l'optimisation de stratégie et bien plus.\n\nQue souhaitez-vous explorer ?`;
}
