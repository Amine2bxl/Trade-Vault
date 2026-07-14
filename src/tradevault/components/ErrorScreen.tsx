import { Link } from "@tanstack/react-router";
import { Home, RotateCw } from "lucide-react";

/* Branded full-screen error identity, shared by the 404 and 500 boundaries.
   Deliberately dependency-light (no i18n/context) so it renders even when the
   app tree is broken. Mirrors the SSR fallback in src/lib/error-page.ts. */
export default function ErrorScreen({
  code,
  title,
  subtitle,
  onRetry,
}: {
  code: string;
  title: string;
  subtitle: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(1000px 700px at 80% -10%, rgba(34,211,238,.08), transparent 60%), linear-gradient(160deg,#05070a 0%,#0a0f1e 55%,#05080c 100%)",
      }}
    >
      <div className="auth-orb w-[460px] h-[460px] bg-cyan-600 -top-40 -left-36" style={{ animationDelay: "0s" }} />
      <div className="auth-orb w-[380px] h-[380px] bg-teal-600 -bottom-36 -right-32" style={{ animationDelay: "-6s" }} />

      <div className="relative z-10 text-center max-w-lg w-full animate-fade-in-up">
        <div className="flex items-center justify-center gap-2 mb-8 opacity-85">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 shadow-[0_0_12px_rgba(34,211,238,.6)]" />
          <span className="text-[0.95rem] font-bold text-white tracking-tight">TradeVault</span>
        </div>

        <div className="err-code" aria-hidden="true" data-code={code}>
          {code}
        </div>

        <svg className="err-spark" viewBox="0 0 200 44" fill="none" aria-hidden="true">
          <path
            d="M2 34 L28 30 L46 36 L70 14 L96 22 L120 8 L150 26 L176 12 L198 20"
            stroke="url(#errlg)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="errlg" x1="0" y1="0" x2="200" y2="0">
              <stop stopColor="#22d3ee" />
              <stop offset="1" stopColor="#14b8a6" />
            </linearGradient>
          </defs>
        </svg>

        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-7">{subtitle}</p>

        <div className="flex flex-wrap gap-2.5 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-teal-500 text-[#04121a] shadow-lg shadow-cyan-500/30 hover:brightness-110 hover:-translate-y-px transition-all"
            >
              <RotateCw className="w-4 h-4" /> Try again
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] border border-white/[0.1] text-slate-200 hover:bg-white/[0.08] transition-all"
          >
            <Home className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
