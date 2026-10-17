import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from "./icons";
import { numericText } from "./NumericText";
import { SelectionPanel } from "./SelectionPanel";

const FilterGroup = createContext("");

/** Un accès, un résumé, des choix directs et une application immédiate.
 * Les sections partagent un accordéon natif pour éviter les menus imbriqués. */
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
        <FilterGroup.Provider value={id}>
          <div id={id} className="tv-filter-body">
            {children}
          </div>
        </FilterGroup.Provider>
      </SelectionPanel>
    </div>
  );
}

/** La valeur active reste visible même quand le groupe est replié. */
export function FilterSection({
  label,
  summary,
  defaultOpen = false,
  children,
}: {
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const group = useContext(FilterGroup);
  return (
    <details name={group || undefined} open={defaultOpen} className="tv-filter-section">
      <summary>
        <span>{label}</span>
        <span className="tv-filter-section-value">{numericText(summary)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </summary>
      <div className="tv-filter-section-body">{children}</div>
    </details>
  );
}
