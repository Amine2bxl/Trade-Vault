import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "./cn";
import { FIELD_BASE } from "./Input";
import { usePopPlacement } from "./usePopPlacement";
import { DateField } from "./DateField";

/**
 * LES SÉLECTEURS TRADEVAULT — une seule famille pour tout ce qui se choisit.
 *
 * Le produit avait un calendrier et une roue d'heure à lui, et, à côté, des
 * `<select>` natifs : une liste blanche du système au milieu d'une application
 * noire, des pastilles de filtre qui ouvraient cette même liste, et aucune
 * façon de choisir PLUSIEURS jours ou plusieurs setups. Trois générations de
 * composants dans un même écran.
 *
 * Ici, un seul langage, celui du sélecteur de date (`.tv-pop`) :
 *   - la même plaque, le même rayon, la même profondeur, la même entrée ;
 *   - un déclencheur en deux formes — PASTILLE de filtre (nom + valeur) ou
 *     CHAMP de formulaire ;
 *   - sur bureau, un panneau ancré sous son déclencheur ; sur téléphone, le
 *     même panneau CENTRÉ au-dessus d'un voile (jamais une feuille qui jaillit
 *     du bas, jamais rogné par la colonne qui défile) ;
 *   - Échap et le clic dehors ferment, le clavier parcourt la liste ;
 *   - une recherche apparaît d'elle-même au-delà de huit options.
 *
 * Trois formes : `SelectPicker` (un choix), `MultiPicker` (plusieurs, avec
 * « tout ») et `RangePicker` (raccourcis de période + de/à personnalisés).
 * Chacune a une variante `inline` : le corps du panneau posé à plat, pour une
 * feuille de filtres qui est déjà elle-même un panneau.
 */

export interface PickerOption<V extends string = string> {
  value: V;
  label: string;
  /** Ligne secondaire, en petit. */
  hint?: string;
  /** Nombre d'éléments derrière l'option (trades, notifications…). */
  count?: number;
}

type Variant = "pill" | "field";

/* ── Le point de rupture, sans dépendre de `app/` ── */
const NARROW = "(max-width: 639px)";
function subscribeNarrow(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => typeof window !== "undefined" && !!window.matchMedia?.(NARROW).matches,
    () => false,
  );
}

/* ── Le panneau : ancré (bureau) ou centré (téléphone) ──
   Exporté pour les autres membres de la famille (sélecteur de couleur). */
