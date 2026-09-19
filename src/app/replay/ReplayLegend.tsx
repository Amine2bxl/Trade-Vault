/**
 * ReplayLegend — la légende du graphe, en haut à gauche.
 *
 * C'est la ligne d'identité d'un graphe de plateforme : l'instrument, l'unité
 * de temps, puis l'OHLC de la bougie visée et la variation qu'elle porte. En
 * dessous, une ligne par étude, avec SA valeur à ce même instant.
 *
 * Deux choix comptent ici :
 *
 *  • la légende décrit la DERNIÈRE bougie quand rien n'est survolé, et pas
 *    « rien ». Une légende qui se vide dès qu'on sort du graphe oblige à
 *    garder la souris dedans pour lire un cours, ce qui est absurde pendant
 *    une lecture en continu ;
 *  • elle ne capte AUCUN clic (`pointer-events: none`). Elle flotte au-dessus
 *    de la zone de tracé : le moindre clic avalé serait un ordre ou un dessin
 *    perdu.
 */

import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { cn } from "../utils/cn";
import type { LegendInfo } from "./ReplayChart";
import { indicatorTitle, INDICATOR_SPECS, type IndicatorConfig } from "@/modules/replay";

/** Un nombre d'étude, arrondi comme la plateforme l'arrondit. */
function fmtValue(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(2);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/** Le volume, en notation courte — « 12,4 K », « 1,2 M ». */
function fmtVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

export default function ReplayLegend({
  symbol,
  timeframe,
  info,
  indicators,
}: {
  symbol: string;
  timeframe: string;
  info: LegendInfo | null;
  indicators: IndicatorConfig[];
}) {
  const { t } = useT();
  const up = info ? info.c >= info.o : true;
  const tone = up ? "text-[var(--tv-chart-green)]" : "text-[var(--tv-chart-red)]";
  const byId = new Map(indicators.map((i) => [i.id, i]));

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[min(520px,70%)] space-y-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11.5px] font-bold text-[var(--tv-text)]">{symbol}</span>
        <span className="tv-label text-[9.5px] text-[var(--tv-text-muted)]">{timeframe}</span>
        {info && (
          <span className="tv-figure flex flex-wrap items-baseline gap-x-1.5 text-[10.5px] text-[var(--tv-text-muted)]">
            <span>
              O <span className={tone}>{info.o.toFixed(2)}</span>
            </span>
            <span>
              H <span className={tone}>{info.h.toFixed(2)}</span>
            </span>
            <span>
              L <span className={tone}>{info.l.toFixed(2)}</span>
            </span>
            <span>
              C <span className={tone}>{info.c.toFixed(2)}</span>
            </span>
            <span className={tone}>
              {info.change >= 0 ? "+" : "−"}
              {Math.abs(info.change).toFixed(2)} ({info.changePct >= 0 ? "+" : "−"}
              {Math.abs(info.changePct).toFixed(2)}%)
            </span>
          </span>
        )}
      </div>

      {info && info.v > 0 && (
        <div className="tv-figure text-[10px] text-[var(--tv-text-muted)]">
          Vol <span className="text-[var(--tv-text-secondary)]">{fmtVolume(info.v)}</span>
        </div>
      )}

      {info?.studies.map((study) => {
        const cfg = byId.get(study.id);
        if (!cfg) return null;
        const spec = INDICATOR_SPECS[cfg.kind];
        return (
          <div
            key={study.id}
            className="tv-figure flex flex-wrap items-baseline gap-x-1.5 text-[10px]"
          >
            <span className="font-semibold text-[var(--tv-text-secondary)]">
              {indicatorTitle(cfg, t(spec.labelKey as TKey))}
            </span>
            {study.values.map((v) => (
              <span key={v.name} className={cn("inline-flex items-baseline gap-1")}>
                <span
                  className="inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full"
                  style={{ background: v.color }}
                />
                <span style={{ color: v.color }}>{fmtValue(v.value)}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
