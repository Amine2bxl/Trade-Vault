import type { ReactNode } from "react";
import { cn } from "./cn";
import { density, type } from "./tokens";

/**
 * PageHeader — le seul motif de titre de page.
 *
 * PAS DE SOUS-TITRE. Il y en avait un sur presque toutes les pages, et il
 * répétait ce que le titre disait déjà (« Journal » / « Tous tes trades »).
 * Une ligne grise sous chaque titre, sur vingt-et-un écrans, c'est vingt-et-une
 * phrases à lire avant d'arriver au contenu — et personne ne les lit deux fois.
 * Ce qui a besoin d'être expliqué se met à côté de ce qui a besoin d'être
 * expliqué, pas en haut de page.
 */
export function PageHeader({
  title,
  eyebrow,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  /** Optional small accent line above the title (greeting, breadcrumb). */
  eyebrow?: ReactNode;
  /** Optional icon rendered inline, just before the title text. */
  icon?: ReactNode;
  /** Right-aligned actions (primary CTA, filters). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        density.sectionGap,
        "animate-fade-in-up flex items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow}
        <div className="flex items-center gap-2.5">
          {icon}
          <h1
            className={cn(
              type.h1,
              "bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent",
            )}
          >
            {title}
          </h1>
        </div>
      </div>
      {actions}
    </div>
  );
}

/**
 * SectionHeader — intra-page section title (above a card group or table).
 * One consistent size step below PageHeader, with optional right-side action.
 */
export function SectionHeader({
  title,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-2", className)}>
      <h2 className={cn("flex items-center gap-2 text-white", type.h2)}>
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
