import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { FIELD_BASE } from "./Input";
import { usePopPlacement } from "./usePopPlacement";

/**
 * LE CHAMP DE DATE — celui du produit, plus celui du navigateur.
 *
 * `<input type="date">` ouvre le sélecteur NATIF : sur Chrome, un calendrier
 * blanc, avec la typographie du système et les couleurs du système, posé au
 * milieu d'une application noire. Aucun réglage CSS ne le teinte — c'est un
 * widget hors document. Le trader ouvre une date et reçoit une page d'un autre
 * site.
 *
 * Celui-ci est du DOM ordinaire : il hérite des jetons du thème, il suit
 * l'accent, il se ferme au clic dehors et à Échap, et il ne coûte aucune
 * dépendance.
 *
 * ── CE QU'IL FAUT SAVOIR SUR LA VALEUR ──
 * `value` est une date CIVILE au format `YYYY-MM-DD` — jamais un `Date`, jamais
 * un horodatage. Un trade daté du 3 septembre l'est dans le fuseau du trader ;
 * passer par `new Date("2026-09-03")` (interprété UTC) puis reformater en local
 * fait reculer la date d'un jour à l'ouest de Greenwich. Toutes les
 * manipulations ici restent en nombres (année, mois, jour), et l'unique `Date`
 * construit l'est en LOCAL via `new Date(y, m, d)`.
 */

const MS_JOUR = 86_400_000;

/** "2026-09-03" → [2026, 9, 3]. */
function partsOf(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y || new Date().getFullYear(), m || 1, d || 1];
}

/** [2026, 9, 3] → "2026-09-03". */
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayIso(): string {
  const n = new Date();
  return isoOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export interface DateFieldProps {
  /** Date civile `YYYY-MM-DD`. */
  value: string;
  onChange: (iso: string) => void;
  /** Locale d'affichage (BCP-47). Le format suit la langue de l'app. */
  locale?: string;
  className?: string;
  /** Bornes optionnelles, mêmes formats. */
  min?: string;
  max?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** Libellé du raccourci « aujourd'hui ». */
  todayLabel?: string;
}

export function DateField({
  value,
  onChange,
  locale = "en-US",
  className,
  min,
  max,
  disabled,
  todayLabel = "Today",
  ...aria
}: DateFieldProps) {
  const [ouvert, setOuvert] = useState(false);
  const boiteRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<HTMLDivElement | null>(null);
  const pose = usePopPlacement(panRef, ouvert);
  const id = useId();

  // Le mois affiché — il suit la valeur tant qu'on ne navigue pas.
  const [ancre, setAncre] = useState<[number, number]>(() => {
    const [y, m] = partsOf(value || todayIso());
    return [y, m];
  });
  useEffect(() => {
    if (!ouvert) {
      const [y, m] = partsOf(value || todayIso());
      setAncre([y, m]);
    }
  }, [value, ouvert]);

  // Fermeture au clic dehors et à Échap — les deux, jamais l'une sans l'autre :
  // un panneau qu'on ne peut fermer qu'à la souris piège la navigation clavier.
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

  const [ay, am] = ancre;

  /** Les noms de jours, dans l'ordre de la locale (lundi ou dimanche d'abord). */
  const nomsJours = useMemo(() => {
    // Une semaine de référence connue : 2024-01-01 est un lundi.
    const base = new Date(2024, 0, 1);
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    const debutDimanche = premierJourSemaine(locale) === 0;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getTime() + (debutDimanche ? i - 1 : i) * MS_JOUR);
      return fmt.format(d);
    });
  }, [locale]);

  /** Les cases du mois — `null` pour les trous de début de grille. */
  const cases = useMemo(() => {
    const premier = new Date(ay, am - 1, 1);
    const nbJours = new Date(ay, am, 0).getDate();
    const decalage = (premier.getDay() - premierJourSemaine(locale) + 7) % 7;
    const out: (number | null)[] = Array.from({ length: decalage }, () => null);
    for (let j = 1; j <= nbJours; j++) out.push(j);
    return out;
  }, [ay, am, locale]);

  const titreMois = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
        new Date(ay, am - 1, 1),
      ),
    [ay, am, locale],
  );

  const affichage = useMemo(() => {
    if (!value) return "—";
    const [y, m, d] = partsOf(value);
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  }, [value, locale]);

  const aujourdhui = todayIso();
  const horsBornes = (iso: string) => (min && iso < min) || (max && iso > max);

  const decaler = (n: number) => {
    const d = new Date(ay, am - 1 + n, 1);
    setAncre([d.getFullYear(), d.getMonth() + 1]);
  };

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
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1 truncate">{affichage}</span>
      </button>

      {ouvert && (
        <div
          ref={panRef}
          role="dialog"
          aria-label={aria["aria-label"]}
          id={id}
          className={cn(
            "tv-pop absolute z-[var(--tv-z-nav)] w-[max(100%,17rem)] p-3",
            pose.align === "end" ? "right-0" : "left-0",
            pose.side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => decaler(-1)}
              className="tv-pop-nav"
              aria-label="−1"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex-1 text-center text-[13px] font-semibold capitalize text-white">
              {titreMois}
            </span>
            <button type="button" onClick={() => decaler(1)} className="tv-pop-nav" aria-label="+1">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {nomsJours.map((n, i) => (
              <span key={i} className="tv-label py-1 text-center text-slate-600">
                {n}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cases.map((j, i) =>
              j === null ? (
                <span key={`v${i}`} />
              ) : (
                (() => {
                  const iso = isoOf(ay, am, j);
                  const bloque = horsBornes(iso);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!!bloque}
                      onClick={() => {
                        onChange(iso);
                        setOuvert(false);
                      }}
                      aria-current={iso === value ? "date" : undefined}
                      className={cn(
                        "tv-pop-day",
                        iso === value && "tv-pop-day-on",
                        iso === aujourdhui && iso !== value && "tv-pop-day-today",
                      )}
                    >
                      {j}
                    </button>
                  );
                })()
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(aujourdhui);
              setOuvert(false);
            }}
            className="mt-2 w-full rounded-xl border border-white/[0.08] py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            {todayLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Le premier jour de la semaine de la locale — 1 (lundi) presque partout, 0
 * (dimanche) aux États-Unis, au Canada, au Japon… `Intl.Locale.weekInfo` le
 * sait, mais n'existe pas partout : la liste de repli couvre les locales
 * dimanche-d'abord de l'application.
 */
const DIMANCHE_DABORD = [
  "en-US",
  "en-CA",
  "ja",
  "ja-JP",
  "zh",
  "zh-CN",
  "pt-BR",
  "ar",
  "ar-SA",
  "hi",
  "hi-IN",
];
function premierJourSemaine(locale: string): 0 | 1 {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = (new (Intl as any).Locale(locale) as any).weekInfo;
    if (info?.firstDay === 7) return 0;
    if (typeof info?.firstDay === "number") return info.firstDay === 7 ? 0 : 1;
  } catch {
    /* pas de weekInfo dans ce moteur — on retombe sur la liste */
  }
  return DIMANCHE_DABORD.includes(locale) ? 0 : 1;
}
