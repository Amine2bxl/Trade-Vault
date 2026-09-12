/**
 * ReplayControls — la barre de transport du terminal.
 *
 * Play / pause / bougie suivante / bougie précédente / vitesse / progression.
 * L'horloge simulée est TOUJOURS affichée : c'est elle, pas le graphe, qui dit
 * où le rejeu en est.
 */

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

interface Props {
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  progress: number;
  clockLabel: string;
  viewTf: string;
}

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10];

export default function ReplayControls({
  playing,
  atStart,
  atEnd,
  onToggle,
  onNext,
  onPrev,
  speed,
  setSpeed,
  progress,
  clockLabel,
  viewTf,
}: Props) {
  const { t } = useT();

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-t border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-4">
      {/* Transport */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={atStart}
          title={t("rt.prev")}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)] disabled:opacity-35"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={atEnd}
          title={playing ? t("rt.pause") : t("rt.play")}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-2xl text-white transition",
            playing ? "bg-[var(--tv-text-secondary)]" : "tv-accent-fill",
          )}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={atEnd}
          title={t("rt.next")}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)] disabled:opacity-35"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Vitesse */}
      <div className="hidden items-center gap-1 md:flex">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={cn(
              "rounded-lg px-2 py-1 text-[11px] font-semibold transition",
              speed === s
                ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Horloge + progression */}
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--tv-text-muted)]">
            {t("rt.clock")} · {viewTf}
          </div>
          <div className="font-mono text-sm font-bold text-[var(--tv-text)]">{clockLabel}</div>
        </div>
        <div className="w-40">
          <div className="mb-1 flex justify-between text-[10px] text-[var(--tv-text-muted)]">
            <span>0%</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>100%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[var(--tv-surface-3)]">
            <div
              className="h-full rounded-full tv-accent-fill transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
