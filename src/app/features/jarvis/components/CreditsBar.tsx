import { useEffect, useReducer } from "react";
import { ArrowUpRight, Crown, Sparkles, Zap } from "lucide-react";
import { useT } from "@/app/i18n/LanguageContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { AI_USAGE_EVENT, aiUsageToday, jarvisDailyLimit } from "../aiUsage";
import { useSubscription } from "@/app/hooks/useSubscription";
import { cn } from "@/app/utils/cn";

/**
 * Le pied de Jarvis — il dépend de l'abonnement, et il ne vend qu'à qui peut
 * encore acheter.
 *
 * ══ CE QUI N'ALLAIT PAS ══
 *
 *   • « Discover Premium » s'affichait À TOUT LE MONDE, abonnés compris : un
 *     trader Elite, qui paie le palier le plus haut, se voyait proposer de
 *     passer Premium à chaque message.
 *   • La phrase d'explication annonçait « 5 analyses gratuites par jour » alors
 *     que le palier gratuit en compte 3 (`LIMITS.free.jarvisPerDay`).
 *
 * ══ CE QU'IL EST ══
 *
 *   • GRATUIT — le compteur en pastilles (on voit ce qu'il reste d'un coup
 *     d'œil), quand il se recharge, et UN appel à l'action lumineux vers Pro.
 *   • PRO — le compteur et le badge du palier ; aucune publicité. Le seul
 *     moment où Elite est proposé, c'est quand la limite du jour est atteinte :
 *     c'est la seule situation où l'offre répond à un besoin réel.
 *   • ELITE — le badge et « analyses illimitées ». Rien à vendre.
 *   • Tant que l'abonnement se charge, AUCUN appel à l'action : un abonné ne
 *     doit jamais voir clignoter une offre qu'il a déjà.
 */

export default function CreditsBar() {
  const { t } = useT();
  const { user } = useAuth();
  const { tier, loading } = useSubscription();
  // Le compteur vit en localStorage : on se re-rend à chaque analyse consommée.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener(AI_USAGE_EVENT, refresh);
    return () => window.removeEventListener(AI_USAGE_EVENT, refresh);
  }, []);
  const limit = jarvisDailyLimit(tier);
  const unlimited = !Number.isFinite(limit);
  const used = aiUsageToday(user?.id);
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  const exhausted = remaining === 0;
  const upgrade = () => window.dispatchEvent(new CustomEvent("tv:upgrade"));

  /* ── ELITE : rien à vendre ── */
  if (unlimited) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2.5">
        <span className="jarvis-plan-badge" data-tier={tier}>
          <Crown className="h-3 w-3" aria-hidden />
          {t(`credits.plan.${tier}`)}
        </span>
        <span className="tv-row-label truncate">{t("credits.unlimited")}</span>
      </div>
    );
  }

  const counter = t("credits.left")
    .replace("{n}", String(remaining))
    .replace("{max}", String(limit));

  /* ── PRO : le compteur, le badge ; Elite seulement à la limite ── */
  if (tier !== "free") {
    return (
      <div className="flex w-full min-w-0 items-center gap-2.5">
        <span className="jarvis-plan-badge" data-tier={tier}>
          <Sparkles className="h-3 w-3" aria-hidden />
          {t(`credits.plan.${tier}`)}
        </span>
        <span className={cn("tv-row-label min-w-0 truncate", exhausted && "text-amber-300/90")}>
          {exhausted ? t("credits.exhaustedPro") : counter}
        </span>
        <Gauge
          used={limit - remaining}
          limit={limit}
          exhausted={exhausted}
          label={t("credits.title")}
        />
        {exhausted && !loading && (
          <button type="button" onClick={upgrade} className="jarvis-upgrade ml-auto">
            {t("credits.upgradePro")}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  /* ── GRATUIT : lisible, et une vraie raison de passer Pro ── */
  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <span className="flex shrink-0 items-center gap-2">
        <Zap
          className={cn("h-3.5 w-3.5", exhausted ? "text-amber-400" : "text-[var(--tv-highlight)]")}
          aria-hidden
        />
        <span className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: limit }, (_, i) => (
            <span key={i} className="jarvis-pip" data-on={i < remaining} />
          ))}
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span
          className={cn("text-[12px] font-semibold", exhausted ? "text-amber-300" : "text-white")}
        >
          {exhausted ? t("credits.exhausted") : counter}
        </span>
        <span className="tv-row-label hidden md:inline">
          {" · "}
          {exhausted ? t("credits.freePitch") : t("credits.reset")}
        </span>
      </span>
      {!loading && (
        <button type="button" onClick={upgrade} className="jarvis-upgrade jarvis-upgrade-hot">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t("credits.upgrade")}
        </button>
      )}
    </div>
  );
}

function Gauge({
  used,
  limit,
  exhausted,
  label,
}: {
  used: number;
  limit: number;
  exhausted: boolean;
  label: string;
}) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <span
      className="hidden h-1 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--tv-plate-3)] sm:block"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-300",
          exhausted ? "bg-amber-400" : "bg-[var(--tv-accent)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
