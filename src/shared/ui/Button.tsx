import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Button — the single button contract. `primary` and `ghost` map to the
 * existing `.btn-primary` / `.btn-ghost` CSS (defined in styles.css). `subtle`,
 * `danger` and `accent` compose the recurring Tailwind patterns using the
 * design-system tokens so they stay consistent across themes.
 *
 * `className` is merged last (twMerge), so any caller override wins.
 */

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "accent";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  // Reuse the existing global classes verbatim.
  primary: "btn-primary",
  ghost: "btn-ghost",
  // Named versions of the recurring inline styles, using design-system tokens.
  subtle:
    "inline-flex items-center justify-center gap-2 rounded-md border border-border " +
    "bg-transparent font-medium text-secondary transition hover:bg-hover hover:text-primary",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-red-500/25 " +
    "bg-red-500/10 font-medium text-red-500 transition hover:bg-red-500/15 hover:text-red-400",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-md border border-accent/30 " +
    "bg-accent-subtle font-medium text-accent transition hover:bg-accent/15 hover:text-accent-hover",
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
