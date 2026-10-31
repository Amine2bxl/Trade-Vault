import { ArrowDown, ArrowUp } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useRFormat } from "./checklistLabels";
import type { Ladder, LadderKind } from "./ladderGeometry";

/**
 * La carte du plan : les niveaux écrits, posés à leur place.
 *
 * Deux plaques sourdes — le gain au-dessus (ou en dessous) de l'entrée, le
 * risque de l'autre côté — et une ligne par niveau, au prix exact. Les
 * couleurs sont celles du P&L, fixes ; rien ne rayonne. Les étiquettes sont
 * écartées quand deux niveaux sont proches, les lignes jamais.
 */

const LABELS: Record<LadderKind, TKey> = {
  target: "chk.target",
  entry: "chk.entry",
  invalidation: "chk.invalidation",
  altTarget: "chk.altTarget",
};

export default function PlanLadder({ ladder, className }: { ladder: Ladder; className?: string }) {
  const { t } = useT();
  const fmt = useRFormat();
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const Arrow = ladder.direction === "long" ? ArrowUp : ArrowDown;
  const rText = (r: number) => `${r > 0 ? "+" : r < 0 ? "−" : ""}${fmt.format(Math.abs(r))}R`;

  return (
    <figure
      aria-label={t("chk.ladder")}
      className={cn(
        "relative h-52 overflow-hidden rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)]",
        className,
      )}
    >
      {/* Zone de gain, zone de risque. */}
      <div
        aria-hidden
        className="absolute inset-x-0 border-l-2 border-emerald-400/60 bg-emerald-400/10"
        style={{
          top: pct(ladder.reward.top),
          height: pct(ladder.reward.bottom - ladder.reward.top),
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 border-l-2 border-red-400/60 bg-red-400/10"
        style={{ top: pct(ladder.risk.top), height: pct(ladder.risk.bottom - ladder.risk.top) }}
      />

      {/* Une ligne par niveau, au prix exact. */}
      {ladder.levels.map((l) => (
        <div
          key={`line-${l.kind}`}
          aria-hidden
          className={cn(
            "absolute inset-x-0 border-t",
            l.kind === "altTarget"
              ? "border-dashed border-slate-500"
              : l.kind === "entry"
                ? "border-slate-300"
                : l.kind === "target"
                  ? "border-emerald-400"
                  : "border-red-400",
          )}
          style={{ top: pct(l.y) }}
        />
      ))}

      {/* Les étiquettes, écartées si besoin. */}
      <ul className="absolute inset-0">
        {ladder.levels.map((l) => (
          <li
            key={`label-${l.kind}`}
            className="absolute inset-x-2 flex -translate-y-1/2 items-center justify-between gap-2"
            style={{ top: pct(l.labelY) }}
          >
            <span className="tv-label flex items-center gap-1 rounded bg-[var(--tv-plate-2)] px-1 text-slate-400">
              {l.kind === "target" && <Arrow className="h-3 w-3 text-emerald-400" />}
              {t(LABELS[l.kind])}
              {/* Hors échelle : le sens où il se trouve, pas une fausse position. */}
              {l.beyond === "above" && (
                <ArrowUp className="h-3 w-3" aria-label={t("chk.offScale")} />
              )}
              {l.beyond === "below" && (
                <ArrowDown className="h-3 w-3" aria-label={t("chk.offScale")} />
              )}
            </span>
            <span className="flex min-w-0 items-baseline gap-2 rounded bg-[var(--tv-plate-2)] px-1">
              <span className="truncate text-xs font-semibold text-white">{l.text}</span>
              {l.r !== null && l.kind !== "entry" && (
                <span
                  className={cn(
                    "tv-figure shrink-0 text-xs",
                    l.r >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {rText(l.r)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
