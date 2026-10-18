import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, Minus, Plus, type LucideIcon } from "@/shared/ui/icons";
import { JarvisOrb } from "@/shared/ui/JarvisOrb";
import { cn } from "@/shared/ui/cn";
import { computeThemeVars, type ThemeDef } from "@/app/utils/themes";
import { play } from "./onboardingSound";
import { prefersReducedMotion, rise } from "./onboardingMotion";

/**
 * Les briques de l'onboarding. Elles n'existent qu'ici : une carte de réponse
 * plein écran, une ligne de Jarvis qui s'écrit, un sélecteur pas-à-pas — des
 * gestes propres à cette séquence, pas des primitives du produit. Tout le
 * reste (sélecteur de devise, orbe de Jarvis, icônes) vient de `shared/ui`.
 */

/**
 * LA LIGNE DE JARVIS — elle s'écrit, avec le son d'un terminal.
 *
 * Chaque écran dit POURQUOI il pose sa question (ce que la réponse change
 * dans l'application). L'écrire caractère par caractère, avec l'orbe qui
 * « parle », en fait une phrase de Jarvis plutôt qu'une légende. Le texte
 * complet est toujours lisible par un lecteur d'écran, et s'affiche d'un bloc
 * sous `prefers-reduced-motion`.
 */
export function JarvisLine({
  text,
  className,
  delay = 260,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0));
  const done = shown >= text.length;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    let timer: number | undefined;
    const start = window.setTimeout(function step() {
      i += 1;
      setShown(i);
      if (i % 4 === 0) play("type");
      if (i < text.length) timer = window.setTimeout(step, text[i - 1] === "." ? 90 : 16);
    }, delay);
    return () => {
      window.clearTimeout(start);
      if (timer) window.clearTimeout(timer);
    };
  }, [text, delay]);

  return (
    <p className={cn("flex items-start gap-2.5 text-left", className)}>
      <JarvisOrb size={20} state={done ? "idle" : "speaking"} className="mt-0.5 shrink-0" />
      <span className="sr-only">{text}</span>
      <span aria-hidden className="text-[13px] leading-relaxed text-slate-400">
        {text.slice(0, shown)}
        {!done && <span className="onb-caret" />}
      </span>
    </p>
  );
}

/** Le liseré qui se trace autour d'une réponse choisie (`.onb-lock-sweep`). */
export function LockSweep({ radius = 16 }: { radius?: number }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        fill="none"
        stroke="var(--tv-accent)"
        strokeWidth="1.5"
        pathLength={1}
        className="onb-lock-sweep"
      />
    </svg>
  );
}

/**
 * UNE RÉPONSE : une vignette d'icône, un libellé, une précision.
 *
 * `index` affiche le raccourci clavier (1, 2, 3…) : la séquence se pilote
 * entièrement au clavier, comme un terminal.
 */
