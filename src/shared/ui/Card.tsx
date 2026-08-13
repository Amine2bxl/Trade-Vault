import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Heading } from "./Typography";
import { density } from "./tokens";

/**
 * Card — the surface primitive. Variants map to the design-system surfaces:
 *
 *   glass        → `.glass` (panel surface)
 *   glass-strong → `.glass-strong` (raised surface, for modals/menus)
 *   plain        → bare surfaced panel
 *   solid        → `.stat-card` (dense dashboard tile)
 *   inset        → nested inset surface
 *
 * `hover` adds the `.card-premium` lift (transition-safe, no layout impact).
 */

export type CardVariant = "glass" | "glass-strong" | "plain" | "solid" | "inset";

const VARIANT: Record<CardVariant, string> = {
  glass: "glass",
  "glass-strong": "glass-strong",
  plain: "bg-surface border border-border rounded-md",
  solid: "stat-card",
  inset: "bg-raised border border-border rounded-md",
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
