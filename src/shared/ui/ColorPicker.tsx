import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pipette } from "lucide-react";
import { cn } from "./cn";
import { PickerPanel } from "./Picker";

/**
 * LE SÉLECTEUR DE COULEUR TRADEVAULT.
 *
 * Il remplace l'`<input type="color">` natif — un carré blanc du système, des
 * champs RVB, un code HEX au premier plan : un outil de développeur posé au
 * milieu d'un produit sombre. Ici, on CHOISIT avant de régler :
 *
 *   1. une FAMILLE de la palette TradeVault (des accents pensés pour un fond
 *      presque noir) ;
 *   2. son TON, du plus profond au plus doux ;
 *   3. et seulement si on le veut, une couleur libre — HEX ou pipette du
 *      système — repliée sous « Couleur libre ».
 *
 * Même panneau que les autres sélecteurs (`PickerPanel` : ancré sur bureau,
 * centré au-dessus d'un voile sur téléphone), même plaque, mêmes états.
 * Le composant ne connaît ni la langue ni les palettes : `shared/ui`
 * n'importe jamais `app/`, tout arrive par les props.
 */

export interface ColorFamily {
  name: string;
  /** Du plus profond au plus doux. Une seule valeur : pas de rangée de tons. */
  tones: string[];
}

export interface ColorPickerLabels {
  family: string;
  tone: string;
  custom: string;
  system: string;
  apply: string;
  customName: string;
}

const DEFAULT_LABELS: ColorPickerLabels = {
  family: "Palette",
  tone: "Tone",
  custom: "Custom colour",
  system: "System picker",
  apply: "Apply",
  customName: "Custom",
};

const HEX = /^#?([0-9a-f]{6})$/i;
const norm = (v: string) => v.trim().toLowerCase();

function locate(families: ColorFamily[], value: string): { f: number; t: number } | null {
  const v = norm(value);
  for (let f = 0; f < families.length; f++) {
    const t = families[f].tones.findIndex((x) => norm(x) === v);
    if (t >= 0) return { f, t };
  }
  return null;
}

export function ColorPicker({
  label,
  hint,
  value,
  onChange,
  families,
  labels: partial,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
  families: ColorFamily[];
  labels?: Partial<ColorPickerLabels>;
  className?: string;
}) {
  const labels = { ...DEFAULT_LABELS, ...partial };
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const here = useMemo(() => locate(families, value), [families, value]);
  // La famille affichée : celle de la valeur, sinon la première.
  const [famIdx, setFamIdx] = useState(here?.f ?? 0);
  const [customOpen, setCustomOpen] = useState(!here);
  const [hexDraft, setHexDraft] = useState(value);

  const fam = families[Math.min(famIdx, families.length - 1)];
  const name = here ? families[here.f].name : labels.customName;

  const toggle = () => {
    if (!open) {
      setFamIdx(here?.f ?? famIdx);
      setHexDraft(value);
      setCustomOpen(!here);
    }
    setOpen((o) => !o);
  };

  const applyHex = () => {
    const m = HEX.exec(hexDraft.trim());
    if (m) onChange(`#${m[1].toLowerCase()}`);
  };

  return (
    <div ref={anchorRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          "tv-color-trigger group flex w-full items-center gap-3 text-left",
          open && "is-open",
        )}
      >
        <span
          aria-hidden
          className="tv-color-chip h-9 w-9 shrink-0"
          style={{ background: value }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-white">{label}</span>
          {hint && <span className="block truncate text-[11px] text-slate-500">{hint}</span>}
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-slate-400">{name}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <PickerPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        width="18.5rem"
      >
        <div id={id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {/* 1. LA FAMILLE */}
          <div className="tv-label mb-2 text-slate-500">{labels.family}</div>
          <div className="grid grid-cols-6 gap-2">
            {families.map((f, i) => {
              const base = f.tones[Math.min(1, f.tones.length - 1)];
              const on = i === famIdx;
              const isValue = here?.f === i;
              return (
                <button
                  key={f.name}
                  type="button"
                  title={f.name}
                  aria-label={f.name}
                  aria-pressed={on}
                  onClick={() => {
                    setFamIdx(i);
                    // Une famille à un seul ton se choisit d'un clic.
                    if (f.tones.length === 1) onChange(f.tones[0]);
                  }}
                  className={cn("tv-color-swatch aspect-square", on && "is-on")}
                  style={{ background: base }}
                >
                  {isValue && f.tones.length === 1 && (
                    <Check
                      className="h-3.5 w-3.5 text-white mix-blend-difference"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 2. LE TON */}
          {fam && fam.tones.length > 1 && (
            <>
              <div className="mt-3.5 mb-2 flex items-center justify-between">
                <span className="tv-label text-slate-500">{labels.tone}</span>
                <span className="text-[11px] font-semibold text-slate-400">{fam.name}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {fam.tones.map((tone) => {
                  const on = norm(tone) === norm(value);
                  return (
                    <button
                      key={tone}
                      type="button"
                      aria-label={`${fam.name} ${tone}`}
                      aria-pressed={on}
                      onClick={() => onChange(tone)}
                      className={cn("tv-color-swatch h-10", on && "is-on")}
                      style={{ background: tone }}
                    >
                      {on && (
                        <Check
                          className="h-4 w-4 text-white mix-blend-difference"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* 3. LA COULEUR LIBRE — repliée : le HEX est une option, pas l'entrée. */}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            aria-expanded={customOpen}
            className="mt-3.5 flex w-full items-center gap-2 border-t border-[var(--tv-border)] pt-3 text-left"
          >
            <span className="tv-label flex-1 text-slate-500">{labels.custom}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-slate-500 transition-transform",
                customOpen && "rotate-180",
              )}
            />
          </button>
          {customOpen && (
            <div className="mt-2.5 flex items-center gap-2">
              <span
                aria-hidden
                className="tv-color-chip h-9 w-9 shrink-0"
                style={{ background: HEX.test(hexDraft.trim()) ? hexDraft : value }}
              />
              <input
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyHex()}
                onBlur={applyHex}
                spellCheck={false}
                aria-label="HEX"
                className="tv-pick-search h-9 min-w-0 flex-1 font-mono text-[13px] uppercase text-white outline-none"
              />
              {/* La pipette du système, pour qui veut reprendre une couleur
                  précise à l'écran — cachée derrière une icône. */}
              <label
                title={labels.system}
                className="tv-pop-nav relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center"
              >
                <Pipette className="h-4 w-4" />
                <input
                  type="color"
                  value={HEX.test(value) ? value : "#000000"}
                  onChange={(e) => {
                    setHexDraft(e.target.value);
                    onChange(e.target.value);
                  }}
                  aria-label={labels.system}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          )}
        </div>
      </PickerPanel>
    </div>
  );
}
