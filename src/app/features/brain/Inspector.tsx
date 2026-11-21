import { lazy, Suspense, useMemo, useState } from "react";
import { Badge, Button, Card, Kpi, KpiGrid } from "@/shared/ui";
import { Bot, ChevronsDownUp, ChevronsUpDown, Crosshair, ExternalLink } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { ScreenshotImage } from "@/app/components/ScreenshotImage";
import { useScreenshotUrls } from "@/app/hooks/useScreenshotUrls";
import {
  KnowledgeGraph,
  NODE_KINDS,
  leafCount,
  type KnowledgeEdge,
  type KnowledgeNode,
} from "@/modules/knowledge";
import { formatMoney } from "@/shared/currency";
import { CATEGORY_SHAPE, colorVarOf, evidenceOf, formatDay, shapePath } from "./presentation";

const Lightbox = lazy(() => import("@/app/components/Lightbox"));

/**
 * L'INSPECTEUR — tout ce que le graphe sait d'un nœud, et d'où il le sait.
 *
 * Trois étages : ce qu'est le nœud (agrégats avec leur `n`, faits lus), ce
 * qui le relie (groupé par relation, chaque lien avec son statut de preuve),
 * et les gestes (ouvrir l'original, déplier, focaliser, demander à Jarvis).
 * Chaque voisin est un bouton : on navigue de nœud en nœud sans le canevas
 * — c'est aussi le chemin au clavier et au lecteur d'écran.
 */

export function KindTag({ node }: { node: KnowledgeNode }) {
  const { t } = useT();
  return (
    <span className="brain-kind tv-label text-slate-500">
      <svg viewBox="0 0 10 10" aria-hidden>
        <path d={shapePath(CATEGORY_SHAPE[node.category])} fill={`var(${colorVarOf(node)})`} />
      </svg>
      {t(`brain.kind.${node.kind}` as TKey)}
    </span>
  );
}

const GROUP_LIMIT = 12;

