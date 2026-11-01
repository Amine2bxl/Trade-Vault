import { ArrowRight, Bitcoin, Check, ShieldCheck } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import PrixAnime from "./PrixAnime";
import {
  LIFETIME_COPY,
  LIFETIME_EUR,
  LIFETIME_PLAN,
  TIER_BY_ID,
  type PaidPlan,
} from "@/domain/plans";
import { eur } from "@/app/utils/pricing";

/**
 * L'OFFRE UNIQUE — la carte de la licence à vie.
 *
 * Une seule carte, partout où l'on achète : la vitrine, la page Abonnement, la
 * fenêtre d'achat. Le prix en chiffre héros, « une fois · à vie » dessous, ce
 * qu'on obtient, un bouton plein (texte blanc), puis la ligne de confiance.
 * Plus de bascule mensuel/annuel : il n'y a plus qu'un prix.
 */
export default function LifetimeOffer({
  lang,
  owned = false,
  busy = false,
  onChoose,
  onCrypto,
  className,
}: {
  lang: "fr" | "en";
  /** Licence déjà possédée : la carte le dit au lieu de vendre. */
  owned?: boolean;
  busy?: boolean;
  onChoose?: (plan: PaidPlan) => void;
  onCrypto?: (plan: PaidPlan) => void;
  className?: string;
}) {
  const def = TIER_BY_ID.elite;
  const price = eur(LIFETIME_EUR, lang);
  return (
    <article className={cn("lifetime-offer", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="lifetime-badge">{LIFETIME_COPY.badge[lang]}</span>
        <span className="tv-label text-slate-500">{def.name[lang]}</span>
      </div>
      <h3 className="mt-4 text-[20px] font-bold tracking-tight text-white">
        {LIFETIME_COPY.title[lang]}
      </h3>
      <p className="mt-1 text-[13px] text-slate-400">{def.tagline[lang]}</p>

      <div className="mt-5 flex items-end gap-2">
        <PrixAnime valeur={price} className="lifetime-price" />
        <span className="mb-1.5 text-[13px] font-medium text-slate-400">
          {LIFETIME_COPY.priceNote[lang]}
        </span>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {def.features.map((f) => (
          <li key={f.en} className="flex items-start gap-2 text-[13px] leading-snug text-slate-300">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tv-chart-green)]" />
            {f[lang]}
          </li>
        ))}
      </ul>

      {owned ? (
        <p className="lifetime-owned">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          {LIFETIME_COPY.owned[lang]}
        </p>
      ) : (
        onChoose && (
          <>
            <button
              type="button"
              onClick={() => onChoose(LIFETIME_PLAN)}
              disabled={busy}
              className="btn-primary mt-6 w-full justify-center disabled:opacity-60"
            >
              {LIFETIME_COPY.cta[lang]} — {price}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            {onCrypto && (
              <button
                type="button"
                onClick={() => onCrypto(LIFETIME_PLAN)}
                disabled={busy}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-slate-500 transition hover:text-slate-300 disabled:opacity-60"
              >
                <Bitcoin className="h-3.5 w-3.5" aria-hidden />
                {LIFETIME_COPY.crypto[lang]}
              </button>
            )}
            <p className="mt-3 text-center text-[11.5px] text-slate-500">
              {LIFETIME_COPY.trust[lang]}
            </p>
          </>
        )
      )}
    </article>
  );
}
