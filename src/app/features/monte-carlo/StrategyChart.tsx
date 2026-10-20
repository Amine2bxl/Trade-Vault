import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/app/i18n/LanguageContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { formatMoney } from "@/shared/currency";
import type { ProjectionBand, StrategyProjection } from "@/modules/probability/strategy";
import { numericText } from "@/shared/ui/NumericText";

export type ProjectionView = "capital" | "drawdown" | "objective";
export interface ProjectionBaseline {
  capital: ProjectionBand[];
  drawdowns: ProjectionBand[];
  objectives: ProjectionBand[];
  config: StrategyProjection["config"];
  profitProbability: number;
  medianPnl: number;
  drawdown95: number;
  passProbability: number;
}

const PAD = { left: 64, right: 18, top: 22, bottom: 34 };
const PLOT_HEIGHT = 360;

/** Domaine commun aux scénarios comparés ; P5/P95 de toute la projection pour ne
 * pas laisser un seul tirage extrême écraser 9 999 autres. Les trajectoires
 * hors cadre sont rognées, jamais les calculs ; l'UI le dit dans la méthode. */
function plotDomain(
  bands: ProjectionBand[],
  baseline: ProjectionBand[] | undefined,
  start: number,
  target: number,
  floor: number,
  drawdown: boolean,
): [number, number] {
  const all = [...bands, ...(baseline ?? [])];
  let lo = drawdown ? 0 : Math.min(start, floor, ...all.map((p) => p.p5));
  let hi = Math.max(drawdown ? target : start + target, ...all.map((p) => p.p95));
  const span = Math.max(hi - lo, target * 0.1, 1);
  if (!drawdown) lo -= span * 0.06;
  hi += span * 0.08;
  return [lo, hi];
}

