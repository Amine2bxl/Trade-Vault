import { Zap, Check, Sparkles, ArrowUpRight } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { aiUsageToday, jarvisDailyLimit } from "../../../utils/aiUsage";
import { useSubscription } from "../../../hooks/useSubscription";
import { cn } from "../../../utils/cn";

/**
 * Jarvis Intelligence — le quota IA du jour, selon le palier (3 en gratuit,
 * 20 en Pro, aucune limite en Elite).
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
  const { tier } = useSubscription();
  const limit = jarvisDailyLimit(tier);
  const unlimited = !Number.isFinite(limit);
  const used = aiUsageToday(user?.id);
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100);
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
              className="transition-[stroke-dashoffset] duration-250"
            />
            <defs>
              <linearGradient id="creditsGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--tv-highlight)" />
<<<<<<< HEAD
                <stop offset="100%" stopColor="#2dd4bf" />
=======
                <stop offset="100%" stopColor="var(--tv-accent-2)" />
>>>>>>> origin/claude/minimal-tokens-caveman-skill-l3dmgc
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            <Zap className={cn("w-4 h-4", exhausted ? "text-slate-500" : "text-cyan-300")} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="tv-figure text-sm text-white leading-none">
              {unlimited ? "∞" : remaining}
            </span>
            <span className="text-[11px] text-slate-500 leading-none">
              {t("credits.remaining")}
            </span>
          </div>
          <div className="tv-label mt-0.5 text-slate-600">
            {t("credits.title")} · {unlimited ? "∞" : `${limit}/j`}
          </div>
        </div>

        {/* Bénéfices — pourquoi Jarvis mérite l'analyse, pas le compteur. */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 flex-wrap shrink-0">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1">
              <Check className="w-2.5 h-2.5 text-emerald-400" /> {v}
            </span>
          ))}
        </div>
      </div>

      {/* Texte explicatif + CTA Premium — la limite est une porte, pas un mur.
          Taille au plancher de 11px du design system : c'est la seule surface
          de conversion de l'écran Jarvis, la rendre plus petite que tout le
          reste revenait à cacher l'offre. */}
      <div
        className={cn(
          "mt-2 flex items-center gap-1.5 text-[11px] leading-snug",
          exhausted ? "text-amber-300/90" : "text-slate-600",
        )}
      >
        <Sparkles className="w-3 h-3 shrink-0 text-cyan-400/70" />
        <span className="flex-1 min-w-0">
          {exhausted ? t("credits.exhausted") : t("credits.explainer")}
        </span>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
          /* Une cible de 15px de haut, mesurée : le lien vivait dans une
             ligne de 11px sans hauteur propre. Le texte garde sa taille, c'est
             la zone qui s'ouvre. */
          className="-my-1.5 inline-flex h-8 shrink-0 items-center gap-0.5 px-1 font-bold text-cyan-400 transition-colors hover:text-cyan-300"
        >
          {t("credits.upgrade")}
          <ArrowUpRight className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}
