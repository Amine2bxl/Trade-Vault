import { Zap, Check } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";

/**
 * Jarvis Intelligence — le quota IA de Jarvis, pensé comme une CAPACITÉ.
 *
 * Affichage uniquement (paywall non implémenté) : le compteur est prêt à
 * recevoir des valeurs réelles (`used`/`limit`), et la ligne de valeur
 * (« Aujourd'hui Jarvis t'a aidé à… ») rend le bénéfice immédiatement lisible.
 */

interface CreditsBarProps {
  used?: number;
  limit?: number;
}

export default function CreditsBar({ used = 12, limit = 20 }: CreditsBarProps) {
  const { t } = useT();
  const pct = Math.max(0, Math.min(100, (used / Math.max(1, limit)) * 100));
  const values = [t("credits.value1"), t("credits.value2"), t("credits.value3")];

  return (
    <div className="px-4 py-2 min-w-0">
      <div className="flex items-center gap-2">
        <span className="relative shrink-0">
          <span className="absolute -inset-0.5 rounded-lg bg-cyan-500/40 blur-sm" />
          <span className="relative grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/30">
            <Zap className="w-3.5 h-3.5" />
          </span>
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300 leading-none">
            {t("credits.title")}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-display text-sm font-extrabold text-white tabular-nums leading-none">
              {used}
            </span>
            <span className="text-[10px] text-slate-500">{t("credits.remaining")}</span>
            <div className="w-14 h-1 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex items-center gap-2.5 mt-1.5 text-[10px] text-slate-500 flex-wrap">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-emerald-400" /> {v}
          </span>
        ))}
      </div>
    </div>
  );
}
