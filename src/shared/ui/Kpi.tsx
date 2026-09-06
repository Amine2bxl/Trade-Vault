import type { ReactNode } from "react";
import { cn } from "./cn";
import { type } from "./tokens";

/**
 * Kpi — LA CASE D'INFORMATION STATIQUE.
 *
 * `Metric` est la TUILE : elle porte une jauge, un pied de tuile, un survol,
 * une entrée animée. C'est la surface d'un chiffre qui compte — le P&L du
 * mois, la série en cours.
 *
 * `Kpi` est ce qu'il manquait en dessous : une case qui affiche un libellé, un
 * chiffre et une mention, et RIEN d'autre. Pas de survol (rien à survoler),
 * pas de rembourrage de carte, pas d'animation. C'est la règle des cartes
 * statiques rendue concrète — une surface qui n'a aucune interaction ne prend
 * pas la place d'une surface qui en a une.
 *
 * Mesuré sur Analytics : sept cases passent de 86px à 54px de haut sur
 * téléphone. Le premier graphe de la page entre dans le premier écran.
 */

export type KpiTone = "neutral" | "pos" | "neg" | "warn" | "accent";

const TONE: Record<KpiTone, string> = {
  neutral: "text-white",
  pos: "rp-pos",
  neg: "rp-neg",
  warn: "rp-warn",
  accent: "text-[var(--tv-highlight)]",
};

export interface KpiProps {
  label: string;
  value: string;
  /** Mention sous le chiffre — une ligne, tronquée. */
  hint?: ReactNode;
  /** Icône ou infobulle posée à droite du libellé. */
  adornment?: ReactNode;
  tone?: KpiTone;
  /** Surface creuse — la case vit DANS une carte. */
  inset?: boolean;
  /** La mention peut passer à la ligne (légende explicative, pas une valeur). */
  wrapHint?: boolean;
  className?: string;
}

export function Kpi({
  label,
  value,
  hint,
  adornment,
  tone = "neutral",
  inset = false,
  wrapHint = false,
  className,
}: KpiProps) {
  return (
    <div className={cn("tv-kpi", inset && "tv-kpi-inset", className)}>
      <div className="flex min-w-0 items-center gap-1">
        <span className={cn(type.label, "min-w-0 flex-1 truncate text-slate-500")}>{label}</span>
        {adornment}
      </div>
      <div className={cn("tv-kpi-value", TONE[tone])}>{value}</div>
      {hint !== undefined && hint !== null && (
        <div className={cn("tv-row-label mt-0.5", wrapHint ? "leading-snug" : "truncate")}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * La rangée de cases. `auto-fit` avec un plancher de 108px : le nombre de
 * colonnes suit la largeur RÉELLE de la colonne de contenu (le rail en prend
 * déjà 230px sur tablette), et il n'y a jamais de défilement horizontal.
 *
 * `cols` borne la grille quand le compte est connu d'avance (deux ou quatre
 * cases exactement) — sans lui, une rangée de quatre s'étalerait en une seule
 * ligne de cases très larges sur grand écran.
 */
export function KpiGrid({
  cols,
  className,
  children,
}: {
  cols?: 2 | 4;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "tv-kpi-grid",
        cols === 2 && "tv-kpi-grid-2",
        cols === 4 && "tv-kpi-grid-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
