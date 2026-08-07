import { Sparkles, Bot, Send, TrendingUp, Zap, MessageSquare, Shield } from "lucide-react";

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes jarvis-float {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0;}
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
        }
        .j-particle { position: absolute; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #22d3ee, #06b6d4); box-shadow: 0 0 4px 0.5px rgba(34,211,238,0.5); }
      `}</style>
      {Array.from({ length: 30 }).map((_, i) => {
        const left = (i * 37 + 11) % 100;
        const duration = 8 + (i % 5) * 2;
        const delay = (i * 0.7) % duration;
        const size = 1 + (i % 3) * 0.5;
        return (
          <div
            key={i}
            className="j-particle"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${-5 + ((i * 17 + 7) % 100)}%`,
              animation: `jarvis-float ${duration}s ${delay}s linear infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

const PRIORITIES = [
  {
    icon: Shield,
    label: "Discipline",
    desc: "Aucune alerte aujourd'hui",
    color: "text-emerald-400",
  },
  {
    icon: TrendingUp,
    label: "Performance",
    desc: "Win rate : 64% ce mois",
    color: "text-cyan-400",
  },
  { icon: Zap, label: "Edge", desc: "FVG London : +4.2R ce mois", color: "text-amber-400" },
];

export default function Jarvis() {
  return (
    <div className="relative h-full flex flex-col bg-[#060d16] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(6,182,212,.06), transparent 60%), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(16,185,129,.04), transparent 60%)",
        }}
      />
      <ParticleField />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Core visual */}
        <div className="mb-10 relative">
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-20"
            style={{
              background:
                "radial-gradient(circle, rgba(6,182,212,0.5) 0%, rgba(16,185,129,0.3) 40%, transparent 70%)",
            }}
          />
          <div
            className="relative w-36 h-36 rounded-full flex items-center justify-center"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(6,182,212,0.12), transparent 70%)",
              boxShadow:
                "0 0 50px 12px rgba(6,182,212,0.1), 0 0 120px 24px rgba(16,185,129,0.06), inset 0 0 30px 4px rgba(6,182,212,0.06)",
            }}
          >
            {/* Rotating ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "1px solid rgba(6,182,212,0.12)",
                animation: "jarvis-ring 14s linear infinite",
              }}
            />
            <div
              className="absolute inset-2 rounded-full"
              style={{
                border: "1px dashed rgba(16,185,129,0.15)",
                animation: "jarvis-ring-rev 10s linear infinite",
              }}
            />
            <Bot className="w-14 h-14 text-cyan-400 drop-shadow-[0_0_24px_rgba(6,182,212,0.4)]" />
          </div>
        </div>

        <style>{`
          @keyframes jarvis-ring { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes jarvis-ring-rev { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
        `}</style>

        <h1
          className="text-[2.7rem] sm:text-6xl font-extrabold tracking-tight"
          style={{
            background:
              "linear-gradient(135deg, #22d3ee 0%, #14b8a6 40%, #67e8f9 70%, #06b6d4 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animation: "shimmer 3s linear infinite",
          }}
        >
          J.A.R.V.I.S.
        </h1>
        <style>{`@keyframes shimmer { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }`}</style>

        <p className="mt-3 text-base text-slate-400 max-w-md tracking-wide">
          Ton assistant de trading personnel — analyses, discipline, mémoire.
        </p>

        {/* Priorities row */}
        <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-md">
          {PRIORITIES.map(({ icon: Icon, label, desc, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-3"
            >
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-[11px] font-bold text-white">{label}</span>
              <span className="text-[9px] text-slate-500 leading-tight text-center">{desc}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("tv:open-jarvis"))}
          className="mt-8 inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #06b6d4, #10b981)",
            boxShadow: "0 0 40px 6px rgba(6,182,212,0.2)",
          }}
        >
          <Send className="w-5 h-5" />
          Ouvrir le coach
          <MessageSquare className="w-5 h-5" />
        </button>

        <p className="mt-5 text-[11px] text-slate-600 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          SYSTEM ONLINE
        </p>
      </div>
    </div>
  );
}