export function Inspector({
  node,
  graph,
  labelOf,
  expanded,
  onToggleExpand,
  onSelect,
  onFocus,
  onOpen,
  onAsk,
}: {
  node: KnowledgeNode;
  graph: KnowledgeGraph;
  labelOf: (n: KnowledgeNode) => string;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: (id: string) => void;
  onFocus: () => void;
  onOpen: () => void;
  onAsk: () => void;
}) {
  const { t, lang } = useT();
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, { edge: KnowledgeEdge; other: KnowledgeNode }[]>();
    for (const e of graph.edgesOf(node.id)) {
      const other = graph.nodes.get(KnowledgeGraph.other(e, node.id));
      if (!other) continue;
      const list = map.get(e.type) ?? [];
      list.push({ edge: e, other });
      map.set(e.type, list);
    }
    for (const list of map.values())
      list.sort(
        (a, b) =>
          (b.other.metrics?.n ?? 0) - (a.other.metrics?.n ?? 0) ||
          (b.other.date ?? "").localeCompare(a.other.date ?? "") ||
          a.other.id.localeCompare(b.other.id),
      );
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [graph, node.id]);

  const leaves = NODE_KINDS[node.kind].leaf ? 0 : leafCount(graph, node.id);
  const m = node.metrics;
  const d = node.data ?? {};
  const shotPaths = node.kind === "screenshot" ? [node.key] : [];
  const urls = useScreenshotUrls(shotPaths);

  const facts: [string, string][] = [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (node.kind === "trade") {
    if (num(d.pnl) !== null)
      facts.push([t("brain.fact.pnl"), formatMoney(num(d.pnl)!, { signed: true })]);
    facts.push([
      t("brain.fact.r"),
      num(d.r) !== null ? `${num(d.r)!.toFixed(2)}R` : t("brain.fact.unknown"),
    ]);
    facts.push([
      t("common.risk"),
      num(d.risk) !== null ? formatMoney(num(d.risk)!) : t("brain.fact.unknown"),
    ]);
    if (num(d.setupQuality) !== null) facts.push([t("common.quality"), `${d.setupQuality}/5`]);
    if (num(d.confidence) !== null) facts.push([t("brain.fact.confidence"), `${d.confidence}`]);
    if (d.entryTime)
      facts.push([t("common.time"), `${d.entryTime}${d.exitTime ? ` → ${d.exitTime}` : ""}`]);
  } else if (node.kind === "missed") {
    facts.push([
      t("brain.fact.estimatedR"),
      num(d.estimatedR) !== null && d.estimatedR !== 0
        ? `${num(d.estimatedR)!.toFixed(1)}R`
        : t("brain.fact.unknown"),
    ]);
  } else if (node.kind === "economic_event") {
    if (d.time) facts.push([t("common.time"), String(d.time)]);
    if (d.actual) facts.push([t("brain.fact.actual"), String(d.actual)]);
    if (d.approximate) facts.push([t("brain.fact.timing"), t("brain.fact.approximate")]);
  } else if (node.kind === "simulation") {
    facts.push([
      t("brain.fact.assumedRisk"),
      num(d.risk) !== null ? formatMoney(num(d.risk)!) : t("brain.fact.unknown"),
    ]);
    if (num(d.seed) !== null) facts.push([t("brain.fact.seed"), String(d.seed)]);
  } else if (node.kind === "research_note") {
    facts.push([t("brain.fact.verdict"), d.verdict ? String(d.verdict) : t("brain.fact.pending")]);
  } else if (node.kind === "experiment") {
    facts.push([t("brain.fact.status"), String(d.status)]);
    facts.push([t("brain.fact.sessions"), String(d.targetSessions)]);
  } else if (node.kind === "risk_band" && num(d.median) !== null) {
    facts.push([t("brain.ev.median"), formatMoney(num(d.median)!)]);
  }

  return (
    <Card pad="default">
      <KindTag node={node} />
      <h2 className="tv-title mt-1 leading-snug text-white">{labelOf(node)}</h2>
      {node.date && node.kind !== "day" && node.kind !== "month" && (
        <p className="tv-hint mt-0.5 text-slate-500">{formatDay(node.date, lang)}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onOpen}>
          <ExternalLink className="h-3.5 w-3.5" />
          {t("brain.open")}
        </Button>
        {leaves > 0 && (
          <Button size="sm" variant="ghost" onClick={onToggleExpand} aria-pressed={expanded}>
            {expanded ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
            {(expanded ? t("brain.collapse") : t("brain.expand")).replace("{n}", String(leaves))}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onFocus}>
          <Crosshair className="h-3.5 w-3.5" />
          {t("brain.focus")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onAsk}>
          <Bot className="h-3.5 w-3.5" />
          {t("brain.askJarvis")}
        </Button>
      </div>

      <div className="mt-3">
        {m && m.n > 0 && (
          <KpiGrid cols={2} className="mb-3">
            <Kpi label={t("brain.metric.trades")} value={String(m.n)} />
            <Kpi
              label={t("brain.metric.pnl")}
              value={formatMoney(m.pnl, { signed: true })}
              tone={m.pnl > 0 ? "pos" : m.pnl < 0 ? "neg" : "neutral"}
            />
            <Kpi
              label={t("brain.metric.winRate")}
              value={m.winRate === null ? "—" : `${Math.round(m.winRate * 100)} %`}
              hint={m.winRate === null ? t("brain.metric.tooFew") : `n ${m.wins + m.losses}`}
            />
            <Kpi
              label={t("brain.metric.avgR")}
              value={m.avgR === null ? "—" : `${m.avgR.toFixed(2)}R`}
              hint={
                m.avgR === null
                  ? t("brain.metric.tooFewR").replace("{n}", String(m.nR))
                  : `n ${m.nR}`
              }
            />
          </KpiGrid>
        )}

        {facts.length > 0 && (
          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="tv-figure text-right text-white">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {node.kind === "missed" && (
          <p className="tv-hint mb-3 text-slate-500">{t("brain.hypotheticalMissed")}</p>
        )}

        {shotPaths.length > 0 && urls[node.key] && (
          <button type="button" className="mb-3 block w-full" onClick={() => setLightbox(true)}>
            <ScreenshotImage
              path={node.key}
              url={urls[node.key]}
              alt={labelOf(node)}
              className="brain-shot"
            />
          </button>
        )}

        {groups.map(([type, list]) => {
          const shown = more[type] ? list : list.slice(0, GROUP_LIMIT);
          return (
            <section
              key={type}
              className="brain-rel-group"
              aria-label={t(`brain.rel.${type}` as TKey)}
            >
              <h3 className="tv-label mb-1 flex items-center justify-between text-slate-500">
                <span>{t(`brain.rel.${type}` as TKey)}</span>
                <span className="tv-num">{list.length}</span>
              </h3>
              <ul>
                {shown.map(({ edge, other }) => {
                  const proof = evidenceOf(edge, t);
                  const status = edge.provenance.validation;
                  return (
                    <li key={edge.id}>
                      <button
                        type="button"
                        className="brain-link"
                        onClick={() => onSelect(other.id)}
                      >
                        <svg
                          viewBox="0 0 10 10"
                          width="10"
                          height="10"
                          aria-hidden
                          className="flex-none"
                        >
                          <path
                            d={shapePath(CATEGORY_SHAPE[other.category])}
                            fill={`var(${colorVarOf(other)})`}
                          />
                        </svg>
                        <span className="min-w-0 flex-1 truncate">{labelOf(other)}</span>
                        <span className="brain-link-meta">
                          {proof && <span className="tv-num mr-1.5">{proof}</span>}
                          {status !== "fact" && (
                            <Badge variant={status === "hypothesis" ? "warning" : "accent"}>
                              {t(`brain.val.${status}` as TKey)}
                            </Badge>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {list.length > GROUP_LIMIT && (
                <button
                  type="button"
                  className="tv-hint mt-1 px-2 text-slate-400 hover:text-white"
                  onClick={() => setMore((s) => ({ ...s, [type]: !s[type] }))}
                >
                  {more[type]
                    ? t("filters.less")
                    : t("brain.showAll").replace("{n}", String(list.length))}
                </button>
              )}
            </section>
          );
        })}

        <div className="brain-proof">
          <span className="tv-label text-slate-500">{t("brain.provenance")}</span>
          <p className="mt-1">
            {node.source
              ? t("brain.provenance.record")
                  .replace("{table}", node.source.table)
                  .replace(
                    "{id}",
                    node.source.id.length > 24 ? `${node.source.id.slice(0, 24)}…` : node.source.id,
                  )
              : t("brain.provenance.derived")}
          </p>
        </div>
      </div>

      {lightbox && (
        <Suspense fallback={null}>
          <Lightbox
            paths={shotPaths}
            index={0}
            onClose={() => setLightbox(false)}
            onIndexChange={() => {}}
          />
        </Suspense>
      )}
    </Card>
  );
}
