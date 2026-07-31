import { Zap, Check, Sparkles, ArrowUpRight } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { aiUsageToday, FREE_DAILY_LIMIT } from "../../../utils/aiUsage";
import { cn } from "../../../utils/cn";

/**
 * Jarvis Intelligence — le quota IA de Jarvis (5 analyses gratuites / jour).
 *
 * Rendu premium : jauge radiale dégradé, compteur réel issu du compteur local
 * (`aiUsage`), bénéfices immédiatement lisibles et texte explicatif en pied de
 * carte. Le CTA « Découvrir Premium » ouvre l'abonnement via tv:navigate.
 */

const RADIUS = 17;
const CIRC = 2 * Math.PI * RADIUS;

export default function CreditsBar() {
  const { t } = useT();
  const { user } = useAuth();
  const used = aiUsageToday(user?.id);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used);
  const pct = (used / FREE_DAILY_LIMIT) * 100;
  const exhausted = remaining === 0;
  const values = [t("credits.value1"), t("credits.value2"), t("credits.value3")];

  return (
    <div className="w-full min-w-0 px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* Jauge radiale — la capacité du jour, un coup d'œil suffit. */}
        <div className="relative shrink-0">
          <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
            <circle
              cx="22"
              cy="22"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="4"
            />
            <circle
              cx="22"
              cy="22"
              r={RADIUS}
              fill="none"
              stroke="url(#creditsGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct / 100)}
              className="transition-[stroke-dashoffset] duration-700"
            />
            <defs>
              <linearGradient id="creditsGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            <Zap className={cn("w-4 h-4", exhausted ? "text-slate-500" : "text-cyan-300")} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-sm font-extrabold text-white tabular-nums leading-none">
              {remaining}
            </span>
            <span className="text-[10px] text-slate-500 leading-none">
              {t("credits.remaining")}
            </span>
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-slate-600 font-bold">
            {t("credits.title")} · {FREE_DAILY_LIMIT}/j
          </div>
        </div>

        {/* Bénéfices — pourquoi Jarvis mérite l'analyse, pas le compteur. */}
        <div className="hidden lg:flex items-center gap-2 text-[9.5px] text-slate-500 flex-wrap shrink-0">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1">
              <Check className="w-2.5 h-2.5 text-emerald-400" /> {v}
            </span>
          ))}
        </div>
      </div>

      {/* Texte explicatif + CTA Premium — la limite est une porte, pas un mur. */}
      <div
        className={cn(
          "mt-2 flex items-center gap-1.5 text-[9.5px] leading-snug",
          exhausted ? "text-amber-300/90" : "text-slate-600",
        )}
      >
        <Sparkles className="w-3 h-3 shrink-0 text-cyan-400/70" />
        <span className="flex-1 min-w-0">
          {exhausted ? t("credits.exhausted") : t("credits.explainer")}
        </span>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("tv:navigate", { detail: { page: "subscription" } }),
            )
          }
          className="shrink-0 inline-flex items-center gap-0.5 text-cyan-400 font-bold hover:text-cyan-300 transition-colors"
        >
          {t("credits.upgrade")}
          <ArrowUpRight className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}
