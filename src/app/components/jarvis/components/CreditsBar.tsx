import { Zap } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";

/**
 * CreditsBar — affichage (uniquement) du quota IA de Jarvis.
 *
 * FREE : quota limité · PREMIUM : quota supérieur / futur illimité. Le paywall
 * n'est PAS implémenté : on affiche une jauge prête à recevoir des valeurs
 * réelles (`used` / `limit`).
 */

interface CreditsBarProps {
  used?: number;
  limit?: number;
}

export default function CreditsBar({ used = 12, limit = 20 }: CreditsBarProps) {
  const { t } = useT();
  const pct = Math.max(0, Math.min(100, (used / Math.max(1, limit)) * 100));
  return (
    <div className="flex items-center gap-2.5 px-4 py-2">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
          <Zap className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white">{t("jarvisConv.credits")}</span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-slate-400 shrink-0">
        {used} / {limit}
      </span>
    </div>
  );
}
