import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * SubNav — LA NAVIGATION *DANS* UNE PAGE.
 *
 * Le produit avait deux niveaux de navigation et il en manquait un troisième :
 *
 *   1. le rail — la section (Préparation, Journal, Analyse…) ;
 *   2. `SectionTabs` — la vue de la section (Analytics, Rapports, Monte-Carlo),
 *      qui disparaît sous 768px au profit d'un sélecteur ;
 *   3. …et rien pour les PARTIES d'une même vue.
 *
 * Sans ce troisième cran, une page à six parties n'avait qu'une réponse : les
 * empiler toutes dans un rouleau de quatre écrans, et laisser le trader
 * chercher. Le Plan de trading faisait exactement ça — six sections
 * `glass-strong` ouvertes en même temps, dont il n'en modifie qu'une.
 *
 * `SubNav` rend UNE partie à la fois, nomme celle qu'on regarde, et tient sur
 * un téléphone (elle défile horizontalement au lieu de passer sur deux
 * lignes). Elle ne remplace jamais la navigation de section : elle vit à
 * l'intérieur d'une page, sous la barre de tête.
 */

export interface SubNavItem<T extends string> {
  id: T;
  label: string;
  /** Icône optionnelle — toujours accompagnée du libellé, jamais seule. */
  icon?: ReactNode;
  /** Compteur discret (nombre d'éléments de l'onglet). */
  count?: number;
}

export function SubNav<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: readonly SubNavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  // Flèches gauche/droite : c'est un `tablist`, il se parcourt au clavier.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = Math.max(
      0,
      items.findIndex((it) => it.id === value),
    );
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (i + delta + items.length) % items.length;
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn("tv-subnav", className)}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.id)}
            className={cn("tv-subnav-item", active && "tv-subnav-item-active")}
          >
            {it.icon}
            <span>{it.label}</span>
            {it.count !== undefined && <span className="tv-subnav-count">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * La barre d'outils de page : la navigation secondaire à gauche, les commandes
 * de la vue à droite, sur UNE ligne collante.
 *
 * Collante, parce que c'est ce qui distingue une navigation d'une rangée de
 * boutons : on change de vue depuis n'importe quel point du défilement. Le
 * `top-0` s'appuie sur `main`, qui est la fenêtre de défilement de
 * l'application — pas sur la fenêtre du navigateur.
 */
export function PageToolbar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("tv-toolbar", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1.5 pr-1">{actions}</div>}
    </div>
  );
}
