import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * ActionButton — l'action ronde de Revolut : un disque de 52 px et son libellé
 * dessous. Sert aux rangées d'actions rapides (ajouter un trade, importer,
 * checklist, Jarvis…). Une rangée porte au plus UN disque `primary` (plein,
 * accent) ; les autres sont des plaques. Styles : `.tv-action*` (styles.css).
 *
 * Le libellé visible nomme l'action : pas besoin d'`aria-label`.
 */
export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: ReactNode;
  variant?: "default" | "primary";
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { icon, label, variant = "default", type = "button", className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("tv-action", variant === "primary" && "tv-action-primary", className)}
      {...rest}
    >
      <span className="tv-action-disc" aria-hidden>
        {icon}
      </span>
      <span className="tv-action-label">{label}</span>
    </button>
  );
});
