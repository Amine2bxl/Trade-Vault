import type { TKey } from "@/app/i18n/translations";
import type { Discovery, KnowledgeNode, NodeCategory } from "@/modules/knowledge";
import { formatMoney } from "@/shared/currency";
import { MISTAKE_CLUSTERS } from "@/app/trading/mistakeClusters";

/**
 * Comment un nœud se MONTRE : forme, couleur, libellé, texte d'une découverte.
 *
 * La forme dit la famille, la couleur la double (jamais la couleur seule —
 * accessibilité). Les textes passent tous par l'i18n de l'app : le moteur ne
 * rend que des clés et des nombres.
 */

type T = (key: TKey) => string;

export type Shape =
  | "circle"
  | "diamond"
  | "triangle"
  | "square"
  | "hexagon"
  | "pentagon"
  | "triangleDown"
  | "star";

export const CATEGORY_SHAPE: Record<NodeCategory, Shape> = {
  trading: "circle",
  market: "diamond",
  behavior: "triangle",
  risk: "square",
  simulation: "hexagon",
  ai: "pentagon",
  documents: "triangleDown",
  performance: "star",
};

/** Variables CSS des couleurs (définies dans `brain.css`). */
export const COLOR_VARS = [
  "--brain-trading",
  "--brain-time",
  "--brain-market",
  "--brain-behavior",
  "--brain-mistake",
  "--brain-risk",
  "--brain-simulation",
  "--brain-ai",
  "--brain-documents",
  "--brain-performance",
  "--brain-win",
  "--brain-loss",
  "--brain-edge",
  "--tv-accent",
  "--tv-text-primary",
  "--tv-text-secondary",
  "--tv-bg",
] as const;
export type ColorVar = (typeof COLOR_VARS)[number];

/** La couleur d'un nœud : le résultat pour un trade, sinon sa famille. */
export function colorVarOf(node: KnowledgeNode): ColorVar {
  if (node.kind === "trade") {
    const pnl = Number(node.data?.pnl ?? 0);
    return pnl > 0 ? "--brain-win" : pnl < 0 ? "--brain-loss" : "--brain-time";
  }
  if (node.kind === "day" || node.kind === "month") return "--brain-time";
  if (node.kind === "mistake") return "--brain-mistake";
  return `--brain-${node.category}` as ColorVar;
}

/** Trace la forme d'un nœud (centre x, y, rayon r) dans le chemin courant. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  r: number,
) {
  const poly = (sides: number, rot: number, radius = r) => {
    for (let i = 0; i < sides; i++) {
      const a = rot + (i * 2 * Math.PI) / sides;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  switch (shape) {
    case "circle":
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      return;
    case "square":
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      return;
    case "diamond":
      return poly(4, -Math.PI / 2, r * 1.15);
    case "triangle":
      return poly(3, -Math.PI / 2, r * 1.2);
    case "triangleDown":
      return poly(3, Math.PI / 2, r * 1.2);
    case "hexagon":
      return poly(6, 0, r * 1.05);
    case "pentagon":
      return poly(5, -Math.PI / 2, r * 1.1);
    case "star": {
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        const radius = i % 2 ? r * 0.55 : r * 1.3;
        const px = x + Math.cos(a) * radius;
        const py = y + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      return;
    }
  }
}

/** Le chemin SVG de la même forme (légende, inspecteur), dans une boîte 10×10. */
export function shapePath(shape: Shape): string {
  switch (shape) {
    case "circle":
      return "M5 1a4 4 0 1 0 0.01 0z";
    case "square":
      return "M1.6 1.6h6.8v6.8H1.6z";
    case "diamond":
      return "M5 0.4 9.6 5 5 9.6 0.4 5z";
    case "triangle":
      return "M5 0.6 9.4 8.6H0.6z";
    case "triangleDown":
      return "M0.6 1.4h8.8L5 9.4z";
    case "hexagon":
      return "M9.2 5 7.1 8.6H2.9L0.8 5 2.9 1.4h4.2z";
    case "pentagon":
      return "M5 0.6 9.2 3.7 7.6 8.7H2.4L0.8 3.7z";
    case "star":
      return "M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9z";
  }
}

const WEEKDAY_KEYS: TKey[] = [
  "brain.weekday.0",
  "brain.weekday.1",
  "brain.weekday.2",
  "brain.weekday.3",
  "brain.weekday.4",
  "brain.weekday.5",
  "brain.weekday.6",
];

export function formatDay(day: string, lang: string): string {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
}

