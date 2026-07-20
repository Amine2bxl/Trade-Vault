import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Badge — small status pill. Variants encode the product's semantic colours
 * (profit/loss/warning/accent) using the exact tint patterns already used
 * inline across the app, so adopting them changes nothing visually while giving
 * profit/loss a single source of truth.
 */

export type BadgeVariant = "neutral" | "profit" | "loss" | "warning" | "accent";

const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-white/[0.06] border-white/10 text-slate-300",
  profit: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
  loss: "bg-red-500/15 border-red-500/25 text-red-400",
  warning: "bg-amber-500/10 border-amber-500/25 text-amber-400",
  accent: "bg-cyan-500/15 border-cyan-500/25 text-cyan-300",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold",
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
