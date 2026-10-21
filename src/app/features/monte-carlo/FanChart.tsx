import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import { formatMoney, formatMoneyExact } from "./format";
import { createFanGrid, paintFan, rasterizeRuns, type FanPalette } from "./fanRender";
import {
  OUTCOME_FAILED,
  OUTCOME_PASSED,
  dayOfStep,
  type Bands,
  type Simulation,
} from "./simulation";
import type { Baseline } from "./useSimulation";

/**
 * LE FAISCEAU — dix mille comptes simulés, d'un seul regard.
 *
 * Trois couches, chacune avec un rôle :
 *
 *   1. LA DENSITÉ (canevas) — toutes les trajectoires, comptées pixel par
 *      pixel (`fanRender`). Là où beaucoup de comptes passent, c'est clair ;
 *      la teinte dit où ils finissent : vert vers l'objectif, rouge vers la
 *      limite. Elle se remplit pendant le calcul.
 *   2. LES REPÈRES (SVG) — la médiane, l'enveloppe où passent neuf comptes
 *      sur dix (p5–p95) et la moitié centrale (p25–p75), l'objectif, la
 *      limite, le départ. Et, quand le trader a changé quelque chose, la
 *      médiane d'AVANT en pointillé : l'effet de ses changements se voit.
 *   3. L'ARRIVÉE (à droite) — où finissent les comptes, sur le même axe : le
 *      pic contre l'objectif, celui contre la limite, et ceux qui tiennent
 *      l'horizon entre les deux.
 *
 * Au survol, une lecture verticale : à ce jour-là, la médiane, l'intervalle,
 * la part en profit, la part déjà arrivée à l'objectif ou à la limite.
 *
 * L'échelle est ancrée sur les RÉGLAGES (départ, objectif, limite), jamais
 * sur le tirage : relancer ne déplace pas les repères, deux scénarios se
 * comparent à l'œil.
 */

/** La hauteur du faisceau — en pixels, jamais en `h-full` (voir la page). */
export const H_FAN = "h-[300px] sm:h-[360px] lg:h-[420px]";

const FALLBACK: FanPalette = {
  neutral: [155, 161, 166],
  pos: [97, 248, 171],
  neg: [248, 113, 113],
};

/** Les couleurs du faisceau, lues dans les jetons du thème. */
function readPalette(): FanPalette {
  const css = getComputedStyle(document.documentElement);
  const rgb = (name: string, fallback: readonly [number, number, number]) => {
    const raw = css.getPropertyValue(name).trim();
    const hex = raw.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
    }
    const parts = raw.match(/\d+(\.\d+)?/g);
    if (raw.startsWith("rgb") && parts && parts.length >= 3)
      return [Number(parts[0]), Number(parts[1]), Number(parts[2])] as const;
    return fallback;
  };
  return {
    neutral: rgb("--tv-text-secondary", FALLBACK.neutral),
    pos: rgb("--tv-chart-green", FALLBACK.pos),
    neg: rgb("--tv-chart-red", FALLBACK.neg),
  };
}

/** Un pas « rond » (1, 2, 2.5, 5 × 10ⁿ) pour environ `target` graduations. */
function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

interface Geometry {
  w: number;
  h: number;
  left: number;
  top: number;
  plotW: number;
  plotH: number;
  /** Bande d'arrivée, à droite du tracé. */
  arriveX: number;
  arriveW: number;
  lo: number;
  hi: number;
  y: (v: number) => number;
}

function geometry(w: number, h: number, balance: number, target: number, floor: number): Geometry {
  const narrow = w < 520;
  const left = narrow ? 44 : 56;
  const arriveW = narrow ? 28 : 44;
  const right = arriveW + (narrow ? 6 : 10);
  const top = 10;
  const bottom = 24;
  const plotW = Math.max(40, w - left - right);
  const plotH = Math.max(40, h - top - bottom);
  const t = Number.isFinite(target) ? target : balance * 1.2;
  const f = Number.isFinite(floor) ? floor : balance * 0.8;
  const lo0 = Math.min(f, balance);
  const hi0 = Math.max(t, balance);
  const pad = Math.max(1, (hi0 - lo0) * 0.08);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  return {
    w,
    h,
    left,
    top,
    plotW,
    plotH,
    arriveX: left + plotW + (narrow ? 6 : 10),
    arriveW,
    lo,
    hi,
    y: (v: number) => top + ((hi - v) / (hi - lo)) * plotH,
  };
}