export function StrategyChart({
  result,
  view,
  baseline,
  cloud,
}: {
  result: StrategyProjection;
  view: ProjectionView;
  baseline: ProjectionBaseline | null;
  cloud: boolean;
}) {
  const { t } = useT();
  const { active } = useTheme();
  const root = useRef<HTMLDivElement>(null),
    cloudImage = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState(700),
    [at, setAt] = useState<number | null>(null);
  const { points, config: c } = result;
  const dd = view === "drawdown";
  const bands = view === "capital" ? result.capital : dd ? result.drawdowns : result.objectives;
  const baseBands =
    baseline && baseline.config.trades === c.trades
      ? view === "capital"
        ? baseline.capital
        : dd
          ? baseline.drawdowns
          : baseline.objectives
      : undefined;
  const [lo, hi] = useMemo(
    () =>
      plotDomain(
        bands,
        baseBands,
        c.balance,
        dd ? c.lossLimit : view === "objective" ? c.target : 0,
        view === "objective" ? c.balance - c.lossLimit : c.balance,
        dd,
      ),
    [bands, baseBands, c, dd, view],
  );
  const left = width < 420 ? 52 : PAD.left;
  const plotWidth = Math.max(1, width - left - PAD.right),
    plotHeight = PLOT_HEIGHT - PAD.top - PAD.bottom;
  const x = useCallback(
    (step: number) => left + (step / c.trades) * plotWidth,
    [left, c.trades, plotWidth],
  );
  const y = useCallback(
    (value: number) => PAD.top + ((hi - value) / (hi - lo)) * plotHeight,
    [hi, lo, plotHeight],
  );
  const path = (key: "p5" | "p25" | "p50" | "p75" | "p95", rows = bands) =>
    rows.map((p, i) => `${i ? "L" : "M"}${x(p.step).toFixed(2)},${y(p[key]).toFixed(2)}`).join(" ");
  const area = (low: "p5" | "p25", high: "p95" | "p75") =>
    `${path(high)} ${[...bands]
      .reverse()
      .map((p) => `L${x(p.step).toFixed(2)},${y(p[low]).toFixed(2)}`)
      .join(" ")} Z`;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = cloudImage.current;
    if (!el) return;
    const raster = document.createElement("canvas");
    const ctx = raster.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.round(width * dpr),
      pixelHeight = Math.round(PLOT_HEIGHT * dpr);
    el.style.visibility = "hidden";
    el.removeAttribute("src");
    if (!cloud) return;
    el.onload = () => {
      el.style.visibility = "visible";
    };
    // Le navigateur résout aussi bien une couleur hex que les tokens oklch.
    ctx.fillStyle = getComputedStyle(el)
      .getPropertyValue(dd ? "--tv-chart-red" : "--tv-accent")
      .trim();
    ctx.fillRect(0, 0, 1, 1);
    const color = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    let worker: Worker | null = null;
    let imageUrl: string | null = null;
    try {
      worker = new Worker(new URL("./cloud.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ blob: Blob }>) => {
        imageUrl = URL.createObjectURL(event.data.blob);
        el.src = imageUrl;
        worker?.terminate();
      };
      worker.onerror = () => worker?.terminate();
      worker.postMessage({
        matrix: dd ? result.drawdownPaths : result.paths,
        points,
        stops: result.objectiveStops,
        endBalances: result.objectiveBalances,
        runs: result.runs,
        width: pixelWidth,
        height: pixelHeight,
        left: left * dpr,
        top: PAD.top * dpr,
        plotWidth: plotWidth * dpr,
        plotHeight: plotHeight * dpr,
        lo,
        hi,
        trades: c.trades,
        objective: view === "objective",
        color,
      });
    } catch {
      /* Les bandes et la médiane restent utilisables sans le nuage. */
    }
    return () => {
      worker?.terminate();
      el.onload = null;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [result, view, cloud, width, lo, hi, left, plotWidth, plotHeight, c, points, dd, active]);

  const selected = at === null ? bands.length - 1 : Math.min(at, bands.length - 1),
    point = bands[selected];
  let count = 0;
  for (let i = 0; i < result.runs; i++) {
    if (view === "objective") {
      if (result.outcomes[i] === 1 && result.objectiveStops[i] <= point.step) count++;
    } else if (dd) {
      if (result.drawdownPaths[i * points.length + selected] >= c.lossLimit) count++;
    } else if (result.paths[i * points.length + selected] > c.balance) count++;
  }
  const pct = ((count / result.runs) * 100).toFixed(1) + "%";
  const selectAt = (clientX: number) => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    setAt(
      Math.round(
        Math.max(0, Math.min(1, (clientX - box.left - left) / plotWidth)) * (points.length - 1),
      ),
    );
  };
  const label =
    view === "objective" ? t("lab.reachedBy") : dd ? t("lab.currentDip") : t("lab.positiveAt");
  return (
    <div className="strategy-chart-shell">
      <div className="strategy-chart-readout" aria-live="off">
        <span className="tv-label text-slate-500">
          {t("lab.tradeAt").replace("{n}", String(point.step))}
        </span>
        <span>
          <span className="strategy-swatch" />
          {t("lab.median")} <strong className="tv-figure">{formatMoney(point.p50)}</strong>
        </span>
        <span className="strategy-readout-prob">
          {label} <strong className="tv-figure">{pct}</strong>
        </span>
      </div>
      <div ref={root} className="strategy-chart" style={{ height: PLOT_HEIGHT }}>
        <img ref={cloudImage} alt="" aria-hidden="true" className="strategy-cloud" />
        <svg
          className="strategy-chart-svg"
          viewBox={`0 0 ${width} ${PLOT_HEIGHT}`}
          width="100%"
          height={PLOT_HEIGHT}
          role="slider"
          tabIndex={0}
          aria-label={t("lab.chartAccessible")}
          aria-valuemin={0}
          aria-valuemax={c.trades}
          aria-valuenow={point.step}
          aria-valuetext={`${point.step}: ${formatMoney(point.p5)} — ${formatMoney(point.p50)} — ${formatMoney(point.p95)}`}
          onPointerMove={(e) => selectAt(e.clientX)}
          onPointerDown={(e) => selectAt(e.clientX)}
          onPointerLeave={() => setAt(null)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            setAt((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? bands.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        bands.length - 1,
                        (i ?? bands.length - 1) + (e.key === "ArrowRight" ? 1 : -1),
                      ),
                    ),
            );
          }}
        >
          <defs>
            <clipPath id={`strategy-clip-${view}`}>
              <rect x={left} y={PAD.top} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => {
            const value = lo + ((hi - lo) * i) / 4;
            return (
              <g key={i}>
                <line
                  className="strategy-grid"
                  x1={left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                />
                <text className="strategy-axis" x={left - 9} y={y(value) + 4} textAnchor="end">
                  {formatMoney(value, hi - lo < 1000 ? { whole: true } : { compact: true })}
                </text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((q) => (
            <text
              key={q}
              className="strategy-axis"
              x={x(c.trades * q)}
              y={PLOT_HEIGHT - 8}
              textAnchor="middle"
            >
              {Math.round(c.trades * q)}
            </text>
          ))}
          <g clipPath={`url(#strategy-clip-${view})`}>
            <path d={area("p5", "p95")} className="strategy-band-90" />
            <path d={area("p25", "p75")} className="strategy-band-50" />
            {!dd && (
              <line
                x1={left}
                x2={width - PAD.right}
                y1={y(c.balance)}
                y2={y(c.balance)}
                className="strategy-start"
              />
            )}
            {(dd || (view === "objective" && c.drawdownType === "static")) && (
              <line
                x1={left}
                x2={width - PAD.right}
                y1={y(dd ? c.lossLimit : c.balance - c.lossLimit)}
                y2={y(dd ? c.lossLimit : c.balance - c.lossLimit)}
                className="strategy-limit"
              />
            )}
            {view === "objective" && (
              <line
                x1={left}
                x2={width - PAD.right}
                y1={y(c.balance + c.target)}
                y2={y(c.balance + c.target)}
                className="strategy-target"
              />
            )}
            {baseBands && <path d={path("p50", baseBands)} className="strategy-baseline" />}
            <path d={path("p50")} className="strategy-median" />
            {at !== null && (
              <>
                <line
                  x1={x(point.step)}
                  x2={x(point.step)}
                  y1={PAD.top}
                  y2={PLOT_HEIGHT - PAD.bottom}
                  className="strategy-crosshair"
                />
                <circle cx={x(point.step)} cy={y(point.p50)} r={4} className="strategy-cross-dot" />
              </>
            )}
          </g>
        </svg>
      </div>
      <div className="strategy-chart-legend">
        <span>
          <i className="strategy-swatch" />
          {t("lab.median")}
        </span>
        <span>
          <i className="strategy-legend-50" />
          {t("lab.middle50")}
        </span>
        <span>
          <i className="strategy-legend-90" />
          {t("lab.middle90")}
        </span>
        {baseBands && (
          <span>
            <i className="strategy-legend-baseline" />
            {t("lab.reference")}
          </span>
        )}
      </div>
      <div className="strategy-chart-range">
        <span>
          {t("lab.lower5")} <strong className="tv-figure">{formatMoney(point.p5)}</strong>
        </span>
        <span>
          {t("lab.upper5")} <strong className="tv-figure">{formatMoney(point.p95)}</strong>
        </span>
      </div>
      <p className="strategy-chart-caption">
        {numericText(
          t(
            view === "capital"
              ? "lab.capitalCaption"
              : dd
                ? "lab.ddCaption"
                : c.drawdownType === "static"
                  ? "lab.objectiveCaption"
                  : "lab.trailingCaption",
          ),
        )}
      </p>
    </div>
  );
}
