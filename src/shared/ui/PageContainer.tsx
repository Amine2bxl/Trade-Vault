import type { HTMLAttributes } from "react";
import { cn } from "./cn";
import { density } from "./tokens";

/**
 * PageContainer — the single page shell. Replaces the
 * `p-4 md:p-8 max-w-[1400px] mx-auto` wrapper that every screen re-declared,
 * so page gutters and max width evolve in one place.
 *
 * Gutters follow the density contract (tighter than the previous md:p-8), which
 * is what makes the product read as a dense tool rather than a marketing page.
 */
export function PageContainer({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(density.pagePad, "max-w-[1400px] mx-auto", className)} {...rest}>
      {children}
    </div>
  );
}
