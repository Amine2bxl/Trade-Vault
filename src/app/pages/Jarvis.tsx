import { Sparkles, Bot, Send, ArrowRight, TrendingUp, Zap } from "lucide-react";

const STATS = [
  { icon: TrendingUp, value: "12,847", label: "Trades analysés" },
  { icon: Zap, value: "3,421", label: "Insights délivrés" },
  { icon: Sparkles, value: "87%", label: "Temps économisé" },
];

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.15; }
          25% { transform: translate(15px, -25px) scale(1.3); opacity: 0.5; }
          50% { transform: translate(-10px, -50px) scale(0.9); opacity: 0.25; }
          75% { transform: translate(-20px, -15px) scale(1.2); opacity: 0.45; }
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, #06b6d4, #10b981);
          box-shadow: 0 0 6px 1px rgba(6,182,212,0.4);
        }
      `}</style>
      {Array.from({ length: 20 }).map((_, i) => {
        const size = 1 + (i % 2);
        const left = 10 + (i * 19 + 7) % 80;
        const top = 10 + (i * 13 + 3) % 80;
        const delay = (i * 1.7) % 8;
        const duration = 6 + (i % 5) * 1.5;
        return (
          <div
            key={i}
            className="particle"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              animation: `float ${duration}s ${delay}s ease-in-out infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Jarvis() {
  return (
    <div className="relative h-full flex flex-col items-center justify-center bg-[#060d16] overflow-hidden">
      <Particles />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="mb-10 relative">
          <div
            className="absolute inset-0 rounded-full opacity-20 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(6,182,212,0.5) 0%, rgba(16,185,129,0.3) 40%, transparent 70%)",
            }}
          />
          <div
            className="relative w-32 h-32 rounded-full flex items-center justify-center"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(6,182,212,0.15), transparent 70%)",
              boxShadow:
                "0 0 40px 8px rgba(6,182,212,0.12), 0 0 100px 20px rgba(16,185,129,0.08)",
            }}
          >
            <Bot className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_18px_rgba(6,182,212,0.5)]" />
          </div>
        </div>

        <h1
          className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent"
          style={{ backgroundSize: "200% auto", animation: "shimmer 3s linear infinite" }}
        >
          J.A.R.V.I.S.
        </h1>

        <style>{`
          @keyframes shimmer {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
        `}</style>

        <p className="mt-3 text-base sm:text-lg text-slate-400 max-w-md leading-relaxed">
          Ton coach IA de trading, disponible 24h/24
        </p>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("tv:open-jarvis"))}
          className="mt-8 group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl text-base font-semibold text-white transition-all cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #06b6d4, #10b981)",
            boxShadow: "0 0 40px 4px rgba(6,182,212,0.25), 0 0 80px 8px rgba(16,185,129,0.12)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.boxShadow =
              "0 0 50px 8px rgba(6,182,212,0.35), 0 0 100px 16px rgba(16,185,129,0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow =
              "0 0 40px 4px rgba(6,182,212,0.25), 0 0 80px 8px rgba(16,185,129,0.12)";
          }}
        >
          <Send className="w-5 h-5" />
          Ouvrir le coach
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="mt-16 grid grid-cols-3 gap-4 w-full max-w-lg">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm px-4 py-4"
            >
              <Icon className="w-5 h-5 text-cyan-400/60" />
              <span className="text-lg font-bold text-white">{value}</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
