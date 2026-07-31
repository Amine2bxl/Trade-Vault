import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Button — the single button contract. `primary` and `ghost` map to the
 * existing `.btn-primary` / `.btn-ghost` CSS (defined in styles.css) so they
 * render pixel-identically to today's buttons; `subtle` and `danger` compose
 * the ad-hoc Tailwind patterns already used across the app into named variants.
 *
 * `className` is merged last (twMerge), so any caller override wins.
 */

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "accent";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  // Reuse the existing global classes verbatim — identical output.
  primary: "btn-primary",
  ghost: "btn-ghost",
  // Named versions of the recurring inline styles.
  subtle:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] " +
    "bg-white/[0.03] font-semibold text-slate-300 transition-all hover:bg-white/5 hover:text-white",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 " +
    "bg-red-500/10 font-semibold text-red-400 transition-all hover:bg-red-500/15 hover:text-red-300",
  // Same toolbar shape as `subtle` (Export CSV / Delete all) but tinted with the
  // product accent so the primary action stands out while staying in the family.
  accent:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 " +
    "bg-cyan-500/10 font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:text-cyan-200",
};

// Composed variants get Tailwind sizing; the CSS-class variants (`.btn-*`)
// carry their own padding, so `sm` swaps in the shared `.btn-sm` modifier
// instead of fighting the cascade with utilities.
const SIZE: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-xs",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", type = "button", className, ...rest },
  ref,
) {
  const composed = variant === "subtle" || variant === "danger" || variant === "accent";
  return (
    <button
      ref={ref}
      type={type}
      className={cn(VARIANT[variant], composed ? SIZE[size] : size === "sm" && "btn-sm", className)}
      {...rest}
    />
  );
});