export const FanChart = memo(function FanChart({
  sim,
  bands,
  baseline,
  running,
}: {
  sim: Simulation | null;
  /** Percentiles du tirage `sim` — absents tant qu'ils se calculent. */
  bands: Bands | null;
  baseline: Baseline | null;
  running: boolean;
}) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize((s) =>
        Math.round(r.width) === s.w && Math.round(r.height) === s.h
          ? s
          : { w: Math.round(r.width), h: Math.round(r.height) },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(
    () =>
      sim && size.w > 0 && size.h > 0
        ? geometry(size.w, size.h, sim.cfg.balance, sim.target, sim.floor)
        : null,
    [sim, size.w, size.h],
  );

  /* ── LA DENSITÉ — tracée par tranches, peinte au plus toutes les 90 ms ──
     Dix mille trajectoires d'un bloc coûtent jusqu'à 200 ms : on les dépose
     par paquets dans le budget d'une image, et on ne repeint le canevas que
     de temps en temps pendant la génération. La dernière image est toujours
     peinte. Un nouveau tirage repart d'une grille vide ; l'image précédente
     reste à l'écran jusqu'à la première peinture du nouveau. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!sim || !geo || !canvas || !sim.paths) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const gw = Math.max(2, Math.round(geo.plotW * scale));
    const gh = Math.max(2, Math.round(geo.plotH * scale));
    if (canvas.width !== gw) canvas.width = gw;
    if (canvas.height !== gh) canvas.height = gh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const grid = createFanGrid(gw, gh);
    const img = ctx.createImageData(grid.w, grid.h);
    const palette = readPalette();
    const yPx = (v: number) => ((geo.hi - v) / (geo.hi - geo.lo)) * (grid.h - 1);
    let done = 0;
    let raf = 0;
    let lastPaint = 0;
    let dirty = false;
    const loop = (now: number) => {
      raf = 0;
      const t0 = performance.now();
      const avail = sim.done;
      while (done < avail && performance.now() - t0 < 5) {
        const to = Math.min(avail, done + 64);
        rasterizeRuns(grid, sim, done, to, yPx);
        done = to;
        dirty = true;
      }
      const complete = sim.finished && done >= sim.done;
      if (dirty && (complete || now - lastPaint > 90)) {
        paintFan(grid, img.data, palette, done, 0.92, Math.max(1, Math.round(2 * scale)));
        ctx.putImageData(img, 0, 0);
        lastPaint = now;
        dirty = false;
      }
      if (!complete || dirty) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, geo]);

  /* L'arrivée : où finissent les comptes, sur l'axe du faisceau. Calculée
     une fois le tirage terminé — pendant la génération, la bande se tait. */
  const arrival = useMemo(() => {
    if (!sim || !geo || !bands) return null;
    const bins = 44;
    const pass = new Float32Array(bins);
    const fail = new Float32Array(bins);
    const open = new Float32Array(bins);
    const span = geo.hi - geo.lo;
    for (let i = 0; i < sim.done; i++) {
      // Au mur près, comme les courbes : le pic de l'objectif est SUR l'objectif.
      const v = Math.min(sim.target, Math.max(sim.floor, sim.final[i]));
      const k = Math.min(bins - 1, Math.max(0, Math.floor(((geo.hi - v) / span) * bins)));
      if (sim.status[i] === OUTCOME_PASSED) pass[k]++;
      else if (sim.status[i] === OUTCOME_FAILED) fail[k]++;
      else open[k]++;
    }
    let max = 1;
    for (let k = 0; k < bins; k++) max = Math.max(max, pass[k] + fail[k] + open[k]);
    return { bins, pass, fail, open, max };
  }, [sim, geo, bands]);

  if (!sim) return <div ref={wrapRef} className={cn("relative w-full", H_FAN)} />;

  const cfg = sim.cfg;
  const P = sim.points;
  const xOf = (c: number) => (geo ? geo.left + (c / (P - 1)) * geo.plotW : 0);
  // Les percentiles se tracent entre les murs, comme les courbes : un compte
  // arrêté a pu dépasser d'un trade, la ligne s'arrête au mur qu'il a franchi.
  const wall = (v: number) => Math.min(sim.target, Math.max(sim.floor, v));
  const yw = (v: number) => (geo ? geo.y(wall(v)) : 0);
  const line = (arr: Float32Array, upto = P) => {
    if (!geo) return "";
    let d = "";
    for (let c = 0; c < upto; c++)
      d += `${c ? "L" : "M"}${xOf(c).toFixed(1)},${yw(arr[c]).toFixed(1)}`;
    return d;
  };
  const ready = bands && bands.ready >= P;

  // La médiane d'AVANT, recalée sur l'horizon actuel (par jour, pas par instant).
  const before = (() => {
    if (!geo || !baseline || baseline.bands.ready < baseline.sim.points) return "";
    const b = baseline.sim;
    let d = "";
    for (let c = 0; c < b.points; c++) {
      const day = (b.stepAt[c] / b.steps) * b.cfg.days;
      if (day > cfg.days + 1e-9) break;
      const x = geo.left + (day / cfg.days) * geo.plotW;
      d += `${c ? "L" : "M"}${x.toFixed(1)},${yw(baseline.bands.p50[c]).toFixed(1)}`;
    }
    return d;
  })();

  const yTicks: number[] = [];
  if (geo) {
    const step = niceStep(geo.hi - geo.lo, size.h < 340 ? 3 : 4);
    for (let v = Math.ceil(geo.lo / step) * step; v <= geo.hi; v += step) yTicks.push(v);
  }
  const xTicks: number[] = [];
  {
    const step = Math.max(1, Math.round(niceStep(cfg.days, size.w < 520 ? 3 : 5)));
    for (let d = 0; d <= cfg.days; d += step) xTicks.push(d);
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!geo || !ready) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left - geo.left;
    if (x < 0 || x > geo.plotW) return setHover(null);
    setHover(Math.round((x / geo.plotW) * (P - 1)));
  };

  const hc = hover !== null && ready ? hover : null;
  const hoverDay = hc !== null ? dayOfStep(sim.stepAt[hc], cfg.tradesPerDay) : 0;

  return (
    <div
      ref={wrapRef}
      className={cn("mc-fan relative w-full select-none", H_FAN)}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={
        ready && bands
          ? t("mc.fanAria")
              .replace("{n}", sim.done.toLocaleString())
              .replace("{med}", formatMoney(bands.p50[P - 1]))
              .replace("{lo}", formatMoney(bands.p5[P - 1]))
              .replace("{hi}", formatMoney(bands.p95[P - 1]))
          : t("mc.generating")
              .replace("{k}", sim.done.toLocaleString())
              .replace("{n}", cfg.runs.toLocaleString())
      }
    >
      {geo && (
        <canvas
          ref={canvasRef}
          aria-hidden
          className={cn("mc-fan-canvas absolute", running && sim.finished && "opacity-70")}
          style={{ left: geo.left, top: geo.top, width: geo.plotW, height: geo.plotH }}
        />
      )}
      {geo && (
        <svg className="absolute inset-0 overflow-visible" width={geo.w} height={geo.h} aria-hidden>
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={geo.left}
                x2={geo.left + geo.plotW}
                y1={geo.y(v)}
                y2={geo.y(v)}
                className="mc-fan-grid"
              />
              <text
                x={geo.left - 8}
                y={geo.y(v)}
                className="mc-fan-tick"
                textAnchor="end"
                dy="0.32em"
              >
                {formatMoney(v)}
              </text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text
              key={d}
              x={geo.left + (d / cfg.days) * geo.plotW}
              y={geo.h - 6}
              className="mc-fan-tick"
              textAnchor={d === 0 ? "start" : d === cfg.days ? "end" : "middle"}
            >
              {t("mc.dayShort")}
              {d}
            </text>
          ))}

          {/* Les murs : objectif, limite — et le départ, en retrait. */}
          <line
            x1={geo.left}
            x2={geo.left + geo.plotW}
            y1={geo.y(cfg.balance)}
            y2={geo.y(cfg.balance)}
            className="mc-fan-start"
          />
          {Number.isFinite(sim.target) && (
            <g>
              <line
                x1={geo.left}
                x2={geo.left + geo.plotW}
                y1={geo.y(sim.target)}
                y2={geo.y(sim.target)}
                className="mc-fan-wall mc-fan-wall-pos"
              />
              <text
                x={geo.left + geo.plotW - 6}
                y={geo.y(sim.target) - 6}
                textAnchor="end"
                className="mc-fan-wall-label mc-fan-wall-label-pos"
              >
                {t("mc.target")} · {formatMoneyExact(sim.target)}
              </text>
            </g>
          )}
          {Number.isFinite(sim.floor) && (
            <g>
              <line
                x1={geo.left}
                x2={geo.left + geo.plotW}
                y1={geo.y(sim.floor)}
                y2={geo.y(sim.floor)}
                className="mc-fan-wall mc-fan-wall-neg"
              />
              <text
                x={geo.left + geo.plotW - 6}
                y={geo.y(sim.floor) + 14}
                textAnchor="end"
                className="mc-fan-wall-label mc-fan-wall-label-neg"
              >
                {t("mc.limit")} · {formatMoneyExact(sim.floor)}
              </text>
            </g>
          )}

          {/* Les percentiles : la moitié centrale en voile, neuf sur dix en
              deux traits fins, la médiane en trait plein. */}
          {ready && bands && (
            <g className="animate-fade-in">
              <path
                d={`${line(bands.p75)}${Array.from({ length: P }, (_, k) => P - 1 - k)
                  .map((c) => `L${xOf(c).toFixed(1)},${yw(bands.p25[c]).toFixed(1)}`)
                  .join("")}Z`}
                className="mc-fan-band50"
                data-key="band50"
              />
              <path d={line(bands.p95)} className="mc-fan-p90" data-key="p95" />
              <path d={line(bands.p5)} className="mc-fan-p90" data-key="p5" />
              {before && <path d={before} className="mc-fan-before" />}
              <path d={line(bands.p50)} className="mc-fan-median" data-key="p50" />
              <circle
                cx={xOf(P - 1)}
                cy={yw(bands.p50[P - 1])}
                r={3.5}
                className="mc-fan-median-dot"
              />
            </g>
          )}

          {/* L'arrivée : où finissent les comptes, sur le même axe. */}
          {arrival && (
            <g className="animate-fade-in">
              {Array.from({ length: arrival.bins }, (_, k) => {
                const tot = arrival.pass[k] + arrival.fail[k] + arrival.open[k];
                if (tot <= 0) return null;
                const bh = geo.plotH / arrival.bins;
                // Racine carrée : le pic contre l'objectif écrasait les comptes
                // qui tiennent l'horizon, invisibles à l'échelle linéaire.
                const len = Math.max(1, Math.sqrt(tot / arrival.max) * geo.arriveW);
                const tone =
                  arrival.pass[k] >= arrival.fail[k] && arrival.pass[k] >= arrival.open[k]
                    ? "pos"
                    : arrival.fail[k] >= arrival.open[k]
                      ? "neg"
                      : "flat";
                return (
                  <rect
                    key={k}
                    x={geo.arriveX}
                    y={geo.top + k * bh + 0.5}
                    width={len}
                    height={Math.max(1, bh - 1)}
                    rx={1}
                    className={`mc-fan-arrive mc-fan-arrive-${tone}`}
                  />
                );
              })}
            </g>
          )}

          {/* La lecture au survol. */}
          {hc !== null && bands && (
            <g>
              <line
                x1={xOf(hc)}
                x2={xOf(hc)}
                y1={geo.top}
                y2={geo.top + geo.plotH}
                className="mc-fan-cursor"
              />
              <circle cx={xOf(hc)} cy={yw(bands.p50[hc])} r={4} className="mc-fan-median-dot" />
            </g>
          )}
        </svg>
      )}

      {hc !== null && bands && geo && (
        <div
          className="mc-fan-tip"
          style={{
            top: geo.top + 8,
            left: xOf(hc) > geo.left + geo.plotW / 2 ? undefined : xOf(hc) + 12,
            right: xOf(hc) > geo.left + geo.plotW / 2 ? geo.w - xOf(hc) + 12 : undefined,
          }}
        >
          <div className="tv-label text-slate-400">
            {t("mc.tipDay").replace("{d}", String(hoverDay))}
          </div>
          <TipRow label={t("mc.legendMedian")} value={formatMoneyExact(bands.p50[hc])} strong />
          <TipRow
            label={t("mc.tipRange")}
            value={`${formatMoneyExact(bands.p5[hc])} – ${formatMoneyExact(bands.p95[hc])}`}
          />
          <TipRow label={t("mc.tipAbove")} value={`${Math.round(bands.above[hc] * 100)}%`} />
          {Number.isFinite(sim.target) && (
            <TipRow
              label={t("mc.passed")}
              value={`${Math.round(bands.passedBy[hc] * 100)}%`}
              tone="pos"
            />
          )}
          {Number.isFinite(sim.floor) && (
            <TipRow
              label={t("mc.failed")}
              value={`${Math.round(bands.failedBy[hc] * 100)}%`}
              tone="neg"
            />
          )}
        </div>
      )}
    </div>
  );
});

function TipRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="mt-1 flex items-baseline justify-between gap-4">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={cn(
          "tv-figure text-xs",
          tone === "pos"
            ? "rp-pos"
            : tone === "neg"
              ? "rp-neg"
              : strong
                ? "text-white"
                : "text-slate-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}
