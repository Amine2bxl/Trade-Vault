import type { ElementType, HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * Typography — a role-based type scale so hierarchy is named, not expressed as
 * arbitrary pixel sizes scattered across the app. Uses Inter only in the app,
 * with a sober weight range (400–600) per DESIGN_SYSTEM.md.
 *
 *   Display  → hero (landing)          font-semibold, fluid clamp
 *   Heading level 1..3 → page/section  font-semibold
 *   Text     → body / caption          system font
 *   Label    → compact uppercase label (the canonical field label used everywhere)
 *
 * All components accept `className` (merged last, so overrides win) and `as`
 * to change the rendered element without losing the role styles.
 */

type WithAs<P> = P & { as?: ElementType; className?: string; children?: ReactNode };

/** Hero display type. Fluid — matches the landing hero sizing. */
export function Display({ as, className, children, ...rest }: WithAs<HTMLAttributes<HTMLElement>>) {
  const Comp = as ?? "h1";
  return (
    <Comp
      className={cn(
        "font-semibold tracking-[-0.02em] leading-[1.1]",
        "text-[clamp(2.6rem,5.4vw,4.5rem)] text-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

const HEADING_ROLE: Record<1 | 2 | 3, string> = {
  1: "text-2xl font-semibold tracking-[-0.02em]",
  2: "text-lg font-semibold tracking-[-0.01em]",
  3: "text-sm font-semibold",
};

/** Section/page heading. `level` sets the visual role; `as` sets the tag. */
export function Heading({
  level = 2,
  as,
  className,
  children,
  ...rest
}: WithAs<HTMLAttributes<HTMLHeadingElement>> & { level?: 1 | 2 | 3 }) {
  const Comp = as ?? (`h${level}` as ElementType);
  return (
    <Comp className={cn("text-primary", HEADING_ROLE[level], className)} {...rest}>
      {children}
    </Comp>
  );
}

const TEXT_TONE = {
  default: "text-primary",
  muted: "text-secondary",
  subtle: "text-tertiary",
} as const;

const TEXT_SIZE = {
  body: "text-sm",
  caption: "text-xs",
} as const;

/** Body / caption text. Floors at 12px (`caption`) — no sub-12px roles. */
export function Text({
  size = "body",
  tone = "default",
  as,
  className,
  children,
  ...rest
}: WithAs<HTMLAttributes<HTMLElement>> & {
  size?: keyof typeof TEXT_SIZE;
  tone?: keyof typeof TEXT_TONE;
}) {
  const Comp = as ?? "p";
  return (
    <Comp className={cn(TEXT_SIZE[size], TEXT_TONE[tone], className)} {...rest}>
      {children}
    </Comp>
  );
}

/**
 * Compact uppercase label — the exact skin used for every form/field label in
 * the product (`text-[10px] font-medium uppercase tracking-wider`). Kept as a
 * single role so the ~hundreds of ad-hoc copies can converge here over time.
 */
export function Label({
  as,
  className,
  children,
  ...rest
}: WithAs<LabelHTMLAttributes<HTMLLabelElement>>) {
  const Comp = as ?? "label";
  return (
    <Comp
      className={cn(
        "block text-[10px] font-medium uppercase tracking-wider text-secondary",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
