import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from "recharts";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import { formatPnl } from "@/domain/tradeCalcs";
import { MIN_TRADES } from "@/modules/patterns/thresholds";
import { AXIS_TICK, CHART_GREEN, CHART_RED, tooltipStyle } from "@/app/trading/chartTheme";
import {
  EDGE_MAP,
  breakEvenWinRate,
  edgeGrid,
  edgeTerms,
  rrAt,
  rrPos,
  tradeShape,
  type EdgeModel,
  type Pools,
} from "./strategy";

/** Les hauteurs des petits graphes — en pixels, jamais en `h-full`. */
const H_SHAPE = "h-[88px]";
const H_MAP = "h-[248px] sm:h-[264px]";

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** « +1.5R », « −3R », « 0R » — sans « .0 » qui serre les graduations. */
const fmtR = (v: number) =>
  `${v > 0.01 ? "+" : v < -0.01 ? "−" : ""}${Number(Math.abs(v).toFixed(1))}R`;
const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

export function CardTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="flex items-center gap-2">
        <span className="tv-label shrink-0 text-slate-400">{title}</span>
        <span aria-hidden className="rp-rule h-px flex-1" />
      </h3>
      {sub && <p className="tv-row-label mt-1">{sub}</p>}
    </div>
  );
}

/**
 * TON EDGE — d'où vient le résultat, en une équation qu'on voit.
 *
 * L'espérance n'est pas un chiffre magique : c'est ce que rapportent les
 * gains MOINS ce que coûtent les pertes. Deux barres sur la même échelle le
 * montrent — on voit tout de suite lequel des deux termes porte la
 * stratégie. Puis le point mort : le taux de réussite qu'il FAUT, avec ce
 * rapport gain/perte, pour ne rien perdre — et l'écart avec le sien. C'est
 * sa marge de sécurité, en points.
 */
export const EdgePanel = memo(function EdgePanel({
  model,
  pools,
  n,
  risk,
  sourceLabel,
}: {
  model: EdgeModel;
  pools: Pools;
  /** Trades réels derrière la forme (0 = stratégie modèle). */
  n: number;
  /** 1R en devise. */
  risk: number;
  sourceLabel: string;
}) {
  const { t } = useT();
  const terms = edgeTerms(model);
  const be = breakEvenWinRate(model.avgWinR, model.avgLossR);
  const margin = Math.round((model.winRate - be) * 100);
  const scale = Math.max(terms.gain, terms.loss, 0.01);
  const shape = useMemo(() => tradeShape(model, pools), [model, pools]);

  return (
    <section className="mc-card">
      <CardTitle
        title={t("mc.edgeTitle")}
        sub={
          n > 0
            ? t("mc.edgeSub").replace("{n}", String(n)).replace("{src}", sourceLabel)
            : sourceLabel
        }
      />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("tv-figure mc-edge-value", terms.net >= 0 ? "rp-pos" : "rp-neg")}>
          {signed(terms.net)}R
        </span>
        <span className="tv-row-label">
          {t("mc.perTrade")} · ≈ {formatPnl(terms.net * risk)}
        </span>
      </div>

      {/* L'équation : gains − pertes, sur une seule échelle. */}
      <div className="mt-4 space-y-2.5">
        <EdgeBar
          label={t("mc.gains")}
          detail={`${pct(model.winRate * (1 - model.beRate))} × ${model.avgWinR.toFixed(2)}R`}
          value={`+${terms.gain.toFixed(2)}R`}
          width={terms.gain / scale}
          tone="pos"
        />
        <EdgeBar
          label={t("mc.losses")}
          detail={`${pct((1 - model.winRate) * (1 - model.beRate))} × ${model.avgLossR.toFixed(2)}R`}
          value={`−${terms.loss.toFixed(2)}R`}
          width={terms.loss / scale}
          tone="neg"
        />
      </div>

      {/* Le point mort, et la marge. */}
      <div className="mt-5">
        <div className="mc-be" aria-hidden>
          <span
            className={cn("mc-be-gap", margin >= 0 ? "mc-be-gap-pos" : "mc-be-gap-neg")}
            style={{
              left: `${Math.min(be, model.winRate) * 100}%`,
              width: `${Math.abs(model.winRate - be) * 100}%`,
            }}
          />
          <span className="mc-be-mark" style={{ left: `${be * 100}%` }} />
          <span className="mc-be-you" style={{ left: `${model.winRate * 100}%` }} />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="tv-row-label">
            {t("mc.breakEven")} <span className="tv-figure text-slate-200">{pct(be)}</span>
          </span>
          <span className={cn("tv-figure text-xs", margin >= 0 ? "rp-pos" : "rp-neg")}>
            {t(margin >= 0 ? "mc.marginPos" : "mc.marginNeg").replace(
              "{d}",
              String(Math.abs(margin)),
            )}
          </span>
        </div>
        <p className="tv-row-label mt-1">
          {t("mc.breakEvenHint")
            .replace("{w}", model.avgWinR.toFixed(2))
            .replace("{l}", model.avgLossR.toFixed(2))
            .replace("{be}", pct(be))}
        </p>
      </div>

      {/* La forme : ce que la simulation tire, trade par trade. */}
      <div className="mt-5 border-t border-[var(--tv-border)] pt-3">
        <div className="tv-label mb-1 text-slate-500">{t("mc.shapeTitle")}</div>
        <div className={H_SHAPE}>
          <ResponsiveContainer debounce={100} width="100%" height="100%">
            <BarChart data={shape} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="center"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={1}
                tickFormatter={(v) => fmtR(Number(v))}
              />
              <YAxis hide />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(v) => fmtR(Number(v))}
                formatter={(value: number | string) => [pct(Number(value)), t("mc.shareOfTrades")]}
              />
              <Bar dataKey="share" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {shape.map((b, i) => (
                  <Cell
                    key={i}
                    fill={
                      b.center > 0.01
                        ? CHART_GREEN
                        : b.center < -0.01
                          ? CHART_RED
                          : "var(--tv-text-secondary)"
                    }
                    fillOpacity={0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {n > 0 && n < MIN_TRADES && (
        <p className="mc-note mt-3">{t("mc.smallSample").replace("{n}", String(n))}</p>
      )}
    </section>
  );
});

function EdgeBar({
  label,
  detail,
  value,
  width,
  tone,
}: {
  label: string;
  detail: string;
  value: string;
  width: number;
  tone: "pos" | "neg";
}) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_64px] items-center gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="min-w-0">
        <span className="rp-bartrack block">
          <span
            className={tone === "pos" ? "rp-fill-pos" : "rp-fill-neg"}
            style={{ width: `${Math.max(1, width * 100)}%` }}
          />
        </span>
        <span className="tv-row-label mt-0.5 block truncate">{detail}</span>
      </span>
      <span className={cn("tv-figure text-right text-sm", tone === "pos" ? "rp-pos" : "rp-neg")}>
        {value}
      </span>
    </div>
  );
}

