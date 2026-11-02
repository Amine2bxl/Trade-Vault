import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button as GlassButton } from "glisse";
import { cn } from "./cn";

/**
 * Button — LE bouton du produit, en verre liquide d'iOS 26 (Glisse).
 *
 * L'API ne change pas (`variant`, `size`, `className`) : les écrans qui
 * utilisaient `<Button>` passent en Glisse sans être touchés. Dessous, c'est le
 * `Button` de Glisse, avec son geste — il se SOULÈVE sous le doigt, s'étire
 * vers où l'on glisse, s'éclaircit. Verre plat, sans flou ni réfraction du
 * fond (bloc « LA BULLE, SOBRE » de `styles.css`).
 *
 * Correspondance :
 *   primary / entry → `filled` : la capsule pleine à l'accent du thème, texte
 *                     blanc. Une seule par écran, pour l'action principale.
 *   ghost / subtle  → `glass` : la capsule de verre clair.
 *   accent          → `glass` teinté : le libellé prend l'accent.
 *   danger          → `glass` destructif : le libellé rouge.
 *
 * `size="sm"` : capsule de 32 px (`.tv-btn-sm`). `className` passe en dernier :
 * un utilitaire Tailwind d'un appelant l'emporte toujours sur Glisse, rangé
 * dans la couche `components`.
 */

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "accent" | "entry";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Pictogramme placé avant le libellé. Seul (sans enfants), le bouton est
   *  un CERCLE de verre : lui donner un `aria-label`. */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", type = "button", className, icon, ...rest },
  ref,
) {
  const filled = variant === "primary" || variant === "entry";
  return (
    <GlassButton
      ref={ref}
      type={type}
      variant={filled ? "filled" : "glass"}
      icon={icon}
      destructive={variant === "danger"}
      tint={variant === "accent" ? "var(--tv-highlight)" : undefined}
      className={cn(
        "tv-btn",
        variant === "entry" && "tv-entry-button",
        size === "sm" && "tv-btn-sm",
        className,
      )}
      {...rest}
    />
  );
});
