import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "./cn";
import { FIELD_BASE } from "./Input";
import { usePopPlacement } from "./usePopPlacement";

/**
 * LE CHAMP D'HEURE — celui du produit, plus celui du navigateur.
 *
 * Même histoire que `DateField` : `<input type="time">` ouvre un minuteur natif
 * blanc, hors document, insensible au thème. Ici, deux colonnes de DOM
 * ordinaire — les heures, les minutes — qui défilent chacune de leur côté et
 * se posent sur la valeur courante à l'ouverture.
 *
 * DEUX COLONNES, PAS UNE ROULETTE. Une roulette (le motif iOS) demande un geste
 * continu et une inertie qu'aucune implémentation web ne rend correctement à la
 * souris. Deux listes de boutons se cliquent, se tabulent, et se lisent.
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
  /** Pas des minutes proposées. 5 par défaut — 288 lignes se parcourent, 1440 non. */
  step?: number;
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
  step = 5,
  ...aria
}: TimeFieldProps) {
  const [ouvert, setOuvert] = useState(false);
  const boiteRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<HTMLDivElement | null>(null);
  const pose = usePopPlacement(panRef, ouvert);
  const colHRef = useRef<HTMLDivElement | null>(null);
  const colMRef = useRef<HTMLDivElement | null>(null);

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

  /* À l'ouverture, chaque colonne se pose SUR la valeur courante. Sans ça,
     ouvrir « 14:30 » montre minuit et demande de faire défiler quatorze
     heures. */
  useEffect(() => {
    if (!ouvert) return;
    for (const ref of [colHRef, colMRef]) {
      const el = ref.current?.querySelector<HTMLElement>("[data-on='1']");
      if (el && ref.current) ref.current.scrollTop = el.offsetTop - 64;
    }
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
            "tv-pop absolute z-[var(--tv-z-nav)] w-[13rem] p-2",
            pose.align === "end" ? "right-0" : "left-0",
            pose.side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="tv-label mb-1 px-1 text-slate-600">h</div>
              <div ref={colHRef} className="tv-pop-col">
                {HEURES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-on={courant?.h === h ? "1" : undefined}
                    onClick={() => poser(h, courant?.m ?? 0)}
                    className={cn("tv-pop-cell", courant?.h === h && "tv-pop-cell-on")}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="tv-label mb-1 px-1 text-slate-600">min</div>
              <div ref={colMRef} className="tv-pop-col">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-on={courant?.m === m ? "1" : undefined}
                    onClick={() => {
                      poser(courant?.h ?? 0, m);
                      setOuvert(false);
                    }}
                    className={cn("tv-pop-cell", courant?.m === m && "tv-pop-cell-on")}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
