import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * LA RÉGION QUI DÉFILE, DANS UNE PAGE QUI NE DÉFILE PAS.
 *
 * Dans un `PageContainer fit`, la page tient dans l'écran ; ce qui est long
 * par nature (une liste, un tableau, un fil) défile ICI, à l'intérieur de sa
 * carte, sans entraîner l'en-tête ni le reste de la page. En dehors du mode
 * ajusté (téléphone, fenêtre basse), c'est un bloc ordinaire.
 */
export function ScrollArea({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("tv-scroll", className)} {...rest}>
      {children}
    </div>
  );
}
