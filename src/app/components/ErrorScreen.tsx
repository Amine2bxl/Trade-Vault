import { Link } from "@tanstack/react-router";
import { Home, RotateCw } from "lucide-react";
// Button is a leaf primitive (only `cn`), so it stays safe for this
// dependency-light error surface.
import { Button } from "@/shared/ui";

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
        background: "var(--tv-bg)",
      }}
    >
      <div className="relative z-10 text-center max-w-lg w-full animate-fade-in-up">
        <div className="flex items-center justify-center gap-2 mb-8 opacity-85">
          <span className="w-2.5 h-2.5 rounded-full tv-accent-fill" />
          <span className="text-[0.95rem] font-bold tracking-tight">TradeVault</span>
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
              <stop stopColor="var(--tv-highlight)" />
              <stop offset="1" stopColor="var(--tv-accent-2)" />
            </linearGradient>
          </defs>
        </svg>

        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-7">{subtitle}</p>

        <div className="flex flex-wrap gap-2.5 justify-center">
          {onRetry && (
            <Button onClick={onRetry}>
              <RotateCw className="w-4 h-4" /> Try again
            </Button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] border border-white/[0.1] text-slate-200 hover:bg-white/[0.08] transition"
          >
            <Home className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