/**
 * LA CARTE DE L'EDGE — tout l'espace des stratégies, et où est la sienne.
 *
 * En abscisse le taux de réussite, en ordonnée le rapport gain moyen ÷ perte
 * moyenne. Chaque point de la carte est une stratégie ; sa couleur, son
 * espérance (vert gagnant, rouge perdant, d'autant plus franc qu'elle est
 * loin de zéro). La ligne du point mort sépare les deux mondes ; les courbes
 * d'iso-espérance (+0,5R, +1R) montrent qu'on peut gagner autant en gagnant
 * plus souvent OU en laissant courir — c'est la lecture qu'aucun chiffre ne
 * donne seul.
 *
 * Un clic (ou un glissé) y pose le plan : la simulation repart avec ce taux
 * et ce rapport, la perte moyenne restant celle du trader.
 */
export const EdgeMap = memo(function EdgeMap({
  plan,
  base,
  onPick,
}: {
  plan: EdgeModel;
  /** Le modèle du journal — absent pour une stratégie modèle. */
  base: EdgeModel | null;
  onPick: (winRate: number, rr: number) => void;
}) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dragging = useRef(false);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const L = 34;
  const B = 20;
  const T = 6;
  const R = 8;
  const plotW = Math.max(10, size.w - L - R);
  const plotH = Math.max(10, size.h - T - B);
  const [w0, w1] = EDGE_MAP.winRate;
  const xOf = (wr: number) => L + ((Math.min(w1, Math.max(w0, wr)) - w0) / (w1 - w0)) * plotW;
  const yOf = (rr: number) => T + (1 - rrPos(rr)) * plotH;

  // La carte elle-même : une image basse définition, lissée à l'affichage.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cols = 72;
    const rows = 48;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const hex = (name: string, fb: number[]) => {
      const m = css
        .getPropertyValue(name)
        .trim()
        .match(/^#([0-9a-f]{6})$/i);
      if (!m) return fb;
      const v = parseInt(m[1], 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    };
    const pos = hex("--tv-chart-green", [97, 248, 171]);
    const neg = hex("--tv-chart-red", [248, 113, 113]);
    const grid = edgeGrid(cols, rows);
    const img = ctx.createImageData(cols, rows);
    for (let i = 0; i < grid.length; i++) {
      const e = grid[i];
      const c = e >= 0 ? pos : neg;
      const a =
        e >= 0
          ? Math.pow(Math.min(1, e / 1.5), 0.7) * 0.5
          : Math.pow(Math.min(1, -e / 0.9), 0.7) * 0.36;
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const iso = (e: number) => {
    let d = "";
    const steps = 48;
    for (let k = 0; k <= steps; k++) {
      const rr = rrAt(k / steps);
      const wr = (1 + e) / (1 + rr);
      if (wr < w0 || wr > w1) continue;
      d += `${d ? "L" : "M"}${xOf(wr).toFixed(1)},${yOf(rr).toFixed(1)}`;
    }
    return d;
  };

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left - L) / plotW;
    const fy = (e.clientY - r.top - T) / plotH;
    if (fx < -0.05 || fx > 1.05 || fy < -0.05 || fy > 1.05) return;
    const wr = Math.round((w0 + Math.min(1, Math.max(0, fx)) * (w1 - w0)) * 100) / 100;
    const rr = Math.round(rrAt(1 - Math.min(1, Math.max(0, fy))) * 20) / 20;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => onPick(wr, rr));
  };

  const planRR = plan.avgLossR > 0 ? plan.avgWinR / plan.avgLossR : 0;
  const baseRR = base && base.avgLossR > 0 ? base.avgWinR / base.avgLossR : 0;
  const moved =
    base && (Math.abs(base.winRate - plan.winRate) > 0.004 || Math.abs(baseRR - planRR) > 0.02);

  return (
    <section className="mc-card">
      <CardTitle title={t("mc.mapTitle")} sub={t("mc.mapSub")} />
      <div
        ref={wrapRef}
        className={cn("mc-map relative w-full touch-pan-y select-none", H_MAP)}
        /* À la souris : on glisse sur la carte. Au doigt : un TAP pose le plan,
           un glissé fait défiler la page — la carte ne doit pas piéger le
           défilement d'un téléphone. */
        onPointerDown={(e) => {
          tap.current = { x: e.clientX, y: e.clientY };
          if (e.pointerType !== "mouse") return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => dragging.current && pick(e)}
        onPointerUp={(e) => {
          const t0 = tap.current;
          if (!dragging.current && t0 && Math.hypot(e.clientX - t0.x, e.clientY - t0.y) < 8)
            pick(e);
          dragging.current = false;
          tap.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = false;
          tap.current = null;
        }}
        role="img"
        aria-label={t("mc.mapAria")
          .replace("{wr}", pct(plan.winRate))
          .replace("{rr}", planRR.toFixed(2))}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="mc-map-canvas absolute"
          style={{ left: L, top: T, width: plotW, height: plotH }}
        />
        {size.w > 0 && (
          <svg
            className="absolute inset-0 overflow-visible"
            width={size.w}
            height={size.h}
            aria-hidden
          >
            {[0.2, 0.35, 0.5, 0.65, 0.8].map((wr) => (
              <text key={wr} x={xOf(wr)} y={size.h - 4} textAnchor="middle" className="mc-fan-tick">
                {pct(wr)}
              </text>
            ))}
            {[0.5, 1, 2, 4].map((rr) => (
              <g key={rr}>
                <line x1={L} x2={L + plotW} y1={yOf(rr)} y2={yOf(rr)} className="mc-fan-grid" />
                <text x={L - 6} y={yOf(rr)} dy="0.32em" textAnchor="end" className="mc-fan-tick">
                  {rr}:1
                </text>
              </g>
            ))}
            <path d={iso(0)} className="mc-map-be" />
            <path d={iso(0.5)} className="mc-map-iso" />
            <path d={iso(1)} className="mc-map-iso" />
            {/* Le point mort descend de 20 % à 4:1 jusqu'à 67 % à 0,5:1 : son
                nom se pose près de son pied, là où il y a de la place. */}
            <text x={xOf(1 / 1.6) + 8} y={yOf(0.6)} dy="0.32em" className="mc-map-iso-label">
              {t("mc.breakEven")}
            </text>
            {base && moved && (
              <>
                <line
                  x1={xOf(base.winRate)}
                  y1={yOf(baseRR)}
                  x2={xOf(plan.winRate)}
                  y2={yOf(planRR)}
                  className="mc-map-link"
                />
                <circle cx={xOf(base.winRate)} cy={yOf(baseRR)} r={5} className="mc-map-base" />
              </>
            )}
            <circle cx={xOf(plan.winRate)} cy={yOf(planRR)} r={6} className="mc-map-plan" />
          </svg>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="mc-map-dot mc-map-dot-plan" />
          <span className="tv-row-label">{t("mc.mapPlan")}</span>
        </span>
        {moved && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="mc-map-dot mc-map-dot-base" />
            <span className="tv-row-label">{t("mc.mapJournal")}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="mc-map-swatch mc-map-swatch-iso" />
          <span className="tv-row-label">{t("mc.mapIso")}</span>
        </span>
      </div>
    </section>
  );
});