export function PickerPanel({
  open,
  onClose,
  anchorRef,
  label,
  width = "17rem",
  overflowVisible = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  label: string;
  width?: string;
  /** Laisse déborder un sous-panneau (le calendrier d'un champ de date). */
  overflowVisible?: boolean;
  children: ReactNode;
}) {
  const narrow = useNarrow();
  const panRef = useRef<HTMLDivElement | null>(null);
  const pose = usePopPlacement(panRef, open && !narrow);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Une modale en dessous ne doit pas se fermer avec le sélecteur.
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  if (narrow && typeof document !== "undefined") {
    return createPortal(
      <div className="tv-pick-wrap fixed inset-0 z-[var(--tv-z-modal-top)] flex items-center justify-center p-4">
        <div className="tv-pick-veil absolute inset-0" aria-hidden />
        <div
          ref={panRef}
          role="dialog"
          aria-label={label}
          className={cn(
            "tv-pop tv-pick-in relative flex w-full max-w-sm flex-col",
            !overflowVisible && "max-h-[78dvh] overflow-hidden",
          )}
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3.5">
            <span className="tv-label text-slate-400">{label}</span>
            <button type="button" onClick={onClose} className="tv-pop-nav -mr-1.5" aria-label="×">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div
      ref={panRef}
      role="dialog"
      aria-label={label}
      style={{ width: `max(100%, ${width})` }}
      className={cn(
        "tv-pop tv-pick-in absolute z-[var(--tv-z-modal-top)] flex flex-col",
        !overflowVisible && "max-h-[min(26rem,70vh)] overflow-hidden",
        pose.align === "end" ? "right-0" : "left-0",
        pose.side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
      )}
    >
      {children}
    </div>
  );
}

/* ── Le déclencheur ── */
function Trigger({
  variant,
  label,
  display,
  active,
  open,
  disabled,
  onClick,
  className,
  icon,
  id,
}: {
  variant: Variant;
  label: string;
  display: string;
  active: boolean;
  open: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  icon?: ReactNode;
  id: string;
}) {
  if (variant === "field") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={id}
        className={cn(
          FIELD_BASE,
          "flex h-11 items-center gap-2 text-left disabled:opacity-50",
          open && "border-[var(--tv-border-accent)]",
          className,
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={id}
      className={cn(
        "tv-pick-pill",
        active && "tv-pick-pill-on",
        open && "tv-pick-pill-open",
        className,
      )}
    >
      {icon}
      <span className="tv-label shrink-0 text-slate-500">{label}</span>
      <span className="tv-pick-pill-value">{display}</span>
      <ChevronDown
        className={cn("h-3 w-3 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

/* ── La liste d'options (partagée par simple et multiple) ── */
function OptionList<V extends string>({
  options,
  isOn,
  onPick,
  multi,
  searchLabel,
  id,
}: {
  options: PickerOption<V>[];
  isOn: (v: V) => boolean;
  onPick: (v: V) => void;
  multi: boolean;
  searchLabel: string;
  id: string;
}) {
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLUListElement | null>(null);
  const searchable = options.length > 8;
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n
      ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(n))
      : options;
  }, [options, q]);

  // À l'ouverture, l'option choisie est sous les yeux — pas vingt lignes plus bas.
  useEffect(() => {
    const on = listRef.current?.querySelector<HTMLElement>("[aria-selected='true']");
    on?.scrollIntoView({ block: "nearest" });
    if (!searchable) (on ?? listRef.current?.querySelector<HTMLElement>("button"))?.focus();
  }, [searchable]);

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      items[e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)];
    next?.focus();
  };

  return (
    <>
      {searchable && (
        <div className="shrink-0 px-2.5 pb-1 pt-2.5">
          <label className="tv-pick-search">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  listRef.current?.querySelector<HTMLElement>("button")?.focus();
                }
              }}
              placeholder={searchLabel}
              aria-label={searchLabel}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </label>
        </div>
      )}
      <ul
        ref={listRef}
        id={id}
        role="listbox"
        aria-multiselectable={multi || undefined}
        onKeyDown={move}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
      >
        {shown.map((o) => {
          const on = isOn(o.value);
          return (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onPick(o.value)}
                className={cn("tv-pick-opt", on && "tv-pick-opt-on")}
              >
                <span
                  aria-hidden
                  className={cn(multi ? "tv-pick-box" : "tv-pick-dot", on && "is-on")}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && (
                    <span className="block truncate text-[11px] text-slate-500">{o.hint}</span>
                  )}
                </span>
                {o.count !== undefined && (
                  <span className="tv-figure text-[11px] text-slate-500">{o.count}</span>
                )}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-500">—</li>}
      </ul>
    </>
  );
}

/* ══ SELECT — un choix ══════════════════════════════════════════════════ */

export interface SelectPickerProps<V extends string> {
  label: string;
  value: V;
  options: PickerOption<V>[];
  onChange: (v: V) => void;
  variant?: Variant;
  /** Valeur « neutre » : la pastille ne s'allume pas quand elle est choisie. */
  neutralValue?: V;
  /** Libellé du champ de recherche (au-delà de huit options). */
  searchLabel?: string;
  /** Rend le corps à plat, sans déclencheur ni panneau flottant. */
  inline?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  width?: string;
  /** Déclencheur sur mesure (un sélecteur de mois, un en-tête…) : reçoit
   *  l'état et la bascule ; le panneau reste celui de la famille. */
  renderTrigger?: (p: { open: boolean; toggle: () => void; controls: string }) => ReactNode;
}

