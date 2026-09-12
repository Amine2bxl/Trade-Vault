/**
 * ReplayOverlay — la couche prix/temps par-dessus le graphe.
 *
 * Tout ce qui est ancré à des coordonnées MARKET (et pas au pixel) vit ici,
 * aligné sur le graphe via les conversions de lightweight-charts :
 *   • les DESSINS (lignes, rectangles, zones, textes) ;
 *   • les ORDRES (lignes de prix des ordres en carnet, brackets SL/TP) ;
 *   • les positions (prix d'entrée moyen) et les exécutions ;
 *   • les ombrages ETH/RTH.
 *
 * En mode curseur, la couche est transparente : le graphe pilote zoom/pan, et
 * seules les pp poignées (ancres, étiquettes d'ordres, curseurs de bracket)
 * sont interactives. En mode dessin, la couche capture les clics pour poser
 * les ancres du nouvel outil.
 */

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import type { ChartView } from "./ReplayChart";
import type { Drawing, Order, Position } from "@/modules/replay";

export type ReplayTool =
  | "cursor"
  | "hline"
  | "trend"
  | "ray"
  | "rect"
  | "vline"
  | "text"
  | "measured"
  | "zone"
  | "erase";

const ACCENT = "var(--tv-accent)";
const SL = "var(--tv-chart-red)";
const TP = "var(--tv-chart-green)";

const PLACING: Record<string, boolean> = {
  hline: true,
  trend: true,
  ray: true,
  rect: true,
  vline: true,
  text: true,
  measured: true,
  zone: true,
};
const ONE_CLICK = new Set(["hline", "vline", "text"]);

interface OverlayProps {
  view: MutableRefObject<ChartView>;
  drawings: Drawing[];
  orders: Order[];
  positions: Position[];
  executions: { at: number; price: number; side: "long" | "short"; qty: number }[];
  bounds: { ethStart: number; ethEnd: number; rthStart: number; rthEnd: number };
  showRthEth: boolean;
  tool: ReplayTool;
  mark: number;
  onAddDrawing: (d: Drawing) => void;
  onUpdateDrawing: (d: Drawing) => void;
  onMoveOrder: (orderId: string, price: number) => void;
}

/**
 * Une étiquette de prix — la carte de visite des ordres et des positions.
 * Plaquette arrondie au liseré teinté, pastille de direction, prix en tabular :
 * le vocabulaire d'un terminal pro, conforme à la grammaire TradeVault.
 */
function PriceTag({
  x,
  y,
  color,
  label,
  value,
  drag,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  value: string;
  drag?: {
    onDown: (ev: React.PointerEvent<SVGElement>) => void;
    onMove: (ev: React.PointerEvent<SVGElement>) => void;
    onUp: (ev: React.PointerEvent<SVGElement>) => void;
  };
}) {
  const w = 112;
  return (
    <g
      style={drag ? { pointerEvents: "auto", cursor: "ns-resize" } : { pointerEvents: "none" }}
      onPointerDown={drag?.onDown}
      onPointerMove={drag?.onMove}
      onPointerUp={drag?.onUp}
    >
      <rect
        x={x}
        y={y - 9.5}
        width={w}
        height={19}
        rx={5.5}
        fill={color}
        fillOpacity={0.13}
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      <circle cx={x + 11} cy={y} r={2.7} fill={color} />
      <text
        x={x + 19}
        y={y + 3.2}
        fill={color}
        fontSize={9.5}
        fontWeight={800}
        letterSpacing={0.4}
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {label}
      </text>
      <text
        x={x + w - 9}
        y={y + 3.2}
        fill="var(--tv-text)"
        fontSize={9.5}
        fontWeight={700}
        textAnchor="end"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {value}
      </text>
    </g>
  );
}

/** Petit losange de fill — la signature des exécutions. */
function FillDiamond({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <rect
      x={cx - 3}
      y={cy - 3}
      width={6}
      height={6}
      rx={1}
      fill={color}
      transform={`rotate(45 ${cx} ${cy})`}
    />
  );
}

interface DragState {
  orderId?: string;
  drawingId?: string;
  anchor?: number;
}

