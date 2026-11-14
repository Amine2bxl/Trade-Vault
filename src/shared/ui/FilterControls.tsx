import { useId, useRef, useState, type ReactNode } from "react";
import { Check, RotateCcw, SlidersHorizontal } from "./icons";
import { numericText } from "./NumericText";
import { SelectionPanel } from "./SelectionPanel";

/** Un accès, un résumé, des choix directs et une application immédiate.
 * Toutes les familles sont ouvertes : un filtre est à deux gestes au plus. */
export function FilterControls({
  label,
  summary,
  count = 0,
  onReset,
  resetLabel,
  doneLabel,
  liveLabel,
  children,
}: {
  label: string;
  summary?: string;
  count?: number;
  onReset: () => void;
  resetLabel: string;
  doneLabel: string;
  liveLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const id = useId();
  return (
    <div ref={anchor} className="tv-filter-controls">
      <button
        type="button"
        className="tv-filter-trigger"
        aria-label={summary ? `${label}: ${summary}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-active={count > 0 || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" />
        <span className="tv-filter-summary">{numericText(summary || label)}</span>
        {count > 0 && <span className="tv-num tv-page-controls-count">{count}</span>}
      </button>
      <SelectionPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        label={label}
        width="25rem"
        footer={
          <div className="tv-filter-footer">
            <button type="button" onClick={onReset} disabled={count === 0} className="tv-pick-foot">
              <RotateCcw className="h-3.5 w-3.5" />
              {resetLabel}
            </button>
            <span className="tv-filter-live">{liveLabel}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tv-pick-foot tv-pick-foot-main"
            >
              <Check className="h-3.5 w-3.5" />
              {doneLabel}
            </button>
          </div>
        }
      >
        <div id={id} className="tv-filter-body">
          {children}
        </div>
      </SelectionPanel>
    </div>
  );
}

/**
 * Une famille de filtres, TOUJOURS dépliée.
 *
 * C'était un accordéon exclusif : ouvrir le panneau, déplier la section,
 * puis choisir — trois gestes, et une seule famille visible à la fois. Le
 * propriétaire veut deux gestes au plus et tout réglable d'un coup : le
 * panneau s'ouvre sur toutes les familles, chacune avec ses choix directs.
 * Le libellé porte la valeur active à droite, lisible d'un regard.
 * (`defaultOpen` est conservé pour les appelants : toutes sont ouvertes.)
 */
export function FilterSection({
  label,
  summary,
  children,
}: {
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="tv-filter-section" aria-label={label}>
      <div className="tv-filter-section-head">
        <span>{label}</span>
        <span className="tv-filter-section-value">{numericText(summary)}</span>
      </div>
      <div className="tv-filter-section-body">{children}</div>
    </section>
  );
}
