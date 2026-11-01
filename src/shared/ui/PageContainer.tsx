import type { ComponentProps } from "react";
import { cn } from "./cn";
import { PAGE_WIDTH, SETTINGS_WIDTH, density } from "./tokens";

/**
 * Le cadre commun reprend les marges du calendrier. Les pages de lecture
 * peuvent limiter leur largeur ; les vues mesurées transmettent leur ref
 * directement au cadre, sans ajouter une deuxième couche de padding.
 *
 * `measure="settings"` : les pages de réglages gardent le cadre de toutes les
 * pages (même largeur que l'en-tête, donc même bord gauche que le titre et
 * les onglets) et posent dedans une COLONNE de lecture alignée à gauche. Une
 * colonne centrée à part décalait le contenu de l'en-tête : on passait d'une
 * page à l'autre et le bord gauche bougeait. `className` vise la colonne.
 */
export function PageContainer({
  className,
  children,
  measure,
  ...rest
}: ComponentProps<"div"> & { measure?: "settings" }) {
  if (measure === "settings") {
    return (
      <div className={cn("tv-page mx-auto w-full min-w-0", PAGE_WIDTH, density.pagePad)} {...rest}>
        <div className={cn("w-full min-w-0", SETTINGS_WIDTH, className)}>{children}</div>
      </div>
    );
  }
  return (
    <div
      className={cn("tv-page mx-auto w-full min-w-0", PAGE_WIDTH, density.pagePad, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
