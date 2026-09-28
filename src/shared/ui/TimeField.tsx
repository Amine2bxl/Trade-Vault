import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "./cn";
import { FIELD_BASE } from "./Input";
import { usePopPlacement } from "./usePopPlacement";

/**
 * LE CHAMP D'HEURE — celui du produit, plus celui du navigateur.
 *
 * Même histoire que `DateField` : `<input type="time">` ouvre un minuteur natif
 * blanc, hors document, insensible au thème.
 *
 * ── DEUX ROUES, CHAQUE MINUTE ──
 * La version précédente proposait les minutes de 5 en 5 (un trade entré à
 * 09:47 ne pouvait pas être saisi à 09:47) dans deux listes à barre de
 * défilement blanche. Ce sont maintenant deux roues :
 *   • toutes les minutes, 00 → 59 ;
 *   • la valeur se pose au CENTRE, sous une bande qui la désigne — on voit
 *     d'un coup d'œil ce qui est choisi ;
 *   • molette, trackpad et doigt font défiler (aimantation `scroll-snap`),
 *     un clic amène une valeur au centre, et les flèches ↑ ↓ (Page ↑ ↓ pour
 *     sauter de 5) règlent la colonne qui a le focus ;
 *   • aucune barre de défilement visible.
 *
 * `value` est `HH:MM` en 24 heures — le format de stockage. Seul l'AFFICHAGE du
 * champ suit la locale (12 ou 24 heures) ; ce qui remonte par `onChange` reste
 * `HH:MM`.
 */

const HEURES = Array.from({ length: 24 }, (_, i) => i);

export interface TimeFieldProps {
  /** Heure `HH:MM` (24 h). */
  value: string;
  onChange: (hhmm: string) => void;
  locale?: string;
  className?: string;
  disabled?: boolean;
  /** Pas des minutes proposées. 1 par défaut : chaque minute se saisit. */
  step?: number;
  /** Libellé du bouton qui ferme la roue (traduit par l'appelant). */
  doneLabel?: string;
  "aria-label"?: string;
}

