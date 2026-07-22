import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Heading } from "./Typography";

/**
 * Card — the surface primitive. Variants map to the existing glass classes so
 * output matches today's cards:
 *
 *   glass        → `.glass` (deep-navy translucent panel)
 *   glass-strong → `.glass-strong` (opaque, for modals/menus)
 *   plain        → the recurring `rounded-2xl border border-white/[.06] bg-white/[.015]`
 *
 * `hover` adds the `.card-premium` lift (transition-safe, no layout impact).
 */

export type CardVariant = "glass" | "glass-strong" | "plain";

const VARIANT: Record<CardVariant, string> = {
  glass: "glass rounded-2xl",
  "glass-strong": "glass-strong rounded-2xl",
  plain: "rounded-2xl border border-white/[0.06] bg-white/[0.015]",
};

export function Card({
  variant = "glass",
  hover = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant; hover?: boolean }) {
  return (
    <div className={cn(VARIANT[variant], hover && "card-premium", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between gap-3 p-5 pb-0", className)} {...rest}>
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

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...rest}>
      {children}
    </div>
  );
}
