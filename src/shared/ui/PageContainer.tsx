import type { ComponentProps, CSSProperties } from "react";
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
 *
 * `fit` + `height` : UNE APP, PAS UNE PAGE QUI DÉFILE. Sur ordinateur (≥ 1024px
 * de large, ≥ 640px de haut), le cadre prend exactement la hauteur mesurée par
 * `useAvailableHeight()` (ref transmise via `ref`) et devient une colonne
 * flex : la page se compose dans l'écran, ce qui est long vit dans une
 * `ScrollArea`. En dessous (téléphone, fenêtre basse), rien ne change : la
 * page coule et défile comme avant.
 */
export function PageContainer({
  className,
  children,
  measure,
  fit,
  height,
  style,
  ...rest
}: ComponentProps<"div"> & { measure?: "settings"; fit?: boolean; height?: number }) {
  const fitStyle =
    fit && height !== undefined ? ({ ...style, "--fit-h": `${height}px` } as CSSProperties) : style;
  if (measure === "settings") {
    return (
      <div
        className={cn(
          "tv-page mx-auto w-full min-w-0",
          PAGE_WIDTH,
          density.pagePad,
          fit && "tv-fit",
        )}
        style={fitStyle}
        {...rest}
      >
        <div className={cn("w-full min-w-0", SETTINGS_WIDTH, fit && "tv-fit-col", className)}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "tv-page mx-auto w-full min-w-0",
        PAGE_WIDTH,
        density.pagePad,
        fit && "tv-fit",
        className,
      )}
      style={fitStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
