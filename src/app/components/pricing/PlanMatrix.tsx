import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { TIERS, yearlyPerMonth, type Tier, type TierDef } from "@/domain/plans";
import { useT } from "../../i18n/LanguageContext";
import { eur } from "../../utils/pricing";
import { cn } from "../../utils/cn";

/**
 * LA MATRICE DE COMPARAISON — et ce qu'elle doit faire.
 *
 * Trois colonnes, des lignes groupées par palier qui AJOUTE : chaque ligne
 * n'apparaît qu'une fois, dans le groupe de l'offre qui l'introduit, et la
 * coche se propage aux colonnes qui en héritent. « Pro ajoute X » avec ✓ dans
 * Pro et Elite ne laisse aucune ambiguïté.
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI ──
 *
 * LES TROIS COLONNES AVAIENT LE MÊME POIDS. Free portait les mêmes coches
 * vertes, la même taille de police, le même soin que Pro : une page de
 * comparaison neutre, qui laisse le lecteur conclure que la gratuite suffit.
 * Or cette page existe pour faire passer au payant.
 *
 *   • FREE EST MIS EN RETRAIT — sa colonne est grisée, sans fond, et ses
 *     coches sont de simples traits gris. Elle dit ce qu'elle contient, elle
 *     ne le vend pas.
 *   • PRO EST LA COLONNE. Un fond continu du haut en bas de la matrice — pas
 *     seulement sous son en-tête —, ses coches à l'accent, et SON BOUTON
 *     D'ACHAT DANS SON EN-TÊTE. Il n'y en avait aucun : il fallait descendre
 *     sous la matrice pour trouver comment souscrire, c'est-à-dire quitter
 *     l'argument au moment où il porte.
 *   • LE PRIX TIENT SUR UNE LIGNE. « 16,67 € » passait à la ligne dans une
 *     colonne de 52px, et « 10 € » se coupait entre le nombre et le symbole.
 *     Les colonnes montent à 96px et le prix garde sa chasse.
 */

interface MatrixRow {
  id: string;
  label: { fr: string; en: string };
  /** Colonnes qui contiennent cette fonctionnalité, dans l'ordre de TIERS. */
  in: boolean[];
}

function rowsFor(tier: TierDef, cumulativeFrom: number, all: Tier[]): MatrixRow[] {
  return tier.features.map((f) => ({
    id: `${tier.id}-${f.en}`,
    label: { fr: f.fr, en: f.en },
    in: all.map((_, i) => i >= cumulativeFrom),
  }));
}

/** La grille : le libellé, puis trois colonnes de largeur égale. */
const GRILLE =
  "grid grid-cols-[minmax(0,1fr)_repeat(3,72px)] gap-x-1.5 sm:grid-cols-[minmax(0,1fr)_repeat(3,96px)]";

export default function PlanMatrix() {
  const { lang } = useT();
  const fr = lang === "fr";
  const all = TIERS.map((t) => t.id) as Tier[];
  const groups: { tier: TierDef; rows: MatrixRow[] }[] = [
    { tier: TIERS[0], rows: rowsFor(TIERS[0], 0, all) },
    { tier: TIERS[1], rows: rowsFor(TIERS[1], 1, all) },
    { tier: TIERS[2], rows: rowsFor(TIERS[2], 2, all) },
  ];
  const tr = (b: { fr: string; en: string }) => (fr ? b.fr : b.en);

  return (
    /* `relative` : la bande verticale de Pro est posée en absolu derrière la
       grille. Une colonne teintée ligne par ligne aurait laissé un liseré à
       chaque interstice — c'est UNE colonne, elle doit se lire d'un trait. */
    <div className="relative">
      {/* LA COLONNE PRO, D'UN SEUL TENANT. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 right-[calc(72px+0.375rem)] w-[72px] rounded-2xl border border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.06)] sm:right-[calc(96px+0.375rem)] sm:w-[96px]"
      />

      <div className="relative px-4 py-4 sm:px-5">
        <h3 className="tv-label mb-3 text-slate-400">
          {fr ? "Tout ce que contient chaque offre" : "Everything each plan includes"}
        </h3>

        {/* ── L'EN-TÊTE ────────────────────────────────────────────────── */}
        <div className={cn(GRILLE, "items-end")}>
          <div />
          {TIERS.map((t) => {
            const pro = t.id === "pro";
            const gratuit = t.monthly === 0;
            return (
              /* PAS DE PASTILLE « RECOMMANDÉ ». Elle mesurait 99px de large
                 pour une colonne de 96 — et 87 pour 72 sur téléphone : elle
                 débordait sur la colonne voisine. Et elle ne servait à rien :
                 la bande à l'accent, le nom en surbrillance et le bouton
                 d'achat désignent déjà cette colonne, plus fort qu'un mot. */
              <div
                key={t.id}
                className="flex flex-col items-center justify-end gap-1 pb-2 text-center"
              >
                <span
                  className={cn(
                    "tv-label",
                    pro
                      ? "text-[var(--tv-highlight)]"
                      : gratuit
                        ? "text-slate-600"
                        : "text-slate-400",
                  )}
                >
                  {tr(t.name)}
                </span>
                <span
                  className={cn(
                    "tv-figure whitespace-nowrap text-sm leading-none",
                    pro ? "text-white" : gratuit ? "text-slate-600" : "text-slate-400",
                  )}
                >
                  {gratuit ? "0 €" : eur(Math.round(yearlyPerMonth(t.id) * 100) / 100)}
                </span>
                <span className="tv-row-label leading-none">{fr ? "/mois" : "/mo"}</span>
                {pro && (
                  /* LE BOUTON D'ACHAT EST DANS LA COLONNE. Il n'existait nulle
                     part ici : il fallait descendre sous la matrice, donc
                     quitter l'argument au moment où il porte. */
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
                    className="btn-primary btn-sm mt-1.5 w-full whitespace-nowrap px-2"
                  >
                    {fr ? "Passer Pro" : "Go Pro"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── LES LIGNES, groupées par palier qui ajoute ────────────────── */}
        {groups.map(({ tier: g, rows }) => (
          <Fragment key={g.id}>
            <div className="tv-label mt-4 mb-1 text-slate-600">
              {fr
                ? `Dans l'offre ${g.name.fr.toLowerCase()}`
                : `Included in ${g.name.en.toLowerCase()}`}
            </div>
            {rows.map((row) => (
              <div key={row.id} className={cn(GRILLE, "items-center py-1")}>
                <span className="text-[12.5px] leading-snug text-slate-300">{tr(row.label)}</span>
                {row.in.map((has, i) => (
                  <span key={i} className="justify-self-center">
                    {has ? (
                      <span
                        className={cn(
                          "grid h-4.5 w-4.5 place-items-center rounded-full",
                          i === 1
                            ? "bg-[rgb(var(--tv-accent-rgb)/0.22)] text-[var(--tv-highlight)]"
                            : i === 0
                              ? // Free : un trait gris, pas une coche verte.
                                "text-slate-600"
                              : "bg-emerald-400/10 text-emerald-400/90",
                        )}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <Minus className="h-3 w-3 text-slate-700" />
                    )}
                  </span>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
