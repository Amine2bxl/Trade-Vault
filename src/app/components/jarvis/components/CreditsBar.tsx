import { Zap } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";

/**
 * CreditsBar — le quota IA de Jarvis, rendu avec impact.
 *
 * Affichage uniquement (FREE limité / PREMIUM supérieur, paywall non
 * implémenté). Le compteur est prêt à recevoir des valeurs réelles (`used` /
 * `limit`), et le label communique la valeur de Jarvis.
 */

interface CreditsBarProps {
  used?: number;
  limit?: number;
}

export default function CreditsBar({ used = 12, limit = 20 }: CreditsBarProps) {
  const { t } = useT();
  const pct = Math.max(0, Math.min(100, (used / Math.max(1, limit)) * 100));
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 min-w-0">
      <span className="relative shrink-0">
        <span className="absolute -inset-0.5 rounded-lg bg-cyan-500/40 blur-sm" />
        <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/30">
          <Zap className="w-3.5 h-3.5" />
        </span>
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-400/80">
          {t("jarvisConv.credits")}
        </div>
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-display text-base font-extrabold text-white tabular-nums">
            {used}
          </span>
          <span className="text-[10px] text-slate-500 tabular-nums">/ {limit}</span>
        </div>
      </div>
      <div className="hidden sm:block w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
