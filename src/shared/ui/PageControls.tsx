import { useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "./icons";
import { SelectionPanel } from "./SelectionPanel";

/** Les filtres secondaires restent à portée sans ajouter une rangée de
 * réglages à la page. Même panneau et mêmes gestes que tous les sélecteurs. */
export function PageControls({
  label,
  count = 0,
  closeOnAction = false,
  icon,
  iconOnly = false,
  children,
}: {
  label: string;
  count?: number;
  closeOnAction?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchor} className="shrink-0">
      <button
        type="button"
        className="tv-page-controls-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? <SlidersHorizontal className="h-4 w-4" />}
        <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
        {count > 0 && <span className="tv-figure tv-page-controls-count">{count}</span>}
      </button>
      <SelectionPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        label={label}
        width="22rem"
      >
        <div
          className="tv-page-controls-body"
          onClick={closeOnAction ? () => setOpen(false) : undefined}
        >
          {children}
        </div>
      </SelectionPanel>
    </div>
  );
}
