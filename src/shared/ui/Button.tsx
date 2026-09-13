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
  // Named versions of the recurring inline styles — calm, hairline-bordered.
  subtle:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--tv-border)] " +
    "bg-transparent font-medium text-slate-400 transition " +
    "hover:border-[var(--tv-border-strong)] hover:bg-white/[0.04] hover:text-white",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/20 " +
    "bg-transparent font-medium text-red-400/90 transition hover:bg-red-500/10 hover:text-red-300",
  /* LE BARREAU DU MILIEU.
     Entre `subtle` (filet gris, texte gris) et `primary` (vert plein, texte
     blanc), il manquait la marche : un bouton qui se lit comme l'action
     principale de SA page sans être le bloc vert du produit. `accent` la tenait
     déjà par la couleur, mais avec un fond transparent il ressemblait à un
     contour posé à côté de vrais boutons — il se fondait trop.
     Il a maintenant un fond, faible mais présent : la même forme et le même
     poids que `subtle`, la teinte de l'accent en plus. Un écran peut donc
     porter un seul vert plein (l'action du produit) et plusieurs actions de
     page identifiées, sans que trois verts se disputent. */
  accent:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--tv-border-accent)] " +
    "bg-[rgb(var(--tv-accent-rgb)/0.10)] font-semibold text-[var(--tv-highlight)] transition " +
    "hover:border-[rgb(var(--tv-accent-rgb)/0.55)] hover:bg-[rgb(var(--tv-accent-rgb)/0.18)]",
};

// Composed variants get Tailwind sizing; the CSS-class variants (`.btn-*`)
// carry their own padding, so `sm` swaps in the shared `.btn-sm` modifier
// instead of fighting the cascade with utilities.
const SIZE: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
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
