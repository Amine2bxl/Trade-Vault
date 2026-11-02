import { useId, type ReactNode } from "react";
import { ChevronDown } from "@/shared/ui/icons";
import { cn } from "./cn";

/** Choix courts : même hauteur, typographie et état neutre que les filtres. */
export function ChoiceGroup<V extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: V | null;
  options: readonly { value: V; label: string; icon?: ReactNode; tone?: "positive" | "negative" }[];
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("tv-choice-group", className)}
      onKeyDown={(e) => {
        const delta =
          e.key === "ArrowRight" || e.key === "ArrowDown"
            ? 1
            : e.key === "ArrowLeft" || e.key === "ArrowUp"
              ? -1
              : 0;
        if (!delta && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        const i = Math.max(
          0,
          options.findIndex((o) => o.value === value),
        );
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? options.length - 1
              : (i + delta + options.length) % options.length;
        onChange(options[next].value);
        e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
      }}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value || (value === null && i === 0) ? 0 : -1}
          data-tone={o.tone}
          onClick={() => onChange(o.value)}
          className={cn("tv-choice", o.value === value && "tv-choice-on")}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Les options avancées se replient sans animation de hauteur ni montage
 * d'un deuxième formulaire. Un seul patron pour tous les sous-groupes. */
export function Disclosure({
  title,
  open,
  onChange,
  children,
  className,
}: {
  title: string;
  open: boolean;
  onChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={cn("tv-disclosure", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onChange(!open)}
        className="tv-disclosure-toggle"
      >
        <span>{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-slate-500", open && "rotate-180")} />
      </button>
      {open && (
        <div id={id} className="tv-disclosure-body">
          {children}
        </div>
      )}
    </section>
  );
}