export function SelectPicker<V extends string>({
  label,
  value,
  options,
  onChange,
  variant = "pill",
  neutralValue,
  searchLabel = "Search",
  inline,
  disabled,
  className,
  icon,
  width,
  renderTrigger,
}: SelectPickerProps<V>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  if (inline) {
    return (
      <div className={cn("tv-pick-inline", className)}>
        <span className="tv-label mb-1.5 block text-slate-500">{label}</span>
        <div className="tv-pick-chips">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={o.value === value}
              onClick={() => onChange(o.value)}
              className={cn("tv-pick-chip", o.value === value && "tv-pick-chip-on")}
            >
              {o.label}
              {o.count !== undefined && <span className="tv-figure opacity-60">{o.count}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={anchorRef}
      className={cn("relative", variant === "field" && "w-full", renderTrigger && className)}
    >
      {renderTrigger ? (
        renderTrigger({ open, toggle: () => setOpen((o) => !o), controls: id })
      ) : (
        <Trigger
          variant={variant}
          label={label}
          display={current?.label ?? String(value)}
          active={neutralValue !== undefined && value !== neutralValue}
          open={open}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={className}
          icon={icon}
          id={id}
        />
      )}
      <PickerPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        width={width}
      >
        <OptionList
          id={id}
          options={options}
          isOn={(v) => v === value}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
          multi={false}
          searchLabel={searchLabel}
        />
      </PickerPanel>
    </div>
  );
}

/* ══ MULTI — plusieurs choix ════════════════════════════════════════════ */

export interface MultiPickerProps<V extends string> {
  label: string;
  /** Les valeurs choisies. VIDE = aucune restriction (« tout »). */
  values: V[];
  options: PickerOption<V>[];
  onChange: (v: V[]) => void;
  /** Libellé de « tout » (aucune restriction). */
  allLabel: string;
  /** Libellés du pied : effacer, valider. */
  clearLabel?: string;
  doneLabel?: string;
  /** « {n} sélectionnés » — `{n}` est remplacé. */
  countLabel?: string;
  searchLabel?: string;
  variant?: Variant;
  inline?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  width?: string;
}

/** Le résumé d'une sélection multiple, lisible dans une pastille. */
export function summarizeSelection(
  values: string[],
  options: PickerOption[],
  allLabel: string,
  countLabel = "{n} selected",
): string {
  if (values.length === 0 || values.length === options.length) return allLabel;
  const labels = options.filter((o) => values.includes(o.value)).map((o) => o.label);
  if (labels.length <= 2) return labels.join(", ");
  return countLabel.replace("{n}", String(labels.length));
}

export function MultiPicker<V extends string>({
  label,
  values,
  options,
  onChange,
  allLabel,
  clearLabel = "Clear",
  doneLabel = "Done",
  countLabel,
  searchLabel = "Search",
  variant = "pill",
  inline,
  disabled,
  className,
  icon,
  width,
}: MultiPickerProps<V>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  // Tout coché revient à ne rien restreindre : on normalise vers « vide ».
  const set = (next: V[]) => onChange(next.length === options.length ? [] : next);
  const toggle = (v: V) => set(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const all = values.length === 0;

  if (inline) {
    return (
      <div className={cn("tv-pick-inline", className)}>
        <span className="tv-label mb-1.5 block text-slate-500">{label}</span>
        <div className="tv-pick-chips">
          <button
            type="button"
            aria-pressed={all}
            onClick={() => onChange([])}
            className={cn("tv-pick-chip", all && "tv-pick-chip-on")}
          >
            {allLabel}
          </button>
          {options.map((o) => {
            const on = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.value)}
                className={cn("tv-pick-chip", on && "tv-pick-chip-on")}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
                {o.label}
                {o.count !== undefined && <span className="tv-figure opacity-60">{o.count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={anchorRef} className={cn("relative", variant === "field" && "w-full")}>
      <Trigger
        variant={variant}
        label={label}
        display={summarizeSelection(values, options, allLabel, countLabel)}
        active={!all}
        open={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={className}
        icon={icon}
        id={id}
      />
      <PickerPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        width={width}
      >
        <div className="shrink-0 px-1.5 pt-1.5">
          <button
            type="button"
            onClick={() => onChange([])}
            aria-pressed={all}
            className={cn("tv-pick-opt", all && "tv-pick-opt-on")}
          >
            <span aria-hidden className={cn("tv-pick-box", all && "is-on")}>
              {all && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="flex-1 font-semibold">{allLabel}</span>
          </button>
          <div className="mx-2 mt-1 border-t border-[var(--tv-border)]" />
        </div>
        <OptionList
          id={id}
          options={options}
          isOn={(v) => values.includes(v)}
          onPick={toggle}
          multi
          searchLabel={searchLabel}
        />
        <div className="flex shrink-0 items-center gap-2 border-t border-[var(--tv-border)] p-2">
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={all}
            className="tv-pick-foot disabled:opacity-40"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tv-pick-foot tv-pick-foot-main ml-auto"
          >
            {doneLabel}
          </button>
        </div>
      </PickerPanel>
    </div>
  );
}

/* ══ RANGE — une période ════════════════════════════════════════════════ */

/** Une période : un raccourci (`preset`), ou des bornes civiles `YYYY-MM-DD`. */
export type RangeValue<P extends string = string> =
  | { kind: "preset"; preset: P }
  | { kind: "custom"; from: string; to: string };

export interface RangePickerProps<P extends string> {
  label: string;
  value: RangeValue<P>;
  presets: PickerOption<P>[];
  onChange: (v: RangeValue<P>) => void;
  /** Libellés : « Personnalisée », « Du », « Au », « Appliquer ». */
  customLabel: string;
  fromLabel: string;
  toLabel: string;
  applyLabel: string;
  todayLabel?: string;
  locale?: string;
  /** Le raccourci « neutre » (tout l'historique) — la pastille reste éteinte. */
  neutralPreset?: P;
  variant?: Variant;
  inline?: boolean;
  className?: string;
  icon?: ReactNode;
}

const todayCivil = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const civilMinusDays = (days: number) => {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - days, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function RangePicker<P extends string>({
  label,
  value,
  presets,
  onChange,
  customLabel,
  fromLabel,
  toLabel,
  applyLabel,
  todayLabel,
  locale = "en-US",
  neutralPreset,
  variant = "pill",
  inline,
  className,
  icon,
}: RangePickerProps<P>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const [from, setFrom] = useState(value.kind === "custom" ? value.from : civilMinusDays(30));
  const [to, setTo] = useState(value.kind === "custom" ? value.to : todayCivil());
  const [custom, setCustom] = useState(value.kind === "custom");
  useEffect(() => {
    if (value.kind === "custom") {
      setFrom(value.from);
      setTo(value.to);
      setCustom(true);
    }
  }, [value]);

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
      new Date(y, m - 1, d),
    );
  };
  const display =
    value.kind === "custom"
      ? `${fmt(value.from)} – ${fmt(value.to)}`
      : (presets.find((p) => p.value === value.preset)?.label ?? String(value.preset));
  const active = value.kind === "custom" || value.preset !== neutralPreset;
  const valid = from <= to;

  const body = (
    <div className="p-2.5">
      <div className="tv-pick-chips">
        {presets.map((p) => {
          const on = value.kind === "preset" && value.preset === p.value && !custom;
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCustom(false);
                onChange({ kind: "preset", preset: p.value });
                if (!inline) setOpen(false);
              }}
              className={cn("tv-pick-chip", on && "tv-pick-chip-on")}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={cn("tv-pick-chip", custom && "tv-pick-chip-on")}
        >
          {customLabel}
        </button>
      </div>
      {custom && (
        <div className="mt-2.5 space-y-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className="tv-label mb-1 block text-slate-500">{fromLabel}</span>
              <DateField
                value={from}
                onChange={setFrom}
                max={to}
                locale={locale}
                todayLabel={todayLabel}
                aria-label={fromLabel}
                className="h-10 px-2.5 text-xs"
              />
            </label>
            <label className="block min-w-0">
              <span className="tv-label mb-1 block text-slate-500">{toLabel}</span>
              <DateField
                value={to}
                onChange={setTo}
                min={from}
                locale={locale}
                todayLabel={todayLabel}
                aria-label={toLabel}
                className="h-10 px-2.5 text-xs"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              onChange({ kind: "custom", from, to });
              if (!inline) setOpen(false);
            }}
            className="tv-pick-foot tv-pick-foot-main w-full justify-center disabled:opacity-40"
          >
            {applyLabel}
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className={cn("tv-pick-inline", className)}>
        <span className="tv-label mb-1.5 block text-slate-500">{label}</span>
        {body}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className={cn("relative", variant === "field" && "w-full")}>
      <Trigger
        variant={variant}
        label={label}
        display={display}
        active={active}
        open={open}
        onClick={() => setOpen((o) => !o)}
        className={className}
        icon={icon}
        id={id}
      />
      <PickerPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        width="19rem"
        overflowVisible
      >
        <div id={id}>{body}</div>
      </PickerPanel>
    </div>
  );
}

/** Les bornes civiles d'une période — `null` pour « tout l'historique ». */
export function rangeBounds(
  value: RangeValue,
  presetDays: Record<string, number | null>,
): { from: string; to: string } | null {
  if (value.kind === "custom") return { from: value.from, to: value.to };
  const days = presetDays[value.preset];
  if (days === null || days === undefined) return null;
  return { from: civilMinusDays(days), to: todayCivil() };
}
