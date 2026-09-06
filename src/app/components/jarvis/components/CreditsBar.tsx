import { Zap, ArrowUpRight } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { aiUsageToday, jarvisDailyLimit } from "../../../utils/aiUsage";
import { useSubscription } from "../../../hooks/useSubscription";
import { cn } from "../../../utils/cn";

/**
 * Jarvis Intelligence — le quota IA du jour, selon le palier (3 en gratuit,
 * 20 en Pro, aucune limite en Elite).
 *
 * ── POURQUOI C'EST UNE LIGNE, ET PLUS UNE CARTE ───────────────────────────
 *
 * Ce pied de fenêtre tenait sur deux rangées : une jauge radiale de 44px, le
 * compteur, trois bénéfices cochés, puis une seconde ligne d'explication avec
 * son lien. Environ 76px pris en permanence, en bas de la fenêtre de Jarvis,
 * pour une information qu'on consulte une fois par session — et autant de
 * moins pour la conversation, qui est ce pour quoi la fenêtre existe.
 *
 * C'est la règle des cartes statiques appliquée au chrome : la surface n'a
 * qu'UNE interaction (le lien d'abonnement), donc elle a la taille d'une
 * ligne. Le disque radial devient une barre — même information, sur la hauteur
 * du texte au lieu de trois fois celle-ci. Les trois bénéfices cochés partent :
 * une liste de qualités dans une barre de quota est de la décoration, et elle
 * poussait dehors la phrase qui, elle, dit ce qu'on gagne à passer au palier
 * supérieur.
 *
 * Ce qui est gardé intact : le compteur réel (`aiUsage`), l'état épuisé —
 * qui reste ambre et explicite — et le CTA, qui ouvre l'abonnement via
 * `tv:upgrade`.
 */

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

  return (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <Zap
        className={cn("h-3.5 w-3.5 shrink-0", exhausted ? "text-amber-400" : "text-slate-500")}
        aria-hidden
      />

      {/* Le compteur — le chiffre d'abord, sa nature ensuite. */}
      <span className="flex shrink-0 items-baseline gap-1.5">
        <span
          className={cn(
            "tv-figure text-sm leading-none",
            exhausted ? "text-amber-300" : "text-white",
          )}
        >
          {unlimited ? "∞" : remaining}
        </span>
        <span className="tv-row-label">{t("credits.remaining")}</span>
      </span>

      {/* La jauge — une barre sur la hauteur du texte. Illimité : pas de jauge,
          il n'y a rien à remplir. */}
      {!unlimited && (
        <span
          className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--tv-plate-3)] sm:block"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("credits.title")}
        >
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-300",
              exhausted ? "bg-amber-400" : "bg-[var(--tv-accent)]",
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
      )}

      {/* La phrase de conversion. Elle ne prend plus une rangée à elle : elle
          occupe la place libre de la ligne, et cède la première sur un écran
          étroit — sauf épuisée, où elle EST l'information du moment. */}
      <span
        className={cn(
          "tv-row-label min-w-0 flex-1 truncate",
          exhausted ? "text-amber-300/90" : "hidden lg:block",
        )}
      >
        {exhausted ? t("credits.exhausted") : t("credits.explainer")}
      </span>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
        className="ml-auto inline-flex h-7 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[11px] font-bold text-[var(--tv-highlight)] transition-colors hover:bg-[var(--tv-plate-3)]"
      >
        {t("credits.upgrade")}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}
