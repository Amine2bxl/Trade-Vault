import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Badge,
  Button,
  EmptyState,
  FilterControls,
  FilterSection,
  Input,
  MultiPicker,
  PageControls,
  SubNav,
} from "@/shared/ui";
import {
  ArrowLeft,
  BookOpen,
  Focus,
  LocateFixed,
  Maximize2,
  Minus,
  Network,
  Plus,
  Volume2,
  VolumeX,
} from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
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
  NODE_KINDS,
  RELATIONS,
  type Discovery,
  type DiscoveryRun,
  type KnowledgeEdge,
  type KnowledgeNode,
  type NodeCategory,
  type NodeKind,
  type RelationType,
} from "@/modules/knowledge";
import { seedFrom } from "@/modules/probability/rng";
import { BrainScene, type SceneHandle } from "./BrainScene";
import { Inspector } from "./Inspector";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { SimulateControls, SimulateResults, useSimulation } from "./SimulatePanel";
import { EvolutionList, EvolutionStage } from "./EvolutionPanel";
import { destinationOf, followDestination } from "./destinations";
import { briefForDiscovery, briefForSelection } from "./jarvisBrief";
import { CATEGORY_SHAPE, colorVarOf, evidenceOf, nodeLabel, shapePath } from "./presentation";
import { useBrainData } from "./useBrainData";
import { useBrainCompute } from "./useBrainCompute";
import type { AnalyzeResult } from "./brainCompute";
import { useDiscoveryFeedback } from "./useDiscoveryFeedback";
import { brainSoundEnabled, playBrain, setBrainSound } from "./brainSound";
import type { Camera } from "./camera";
import "./brain.css";

/**
 * NEURAL BRAIN — un environnement à part entière dans TradeVault.
 *
 * On y ENTRE (plein écran au-dessus de l'app, entrée cinématique), on y
 * explore son historique comme un système vivant, on lit les découvertes que
 * les moteurs ont établies, on rejoue son passé avec d'autres décisions, et
 * l'on se compare à soi-même dans le temps. Quatre modes, une seule scène.
 *
 * L'écran reste minimal : la scène domine ; le rail des dimensions, la
 * recherche et les panneaux n'apparaissent que là où ils servent. Tout est
 * DÉRIVÉ des enregistrements (`modules/knowledge`) ; le calcul lourd part
 * dans un Worker ; Jarvis ne fait que formuler.
 */

type Mode = "explore" | "discoveries" | "simulate" | "evolution";
const MODES: Mode[] = ["explore", "discoveries", "simulate", "evolution"];

interface Persisted {
  hiddenCategories: NodeCategory[];
  hiddenRelations: RelationType[];
  showLeaves: boolean;
  camera: Camera | null;
}

/** Les dimensions du rail : chacune isole une famille de nœuds. */
const DIMENSIONS: { id: string; label: TKey; kinds: NodeKind[] }[] = [
  { id: "strategy", label: "brain.dim.setups", kinds: ["strategy"] },
  { id: "symbol", label: "brain.dim.instruments", kinds: ["symbol"] },
  { id: "session", label: "brain.dim.sessions", kinds: ["session"] },
  { id: "mistake", label: "brain.dim.mistakes", kinds: ["mistake", "mistake_cluster"] },
  { id: "signature", label: "brain.dim.signatures", kinds: ["error_pattern"] },
  { id: "risk", label: "brain.dim.risk", kinds: ["risk_band"] },
  { id: "market", label: "brain.dim.market", kinds: ["economic_event"] },
  {
    id: "ai",
    label: "brain.dim.jarvis",
    kinds: ["conversation", "research_note", "experiment", "proposal"],
  },
  { id: "discovery", label: "brain.dim.discoveries", kinds: ["discovery"] },
  { id: "time", label: "brain.dim.time", kinds: ["month", "report"] },
];

