import { Lock } from "lucide-react";
import { cn } from "../../utils/cn";
import { PAGE_VALUE, TIER_BY_ID, pagesOfTier, eur, yearlyPerMonth } from "../../utils/pricing";

/**
 * Ce que Pro débloque, écran par écran.
 *
 * Les mêmes phrases que dans l'application et sur le mur d'aperçu : le
 * visiteur lit sur la landing exactement ce qu'il retrouvera sur le cadenas,
 * puis sur la page une fois payée. Une promesse formulée trois fois de trois
 * façons différentes est une promesse à laquelle on ne croit pas.
 */
export default function ProValueGrid({
  lang,
  className,
}: {
  lang: "fr" | "en";
  className?: string;
}) {
  const fr = lang === "fr";
  const pages = pagesOfTier("pro");
  const perMonth = eur(Math.round(yearlyPerMonth("pro") * 100) / 100);

  return (
    <div className={cn("", className)}>
      <div className="mb-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center">
        <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
          {fr ? "Ce que Pro débloque" : "What Pro unlocks"}
        </h3>
        <span className="text-[13px] text-slate-500">
          {fr
            ? `${pages.length} écrans, à partir de ${perMonth}/mois`
            : `${pages.length} screens, from ${perMonth}/month`}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const value = PAGE_VALUE[page];
          if (!value) return null;
          return (
            <div
              key={page}
              className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">
                <Lock className="h-2.5 w-2.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white">{value.title[lang]}</div>
                <div className="mt-1 text-[12.5px] leading-snug text-slate-400">
                  {value.benefit[lang]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[12.5px] text-slate-500">
        {fr
          ? `${TIER_BY_ID.elite.name.fr} ajoute ${TIER_BY_ID.elite.features[0].fr.toLowerCase()} et ${TIER_BY_ID.elite.features[1].fr.toLowerCase()}.`
          : `${TIER_BY_ID.elite.name.en} adds ${TIER_BY_ID.elite.features[0].en.toLowerCase()} and ${TIER_BY_ID.elite.features[1].en.toLowerCase()}.`}
      </p>
    </div>
  );
}
