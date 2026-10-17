import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Minus, Plus, type LucideIcon } from "@/shared/ui/icons";
import { JarvisOrb } from "@/shared/ui/JarvisOrb";
import { cn } from "@/shared/ui/cn";
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
  label,
  desc,
  selected,
  multi,
  index,
  onSelect,
  compact,
  style,
}: {
  icon: LucideIcon;
  label: string;
  desc?: string;
  selected: boolean;
  multi?: boolean;
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
      onClick={onSelect}
      style={style}
      className={cn(
        "onb-tile onb-rise flex w-full items-center gap-3.5 text-left",
        compact ? "p-3" : "p-3.5 sm:p-4",
      )}
    >
      {selected && <LockSweep />}
      <span className={cn("onb-glyph", compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11")}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[14px] font-semibold leading-tight",
            selected ? "text-white" : "text-slate-200",
          )}
        >
          {label}
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
export function TraderFile({
  title,
  live,
  empty,
  rows,
  className,
}: {
  title: string;
  live: string;
  empty: string;
  rows: { label: string; value: string | null; accent?: boolean }[];
  className?: string;
}) {
  const filled = rows.filter((r) => r.value);
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--tv-border)] px-4 py-3">
        <span className="tv-label text-slate-400">{title}</span>
        <span className="tv-label flex items-center gap-1.5 text-[var(--tv-highlight)]">
          <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />
          {live}
        </span>
      </div>
      {filled.length === 0 ? (
        <p className="px-4 py-5 text-[12px] leading-relaxed text-slate-500">{empty}</p>
      ) : (
        <dl className="divide-y divide-[var(--tv-border)]">
          {filled.map((r) => (
            <div
              key={r.label}
              className="onb-rise flex items-baseline justify-between gap-3 px-4 py-2.5"
            >
              <dt className="tv-label shrink-0 text-slate-500">{r.label}</dt>
              <dd
                key={r.value}
                className={cn(
                  "onb-pop min-w-0 truncate text-right text-[13px] font-semibold",
                  r.accent ? "text-[var(--tv-highlight)]" : "text-slate-100",
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
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
