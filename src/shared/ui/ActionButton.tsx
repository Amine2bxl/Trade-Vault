import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button as GlassButton } from "glisse";
import { cn } from "./cn";

/**
 * ActionButton — l'action ronde : un disque de verre liquide (Glisse) de
 * 52 px et son libellé dessous. Sert aux rangées d'actions rapides (ajouter un
 * trade, importer, checklist, Jarvis…). Une rangée porte au plus UN disque
 * `primary` (plein, accent) ; les autres sont du verre clair.
 *
 * Le disque EST le bouton : c'est lui qui se soulève et s'éclaircit sous le
 * doigt, comme sur iOS 26. Le libellé le nomme (`aria-labelledby`) et le
 * déclenche aussi au clic, pour garder la grande cible d'avant.
 */
export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: ReactNode;
  variant?: "default" | "primary";
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { icon, label, variant = "default", type = "button", className, disabled, ...rest },
  ref,
) {
  const labelId = useId();
  return (
    <div
      className={cn(
        "tv-action",
        variant === "primary" && "tv-action-primary",
        disabled && "tv-action-disabled",
        className,
      )}
    >
      <GlassButton
        ref={ref}
        type={type}
        icon={icon}
        variant={variant === "primary" ? "filled" : "glass"}
        aria-labelledby={labelId}
        disabled={disabled}
        className="tv-action-disc"
        {...rest}
      />
      {/* Le libellé déclenche le disque : un clic sur le texte, comme avant,
          lance l'action. Il n'est pas focalisable, le disque l'est. */}
      <span
        id={labelId}
        className="tv-action-label"
        onClick={(e) => {
          const disc = e.currentTarget.previousElementSibling;
          if (disc instanceof HTMLButtonElement && !disc.disabled) disc.click();
        }}
      >
        {label}
      </span>
    </div>
  );
});
