import type { ComponentProps } from "react";
import { cn } from "./cn";
import { density } from "./tokens";

/**
 * Le cadre commun reprend les marges du calendrier. Les pages de lecture
 * peuvent limiter leur largeur ; les vues mesurées transmettent leur ref
 * directement au cadre, sans ajouter une deuxième couche de padding.
 */
export function PageContainer({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("tv-page mx-auto w-full min-w-0 max-w-[1200px]", density.pagePad, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
