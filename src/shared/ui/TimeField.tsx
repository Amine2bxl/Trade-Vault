import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Clock, ChevronDown } from "@/shared/ui/icons";
import { cn } from "./cn";
import { FIELD_BASE } from "./Input";
import { SelectionPanel } from "./SelectionPanel";
import { formatTimeValue, minuteOptions, normalizeTimeDraft, parseTimeValue } from "./timeValue";

export interface TimeFieldProps {
  value: string;
  onChange: (hhmm: string) => void;
  locale?: string;
  className?: string;
  disabled?: boolean;
  step?: number;
  doneLabel?: string;
  "aria-label"?: string;
}

/** Le défilement reste natif. Seul un clic, une touche ou une heure valide
 * saisie change la valeur : aucun debounce, aucune boucle scroll → état → scroll. */
export function TimeField({
  value,
  onChange,
  locale = "en-US",
  className,
  disabled,
  step = 1,
  doneLabel = "OK",
  ...aria
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const anchorRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = parseTimeValue(value);
  const minute = current?.minute;
  const minutes = useMemo(() => minuteOptions(step, minute), [step, minute]);
  const display = current
    ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(2024, 0, 1, current.hour, current.minute),
      )
    : "—";
  const choose = (hour: number, minute: number) => {
    const next = formatTimeValue(hour, minute);
    setDraft(next);
    onChange(next);
  };
  const valid = parseTimeValue(draft);
  return (
    <div ref={anchorRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={aria["aria-label"]}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setDraft(value);
          setOpen((v) => !v);
        }}
        className={cn(FIELD_BASE, "flex items-center gap-2 text-left", className)}
      >
        <Clock className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="tv-figure min-w-0 flex-1 truncate">{display}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      </button>
      <SelectionPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={aria["aria-label"] ?? "HH:MM"}
        width="18rem"
      >
        <div id={id} className="min-h-0 p-3 pt-1">
          <input
            value={draft}
            onChange={(e) => {
              const next = normalizeTimeDraft(e.target.value);
              setDraft(next);
              if (parseTimeValue(next)) onChange(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                onChange(formatTimeValue(valid.hour, valid.minute));
                setOpen(false);
              }
            }}
            aria-label={`${aria["aria-label"] ?? "HH:MM"} · HH:MM`}
            aria-invalid={draft.length > 0 && !valid}
            placeholder="HH:MM"
            inputMode="numeric"
            maxLength={5}
            className={cn(FIELD_BASE, "tv-time-entry tv-figure text-center")}
          />
          <div className="tv-time-columns mt-3">
            <TimeColumn
              id={`${id}-hours`}
              label="h"
              values={HOURS}
              selected={current?.hour ?? null}
              onSelect={(h) => choose(h, current?.minute ?? 0)}
            />
            <TimeColumn
              id={`${id}-minutes`}
              label="min"
              values={minutes}
              selected={current?.minute ?? null}
              onSelect={(m) => choose(current?.hour ?? 0, m)}
            />
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={() => setOpen(false)}
            className="tv-pick-foot tv-pick-foot-main mt-3 w-full"
          >
            {doneLabel}
          </button>
        </div>
      </SelectionPanel>
    </div>
  );
}
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function TimeColumn({
  id,
  label,
  values,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  values: number[];
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const initialIndex = useRef(Math.max(0, values.indexOf(selected ?? values[0])));
  useLayoutEffect(() => {
    if (list.current)
      list.current.scrollTop = Math.max(
        0,
        initialIndex.current * 44 - (list.current.clientHeight - 44) / 2,
      );
  }, []);
  // Un choix direct doit rester visible. Le scroll ne modifie jamais l'état,
  // donc cette synchronisation instantanée ne peut pas boucler sur la molette.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || selected === null) return;
    const top = Math.max(0, values.indexOf(selected)) * 44;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + 44 > el.scrollTop + el.clientHeight) el.scrollTop = top + 44 - el.clientHeight;
  }, [selected, values]);
  const move = (e: React.KeyboardEvent) => {
    const i = values.indexOf(selected ?? values[0]);
    const delta =
      e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowUp"
          ? -1
          : e.key === "PageDown"
            ? 5
            : e.key === "PageUp"
              ? -5
              : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? values.length - 1
          : Math.max(0, Math.min(values.length - 1, i + delta));
    onSelect(values[next]);
    const el = list.current?.querySelector<HTMLElement>(`[data-time-value="${values[next]}"]`);
    el?.focus({ preventScroll: true });
    if (list.current) {
      const top = next * 44;
      if (top < list.current.scrollTop) list.current.scrollTop = top;
      else if (top + 44 > list.current.scrollTop + list.current.clientHeight)
        list.current.scrollTop = top + 44 - list.current.clientHeight;
    }
  };
  return (
    <div className="min-w-0">
      <div className="tv-label mb-1.5 text-center text-slate-500">{label}</div>
      <div ref={list} role="listbox" aria-label={label} onKeyDown={move} className="tv-time-list">
        {values.map((v) => (
          <button
            key={v}
            id={`${id}-${v}`}
            data-time-value={v}
            type="button"
            role="option"
            aria-selected={v === selected}
            tabIndex={v === (selected ?? values[0]) ? 0 : -1}
            onClick={() => onSelect(v)}
            className={cn("tv-time-option tv-figure", v === selected && "tv-choice-on")}
          >
            {String(v).padStart(2, "0")}
          </button>
        ))}
      </div>
    </div>
  );
}