export function OptionTile({
  icon: Icon,
  media,
  label,
  desc,
  badge,
  selected,
  multi,
  disabled,
  index,
  onSelect,
  compact,
  style,
}: {
  icon?: LucideIcon;
  /** Un visuel qui REMPLACE l'icône : le vrai logo d'un service tiers, que le
   *  trader doit reconnaître au premier coup d'œil (jamais un logo redessiné). */
  media?: ReactNode;
  label: string;
  desc?: string;
  /** Une mention d'état honnête (« En cours »), lue avec le libellé. */
  badge?: string;
  selected: boolean;
  multi?: boolean;
  /** Visible mais pas encore activable : on montre ce qui arrive sans
   *  mener le trader vers une impasse. */
  disabled?: boolean;
  index?: number;
  onSelect: () => void;
  compact?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : undefined}
      aria-checked={multi ? selected : undefined}
      aria-pressed={multi ? undefined : selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      style={style}
      className={cn(
        "onb-tile onb-rise flex w-full items-center gap-3.5 text-left",
        compact ? "p-3" : "p-3.5 sm:p-4",
      )}
    >
      {selected && <LockSweep />}
      {media ? (
        <span className={cn("onb-glyph-media", compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11")}>
          {media}
        </span>
      ) : (
        Icon && (
          <span className={cn("onb-glyph", compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11")}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
        )
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "text-[14px] font-semibold leading-tight",
              selected ? "text-white" : "text-slate-200",
            )}
          >
            {label}
          </span>
          {badge && (
            <span className="tv-label rounded-md border border-[var(--tv-border-strong)] px-1.5 py-0.5 text-slate-400">
              {badge}
            </span>
          )}
        </span>
        {desc && (
          <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{desc}</span>
        )}
      </span>
      {multi ? (
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
            selected
              ? "border-[var(--tv-border-accent)] text-[var(--tv-highlight)]"
              : "border-[var(--tv-border-strong)]",
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      ) : (
        index !== undefined && <span className="onb-kbd hidden shrink-0 sm:inline">{index}</span>
      )}
    </button>
  );
}

/** Une pastille de choix rapide (taille de compte, firme, objectif). */
export function ChoiceChip({
  label,
  selected,
  onSelect,
  mono,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "onb-tile inline-flex h-10 items-center justify-center rounded-xl px-3.5 text-[13px] font-semibold",
        mono && "tv-figure",
        selected ? "text-white" : "text-slate-300",
      )}
    >
      {selected && <LockSweep radius={12} />}
      {label}
    </button>
  );
}

/** Le sélecteur pas-à-pas d'un garde-fou : − valeur + */
export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format = (v) => String(v),
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format?: (v: number) => string;
  disabled?: boolean;
  label: string;
}) {
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, Math.round(v * 100) / 100));
    if (next !== value) {
      play("tick");
      onChange(next);
    }
  };
  const btn =
    "grid h-8 w-8 place-items-center rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-0)] text-slate-300 transition-colors hover:border-[var(--tv-border-strong)] hover:text-white disabled:opacity-40";
  return (
    <div className={cn("flex items-center gap-1.5", disabled && "opacity-45")}>
      <button
        type="button"
        className={btn}
        onClick={() => set(value - step)}
        disabled={disabled || value <= min}
        aria-label={`${label} −`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className="tv-figure min-w-[3.25rem] text-center text-[17px] text-white"
        aria-live="polite"
      >
        {format(value)}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => set(value + step)}
        disabled={disabled || value >= max}
        aria-label={`${label} +`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * LE DOSSIER TRADER — la preuve, en direct, que les réponses servent.
 *
 * Chaque réponse s'y inscrit à l'instant où elle est donnée : le trader VOIT
 * l'application se configurer autour de lui, au lieu d'avoir à le croire.
 */
export interface FileRow {
  label: string;
  value: string | null;
  accent?: boolean;
}

export function TraderFile({
  title,
  live,
  empty,
  rows,
  pending,
  headless,
  className,
}: {
  title: string;
  live: string;
  empty: string;
  rows: FileRow[];
  /** Libellé des lignes encore vides. Fourni, elles s'affichent en attente :
   *  le trader voit aussi ce qui reste à régler, pas seulement ce qui l'est. */
  pending?: string;
  /** Sans en-tête : quand un conteneur (la feuille mobile) porte déjà le titre. */
  headless?: boolean;
  className?: string;
}) {
  const shown = pending ? rows : rows.filter((r) => r.value);
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]",
        className,
      )}
    >
      {!headless && (
        <div className="flex items-center justify-between border-b border-[var(--tv-border)] px-4 py-3">
          <span className="tv-label text-slate-400">{title}</span>
          <span className="tv-label flex items-center gap-1.5 text-[var(--tv-highlight)]">
            <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />
            {live}
          </span>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-4 py-5 text-[12px] leading-relaxed text-slate-500">{empty}</p>
      ) : (
        <dl className="divide-y divide-[var(--tv-border)]">
          {shown.map((r) => (
            <div
              key={r.label}
              className="onb-rise flex items-baseline justify-between gap-3 px-4 py-2.5"
            >
              <dt className="tv-label shrink-0 text-slate-500">{r.label}</dt>
              {r.value ? (
                <dd
                  key={r.value}
                  className={cn(
                    "onb-pop min-w-0 truncate text-right text-[13px] font-semibold",
                    r.accent ? "text-[var(--tv-highlight)]" : "text-slate-100",
                  )}
                >
                  {r.value}
                </dd>
              ) : (
                <dd className="text-right text-[12px] text-slate-600">{pending}</dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * LE DOSSIER, EN TÉLÉPHONE — la même preuve, réduite à une ligne.
 *
 * Le dossier trader n'a de place qu'à côté des questions, sur grand écran.
 * Sur téléphone, il disparaissait : le trader répondait sans jamais voir ce
 * que ses réponses écrivaient. Ce bandeau garde la preuve sous les yeux — le
 * dernier réglage écrit apparaît à l'instant où il l'est, avec le compte des
 * réglages déjà posés — et s'ouvre sur le dossier complet d'un toucher.
 */
export function FileTicker({
  title,
  empty,
  rows,
  onOpen,
  className,
}: {
  title: string;
  empty: string;
  rows: FileRow[];
  onOpen: () => void;
  className?: string;
}) {
  const filled = rows.filter((r) => r.value);
  // La ligne affichée est la DERNIÈRE ÉCRITE, pas la dernière de la liste :
  // revenir modifier son compte doit montrer le compte, pas la mission.
  const previous = useRef<Map<string, string | null> | null>(null);
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const signature = rows.map((r) => `${r.label}=${r.value ?? ""}`).join("|");
  useEffect(() => {
    const before = previous.current;
    const now = new Map(rows.map((r) => [r.label, r.value]));
    previous.current = now;
    const changed = rows.find((r) => r.value && before?.get(r.label) !== r.value);
    if (changed) setLastLabel(changed.label);
    else if (!rows.some((r) => r.label === lastLabel && r.value)) {
      setLastLabel([...rows].reverse().find((r) => r.value)?.label ?? null);
    }
    // `signature` résume `rows` : l'effet ne tourne que si une valeur change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const last = rows.find((r) => r.label === lastLabel && r.value) ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        "flex h-11 w-full items-center gap-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 text-left transition-colors hover:border-[var(--tv-border-strong)]",
        className,
      )}
    >
      <span className="onb-status-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--tv-accent)]" />
      <span className="tv-label shrink-0 text-slate-400">{title}</span>
      <span className="tv-figure tv-figure-secondary shrink-0 text-[11px] text-slate-500">
        {filled.length}/{rows.length}
      </span>
      <span className="h-3.5 w-px shrink-0 bg-[var(--tv-border-strong)]" aria-hidden />
      {last ? (
        <span
          key={`${last.label}=${last.value}`}
          className="onb-pop flex min-w-0 flex-1 items-center gap-1.5"
        >
          <Check className="h-3 w-3 shrink-0 text-[var(--tv-highlight)]" strokeWidth={3} />
          <span className="truncate text-[12px] text-slate-300">
            <span className="text-slate-500">{last.label} · </span>
            <span
              className={cn(
                "font-semibold",
                last.accent ? "text-[var(--tv-highlight)]" : "text-white",
              )}
            >
              {last.value}
            </span>
          </span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500">{empty}</span>
      )}
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
    </button>
  );
}

/**
 * L'APERÇU D'UN THÈME — l'application en miniature, peinte par le moteur.
 *
 * Une pastille de couleur ne dit pas ce qu'un thème change. Ici, chaque carte
 * est rendue avec les VRAIES variables du thème (`computeThemeVars`, celles
 * que l'application appliquera) : le rail, l'onglet actif, le bouton et la
 * courbe prennent l'accent, tandis que les barres de P&L restent vertes et
 * rouges dans tous les thèmes — exactement ce qui se passera dans l'app.
 */
function ThemePreview() {
  return (
    <svg viewBox="0 0 160 92" className="block h-auto w-full" aria-hidden>
      <rect width="160" height="92" fill="var(--tv-bg)" />
      {/* Le rail : la marque et l'onglet actif prennent l'accent. */}
      <rect x="0" y="0" width="30" height="92" fill="var(--tv-plate-1)" />
      <rect x="9" y="9" width="12" height="12" rx="3.5" fill="var(--tv-accent)" />
      <rect x="6" y="31" width="18" height="6" rx="3" fill="var(--tv-accent)" opacity="0.22" />
      <rect x="9" y="33" width="12" height="2" rx="1" fill="var(--tv-highlight)" />
      <rect x="9" y="45" width="12" height="2" rx="1" fill="white" opacity="0.18" />
      <rect x="9" y="55" width="12" height="2" rx="1" fill="white" opacity="0.18" />
      <rect x="9" y="65" width="12" height="2" rx="1" fill="white" opacity="0.18" />
      {/* La carte : un titre, le bouton principal, la courbe. */}
      <rect
        x="37"
        y="8"
        width="116"
        height="76"
        rx="7"
        fill="var(--tv-plate-1)"
        stroke="white"
        strokeOpacity="0.06"
      />
      <rect x="45" y="16" width="34" height="4" rx="2" fill="white" opacity="0.55" />
      <rect x="45" y="24" width="22" height="3" rx="1.5" fill="white" opacity="0.2" />
      <rect x="119" y="14" width="26" height="10" rx="5" fill="var(--tv-accent)" />
      <polyline
        points="45,60 57,55 67,58 78,47 89,50 100,41 111,44 122,35 133,38 145,30"
        fill="none"
        stroke="var(--tv-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Le P&L : vert et rouge FIXES, quel que soit le thème. */}
      <rect x="45" y="70" width="9" height="7" rx="1.5" fill="var(--tv-chart-green)" />
      <rect x="57" y="73" width="9" height="4" rx="1.5" fill="var(--tv-chart-red)" />
      <rect x="69" y="68" width="9" height="9" rx="1.5" fill="var(--tv-chart-green)" />
      <rect x="81" y="71" width="9" height="6" rx="1.5" fill="var(--tv-chart-green)" />
      <rect x="93" y="72" width="9" height="5" rx="1.5" fill="var(--tv-chart-red)" />
    </svg>
  );
}

export function ThemeCard({
  theme,
  desc,
  tag,
  selected,
  onSelect,
  index,
  wide,
  style,
}: {
  theme: ThemeDef;
  desc: string;
  /** Une mention courte (« Par défaut »). */
  tag?: string;
  selected: boolean;
  onSelect: () => void;
  index?: number;
  /** La carte du thème signature : aperçu et texte côte à côte. */
  wide?: boolean;
  style?: CSSProperties;
}) {
  const vars = useMemo(() => computeThemeVars(theme) as CSSProperties, [theme]);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={style}
      className={cn(
        "onb-tile onb-rise flex w-full p-2 text-left",
        wide ? "col-span-full flex-row items-center gap-3.5" : "flex-col gap-2",
      )}
    >
      {selected && <LockSweep />}
      {/* Les variables du thème sont posées sur ce seul bloc : l'aperçu est
          peint par le thème qu'il présente, pas par le thème actif. */}
      <span
        style={vars}
        className={cn(
          "block shrink-0 overflow-hidden rounded-[10px] border border-[var(--tv-border)]",
          wide ? "w-[46%] max-w-[220px]" : "w-full",
        )}
      >
        <ThemePreview />
      </span>
      <span style={vars} className={cn("block min-w-0", wide ? "flex-1 pr-2" : "px-1 pb-1")}>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--tv-accent)]" aria-hidden />
          <span
            className={cn("text-[13px] font-semibold", selected ? "text-white" : "text-slate-200")}
          >
            {theme.name}
          </span>
          {tag && (
            <span className="tv-label rounded-md border border-[var(--tv-border-strong)] px-1.5 py-0.5 text-slate-400">
              {tag}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {selected ? (
              <Check className="h-3.5 w-3.5 text-[var(--tv-highlight)]" strokeWidth={3} />
            ) : (
              index !== undefined && <span className="onb-kbd hidden sm:inline">{index}</span>
            )}
          </span>
        </span>
        <span className="mt-1 block text-[11.5px] leading-snug text-slate-500">{desc}</span>
      </span>
    </button>
  );
}

/** Le gabarit commun d'une question : code, titre, pourquoi, réponses. */
export function SceneFrame({
  code,
  title,
  why,
  children,
  footer,
}: {
  code: string;
  title: string;
  why: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Le focus suit la scène : un lecteur d'écran annonce la nouvelle question,
  // et le clavier repart du haut de l'écran.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="onb-scene w-full">
      <div
        className="onb-rise mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600"
        style={rise(0)}
      >
        <span className="h-px w-6 bg-[var(--tv-accent)]" />
        <span className="text-[var(--tv-highlight)]">{code}</span>
      </div>
      <h2
        ref={ref}
        tabIndex={-1}
        className="onb-rise text-[clamp(1.45rem,3.2vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white outline-none"
        style={rise(1)}
      >
        {title}
      </h2>
      <JarvisLine text={why} className="onb-rise mt-3 mb-6" />
      {children}
      {footer}
    </div>
  );
}
