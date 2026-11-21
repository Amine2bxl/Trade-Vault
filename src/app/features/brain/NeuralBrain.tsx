import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Button,
  EmptyState,
  FilterControls,
  FilterSection,
  Input,
  MultiPicker,
  PageContainer,
  SubNav,
} from "@/shared/ui";
import { BookOpen, Focus, LocateFixed, Minus, Network, Plus, X } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { usePageActions } from "@/app/contexts/PageActionsContext";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { useIsNarrow } from "@/app/hooks/useIsNarrow";
import { nsKey, readJSON, writeJSON } from "@/app/utils/persistence";
import { clusterOf } from "@/app/trading/mistakeClusters";
import type { Trade } from "@/app/types";
import {
  addDiscoveriesToGraph,
  buildKnowledgeGraph,
  visibleGraph,
  DEFAULT_MAX_NODES,
  DISCOVERY_VERSION,
  NODE_CATEGORIES,
  RELATIONS,
  type Discovery,
  type DiscoveryRun,
  type KnowledgeNode,
  type NodeCategory,
  type RelationType,
} from "@/modules/knowledge";
import { seedFrom } from "@/modules/probability/rng";
import { GraphCanvas, type GraphHandle } from "./GraphCanvas";
import { Inspector, KindTag } from "./Inspector";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { destinationOf, followDestination } from "./destinations";
import { briefForDiscovery, briefForSelection } from "./jarvisBrief";
import { CATEGORY_SHAPE, nodeLabel, shapePath } from "./presentation";
import { useBrainData } from "./useBrainData";
import { useBrainCompute } from "./useBrainCompute";
import type { AnalyzeResult } from "./brainCompute";
import { useDiscoveryFeedback } from "./useDiscoveryFeedback";
import type { Camera } from "./camera";
import "./brain.css";

/**
 * NEURAL BRAIN — le journal entier comme un graphe de connaissance en 3D.
 *
 * Rôle de la page en une phrase : montrer comment chaque trade, erreur, setup
 * manqué, annonce, simulation et conversation se relient, et ce que ces liens
 * révèlent — chaque lien avec sa preuve, chaque nœud avec son original.
 *
 * Tout est DÉRIVÉ à l'affichage (`modules/knowledge`) depuis les sources qui
 * font foi : aucune donnée n'est recopiée, rien ne diverge. Les découvertes
 * sortent des mêmes seuils que le reste du produit (n minimum, intervalle,
 * tests multiples), et Jarvis ne fait que les formuler.
 */

type Tab = "inspect" | "discoveries";

interface Persisted {
  hiddenCategories: NodeCategory[];
  hiddenRelations: RelationType[];
  showLeaves: boolean;
  camera: Camera | null;
}

const RELATION_TYPES = Object.keys(RELATIONS) as RelationType[];
const TRAIL_MAX = 8;
const EMPTY_RUN: DiscoveryRun = {
  discoveries: [],
  tests: 0,
  alpha: 0.1,
  version: DISCOVERY_VERSION,
};