export function formatMonth(month: string, lang: string): string {
  const d = new Date(`${month.slice(0, 7)}-15T12:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString(lang, { month: "long", year: "numeric" });
}

/** Le libellé lisible d'un nœud, dans la langue du trader. */
export function nodeLabel(
  node: KnowledgeNode,
  t: T,
  lang: string,
  discoveries?: ReadonlyMap<string, Discovery>,
): string {
  switch (node.kind) {
    case "account":
      return node.label || t("brain.account");
    case "month":
      return formatMonth(node.key, lang);
    case "day":
      return formatDay(node.key, lang);
    case "trade": {
      const [symbol, dir] = node.label.split(" ");
      const side =
        dir === "long" ? t("common.long") : dir === "short" ? t("common.short") : t("common.be");
      return `${symbol} ${side} · ${node.date ? formatDay(node.date, lang) : ""}`;
    }
    case "session":
      return t(`session.${node.key}` as TKey);
    case "risk_band":
      return t(`brain.risk.${node.key}` as TKey);
    case "mistake_cluster": {
      const c = MISTAKE_CLUSTERS.find((x) => x.id === node.key);
      return c ? t(c.labelKey) : node.label;
    }
    case "experiment":
      return t("brain.experimentLabel").replace("{n}", String(node.data?.maxLosses ?? "?"));
    case "screenshot":
      return `${t("brain.kind.screenshot")} · ${node.date ? formatDay(node.date, lang) : ""}`;
    case "missed":
      return `${node.label} · ${node.date ? formatDay(node.date, lang) : ""}`;
    case "report":
      return `${t("brain.kind.report")} · ${formatMonth(node.key, lang)}`;
    case "discovery": {
      const d = discoveries?.get(node.key);
      return d ? discoveryText(d, t).title : t("brain.kind.discovery");
    }
    default:
      return node.label || t(`brain.kind.${node.kind}` as TKey);
  }
}

// ── Découvertes ─────────────────────────────────────────────────────────────

function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => params[k] ?? m);
}

/** Une valeur dans l'unité de la preuve. */
export function formatEvidence(
  value: number | null,
  unit: Discovery["evidence"]["unit"],
  signed = false,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "pnl":
    case "currency":
      return formatMoney(value, { signed });
    case "r":
      return `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}R`;
    case "risk_ratio":
      return `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}×`;
    case "share":
      return `${Math.round(value * 100)} %`;
  }
}

/** Le nom lisible de la valeur étudiée par EdgeLab (setup, jour, séance…). */
function edgeKeyLabel(d: Discovery, t: T): string {
  const key = String(d.params.key ?? "");
  if (d.params.dimension === "weekday") return t(WEEKDAY_KEYS[Number(key)] ?? "brain.weekday.1");
  if (d.params.dimension === "session") return t(`session.${key}` as TKey);
  return key;
}

export function discoveryText(d: Discovery, t: T): { title: string; body: string } {
  const ev = d.evidence;
  const params: Record<string, string> = {
    n: String(ev.n),
    nCompare: String(ev.nCompare),
    sessions: String(ev.sessions),
    value: formatEvidence(ev.value, ev.unit),
    baseline: formatEvidence(ev.baseline, ev.unit),
    diff: formatEvidence(ev.diff, ev.unit, true),
    low: formatEvidence(ev.low, ev.unit, true),
    high: formatEvidence(ev.high, ev.unit, true),
  };
  for (const [k, v] of Object.entries(d.params)) params[k] = String(v);
  if (d.detector === "edge_condition") params.key = edgeKeyLabel(d, t);
  if (d.detector === "simulation_risk")
    params.share = formatEvidence(Number(d.params.share), "share");
  if (d.detector === "risk_after_loss") params.median = formatMoney(Number(d.params.median));
  const base =
    d.detector === "data_gap"
      ? `brain.disc.data_gap.${d.params.field}`
      : `brain.disc.${d.detector}.${d.direction}`;
  return {
    title: fill(t(`${base}.title` as TKey), params),
    body: fill(t(`${base}.body` as TKey), params),
  };
}

/** La ligne de preuve : échantillon, intervalle, q, méthode. */
export function evidenceLine(d: Discovery, t: T): string {
  const ev = d.evidence;
  const parts = [t("brain.ev.n").replace("{n}", String(ev.n))];
  if (ev.sessions) parts.push(t("brain.ev.sessions").replace("{n}", String(ev.sessions)));
  if (ev.nCompare) parts.push(t("brain.ev.compare").replace("{n}", String(ev.nCompare)));
  if (ev.low !== null && ev.high !== null)
    parts.push(
      t("brain.ev.ci")
        .replace("{low}", formatEvidence(ev.low, ev.unit, true))
        .replace("{high}", formatEvidence(ev.high, ev.unit, true)),
    );
  if (ev.q !== null) parts.push(ev.q < 0.001 ? "q < 0.001" : `q ${ev.q.toFixed(3)}`);
  return parts.join(" · ");
}