export default function ReplayOverlay({
  view,
  drawings,
  orders,
  positions,
  executions,
  bounds,
  showRthEth,
  tool,
  mark,
  onAddDrawing,
  onUpdateDrawing,
  onMoveOrder,
}: OverlayProps) {
  const [pane, setPane] = useState<{ w: number; h: number } | null>(null);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const chart = view.current.chart;
  const candles = view.current.candles;

  // ── Mesure du pane (graphe + resize) ────────────────────────────────────
  useEffect(() => {
    const c = view.current.chart;
    if (!c) return;
    const measure = () => {
      const size = c.paneSize();
      setPane({ w: size.width, h: size.height });
    };
    measure();
    try {
      c.timeScale().subscribeVisibleLogicalRangeChange(measure);
    } catch {
      /* abonnement facultatif */
    }
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coord = (tMs: number, price: number): { x: number | null; y: number | null } => {
    if (!chart || !candles) return { x: null, y: null };
    return {
      x: chart.timeScale().timeToCoordinate((tMs / 1000) as UTCTimestamp),
      y: candles.priceToCoordinate(price),
    };
  };

  const W = pane?.w ?? 0;
  const H = pane?.h ?? 0;

  const toMarket = (ev: {
    clientX: number;
    clientY: number;
  }): { ms: number; price: number } | null => {
    const c = view.current.chart;
    const s = view.current.candles;
    const svg = svgRef.current;
    if (!c || !s || !svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const timeSec = c.timeScale().coordinateToTime(x) as number | null;
    const price = s.coordinateToPrice(y);
    if (timeSec == null || price == null) return null;
    return { ms: timeSec * 1000, price };
  };

  // ── Placement d'un nouveau dessin (mode dessin) ─────────────────────────
  const onPlaceDown = (ev: PointerEvent<SVGRectElement>) => {
    if (ev.button !== 0) return;
    const m = toMarket(ev);
    if (!m) return;
    if (!draft) {
      setDraft({
        id: "draft",
        kind: tool as Drawing["kind"],
        color: ACCENT,
        points: [{ x: m.ms, y: m.price }],
      });
      return;
    }
    if (ONE_CLICK.has(draft.kind) || draft.points.length >= 2) {
      onAddDrawing({
        ...draft,
        points: [...draft.points, { x: m.ms, y: m.price }],
        id: nextDrawId(),
      });
      setDraft(null);
    } else {
      setDraft({ ...draft, points: [...draft.points, { x: m.ms, y: m.price }] });
    }
  };

  const onPlaceMove = (ev: PointerEvent<SVGRectElement>) => {
    if (!draft || draft.points.length >= 2) return;
    const m = toMarket(ev);
    if (m) setDraft({ ...draft, points: [draft.points[0], { x: m.ms, y: m.price }] });
  };

  // ── Poignées : drag avec capture du pointeur ────────────────────────────
  const handleDown = (state: DragState) => (ev: PointerEvent<SVGElement>) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* capture facultative */
    }
    dragRef.current = state;
  };

  const handleMove = (ev: PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const m = toMarket(ev);
    if (!m) return;
    if (drag.orderId) {
      const o = orders.find((x) => x.id === drag.orderId);
      if (o && o.price != null) onMoveOrder(drag.orderId, m.price);
      return;
    }
    const dr = drawings.find((d) => d.id === drag.drawingId);
    if (!dr || drag.anchor == null) return;
    const next = dr.points.map((p, i) => (i === drag.anchor ? { x: m.ms, y: m.price } : p));
    onUpdateDrawing({ ...dr, points: next });
  };

  const handleUp = () => {
    dragRef.current = null;
  };

  // ── Formes ──────────────────────────────────────────────────────────────
  const anchorsOf = (d: Drawing) =>
    d.points.map((p, i) => {
      const { x, y } = coord(p.x, p.y);
      if (x == null || y == null) return null;
      return (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={5}
          fill={d.color}
          style={{ pointerEvents: "auto", cursor: "move" }}
          onPointerDown={handleDown({ drawingId: d.id, anchor: i })}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
      );
    });

  const shapes = drawings.map((d) => {
    const pt = (i: number) => {
      const p = d.points[i] ?? d.points[0];
      const c = coord(p.x, p.y);
      return [c.x, c.y] as const;
    };
    const [x0, y0] = pt(0);
    const [x1, y1] = pt(1);
    if (x0 == null || y0 == null) return null;
    let body: React.ReactNode = null;

    switch (d.kind) {
      case "hline":
        body = <line x1={0} y1={y0 as number} x2={W} y2={y0 as number} />;
        break;
      case "vline":
        body = <line x1={x0} y1={0} x2={x0} y2={H} strokeDasharray="3 3" />;
        break;
      case "trend":
        if (x1 == null || y1 == null) break;
        body = <line x1={x0} y1={y0} x2={x1} y2={y1} />;
        break;
      case "ray": {
        if (x1 == null || y1 == null) break;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const ln = Math.hypot(dx, dy) || 1;
        body = <line x1={x0} y1={y0} x2={x0 + (dx / ln) * W * 4} y2={y0 + (dy / ln) * W * 4} />;
        break;
      }
      case "measured": {
        if (x1 == null || y1 == null) break;
        body = (
          <>
            <line x1={x0} y1={y0} x2={x1} y2={y1} />
            <text
              x={(x0 + x1) / 2}
              y={(y0 + y1) / 2 - 5}
              fill={d.color}
              fontSize={10}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {Math.abs(priceAt(d, 0) - priceAt(d, 1)).toFixed(1)} pts
            </text>
          </>
        );
        break;
      }
      case "rect":
      case "zone": {
        if (x1 == null || y1 == null) break;
        const x = Math.min(x0, x1);
        const y = Math.min(y0, y1);
        body = (
          <rect
            x={x}
            y={y}
            width={Math.abs(x1 - x0)}
            height={Math.abs(y1 - y0)}
            fill={d.kind === "zone" ? d.color : "none"}
            fillOpacity={0.1}
            stroke={d.color}
          />
        );
        break;
      }
      case "text":
        body = (
          <text x={x0} y={y0 - 4} fill={d.color} fontSize={11} fontWeight={600}>
            {d.text || "A"}
          </text>
        );
        break;
    }
    if (body == null) return null;
    return (
      <g key={d.id} stroke={d.color} strokeWidth={1.1}>
        {body}
        {anchorsOf(d)}
      </g>
    );
  });

  function priceAt(d: Drawing, index: number): number {
    return d.points[index]?.y ?? d.points[0]?.y ?? 0;
  }

  const draftShape = (() => {
    if (!draft || draft.points.length < 1) return null;
    const p0 = coord(draft.points[0].x, draft.points[0].y);
    if (!p0.x || !p0.y) return null;
    if (ONE_CLICK.has(draft.kind)) return null;
    const p1 = draft.points[1] ? coord(draft.points[1].x, draft.points[1].y) : null;
    if (!p1?.x || !p1?.y) return null;
    const isRect = draft.kind === "rect" || draft.kind === "zone";
    const body = isRect ? (
      <rect
        x={Math.min(p0.x, p1.x)}
        y={Math.min(p0.y, p1.y)}
        width={Math.abs(p1.x - p0.x)}
        height={Math.abs(p1.y - p0.y)}
        fill={draft.kind === "zone" ? draft.color : "none"}
        fillOpacity={0.08}
        stroke={ACCENT}
        strokeDasharray="4 3"
      />
    ) : (
      <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} strokeDasharray="4 3" />
    );
    return (
      <g stroke={ACCENT} strokeWidth={1.1}>
        {body}
        <circle cx={p0.x} cy={p0.y} r={4} />
      </g>
    );
  })();

  const orderLines = orders
    .filter(
      (o) => o.status === "working" && o.price != null && o.label !== "SL" && o.label !== "TP",
    )
    .map((o) => {
      const { x, y } = coord(0, o.price!);
      if (x == null || y == null) return null;
      const color = o.side === "long" ? "var(--tv-chart-green)" : "var(--tv-chart-red)";
      const sideWord = o.side === "long" ? "BUY" : "SELL";
      const kind = o.type === "limit" ? "LMT" : "STP";
      return (
        <g key={o.id} style={{ pointerEvents: "none" }}>
          {/* Ligne pointillée fine — l'ordre attend. */}
          <line
            x1={0}
            y1={y}
            x2={W}
            y2={y}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="1 4"
            opacity={0.6}
          />
          <PriceTag
            x={W - 112}
            y={y}
            color={color}
            label={`${sideWord} ${o.qty} · ${kind}`}
            value={o.price!.toFixed(2)}
            drag={{
              onDown: handleDown({ orderId: o.id }),
              onMove: handleMove,
              onUp: handleUp,
            }}
          />
        </g>
      );
    });

  const positionShapes = positions.map((pos) => {
    const { y } = coord(0, pos.avgEntry);
    if (y == null) return null;
    const color = pos.side === "long" ? "var(--tv-chart-green)" : "var(--tv-chart-red)";
    const markY = coord(0, mark).y;
    const slY = pos.stop?.price != null ? coord(0, pos.stop.price).y : null;
    const tpY = pos.target?.price != null ? coord(0, pos.target.price).y : null;
    const rail = [slY, tpY, y].filter((v): v is number => v != null);
    const top = rail.length ? Math.min(...rail) : y;
    const bot = rail.length ? Math.max(...rail) : y;

    const bracketHandle = (yy: number | null, orderId: string | null | undefined) =>
      yy != null && orderId ? (
        <rect
          x={W - 11}
          y={yy - 10}
          width={8}
          height={20}
          fill="transparent"
          style={{ pointerEvents: "auto", cursor: "ns-resize" }}
          onPointerDown={handleDown({ orderId })}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
      ) : null;

    return (
      <g key={pos.id} style={{ pointerEvents: "none" }}>
        {/* Zone de P&L : la bande entre l'entrée et le prix marqué. */}
        {markY != null && Math.abs(markY - y) > 1 && (
          <rect
            x={0}
            y={Math.min(y, markY)}
            width={W}
            height={Math.abs(markY - y)}
            fill={color}
            opacity={0.07}
          />
        )}

        {/* Ligne d'entrée — pleine, discrète. */}
        <line x1={0} y1={y} x2={W} y2={y} stroke={color} strokeWidth={1} opacity={0.5} />

        {/* Brackets SL / TP : lignes pointillées + étiquettes draggables. */}
        {slY != null && pos.stop?.price != null && (
          <>
            <line
              x1={0}
              y1={slY}
              x2={W}
              y2={slY}
              stroke={SL}
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.8}
            />
            <PriceTag
              x={8}
              y={slY}
              color={SL}
              label="SL"
              value={pos.stop.price.toFixed(2)}
              drag={{
                onDown: handleDown({ orderId: pos.stop.id }),
                onMove: handleMove,
                onUp: handleUp,
              }}
            />
            {bracketHandle(slY, pos.stop.id)}
          </>
        )}
        {tpY != null && pos.target?.price != null && (
          <>
            <line
              x1={0}
              y1={tpY}
              x2={W}
              y2={tpY}
              stroke={TP}
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.8}
            />
            <PriceTag
              x={8}
              y={tpY}
              color={TP}
              label="TP"
              value={pos.target.price.toFixed(2)}
              drag={{
                onDown: handleDown({ orderId: pos.target.id }),
                onMove: handleMove,
                onUp: handleUp,
              }}
            />
            {bracketHandle(tpY, pos.target.id)}
          </>
        )}

        {/* Le rail du bracket — relie SL et TP, avec une encoche à l'entrée. */}
        {(slY != null || tpY != null) && (
          <>
            <line
              x1={W - 3.5}
              y1={top}
              x2={W - 3.5}
              y2={bot}
              stroke={color}
              strokeWidth={1.5}
              opacity={0.65}
            />
            <rect x={W - 5.5} y={y - 1.5} width={4} height={3} fill={color} />
          </>
        )}

        {/* L'étiquette de position — à droite, plaquette pleine teinte. */}
        <PriceTag
          x={W - 112}
          y={y}
          color={color}
          label={`${pos.side.toUpperCase()} ${pos.qty}`}
          value={pos.avgEntry.toFixed(2)}
        />
      </g>
    );
  });

  const execs = executions.map((ex, i) => {
    const { x, y } = coord(ex.at, ex.price);
    if (x == null || y == null) return null;
    return (
      <FillDiamond
        key={i}
        cx={x}
        cy={y}
        color={ex.side === "long" ? "var(--tv-chart-green)" : "var(--tv-chart-red)"}
      />
    );
  });

  const shading = (() => {
    if (!showRthEth) return [];
    const out: React.ReactNode[] = [];
    for (const [a, b] of [
      [bounds.ethStart, bounds.rthStart],
      [bounds.rthEnd, bounds.ethEnd],
    ] as const) {
      const x = coord(a, 0).x;
      const x2 = coord(b, 0).x;
      if (x == null || x2 == null) continue;
      out.push(
        <rect
          key={a}
          x={x}
          y={0}
          width={Math.max(0, x2 - x)}
          height={H}
          fill="var(--tv-surface-3)"
          opacity={0.14}
          style={{ pointerEvents: "none" }}
        />,
      );
    }
    return out;
  })();

  const capture = PLACING[tool] ? (
    <rect
      x={0}
      y={0}
      width={W}
      height={H}
      fill="transparent"
      style={{ pointerEvents: "auto", cursor: "crosshair" }}
      onPointerDown={onPlaceDown}
      onPointerMove={onPlaceMove}
    />
  ) : null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0"
      width={W}
      height={H}
      style={{ pointerEvents: "none", overflow: "visible" }}
    >
      {shading}
      {shapes}
      {draftShape}
      {orderLines}
      {positionShapes}
      {execs}
      {showRthEth && (
        <text
          x={8}
          y={12}
          fill="var(--tv-text-muted)"
          fontSize={9}
          style={{ pointerEvents: "none" }}
        >
          RTH 09:30–16:00 ET · ETH 18:00–17:00
        </text>
      )}
      {capture}
    </svg>
  );
}

let _d = 0;
function nextDrawId(): string {
  _d += 1;
  return `drw:${Date.now().toString(36)}-${_d}`;
}
