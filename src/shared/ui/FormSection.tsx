import type { ReactNode } from "react";
import { Check } from "./icons";
import { cn } from "./cn";

/**
 * Les repères d'un formulaire de saisie (trade, setup manqué).
 *
 * `FormSection` : une section NUMÉROTÉE dont le numéro devient une coche quand
 * ses champs obligatoires sont remplis — le trader voit d'un coup d'œil ce qui
 * reste à saisir, et où. `FormLabel` : le libellé d'un champ, avec une
 * pastille facultative (`ok` défini : ambre tant que le champ est vide, menthe
 * une fois rempli) ou une couleur de catégorie (`dot`).
 */

export const FORM_LABEL = "tv-label mb-1 block text-slate-400";

export function FormSection({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="tv-trade-section" style={{ animationDelay: `${(n - 1) * 40}ms` }}>
      <div className="tv-trade-section-head">
        <span className="tv-trade-step tv-figure" data-done={!!done}>
          {done ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
        </span>
        <h3 className="tv-label text-slate-300">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function FormLabel({
  children,
  ok,
  dot,
  className,
}: {
  children: ReactNode;
  /** Champ obligatoire : `false` = à remplir, `true` = rempli. */
  ok?: boolean;
  /** Couleur de catégorie (CSS), pour relier le champ à son affichage. */
  dot?: string;
  className?: string;
}) {
  return (
    <span className={cn(FORM_LABEL, "flex items-center gap-1.5", className)}>
      {dot && <span className="tv-trade-req" style={{ background: dot }} aria-hidden />}
      {children}
      {ok !== undefined && <span className="tv-trade-req" data-ok={ok} aria-hidden />}
    </span>
  );
}
