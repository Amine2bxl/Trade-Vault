import { useMemo } from "react";
import { useT } from "../../i18n/LanguageContext";
import { planScale } from "../../utils/planScale";
import { MONTHLY_EUR } from "../../utils/pricing";
import { cn } from "../../utils/cn";
import type { Trade } from "../../types";

/**
 * « MONTRE QUE C'EST VRAIMENT RENTABLE. »
 *
 * ── CE QUE CE BLOC REFUSE DE FAIRE ──────────────────────────────────────────
 *
 * Un journal de trading n'exécute aucun trade. Écrire « +X % de performance »
 * ou « rentabilisé en N trades » inventerait un résultat que rien ne mesure —
 * et un trader reconnaît une promesse creuse plus vite que quiconque. Ce serait
 * la mauvaise vente autant que la mauvaise information.
 *
 * ── CE QU'IL FAIT À LA PLACE ────────────────────────────────────────────────
 *
 * Il pose le prix DANS L'ÉCHELLE que le trader utilise déjà tous les jours.
 * « Quinze euros par mois » ne veut rien dire dans l'absolu ; « quinze euros,
 * contre une perte moyenne de quatre-vingts » se compare instantanément — et
 * c'est un fait tiré de son propre journal, pas un argument fabriqué.
 *
 * Deux barres sur une MÊME échelle : la longueur fait tout le travail. Un
 * pourcentage seul (« 19 % d'une perte ») demande un calcul mental ; deux
 * barres, non.
 *
 * ── POURQUOI LA PERTE, ET NON LE GAIN ───────────────────────────────────────
 *
 * Comparer un abonnement à un GAIN moyen suggérerait que l'abonnement produit
 * ce gain. La perte moyenne ne suggère rien : c'est le montant que le trader
 * accepte déjà de risquer sur un seul trade. Le rapprochement est une mise à
 * l'échelle, jamais un rendement.
 *
 * Et il se tait tant que le journal ne porte pas assez de pertes pour que la
 * moyenne en soit une — voir `planScale`. Sur la page où l'on demande de payer,
 * un chiffre de sable coûte plus cher que pas de chiffre du tout.
 */
export default function PlanScaleBlock({ trades }: { trades: Trade[] }) {
  const { lang } = useT();
  const fr = lang === "fr";
  const echelle = useMemo(() => planScale(trades, MONTHLY_EUR), [trades]);

  if (!echelle) return null;

  const euro = (n: number) =>
    new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  /* L'échelle commune des deux barres. La perte moyenne est forcément la plus
     longue dès que le prix lui est inférieur ; dans le cas contraire (un trader
     qui risque moins de 15 € par trade) c'est le prix qui borne, et la
     comparaison reste juste. */
  const max = Math.max(echelle.perteMoyenne, MONTHLY_EUR);
  const part = (v: number) => `${Math.max(2, (v / max) * 100)}%`;

  return (
    <section className="glass animate-fade-in-up stagger-2 rounded-3xl px-4 py-4 sm:px-5">
      <h3 className="tv-label mb-1 text-slate-400">
        {fr ? "Ce que ça pèse dans ton trading" : "What it weighs in your trading"}
      </h3>
      <p className="tv-row-label mb-4">
        {fr
          ? `Mesuré sur tes ${echelle.nLosses} trades perdants.`
          : `Measured across your ${echelle.nLosses} losing trades.`}
      </p>

      <div className="space-y-3">
        <Barre
          label={fr ? "Ta perte moyenne, sur UN trade" : "Your average loss, on ONE trade"}
          valeur={euro(echelle.perteMoyenne)}
          largeur={part(echelle.perteMoyenne)}
          ton="neg"
        />
        <Barre
          label={fr ? "TradeVault Pro, pour un MOIS" : "TradeVault Pro, for a MONTH"}
          valeur={euro(MONTHLY_EUR)}
          largeur={part(MONTHLY_EUR)}
          ton="accent"
        />
      </div>

      <p className="tv-prose mt-4 text-slate-300">
        {fr
          ? `Un mois d'abonnement représente ${echelle.partDUnePerte} % de ce que tu perds sur un seul trade moyen.`
          : `A month of the subscription is ${echelle.partDUnePerte}% of what one average losing trade costs you.`}
      </p>
      {/* LA LIMITE, ÉCRITE. Sans elle, la comparaison se lirait comme une
          promesse de rendement — ce qu'elle n'est pas et ne peut pas être. */}
      <p className="tv-row-label mt-1.5 max-w-2xl">
        {fr
          ? "Une mise à l'échelle, pas une promesse : TradeVault n'exécute aucun trade et ne garantit aucun résultat."
          : "A scale, not a promise: TradeVault places no trades and guarantees no outcome."}
      </p>
    </section>
  );
}

/** Une barre de l'échelle — la longueur EST la valeur. */
function Barre({
  label,
  valeur,
  largeur,
  ton,
}: {
  label: string;
  valeur: string;
  largeur: string;
  ton: "neg" | "accent";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-slate-400">{label}</span>
        <span
          className={cn(
            "tv-figure shrink-0 text-sm",
            ton === "accent" ? "text-[var(--tv-highlight)]" : "text-white",
          )}
        >
          {valeur}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={cn(
            "h-full rounded-full",
            ton === "accent" ? "bg-[var(--tv-accent)]" : "bg-red-400/60",
          )}
          style={{ width: largeur }}
        />
      </div>
    </div>
  );
}
