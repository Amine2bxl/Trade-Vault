import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Heading } from "./Typography";
import { density } from "./tokens";

/**
 * Card — la primitive de surface. Depuis la refonte, les cinq variantes rendent
 * la MÊME matière (une plaque opaque + un liseré) : ce qui les distingue est la
 * VALEUR de la plaque, c'est-à-dire la profondeur.
 *
 *   glass / plain / solid → plaque 1 — une carte posée sur la page
 *   inset                 → plaque 2 — un bloc DANS une carte
 *   glass-strong          → plaque 2 + ombre — ce qui flotte (modale, menu)
 *
 * `hover` ajoute `.card-premium` : la carte s'ÉCLAIRCIT au survol, elle ne se
 * soulève plus et ne s'allume plus.
 */

export type CardVariant = "glass" | "glass-strong" | "plain" | "solid" | "inset";

const VARIANT: Record<CardVariant, string> = {
  glass: "glass rounded-2xl",
  "glass-strong": "glass-strong rounded-2xl",
  plain: "rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]",
  solid: "stat-card",
  inset: "bg-[var(--tv-plate-2)] border border-[var(--tv-border)] rounded-xl",
};

/** Inner padding steps, straight from the density scale. */
export type CardPad = "default" | "tight" | "loose" | "none";

const PAD: Record<CardPad, string> = {
  default: density.cardPad,
  tight: density.cardPadTight,
  loose: density.cardPadLoose,
  none: "",
};

export function Card({
  variant = "glass",
  hover = false,
  pad = "none",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  hover?: boolean;
  /** Inner padding from the density scale. `none` (default) keeps the card bare. */
  pad?: CardPad;
}) {
  return (
    <div className={cn(VARIANT[variant], hover && "card-premium", PAD[pad], className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5",
        density.cardPad,
        "pb-0",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Heading level={3} className={className}>
      {children}
    </Heading>
  );
}

export function CardBody({
  pad = "default",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { pad?: CardPad }) {
  return (
    <div className={cn(PAD[pad], className)} {...rest}>
      {children}
    </div>
  );
}
