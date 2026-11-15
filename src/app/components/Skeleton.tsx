import { cn } from "@/shared/ui/cn";

/**
 * La plaque d'attente — une place RÉSERVÉE, invisible.
 *
 * Les squelettes de page ont été retirés le 2026-11-15 (« pas de chargement
 * squelette, des pages en un temps ») : `shell/PageTransition.tsx` porte
 * maintenant l'attente (`PageLoader`). Cette plaque ne sert plus qu'à tenir
 * la hauteur d'un bloc qui charge, pour que rien ne bouge à son arrivée ;
 * `.skeleton` ne peint plus rien.
 */

/** Shimmering placeholder block. `style` carries the odd computed width that
 *  would otherwise need a one-off Tailwind class per skeleton row. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton rounded-xl", className)} style={style} />;
}