function parse(v: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(v ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

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
  const [ouvert, setOuvert] = useState(false);
  const boiteRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<HTMLDivElement | null>(null);
  const pose = usePopPlacement(panRef, ouvert);

  const courant = parse(value);
  const minutes = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < 60; m += step) out.push(m);
    // Une minute saisie hors du pas (12:37 importé d'un CSV) doit rester
    // sélectionnable, sinon l'ouvrir la ferait perdre.
    if (courant && !out.includes(courant.m)) out.push(courant.m);
    return out.sort((a, b) => a - b);
  }, [step, courant]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boiteRef.current && !boiteRef.current.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", touche, true);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", touche, true);
    };
  }, [ouvert]);

  const affichage = useMemo(() => {
    if (!courant) return "—";
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
      new Date(2024, 0, 1, courant.h, courant.m),
    );
  }, [courant, locale]);

  const poser = (h: number, m: number) =>
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  return (
    <div ref={boiteRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={aria["aria-label"]}
        className={cn(
          FIELD_BASE,
          "flex items-center gap-2 text-left disabled:opacity-50",
          ouvert && "border-[var(--tv-border-accent)]",
          className,
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="tv-figure min-w-0 flex-1 truncate">{affichage}</span>
      </button>

      {ouvert && (
        <div
          ref={panRef}
          role="dialog"
          aria-label={aria["aria-label"]}
          className={cn(
            "tv-pop absolute z-[var(--tv-z-nav)] w-[12rem] p-2",
            pose.align === "end" ? "right-0" : "left-0",
            pose.side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          <div className="tv-wheel">
            <span className="tv-wheel-band" aria-hidden />
            <WheelColumn
              label="h"
              values={HEURES}
              selected={courant?.h ?? null}
              onSelect={(h) => poser(h, courant?.m ?? 0)}
            />
            <span className="tv-wheel-sep" aria-hidden>
              :
            </span>
            <WheelColumn
              label="min"
              values={minutes}
              selected={courant?.m ?? null}
              onSelect={(m) => poser(courant?.h ?? 0, m)}
            />
          </div>
          <button type="button" onClick={() => setOuvert(false)} className="tv-wheel-done">
            {doneLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Hauteur d'une ligne de roue, en px — doit suivre `.tv-wheel-item`. */
const ROW = 32;

/**
 * Une roue. La valeur choisie est celle qui s'arrête au centre : le défilement
 * (molette, trackpad, doigt) décide, puis la valeur est lue une fois la roue
 * immobile. Un clic ou une flèche fait l'inverse — la valeur change, et la
 * roue vient la poser au centre.
 */
function WheelColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: number[];
  selected: number | null;
  onSelect: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const settle = useRef<number | null>(null);
  // La dernière valeur venue DU DÉFILEMENT : elle ne doit pas relancer un
  // défilement vers elle-même.
  const fromScroll = useRef<number | null>(null);
  const index = selected === null ? 0 : Math.max(0, values.indexOf(selected));
  const indexRef = useRef(index);
  indexRef.current = index;

  // À l'ouverture : posée sur la valeur, sans animation.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Valeur changée par un clic ou une flèche : la roue la rejoint.
  useEffect(() => {
    if (selected === null || fromScroll.current === selected) return;
    ref.current?.scrollTo({ top: index * ROW, behavior: "smooth" });
  }, [selected, index]);

  useEffect(
    () => () => {
      if (settle.current !== null) window.clearTimeout(settle.current);
    },
    [],
  );

  const onScroll = () => {
    if (settle.current !== null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      const v = values[i];
      if (v !== selected) {
        fromScroll.current = v;
        onSelect(v);
      }
    }, 90);
  };

  const step = (delta: number) => {
    const i = Math.min(values.length - 1, Math.max(0, indexRef.current + delta));
    if (values[i] === values[indexRef.current] && selected !== null) return;
    fromScroll.current = null;
    indexRef.current = i;
    onSelect(values[i]);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  /* UN CRAN DE MOLETTE = UNE UNITÉ. Le défilement natif faisait sauter
     plusieurs lignes par cran (un cran de souris vaut ~100 px, une ligne
     32). La molette et le trackpad passent donc par un accumulateur : chaque
     tranche de ~40 px de défilement vaut exactement une minute (ou une
     heure), et la roue glisse jusqu'à la valeur suivante. Le doigt, lui,
     garde le défilement natif aimanté. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    let lastAt = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - lastAt > 220) acc = 0; // un nouveau geste repart de zéro
      lastAt = now;
      const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      acc += px;
      const THRESHOLD = 40;
      while (Math.abs(acc) >= THRESHOLD) {
        const dir = acc > 0 ? 1 : -1;
        acc -= dir * THRESHOLD;
        stepRef.current(dir);
        // Un cran de souris (100 px) ne doit JAMAIS valoir deux unités.
        if (Math.abs(px) >= 80) {
          acc = 0;
          break;
        }
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={selected === null ? undefined : `wheel-${label}-${selected}`}
      onScroll={onScroll}
      onKeyDown={(e) => {
        const d =
          e.key === "ArrowDown"
            ? 1
            : e.key === "ArrowUp"
              ? -1
              : e.key === "PageDown"
                ? 5
                : e.key === "PageUp"
                  ? -5
                  : 0;
        if (d) {
          e.preventDefault();
          step(d);
        }
      }}
      className="tv-wheel-col"
    >
      {values.map((v) => (
        <div
          key={v}
          id={`wheel-${label}-${v}`}
          role="option"
          aria-selected={v === selected}
          onClick={() => {
            fromScroll.current = null;
            onSelect(v);
          }}
          className="tv-wheel-item"
        >
          {String(v).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}
