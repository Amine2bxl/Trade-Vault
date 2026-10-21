import { memo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import {
  AXIS_TICK,
  CHART_GREEN,
  CHART_RED,
  EQUITY_GRID,
  tooltipStyle,
} from "@/app/trading/chartTheme";
import { bestRisk, type RiskPoint } from "./simulation";
import { CardTitle } from "./EdgeCards";

/** La hauteur de la courbe du risque — en pixels, jamais en `h-full`. */
const H_RISK = "h-[200px] sm:h-[220px]";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmtRisk = (v: number) => `${Number(v.toFixed(2))}%`;

/**
 * COMBIEN RISQUER — la question que tout Monte-Carlo pose, calculée.
 *
 * La même stratégie, les mêmes hasards (variables aléatoires communes), à
 * onze niveaux de risque par trade. Deux courbes : la part des comptes qui
 * atteignent l'objectif, celle qui touche la limite. Trop bas, l'objectif
 * n'arrive pas dans l'horizon ; trop haut, la limite arrive avant lui. Le
 * sommet de la courbe verte est le risque qui maximise l'objectif POUR CES
 * RÉGLAGES — pas un conseil universel, et la page le dit en le nommant
 * « le plus haut », jamais « le bon ».
 *
 * Un clic sur un niveau l'applique au plan.
 */
export const RiskCurve = memo(function RiskCurve({
  points,
  currentPct,
  runsPer,
  stale,
  onPick,
}: {
  points: RiskPoint[] | null;
  currentPct: number;
  runsPer: number;
  /** Les points viennent d'un calcul précédent (un nouveau tourne). */
  stale: boolean;
  onPick: (riskPct: number) => void;
}) {
  const { t } = useT();
  const best = points ? bestRisk(points) : null;
  const here = points?.find((p) => Math.abs(p.riskPct - currentPct) < 0.005) ?? null;

  return (
    <section className="mc-card">
      <CardTitle
        title={t("mc.riskTitle")}
        sub={t("mc.riskSub")
          .replace("{k}", String(points?.length ?? 11))
          .replace("{n}", runsPer.toLocaleString())}
      />
      {points && (
        <div className="mb-3 flex flex-wrap gap-2">
          {here && (
            <span className="mc-chip">
              <span className="tv-row-label">{t("mc.riskYou")}</span>
              <span className="tv-figure text-white">{fmtRisk(here.riskPct)}</span>
              <span className="tv-figure rp-pos">{pct(here.pass)}</span>
              <span className="tv-figure rp-neg">{pct(here.fail)}</span>
            </span>
          )}
          {best && (!here || best.riskPct !== here.riskPct) && (
            <button
              type="button"
              className="mc-chip mc-chip-action"
              onClick={() => onPick(best.riskPct)}
            >
              <span className="tv-row-label">{t("mc.riskBest")}</span>
              <span className="tv-figure text-white">{fmtRisk(best.riskPct)}</span>
              <span className="tv-figure rp-pos">{pct(best.pass)}</span>
              <span className="tv-figure rp-neg">{pct(best.fail)}</span>
            </button>
          )}
        </div>
      )}
      <div className={cn(H_RISK, "transition-opacity", stale && "opacity-50")}>
        {points ? (
          <ResponsiveContainer debounce={100} width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              onClick={(e) => {
                const v = Number(e?.activeLabel);
                if (Number.isFinite(v) && v > 0) onPick(v);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid {...EQUITY_GRID} />
              <XAxis
                dataKey="riskPct"
                type="number"
                scale="log"
                domain={["dataMin", "dataMax"]}
                ticks={points.map((p) => p.riskPct)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmtRisk(Number(v))}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={38}
                domain={[0, 1]}
                tickFormatter={(v) => pct(Number(v))}
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(v) => `${fmtRisk(Number(v))} ${t("mc.perTrade")}`}
                formatter={(value: number | string, name: string) => [
                  pct(Number(value)),
                  name === "pass" ? t("mc.passed") : t("mc.failed"),
                ]}
              />
              <ReferenceLine
                x={currentPct}
                stroke="var(--tv-text-secondary)"
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="pass"
                stroke={CHART_GREEN}
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 0, fill: CHART_GREEN }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="fail"
                stroke={CHART_RED}
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 0, fill: CHART_RED }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {best && (
                <ReferenceDot
                  x={best.riskPct}
                  y={best.pass}
                  r={5}
                  fill="var(--tv-plate-1)"
                  stroke={CHART_GREEN}
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton h-full w-full rounded-xl" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="mc-sw mc-sw-line-pos" />
          <span className="tv-row-label">{t("mc.passed")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="mc-sw mc-sw-line-neg" />
          <span className="tv-row-label">{t("mc.failed")}</span>
        </span>
        <span className="tv-row-label sm:ml-auto">{t("mc.riskPick")}</span>
      </div>
    </section>
  );
});