export default function NeuralBrain({ trades }: { trades: Trade[] }) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { activeId, activeAccount } = useAccounts();
  const { boxRef, height } = useAvailableHeight();
  const narrow = useIsNarrow("(max-width: 1023px)");
  const data = useBrainData(trades);
  const { reviews, review } = useDiscoveryFeedback(user?.id);
  const graphRef = useRef<GraphHandle>(null);
  const positions = useRef(new Map<string, [number, number, number]>());

  // ── Préférences de vue (par appareil, namespacées par utilisateur).
  const prefKey = nsKey(user?.id, `brain.view.v1.${activeId ?? "main"}`);
  const [persisted, setPersisted] = useState<Persisted>(() =>
    readJSON<Persisted>(prefKey, {
      hiddenCategories: [],
      hiddenRelations: [],
      showLeaves: false,
      camera: null,
    }),
  );
  const persist = useCallback(
    (patch: Partial<Persisted>) =>
      setPersisted((p) => {
        const next = { ...p, ...patch };
        writeJSON(prefKey, next);
        return next;
      }),
    [prefKey],
  );

  // ── Découvertes : calculées après le premier rendu (bootstrap = quelques
  // centaines de ms sur un gros journal ; le graphe s'affiche d'abord).
  const [run, setRun] = useState<DiscoveryRun>(EMPTY_RUN);
  const accountKey = activeAccount?.id ?? "main";
  const compute = useBrainCompute();
  // Hors du fil d'affichage (Worker) : le graphe s'affiche d'abord.
  useEffect(() => {
    let active = true;
    compute<AnalyzeResult>({
      type: "analyze",
      trades,
      missed: data.missed,
      simulations: data.simulations,
      behavior: data.behavior,
      accountKey,
    })
      .then((r) => active && setRun(r.run))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [compute, trades, data.missed, data.simulations, data.behavior, accountKey]);
  const discoveries = useMemo(() => new Map(run.discoveries.map((d) => [d.id, d])), [run]);

  const graph = useMemo(() => {
    const now = new Date().toISOString();
    const g = buildKnowledgeGraph({
      trades,
      missed: data.missed,
      events: data.events,
      conversations: data.conversations,
      research: data.research,
      experiments: data.experiments,
      simulations: data.simulations,
      reports: data.reports,
      proposals: data.proposals,
      account: { id: activeAccount?.id ?? null, name: activeAccount?.name ?? "" },
      clusterOf,
      behavior: data.behavior,
      now,
    });
    addDiscoveriesToGraph(g, run, now);
    return g;
  }, [trades, data, activeAccount?.id, activeAccount?.name, run]);

  const labelOf = useCallback(
    (n: KnowledgeNode) => nodeLabel(n, t, lang, discoveries),
    [t, lang, discoveries],
  );

  // ── Sélection, fil d'Ariane, dépliage, focus — et le lien profond `?node=`.
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const id = new URLSearchParams(window.location.search).get("node");
    return id ? new Set([id]) : new Set();
  });
  const [primary, setPrimary] = useState<string | null>(() => [...selected][0] ?? null);
  const [trail, setTrail] = useState<string[]>(() => (primary ? [primary] : []));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(primary ? [primary] : []));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(primary ? "inspect" : "discoveries");
  const [activeDiscovery, setActiveDiscovery] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (primary) url.searchParams.set("node", primary);
    else url.searchParams.delete("node");
    if (url.search !== window.location.search)
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [primary]);

  const select = useCallback((id: string | null, additive = false) => {
    if (!id) {
      setSelected(new Set());
      setPrimary(null);
      return;
    }
    setSelected((prev) => {
      if (!additive) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPrimary(id);
    setTrail((tr) =>
      tr[tr.length - 1] === id ? tr : [...tr.filter((x) => x !== id), id].slice(-TRAIL_MAX),
    );
    setTab("inspect");
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const activate = useCallback(
    (id: string) => {
      select(id);
      setFocusId(id);
      setExpanded((prev) => new Set(prev).add(id));
      requestAnimationFrame(() => graphRef.current?.flyTo(id));
    },
    [select],
  );

  // ── Ce qui est visible.
  const hiddenCategories = useMemo(
    () => new Set(persisted.hiddenCategories),
    [persisted.hiddenCategories],
  );
  const hiddenRelations = useMemo(
    () => new Set(persisted.hiddenRelations),
    [persisted.hiddenRelations],
  );
  const visible = useMemo(
    () =>
      visibleGraph(graph, {
        hiddenCategories,
        hiddenRelations,
        expanded,
        showLeaves: persisted.showLeaves,
        from,
        to,
        focus: focusId,
        pinned: selected,
        maxNodes: narrow ? 500 : DEFAULT_MAX_NODES,
      }),
    [
      graph,
      hiddenCategories,
      hiddenRelations,
      expanded,
      persisted.showLeaves,
      from,
      to,
      focusId,
      selected,
      narrow,
    ],
  );

  const primaryNode = primary ? (graph.nodes.get(primary) ?? null) : null;
  const seed = useMemo(
    () => seedFrom(`brain:${user?.id ?? ""}:${activeId ?? "main"}`),
    [user?.id, activeId],
  );

  // ── Jarvis : la sélection décrite, puis Jarvis lit lui-même le journal.
  const askJarvis = useCallback(
    (prompt: string) =>
      window.dispatchEvent(new CustomEvent("tv:ask-coach", { detail: { prompt } })),
    [],
  );
  const askSelection = () => {
    const nodes = [...selected]
      .map((id) => graph.nodes.get(id))
      .filter((n): n is KnowledgeNode => !!n);
    if (nodes.length) askJarvis(briefForSelection(nodes, graph, t, labelOf));
  };

  const openNode = (node: KnowledgeNode) =>
    followDestination(destinationOf(node, graph), (id) => {
      setActiveDiscovery(id);
      setTab("discoveries");
    });

  const showDiscovery = (d: Discovery) => {
    const id = `discovery:${d.id}`;
    setActiveDiscovery(d.id);
    setFocusId(null);
    select(id);
    setTab("discoveries");
    requestAnimationFrame(() => graphRef.current?.flyTo(id));
  };

  const openTrades = (d: Discovery) =>
    followDestination({ type: "page", page: "journal", filter: { trades: d.trades } }, () => {});

  // ── Recherche.
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const results = useMemo(() => (query.trim() ? graph.search(query, 12) : []), [graph, query]);
  const pickResult = (n: KnowledgeNode) => {
    setQuery("");
    activate(n.id);
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") setCursor((c) => (c + 1) % results.length);
    else if (e.key === "ArrowUp") setCursor((c) => (c - 1 + results.length) % results.length);
    else if (e.key === "Enter") pickResult(results[Math.min(cursor, results.length - 1)]);
    else if (e.key === "Escape") setQuery("");
    else return;
    e.preventDefault();
  };

  // ── La frise : un mois = une barre.
  const months = useMemo(
    () =>
      [...graph.nodes.values()]
        .filter((n) => n.kind === "month")
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((n) => ({ key: n.key, n: n.metrics?.n ?? 0 })),
    [graph],
  );
  const maxMonth = Math.max(1, ...months.map((m) => m.n));
  const pickMonth = (key: string, extend: boolean) => {
    const start = `${key}-01`;
    const end = `${key}-31`;
    if (extend && from) {
      setFrom(start < from ? start : from);
      setTo(end > (to ?? end) ? end : (to ?? end));
      return;
    }
    if (from === start && to === end) {
      setFrom(null);
      setTo(null);
    } else {
      setFrom(start);
      setTo(end);
    }
  };

  // ── Filtres (en-tête de page, contrat `FilterControls`).
  const catOptions = NODE_CATEGORIES.map((c) => ({ value: c, label: t(`brain.cat.${c}` as TKey) }));
  const relOptions = RELATION_TYPES.map((r) => ({ value: r, label: t(`brain.rel.${r}` as TKey) }));
  const shownCats = NODE_CATEGORIES.filter((c) => !hiddenCategories.has(c));
  const shownRels = RELATION_TYPES.filter((r) => !hiddenRelations.has(r));
  const filterCount =
    persisted.hiddenCategories.length +
    persisted.hiddenRelations.length +
    (persisted.showLeaves ? 1 : 0);
  const actions = useMemo(
    () => (
      <FilterControls
        label={t("common.filters")}
        summary={
          filterCount ? t("brain.filtersActive").replace("{n}", String(filterCount)) : undefined
        }
        count={filterCount}
        onReset={() => persist({ hiddenCategories: [], hiddenRelations: [], showLeaves: false })}
        resetLabel={t("common.reset")}
        doneLabel={t("common.done")}
        liveLabel={t("filters.live")}
      >
        <label className="tv-inbox-unread-filter">
          <input
            type="checkbox"
            checked={persisted.showLeaves}
            onChange={(e) => persist({ showLeaves: e.target.checked })}
          />
          <span>{t("brain.showLeaves")}</span>
        </label>
        <FilterSection
          label={t("brain.families")}
          summary={
            shownCats.length === NODE_CATEGORIES.length ? t("common.all") : String(shownCats.length)
          }
        >
          <MultiPicker
            inline
            label={t("brain.families")}
            values={shownCats}
            options={catOptions}
            onChange={(v) =>
              persist({ hiddenCategories: NODE_CATEGORIES.filter((c) => !v.includes(c)) })
            }
            allLabel={t("common.all")}
            moreLabel={t("filters.more")}
            lessLabel={t("filters.less")}
            searchLabel={t("picker.search")}
          />
        </FilterSection>
        <FilterSection
          label={t("brain.relations")}
          summary={
            shownRels.length === RELATION_TYPES.length ? t("common.all") : String(shownRels.length)
          }
        >
          <MultiPicker
            inline
            label={t("brain.relations")}
            values={shownRels}
            options={relOptions}
            onChange={(v) =>
              persist({ hiddenRelations: RELATION_TYPES.filter((r) => !v.includes(r)) })
            }
            allLabel={t("common.all")}
            moreLabel={t("filters.more")}
            lessLabel={t("filters.less")}
            searchLabel={t("picker.search")}
          />
        </FilterSection>
      </FilterControls>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, persisted, filterCount],
  );
  usePageActions(actions);

  const categoriesShown = useMemo(() => {
    const present = new Set(visible.nodes.map((n) => n.category));
    return NODE_CATEGORIES.filter((c) => present.has(c));
  }, [visible.nodes]);

  if (!trades.length) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Network className="h-5 w-5" />}
          title={t("brain.emptyTitle")}
          description={t("brain.emptyBody")}
          action={
            <Button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tv:navigate", { detail: { page: "journal" } }),
                )
              }
            >
              <BookOpen className="h-4 w-4" />
              {t("brain.emptyAction")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const status = [
    t("brain.status.shown")
      .replace("{nodes}", String(visible.nodes.length))
      .replace("{edges}", String(visible.edges.length)),
    visible.truncated
      ? t("brain.status.truncated").replace("{n}", String(visible.truncated))
      : null,
    data.failed.length ? t("brain.status.failed").replace("{n}", String(data.failed.length)) : null,
    !settled ? t("brain.status.arranging") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageContainer ref={boxRef} fit height={height} className="brain-root flex flex-col">
      <div className="brain-stage">
        <div className="brain-canvas-wrap">
          <GraphCanvas
            ref={graphRef}
            nodes={visible.nodes}
            edges={visible.edges}
            positions={positions.current}
            seed={seed}
            selected={selected}
            labelOf={labelOf}
            onSelect={(id, additive) => select(id, additive)}
            onActivate={activate}
            initialCamera={persisted.camera}
            onCameraIdle={(camera) => persist({ camera })}
            onSettled={setSettled}
            ariaLabel={t("brain.canvasLabel")
              .replace("{nodes}", String(visible.nodes.length))
              .replace("{edges}", String(visible.edges.length))}
          />

          <div className="brain-top">
            <div className="brain-search">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onSearchKey}
                placeholder={t("brain.searchPlaceholder")}
                aria-label={t("brain.searchPlaceholder")}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="brain-results"
                aria-autocomplete="list"
              />
              {results.length > 0 && (
                <div id="brain-results" role="listbox" className="brain-results">
                  {results.map((n, i) => (
                    <button
                      key={n.id}
                      type="button"
                      role="option"
                      aria-selected={i === cursor}
                      className="brain-result"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => pickResult(n)}
                    >
                      <span className="min-w-0 flex-1 truncate">{labelOf(n)}</span>
                      <KindTag node={n} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(trail.length > 0 || focusId) && (
              <nav className="brain-crumbs" aria-label={t("brain.trail")}>
                {trail.map((id) => {
                  const n = graph.nodes.get(id);
                  if (!n) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="brain-crumb"
                      aria-current={id === primary || undefined}
                      onClick={() => activate(id)}
                    >
                      {labelOf(n)}
                    </button>
                  );
                })}
                {focusId && (
                  <Button size="sm" variant="ghost" onClick={() => setFocusId(null)}>
                    <X className="h-3.5 w-3.5" />
                    {t("brain.exitFocus")}
                  </Button>
                )}
              </nav>
            )}
          </div>

          <div className="brain-tools">
            <button
              type="button"
              className="brain-tool"
              aria-label={t("brain.zoomIn")}
              onClick={() => graphRef.current?.zoomIn()}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="brain-tool"
              aria-label={t("brain.zoomOut")}
              onClick={() => graphRef.current?.zoomOut()}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="brain-tool"
              aria-label={t("brain.fit")}
              onClick={() => graphRef.current?.fit()}
            >
              <LocateFixed className="h-4 w-4" />
            </button>
            {selected.size > 1 && (
              <button
                type="button"
                className="brain-tool"
                aria-label={t("brain.askSelection")}
                onClick={askSelection}
              >
                <Focus className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="brain-legend" aria-label={t("brain.legend")}>
            {categoriesShown.map((c) => (
              <span key={c} className="brain-legend-row">
                <svg viewBox="0 0 10 10" aria-hidden>
                  <path d={shapePath(CATEGORY_SHAPE[c])} fill={`var(--brain-${c})`} />
                </svg>
                {t(`brain.cat.${c}` as TKey)}
              </span>
            ))}
          </div>

          <p className="brain-status tv-num" role="status">
            {status}
          </p>

          {months.length > 1 && (
            <div className="brain-timeline" role="group" aria-label={t("brain.timeline")}>
              {months.map((m) => {
                const on = !!from && !!to && `${m.key}-01` >= from && `${m.key}-01` <= to;
                return (
                  <button
                    key={m.key}
                    type="button"
                    className="brain-month"
                    aria-pressed={on}
                    aria-label={`${m.key} · ${t("brain.status.trades").replace("{n}", String(m.n))}`}
                    title={`${m.key} · ${m.n}`}
                    onClick={(e) => pickMonth(m.key, e.shiftKey)}
                  >
                    <span style={{ height: `${Math.max(8, (m.n / maxMonth) * 100)}%` }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="brain-side" aria-label={t("brain.side")}>
          <SubNav
            ariaLabel={t("brain.side")}
            value={tab}
            onChange={setTab}
            items={[
              { id: "inspect", label: t("brain.tab.inspect") },
              {
                id: "discoveries",
                label: t("brain.tab.discoveries"),
                count: run.discoveries.length,
              },
            ]}
          />
          <div className="brain-side-body overflow-y-auto">
            {tab === "inspect" &&
              (primaryNode ? (
                <Inspector
                  key={primaryNode.id}
                  node={primaryNode}
                  graph={graph}
                  labelOf={labelOf}
                  expanded={expanded.has(primaryNode.id)}
                  onToggleExpand={() => toggleExpand(primaryNode.id)}
                  onSelect={(id) => {
                    select(id);
                    requestAnimationFrame(() => graphRef.current?.flyTo(id));
                  }}
                  onFocus={() => activate(primaryNode.id)}
                  onOpen={() => openNode(primaryNode)}
                  onAsk={() =>
                    selected.size > 1
                      ? askSelection()
                      : askJarvis(briefForSelection([primaryNode], graph, t, labelOf))
                  }
                />
              ) : (
                <EmptyState
                  icon={<Network className="h-5 w-5" />}
                  title={t("brain.inspectEmptyTitle")}
                  description={t("brain.inspectEmptyBody")}
                />
              ))}
            {tab === "discoveries" && (
              <DiscoveryPanel
                run={run}
                tradeCount={trades.length}
                reviews={reviews}
                activeId={activeDiscovery}
                onReview={review}
                onShow={showDiscovery}
                onAsk={(d) => askJarvis(briefForDiscovery(d, t))}
                onOpenTrades={openTrades}
              />
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
