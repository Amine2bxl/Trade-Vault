import type { TKey } from "@/app/i18n/translations";
import { KnowledgeGraph, type Discovery, type KnowledgeNode } from "@/modules/knowledge";
import { formatMoney } from "@/shared/currency";
import { discoveryText, evidenceLine } from "./presentation";

/**
 * LE CONTEXTE ENVOYÉ À JARVIS depuis le graphe — module pur.
 *
 * Jarvis reçoit la sélection DÉCRITE (types, noms, agrégats calculés par le
 * moteur, relations et leur statut de preuve), pas une consigne : il lit
 * ensuite lui-même le journal avec ses outils. Les chiffres viennent du
 * moteur et sont donc vérifiables par la validation des réponses (la
 * question compte parmi les sources). Le texte reste sous la borne de
 * `askCoach` (4 000 caractères).
 */

type T = (key: TKey) => string;
type Label = (node: KnowledgeNode) => string;

export const BRIEF_MAX_CHARS = 3600;

function metricsLine(node: KnowledgeNode, t: T): string | null {
  const m = node.metrics;
  if (!m || !m.n) return null;
  const parts = [
    t("brain.brief.trades").replace("{n}", String(m.n)),
    t("brain.brief.pnl").replace("{v}", formatMoney(m.pnl, { signed: true })),
  ];
  if (m.winRate !== null)
    parts.push(t("brain.brief.winRate").replace("{v}", `${Math.round(m.winRate * 100)} %`));
  if (m.avgR !== null)
    parts.push(
      t("brain.brief.avgR").replace("{v}", m.avgR.toFixed(2)).replace("{n}", String(m.nR)),
    );
  return parts.join(", ");
}

function describe(node: KnowledgeNode, g: KnowledgeGraph, t: T, label: Label): string {
  const kind = t(`brain.kind.${node.kind}` as TKey);
  const lines = [`- ${kind} « ${label(node)} »`];
  const m = metricsLine(node, t);
  if (m) lines.push(`  ${m}`);
  // Relations résumées par type, avec leur statut de preuve.
  const byType = new Map<string, { count: number; validation: string; names: string[] }>();
  for (const e of g.edgesOf(node.id)) {
    const other = g.nodes.get(KnowledgeGraph.other(e, node.id));
    if (!other) continue;
    const k = `${e.type}|${other.kind}`;
    let s = byType.get(k);
    if (!s) byType.set(k, (s = { count: 0, validation: e.provenance.validation, names: [] }));
    s.count++;
    if (s.names.length < 4 && other.kind !== "trade" && other.kind !== "day")
      s.names.push(label(other));
  }
  for (const [k, s] of [...byType.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8)) {
    const [type, kindOf] = k.split("|");
    lines.push(
      `  ${t(`brain.rel.${type}` as TKey)} → ${s.count} ${t(`brain.kind.${kindOf}` as TKey)}` +
        (s.names.length ? ` (${s.names.join(", ")})` : "") +
        ` [${t(`brain.val.${s.validation}` as TKey)}]`,
    );
  }
  return lines.join("\n");
}

/** La question posée à Jarvis pour une sélection de nœuds. */
export function briefForSelection(
  nodes: readonly KnowledgeNode[],
  g: KnowledgeGraph,
  t: T,
  label: Label,
): string {
  const head = t(nodes.length > 1 ? "brain.brief.headMany" : "brain.brief.headOne");
  const body: string[] = [];
  let size = head.length;
  for (const n of nodes) {
    const block = describe(n, g, t, label);
    if (size + block.length > BRIEF_MAX_CHARS - 400) {
      body.push(t("brain.brief.more").replace("{n}", String(nodes.length - body.length)));
      break;
    }
    body.push(block);
    size += block.length;
  }
  return [head, ...body, t("brain.brief.ask")].join("\n\n").slice(0, BRIEF_MAX_CHARS);
}

/** La question posée à Jarvis pour approfondir une découverte. */
export function briefForDiscovery(d: Discovery, t: T): string {
  const { title, body } = discoveryText(d, t);
  return [
    t("brain.brief.discovery"),
    `« ${title} »`,
    body,
    evidenceLine(d, t),
    d.hypothetical ? t("brain.hypothetical") : "",
    `${t("brain.alternatives")} : ${d.alternatives.map((a) => t(`brain.alt.${a}` as TKey)).join(" ; ")}`,
    t("brain.brief.discoveryAsk"),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, BRIEF_MAX_CHARS);
}