const RELATION_TYPES = Object.keys(RELATIONS) as RelationType[];
const TRAIL_MAX = 8;
const EMPTY_RUN: DiscoveryRun = {
  discoveries: [],
  tests: 0,
  alpha: 0.1,
  version: DISCOVERY_VERSION,
};
/** Feuilles épinglées au plus quand une dimension « feuille » est isolée. */
const PIN_CAP = 300;

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function NeuralBrain({ trades }: { trades: Trade[] }) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { activeId, activeAccount } = useAccounts();
  const narrow = useIsNarrow("(max-width: 1023px)");
  const data = useBrainData(trades);
  const { reviews, review } = useDiscoveryFeedback(user?.id);
  const sceneRef = useRef<SceneHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, [number, number, number]>());
  const compute = useBrainCompute();

  // ── Préférences de vue (par appareil, par utilisateur et compte).
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

  // ── Analyse (découvertes + évolution) dans le Worker.
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const accountKey = activeAccount?.id ?? "main";
  useEffect(() => {
    let live = true;
    compute<AnalyzeResult>({
      type: "analyze",
      trades,
      missed: data.missed,
      simulations: data.simulations,
      behavior: data.behavior,
      accountKey,
    })
      .then((r) => live && setAnalysis(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [compute, trades, data.missed, data.simulations, data.behavior, accountKey]);
  const run = analysis?.run ?? EMPTY_RUN;
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
    (n: KnowledgeNode) =>
      n.kind === "error_pattern"
        ? t(`brain.err.${n.key}` as TKey)
        : nodeLabel(n, t, lang, discoveries),
    [t, lang, discoveries],
  );

  // ── État de navigation.
  const [mode, setModeState] = useState<Mode>("explore");
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const id = new URLSearchParams(window.location.search).get("node");
    return id ? new Set([id]) : new Set();
  });
  const [primary, setPrimary] = useState<string | null>(() => [...selected][0] ?? null);
  const [trail, setTrail] = useState<string[]>(() => (primary ? [primary] : []));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(primary ? [primary] : []));
  const [isolate, setIsolate] = useState<string | null>(null);
  const [activeDiscovery, setActiveDiscovery] = useState<string | null>(null);
  const [evoKey, setEvoKey] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [intro, setIntro] = useState(() => !reducedMotion());
  const [sound, setSound] = useState(brainSoundEnabled);
  const [leaving, setLeaving] = useState(false);
  const [tip, setTip] = useState<{ edge: KnowledgeEdge; x: number; y: number } | null>(null);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    playBrain("transition");
  }, []);

  useEffect(() => {
    playBrain("enter");
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (primary) url.searchParams.set("node", primary);
    else url.searchParams.delete("node");
    if (url.search !== window.location.search)
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [primary]);

  const select = useCallback(
    (id: string | null, additive = false) => {
      if (!id) {
        setSelected(new Set());
        setPrimary(null);
        return;
      }
      const node = graph.nodes.get(id);
      // Une découverte s'ouvre dans son mode, avec son parcours de preuve.
      if (node?.kind === "discovery") {
        setActiveDiscovery(node.key);
        setModeState("discoveries");
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
      playBrain("select");
    },
    [graph],
  );

  const activate = useCallback(
    (id: string) => {
      select(id);
      setExpanded((prev) => new Set(prev).add(id));
      requestAnimationFrame(() => sceneRef.current?.flyTo(id));
    },
    [select],
  );

  // ── Parcours de la découverte ouverte : la découverte, ses moyeux, ses trades.
  const activeD = activeDiscovery ? discoveries.get(activeDiscovery) : undefined;
  const path = useMemo(() => {
    if (mode !== "discoveries" || !activeD) return null;
    const ids = [
      `discovery:${activeD.id}`,
      ...activeD.entities,
      ...activeD.trades.slice(0, 12).map((x) => `trade:${x}`),
    ];
    return ids.filter((id) => graph.nodes.has(id));
  }, [mode, activeD, graph]);

  // ── Dimension isolée : ses nœuds et leurs moyeux voisins.
  const isolateSet = useMemo(() => {
    if (!isolate) return null;
    const kinds = DIMENSIONS.find((d) => d.id === isolate)?.kinds ?? [];
    const out = new Set<string>();
    for (const n of graph.nodes.values()) {
      if (!kinds.includes(n.kind)) continue;
      if (out.size > PIN_CAP) break;
      out.add(n.id);
      for (const m of graph.neighbors(n.id)) if (!NODE_KINDS[m.kind].leaf) out.add(m.id);
    }
    return out;
  }, [isolate, graph]);

  const pinned = useMemo(() => {
    const out = new Set(selected);
    for (const id of path ?? []) out.add(id);
    for (const id of isolateSet ?? []) out.add(id);
    return out;
  }, [selected, path, isolateSet]);

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
        pinned,
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
      pinned,
      narrow,
    ],
  );

  // La caméra suit ce qu'on isole ou ce qu'on parcourt.
  useEffect(() => {
    const ids = path ?? (isolateSet ? [...isolateSet] : null);
    if (!ids?.length) return;
    const id = requestAnimationFrame(() => sceneRef.current?.flyToSet(ids));
    if (path) playBrain("discover");
    return () => cancelAnimationFrame(id);
  }, [path, isolateSet]);

  const primaryNode = primary ? (graph.nodes.get(primary) ?? null) : null;
  const seed = useMemo(
    () => seedFrom(`brain:${user?.id ?? ""}:${activeId ?? "main"}`),
    [user?.id, activeId],
  );
  const sim = useSimulation(mode === "simulate", trades, data.behavior, compute);

  // ── Jarvis, liens vers les originaux.
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
  const openDiscovery = (d: Discovery | null) => {
    setActiveDiscovery(d?.id ?? null);
    if (d) select(`discovery:${d.id}`);
  };
  const openNode = (node: KnowledgeNode) =>
    followDestination(destinationOf(node, graph), (id) => {
      setActiveDiscovery(id);
      setMode("discoveries");
    });
  const openTrades = (d: Discovery) =>
    followDestination({ type: "page", page: "journal", filter: { trades: d.trades } }, () => {});

  // ── Quitter : recul, puis la page d'origine.
  const exit = useCallback(() => {
    playBrain("exit");
    setLeaving(true);
    setTimeout(
      () => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        if (window.history.length > 1) window.history.back();
        else
          window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: "dashboard" } }));
      },
      reducedMotion() ? 0 : 180,
    );
  }, []);

  // Échap : d'abord ce qui est ouvert, puis le mode, puis la sortie.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("[role='dialog']")) return;
      if (selected.size) select(null);
      else if (isolate) setIsolate(null);
      else if (mode !== "explore") setMode("explore");
      else exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, isolate, mode, select, setMode, exit]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  const toggleSound = () => {
    setBrainSound(!sound);
    setSound(!sound);
    if (!sound) playBrain("select");
  };

  // ── Recherche.
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const results = useMemo(() => (query.trim() ? graph.search(query, 12) : []), [graph, query]);
  const pickResult = (n: KnowledgeNode) => {
    setQuery("");
    setModeState("explore");
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

  // ── Frise.
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

  const dimCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of DIMENSIONS) out[d.id] = 0;
    for (const n of graph.nodes.values())
      for (const d of DIMENSIONS) if (d.kinds.includes(n.kind)) out[d.id]++;
    return out;
  }, [graph]);

  const pickDimension = (id: string) => {
    setIsolate((cur) => (cur === id ? null : id));
    setModeState("explore");
    playBrain("transition");
  };

  const filterCount =
    persisted.hiddenCategories.length +
    persisted.hiddenRelations.length +
    (persisted.showLeaves ? 1 : 0);
  const catOptions = NODE_CATEGORIES.map((c) => ({ value: c, label: t(`brain.cat.${c}` as TKey) }));
  const relOptions = RELATION_TYPES.map((r) => ({ value: r, label: t(`brain.rel.${r}` as TKey) }));
  const shownCats = NODE_CATEGORIES.filter((c) => !hiddenCategories.has(c));
  const shownRels = RELATION_TYPES.filter((r) => !hiddenRelations.has(r));

  if (!trades.length) {
    return (
      <div className="brain-xp brain-root z-[var(--tv-z-nav)] grid place-items-center p-6">
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
      </div>
    );
  }

  const sheetOpen =
    mode === "discoveries" ||
    mode === "simulate" ||
    mode === "evolution" ||
    (mode === "explore" && !!primaryNode);
  const recede = mode === "simulate" || mode === "evolution";
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
  const edgeName = (e: KnowledgeEdge) => {
    const a = graph.nodes.get(e.source);
    const b = graph.nodes.get(e.target);
    return a && b ? `${labelOf(a)} → ${labelOf(b)}` : "";
  };

  return (
    <div
      ref={rootRef}
      className="brain-xp brain-root z-[var(--tv-z-nav)]"
      data-sheet={sheetOpen || undefined}
      data-leaving={leaving || undefined}
      role="application"
      aria-label={t("nav.brain")}
    >
      <BrainScene
        ref={sceneRef}
        nodes={visible.nodes}
        edges={visible.edges}
        positions={positions.current}
        seed={seed}
        selected={selected}
        emphasis={isolateSet}
        path={path}
        recede={recede}
        intro={intro}
        onIntroDone={() => setIntro(false)}
        labelOf={labelOf}
        onSelect={(id, additive) => select(id, additive)}
        onActivate={activate}
        onHoverEdge={(edge, x, y) => setTip(edge ? { edge, x, y } : null)}
        initialCamera={persisted.camera}
        onCameraIdle={(camera) => persist({ camera })}
        onSettled={setSettled}
        ariaLabel={t("brain.canvasLabel")
          .replace("{nodes}", String(visible.nodes.length))
          .replace("{edges}", String(visible.edges.length))}
      />

      {intro && (
        <div className="brain-intro" aria-live="polite">
          <p className="tv-label text-slate-400">{t("brain.intro.title")}</p>
          <p className="tv-num">{t("brain.intro.trades").replace("{n}", String(trades.length))}</p>
          <p className="tv-num">
            {t("brain.intro.links").replace("{n}", String(graph.edges.size))}
          </p>
          <p className="tv-num">
            {analysis
              ? t("brain.intro.tests").replace("{n}", String(run.tests))
              : t("brain.intro.analyzing")}
          </p>
        </div>
      )}

      {tip && !recede && (
        <div
          className="brain-tip tv-glass-solid"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: tip.y + 14 }}
        >
          <span className="tv-label block text-slate-400">
            {t(`brain.rel.${tip.edge.type}` as TKey)} ·{" "}
            {t(`brain.val.${tip.edge.provenance.validation}` as TKey)}
          </span>
          <span className="mt-0.5 block text-[var(--tv-text-primary)]">{edgeName(tip.edge)}</span>
          {evidenceOf(tip.edge, t) && (
            <span className="tv-num block">{evidenceOf(tip.edge, t)}</span>
          )}
          <span className="block text-slate-500">{tip.edge.provenance.methodology}</span>
        </div>
      )}

      <header className="brain-hud tv-glass-solid">
        <Button size="sm" variant="ghost" onClick={exit} aria-label={t("brain.exit")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden md:inline">TradeVault</span>
        </Button>
        <span className="brain-hud-title">{t("nav.brain")}</span>
        <div className="brain-hud-grow">
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
                    <span className="tv-hint text-slate-500">
                      {t(`brain.kind.${n.kind}` as TKey)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <SubNav
          ariaLabel={t("brain.modes")}
          value={mode}
          onChange={setMode}
          items={MODES.map((m) => ({
            id: m,
            label: t(`brain.mode.${m}` as TKey),
            ...(m === "discoveries" ? { count: run.discoveries.length } : {}),
          }))}
        />
        {narrow && (
          <PageControls
            label={t("brain.dimensions")}
            closeOnAction
            iconOnly
            icon={<Network className="h-4 w-4" />}
          >
            <div className="grid gap-0.5">
              {DIMENSIONS.filter((d) => dimCounts[d.id] > 0).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="brain-dim"
                  aria-pressed={isolate === d.id}
                  onClick={() => pickDimension(d.id)}
                >
                  {t(d.label)}
                  <span className="tv-num ml-auto">{dimCounts[d.id]}</span>
                </button>
              ))}
            </div>
          </PageControls>
        )}
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
              shownCats.length === NODE_CATEGORIES.length
                ? t("common.all")
                : String(shownCats.length)
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
              shownRels.length === RELATION_TYPES.length
                ? t("common.all")
                : String(shownRels.length)
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
        <button
          type="button"
          className="brain-tool"
          aria-pressed={sound}
          aria-label={t(sound ? "brain.sound.on" : "brain.sound.off")}
          title={t(sound ? "brain.sound.on" : "brain.sound.off")}
          onClick={toggleSound}
        >
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        {!narrow && (
          <button
            type="button"
            className="brain-tool"
            aria-label={t("brain.fullscreen")}
            title={t("brain.fullscreen")}
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {!narrow && mode !== "simulate" && mode !== "evolution" && (
        <nav className="brain-rail tv-glass-solid" aria-label={t("brain.dimensions")}>
          <button
            type="button"
            className="brain-dim"
            aria-pressed={!isolate}
            onClick={() => setIsolate(null)}
          >
            <Network className="h-3.5 w-3.5" />
            {t("brain.globalView")}
          </button>
          {DIMENSIONS.filter((d) => dimCounts[d.id] > 0).map((d) => {
            const sample = [...graph.nodes.values()].find((n) => d.kinds.includes(n.kind));
            return (
              <button
                key={d.id}
                type="button"
                className="brain-dim"
                aria-pressed={isolate === d.id}
                onClick={() => pickDimension(d.id)}
              >
                {sample && (
                  <svg viewBox="0 0 10 10" aria-hidden>
                    <path
                      d={shapePath(CATEGORY_SHAPE[sample.category])}
                      fill={`var(${colorVarOf(sample)})`}
                    />
                  </svg>
                )}
                {t(d.label)}
                <span className="tv-num ml-auto text-slate-500">{dimCounts[d.id]}</span>
              </button>
            );
          })}
          <div className="mt-2 grid gap-1 border-t border-[var(--tv-border)] px-2 pt-2">
            <span className="tv-label text-slate-500">{t("brain.links")}</span>
            {(
              [
                ["brain.linkFact", "var(--brain-edge)", false],
                ["brain.linkMeasured", "var(--brain-performance)", false],
                ["brain.linkHypothesis", "var(--brain-behavior)", true],
              ] as const
            ).map(([k, color, dashed]) => (
              <span key={k} className="brain-legend-row">
                <svg width="18" height="4" aria-hidden>
                  <line
                    x1="0"
                    y1="2"
                    x2="18"
                    y2="2"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray={dashed ? "3 3" : undefined}
                  />
                </svg>
                {t(k)}
              </span>
            ))}
          </div>
        </nav>
      )}

      {sheetOpen && (
        <aside className="brain-sheet tv-glass-solid" aria-label={t(`brain.mode.${mode}` as TKey)}>
          <div className="brain-sheet-body">
            {mode === "explore" && primaryNode && (
              <Inspector
                key={primaryNode.id}
                node={primaryNode}
                graph={graph}
                labelOf={labelOf}
                expanded={expanded.has(primaryNode.id)}
                onToggleExpand={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(primaryNode.id)) next.delete(primaryNode.id);
                    else next.add(primaryNode.id);
                    return next;
                  })
                }
                onSelect={(id) => {
                  select(id);
                  requestAnimationFrame(() => sceneRef.current?.flyTo(id));
                }}
                onFocus={() => activate(primaryNode.id)}
                onOpen={() => openNode(primaryNode)}
                onAsk={() =>
                  selected.size > 1
                    ? askSelection()
                    : askJarvis(briefForSelection([primaryNode], graph, t, labelOf))
                }
              />
            )}
            {mode === "discoveries" && (
              <DiscoveryPanel
                run={run}
                graph={graph}
                tradeCount={trades.length}
                reviews={reviews}
                activeId={activeDiscovery}
                onOpen={openDiscovery}
                onReview={review}
                onShow={(d) => openDiscovery(d)}
                onAsk={(d) => askJarvis(briefForDiscovery(d, t))}
                onOpenTrades={openTrades}
              />
            )}
            {mode === "simulate" && (
              <SimulateControls
                trades={trades}
                behavior={data.behavior}
                config={sim.config}
                onChange={sim.setConfig}
              />
            )}
            {mode === "evolution" && (
              <EvolutionList
                evolution={analysis?.evolution ?? null}
                selected={evoKey}
                onSelect={setEvoKey}
              />
            )}
          </div>
        </aside>
      )}

      {mode === "simulate" && (
        <section className="brain-stagechart" aria-label={t("brain.mode.simulate")}>
          <SimulateResults result={sim.result} busy={sim.busy} />
        </section>
      )}
      {mode === "evolution" && (
        <section className="brain-stagechart" aria-label={t("brain.mode.evolution")}>
          <EvolutionStage evolution={analysis?.evolution ?? null} selected={evoKey} />
        </section>
      )}

      {!recede && (
        <div className="brain-tools">
          <button
            type="button"
            className="brain-tool"
            aria-label={t("brain.zoomIn")}
            onClick={() => sceneRef.current?.zoomIn()}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="brain-tool"
            aria-label={t("brain.zoomOut")}
            onClick={() => sceneRef.current?.zoomOut()}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="brain-tool"
            aria-label={t("brain.fit")}
            onClick={() => sceneRef.current?.fit()}
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
      )}

      {!recede && (
        <p className="brain-status tv-num" role="status">
          {status}
          {trail.length > 1 && (
            <>
              {" · "}
              {trail.slice(-3).map((id, i) => {
                const n = graph.nodes.get(id);
                return n ? (
                  <button
                    key={id}
                    type="button"
                    className="brain-crumb inline"
                    onClick={() => activate(id)}
                  >
                    {i ? "› " : ""}
                    {labelOf(n)}
                  </button>
                ) : null;
              })}
            </>
          )}
        </p>
      )}

      {mode === "explore" && months.length > 1 && (
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

      {isolate && mode === "explore" && (
        <Badge variant="accent" className="absolute left-1/2 top-[4.75rem] -translate-x-1/2">
          {t(DIMENSIONS.find((d) => d.id === isolate)!.label)}
        </Badge>
      )}
    </div>
  );
}
