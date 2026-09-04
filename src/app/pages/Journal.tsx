import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  ArrowUpDown,
  Pencil,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  Target,
  SlidersHorizontal,
} from "lucide-react";
import { Trade, isBreakEven, STRATEGIES } from "../types";
import {
  computeStats,
  formatPct,
  formatPnl,
  formatShortDate,
  directionLabel,
  directionBadgeClass,
} from "../utils/tradeCalcs";
import { exportTradesCSV } from "../utils/exportCsv";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useTradeFilter } from "../hooks/useTradeFilter";
import TradeDetailModal from "../components/TradeDetailModal";
import { PageContainer, Button, EmptyState, Card, Modal } from "@/shared/ui";
import { usePageActions } from "../contexts/PageActionsContext";

interface JournalProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  /** Édition en place du R multiple ou du risque, sans ouvrir le formulaire. */
  onQuickEdit?: (id: string, patch: Partial<Pick<Trade, "riskAmount" | "rMultiple">>) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onAdd: () => void;
  onOpenMissed: () => void;
}
const SELECT_PILL =
  "appearance-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-slate-400 outline-none transition-colors hover:text-slate-200 md:text-sm";

type SortKey = "date" | "symbol" | "pnl" | "strategy" | "rMultiple";
type SortDir = "asc" | "desc";
type ResultFilter = "all" | "win" | "loss" | "be";
type DurationFilter = "all" | "lt30" | "30to60" | "1to4" | "gt4";

const PAGE_SIZE = 50;
const FILTERS_STORAGE_KEY = "tv.journal.filters";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const DURATION_OPTIONS: { value: DurationFilter; label: string }[] = [
  { value: "all", label: "Toute durée" },
  { value: "lt30", label: "< 30 min" },
  { value: "30to60", label: "30 min – 1h" },
  { value: "1to4", label: "1h – 4h" },
  { value: "gt4", label: "> 4h" },
];

function tradeDurationMinutes(t: Trade): number | null {
  if (!t.entryTime || !t.exitTime) return null;
  const [eh, em] = t.entryTime.split(":").map(Number);
  const [xh, xm] = t.exitTime.split(":").map(Number);
  let diffMin = xh * 60 + xm - (eh * 60 + em);
  if (diffMin < 0) diffMin += 24 * 60;
  return diffMin;
}

interface StoredFilters {
  strategyFilter: string;
  resultFilter: ResultFilter;
  sortKey: SortKey;
  sortDir: SortDir;
  dayFilter: string;
  durationFilter: DurationFilter;
}

function loadStoredFilters(): Partial<StoredFilters> {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function Journal({
  trades,
  onEdit,
  onQuickEdit,
  onDelete,
  onDeleteAll,
  onAdd,
  onOpenMissed,
}: JournalProps) {
  const { t } = useT();
  const stored = useMemo(loadStoredFilters, []);
  // Deep-link : le filtre unifié (`?f=`) s'applique AVANT les filtres locaux.
  const {
    filtered: deepLinked,
    filter: deepFilter,
    setFilter: setDeepFilter,
  } = useTradeFilter(trades);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState(stored.strategyFilter ?? "all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>(stored.resultFilter ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(stored.sortKey ?? "date");
  const [sortDir, setSortDir] = useState<SortDir>(stored.sortDir ?? "desc");
  const [dayFilter, setDayFilter] = useState<string>(stored.dayFilter ?? "all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>(
    stored.durationFilter ?? "all",
  );
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          strategyFilter,
          resultFilter,
          sortKey,
          sortDir,
          dayFilter,
          durationFilter,
        } satisfies StoredFilters),
      );
    } catch {
      /* best-effort persistence */
    }
  }, [strategyFilter, resultFilter, sortKey, sortDir, dayFilter, durationFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [strategyFilter, resultFilter, dayFilter, durationFilter]);

  const filtered = useMemo(() => {
    let list = [...deepLinked];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.strategy.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q),
      );
    }

    if (periodFilter !== "all") {
      const cutoff = new Date();
      if (periodFilter === "7d") cutoff.setDate(cutoff.getDate() - 7);
      else if (periodFilter === "30d") cutoff.setDate(cutoff.getDate() - 30);
      else if (periodFilter === "90d") cutoff.setDate(cutoff.getDate() - 90);
      else if (periodFilter === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
      list = list.filter((t) => new Date(t.date) >= cutoff);
    }

    if (strategyFilter !== "all") list = list.filter((t) => t.strategy === strategyFilter);

    if (dayFilter !== "all") {
      list = list.filter((t) => new Date(t.date).getDay().toString() === dayFilter);
    }

    if (durationFilter !== "all") {
      list = list.filter((t) => {
        const mins = tradeDurationMinutes(t);
        if (mins === null) return false;
        switch (durationFilter) {
          case "lt30":
            return mins < 30;
          case "30to60":
            return mins >= 30 && mins <= 60;
          case "1to4":
            return mins > 60 && mins <= 240;
          case "gt4":
            return mins > 240;
          default:
            return true;
        }
      });
    }

    if (resultFilter === "win") list = list.filter((t) => !isBreakEven(t) && t.pnl > 0);
    if (resultFilter === "loss") list = list.filter((t) => !isBreakEven(t) && t.pnl < 0);
    if (resultFilter === "be") list = list.filter((t) => isBreakEven(t));

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "pnl") cmp = a.pnl - b.pnl;
      else if (sortKey === "strategy") cmp = a.strategy.localeCompare(b.strategy);
      else if (sortKey === "rMultiple") cmp = a.rMultiple - b.rMultiple;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [
    trades,
    deepLinked,
    searchQuery,
    periodFilter,
    strategyFilter,
    resultFilter,
    sortKey,
    sortDir,
    dayFilter,
    durationFilter,
  ]);

  const counts = useMemo(() => {
    const base =
      strategyFilter === "all" ? trades : trades.filter((t) => t.strategy === strategyFilter);
    return {
      all: base.length,
      win: base.filter((t) => !isBreakEven(t) && t.pnl > 0).length,
      loss: base.filter((t) => !isBreakEven(t) && t.pnl < 0).length,
      be: base.filter(isBreakEven).length,
    } as Record<ResultFilter, number>;
  }, [trades, strategyFilter]);

  const summary = useMemo(() => computeStats(filtered), [filtered]);

  const shown = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;
  const viewing = viewingIdx !== null ? (filtered[viewingIdx] ?? null) : null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-700" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-cyan-400" />
    );
  };

  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Le compteur du bouton « Filtres » ne compte QUE ce qui est dans la
     feuille. La recherche et le segment Résultat restent visibles à l'écran :
     les compter donnerait un badge qui s'allume pour un filtre qu'on a sous
     les yeux. */
  const sheetFilterCount =
    (periodFilter !== "all" ? 1 : 0) +
    (strategyFilter !== "all" ? 1 : 0) +
    (dayFilter !== "all" ? 1 : 0) +
    (durationFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setPeriodFilter("all");
    setStrategyFilter("all");
    setDayFilter("all");
    setDurationFilter("all");
  };

  const activeFilterCount =
    (periodFilter !== "all" ? 1 : 0) +
    (strategyFilter !== "all" ? 1 : 0) +
    (dayFilter !== "all" ? 1 : 0) +
    (durationFilter !== "all" ? 1 : 0) +
    (resultFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // La rangée d'onglets « List / Calendar / Missed » vivait ICI, en état
  // local : elle rendait `CalendarPage` et `MissedOpportunities` sans changer
  // l'URL, alors que ces deux écrans ONT une URL. Deux chemins pour un même
  // écran, dont un seul mesurable et partageable. Ces onglets sont désormais
  // ceux de la section Journal (`SectionTabs`), rendus par le shell, et ce
  // sont de vrais liens.

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="subtle" size="sm" onClick={() => exportTradesCSV(trades)}>
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{t("common.exportCsv")}</span>
        </Button>
        <Button
          variant="subtle"
          size="sm"
          onClick={onDeleteAll}
          className="text-slate-400 hover:text-red-300 hover:border-red-500/25"
        >
          <Trash className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{t("common.deleteAll")}</span>
        </Button>
        <Button variant="accent" size="sm" onClick={onAdd} className="hidden md:inline-flex">
          <Plus className="w-4 h-4" /> {t("common.addTrade")}
        </Button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, onDeleteAll, onAdd, t],
  );
  usePageActions(headerActions);

  return (
    <PageContainer>
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2.5">
          <SummaryTile
            label={t("stats.totalPnl")}
            value={formatPnl(summary.totalPnl)}
            tone={summary.totalPnl >= 0 ? "up" : "down"}
          />
          <SummaryTile label={t("stats.winRate")} value={formatPct(summary.winRate)} />
          <SummaryTile label={t("dashboard.avgRR")} value={`${summary.avgRR.toFixed(2)}R`} />
          <SummaryTile
            /* « P&L » + la mention « BEST » se lisaient « P&L BEST », qui
               n'est le nom de rien. La tuile a déjà un libellé pour ça. */
            label={t("dashboard.bestTrade")}
            value={formatPnl(summary.bestTrade?.pnl ?? 0)}
            tone="up"
          />
        </div>
      )}

      {/* Deep-link filter actif — un chip qui permet de revenir à la vue complète */}
      {deepFilter.trades && deepFilter.trades.length > 0 && (
        <div className="mb-2.5 md:mb-3 flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2 text-xs">
          <span className="text-cyan-300 font-semibold">
            {deepFilter.trades.length} {t("common.trades")} · {t("journal.fromJarvis")}
          </span>
          <button
            onClick={() => setDeepFilter({})}
            className="ml-auto font-semibold text-slate-400 hover:text-white transition-colors"
          >
            {t("common.clear")} ✕
          </button>
        </div>
      )}

      {/* ── LA BARRE DE FILTRES ──
          MOBILE : une seule ligne. La recherche, et un bouton « Filtres » qui
          porte le nombre de filtres actifs. Les quatre listes (période,
          stratégie, jour, durée) et l'accès aux setups manqués partent dans une
          feuille. Elles occupaient QUATRE rangées avant la première ligne de
          données — on ouvrait son journal et on voyait des filtres.
          DESKTOP : rien ne change, la place existe. */}
      <div className="mb-2.5 flex flex-col gap-1.5 md:mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("journal.searchPlaceholder")}
            enterKeyHint="search"
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-[var(--tv-border-accent)] md:h-auto md:w-44 md:flex-none md:py-1.5 md:text-sm"
          />
          {/* Le bouton n'existe que sous md — au-dessus les listes sont
              directement là, il n'aurait rien à ouvrir. */}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 text-sm font-semibold text-slate-300 transition-colors active:bg-white/[0.07] md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("common.filters")}
            {sheetFilterCount > 0 && (
              <span className="tv-figure tv-accent-fill grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px]">
                {sheetFilterCount}
              </span>
            )}
          </button>
          <div className="hidden items-center gap-1.5 md:flex">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className={SELECT_PILL}
            >
              <option value="all">{t("common.all")}</option>
              <option value="7d">{t("common.7d")}</option>
              <option value="30d">{t("common.30d")}</option>
              <option value="90d">{t("common.90d")}</option>
              <option value="1y">{t("common.1y")}</option>
            </select>
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              className={SELECT_PILL}
            >
              <option value="all">{t("common.all")}</option>
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {/* Le segment RÉSULTAT reste visible : c'est le filtre qu'on touche
              vraiment, et il porte les compteurs. Il passe à 36px de haut —
              28 était sous le seuil du pouce. */}
          <div className="flex w-full items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 md:w-auto md:flex-none">
            {(
              [
                { v: "all", label: t("common.all") },
                { v: "win", label: t("common.win") },
                { v: "loss", label: t("common.loss") },
                { v: "be", label: t("common.be") },
              ] as { v: ResultFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setResultFilter(opt.v)}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition md:h-auto md:flex-none md:px-4 md:py-1.5 md:text-sm",
                  resultFilter === opt.v
                    ? opt.v === "win"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : opt.v === "loss"
                        ? "bg-red-500/15 text-red-400"
                        : opt.v === "be"
                          ? "bg-slate-500/20 text-slate-200"
                          : "bg-cyan-500/15 text-cyan-400"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                {opt.label}
                <span
                  className={cn(
                    "tv-figure text-[10px]",
                    resultFilter === opt.v ? "opacity-70" : "text-slate-600",
                  )}
                >
                  {counts[opt.v]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Seconde rangée : desktop uniquement. */}
        <div className="hidden flex-wrap items-center gap-1.5 md:flex">
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className={SELECT_PILL}
          >
            <option value="all">{t("journal.allDays")}</option>
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={String(i)}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value as DurationFilter)}
            className={SELECT_PILL}
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Button variant="primary" size="sm" onClick={onOpenMissed} title={t("missed.title")}>
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">{t("missed.title")}</span>
          </Button>
        </div>
      </div>

      {/* La feuille de filtres — mobile seulement. */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        wrapperClassName="z-[80] md:hidden"
        className="md:max-w-sm"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="tv-title">{t("common.filters")}</h2>
          {sheetFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[13px] font-semibold text-slate-400 active:text-white"
            >
              {t("common.reset")}
            </button>
          )}
        </div>
        <div className="space-y-3 p-4 pt-2">
          {(
            [
              {
                k: "period",
                label: t("common.period"),
                value: periodFilter,
                set: setPeriodFilter,
                opts: [
                  { v: "all", l: t("common.all") },
                  { v: "7d", l: t("common.7d") },
                  { v: "30d", l: t("common.30d") },
                  { v: "90d", l: t("common.90d") },
                  { v: "1y", l: t("common.1y") },
                ],
              },
              {
                k: "strategy",
                label: t("journal.colStrategy"),
                value: strategyFilter,
                set: setStrategyFilter,
                opts: [
                  { v: "all", l: t("common.all") },
                  ...STRATEGIES.map((x) => ({ v: x, l: x })),
                ],
              },
              {
                k: "day",
                label: t("journal.allDays"),
                value: dayFilter,
                set: setDayFilter,
                opts: [
                  { v: "all", l: t("common.all") },
                  ...DAY_NAMES.map((n, i) => ({ v: String(i), l: n })),
                ],
              },
              {
                k: "duration",
                label: t("journal.filterDuration"),
                value: durationFilter,
                set: (v: string) => setDurationFilter(v as DurationFilter),
                opts: DURATION_OPTIONS.map((o) => ({ v: o.value, l: o.label })),
              },
            ] as {
              k: string;
              label: string;
              value: string;
              set: (v: string) => void;
              opts: { v: string; l: string }[];
            }[]
          ).map((f) => (
            <label key={f.k} className="block">
              <span className="tv-label mb-1.5 block text-slate-500">{f.label}</span>
              <select
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm font-semibold text-slate-200 outline-none"
              >
                {f.opts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              setFiltersOpen(false);
              onOpenMissed();
            }}
            className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm font-semibold text-slate-200"
          >
            <Target className="h-4 w-4 text-[var(--tv-accent)]" />
            {t("missed.title")}
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="btn-primary w-full"
          >
            {t("common.done")}
          </button>
        </div>
      </Modal>

      {/* ── Mobile: Card List ── */}
      <div className="md:hidden space-y-1.5">
        {trades.length === 0 ? (
          <EmptyState
            icon={<Target className="w-7 h-7" />}
            title={t("empty.title")}
            description={t("empty.subtitle")}
            action={
              <Button variant="accent" size="sm" onClick={onAdd}>
                <Plus className="w-3.5 h-3.5" /> {t("empty.cta")}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("common.noTradesFound")}
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setResultFilter("all");
                  setStrategyFilter("all");
                  setDayFilter("all");
                  setDurationFilter("all");
                }}
              >
                {t("common.all")}
              </Button>
            }
          />
        ) : (
          shown.map((trade, i) => {
            const be = isBreakEven(trade);
            return (
              <div key={trade.id} className="glass rounded-xl overflow-hidden trade-card">
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <button
                    type="button"
                    className="flex-1 min-w-0 flex items-center gap-2.5 text-left active:opacity-70 transition-opacity"
                    onClick={() => setViewingIdx(i)}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        be
                          ? "bg-slate-500/10"
                          : trade.pnl >= 0
                            ? "bg-emerald-500/10"
                            : "bg-red-500/10",
                      )}
                    >
                      {be ? (
                        <Minus className="w-4 h-4 text-slate-300" />
                      ) : trade.pnl >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-white truncate">
                          {trade.symbol}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-bold px-1.5 py-0.5 rounded leading-none",
                            directionBadgeClass(trade.direction),
                          )}
                        >
                          {directionLabel(trade.direction)}
                        </span>
                        {trade.isExample && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded leading-none bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            {t("journal.exampleBadge")}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {trade.strategy} · {formatShortDate(trade.date)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={cn(
                          "text-[13px] font-bold leading-tight",
                          be
                            ? "text-slate-300"
                            : trade.pnl >= 0
                              ? "text-emerald-400"
                              : "text-red-400",
                        )}
                      >
                        {formatPnl(trade.pnl)}
                      </div>
                      <div
                        className={cn(
                          "text-[10px] font-semibold",
                          be
                            ? "text-slate-300/60"
                            : trade.rMultiple >= 0
                              ? "text-emerald-400/60"
                              : "text-red-400/60",
                        )}
                      >
                        {trade.rMultiple.toFixed(1)}R
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center shrink-0 -mr-1">
                    <button
                      onClick={() => onEdit(trade)}
                      aria-label={t("common.edit")}
                      className="w-11 h-11 -my-2 rounded-lg flex items-center justify-center text-slate-500 active:bg-cyan-500/10 active:text-cyan-400 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(trade.id)}
                      aria-label={t("common.delete")}
                      className="w-11 h-11 -my-2 rounded-lg flex items-center justify-center text-slate-500 active:bg-red-500/10 active:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop: Table ── */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[880px]">
            <thead className="sticky top-0 z-10 bg-[var(--tv-plate-1)]/95 backdrop-blur-md">
              <tr className="border-b border-white/[0.06]">
                {(["date", "symbol", "strategy", "pnl", "rMultiple"] as SortKey[]).map((key) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="tv-label px-4 py-2 text-left text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none"
                  >
                    <span className="flex items-center gap-1.5">
                      {key === "pnl"
                        ? t("journal.colPnl")
                        : key === "rMultiple"
                          ? t("journal.colRR")
                          : key === "date"
                            ? t("journal.colDate")
                            : key === "symbol"
                              ? t("journal.colSymbol")
                              : t("journal.colStrategy")}
                      <SortIcon col={key} />
                    </span>
                  </th>
                ))}
                <th className="tv-label px-4 py-2 text-left text-slate-500">{t("common.side")}</th>
                <th className="tv-label px-4 py-2 text-left text-slate-500">{t("common.risk")}</th>
                <th className="tv-label px-4 py-2 text-right text-slate-500">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center">
                    <div className="text-sm font-semibold text-white mb-1">{t("empty.title")}</div>
                    <p className="tv-prose text-slate-500 mb-3">{t("empty.subtitle")}</p>
                    <Button variant="accent" size="sm" onClick={onAdd}>
                      <Plus className="w-3.5 h-3.5" /> {t("empty.cta")}
                    </Button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-600 text-sm">
                    {t("common.noTradesFound")}
                  </td>
                </tr>
              ) : (
                shown.map((trade, i) => {
                  const be = isBreakEven(trade);
                  return (
                    <tr
                      key={trade.id}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.03]"
                      onClick={() => setViewingIdx(i)}
                    >
                      <td className="px-4 py-1.5 text-sm text-slate-300">
                        {formatShortDate(trade.date)}
                      </td>
                      <td className="px-4 py-1.5">
                        <span className="text-sm font-bold text-white">{trade.symbol}</span>
                        {trade.isExample && (
                          <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 align-middle">
                            {t("journal.exampleBadge")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-sm text-slate-400">{trade.strategy}</td>
                      <td className="px-4 py-1.5">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            be
                              ? "text-slate-300"
                              : trade.pnl >= 0
                                ? "text-emerald-400"
                                : "text-red-400",
                          )}
                        >
                          {formatPnl(trade.pnl)}
                        </span>
                      </td>
                      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <QuickEditCell
                          value={trade.rMultiple}
                          suffix="R"
                          decimals={2}
                          disabled={be || !onQuickEdit}
                          onCommit={(v) => onQuickEdit?.(trade.id, { rMultiple: v })}
                          title={t("journal.quickEditR")}
                          className={cn(
                            "text-sm font-bold",
                            be
                              ? "text-slate-300"
                              : trade.rMultiple >= 0
                                ? "text-emerald-400"
                                : "text-red-400",
                          )}
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-lg",
                            directionBadgeClass(trade.direction),
                          )}
                        >
                          {directionLabel(trade.direction)}
                        </span>
                      </td>
                      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <QuickEditCell
                          value={trade.riskAmount}
                          prefix="$"
                          decimals={0}
                          min={0}
                          disabled={!onQuickEdit}
                          onCommit={(v) => onQuickEdit?.(trade.id, { riskAmount: v })}
                          title={t("journal.quickEditRisk")}
                          className="tv-figure text-sm text-slate-300"
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        <div
                          className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setViewingIdx(i)}
                            aria-label={t("missed.preview")}
                            title={t("missed.preview")}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEdit(trade)}
                            aria-label={t("common.edit")}
                            title={t("common.edit")}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(trade.id)}
                            aria-label={t("common.delete")}
                            title={t("common.delete")}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-300 transition"
          >
            {t("journal.loadMore")} ({filtered.length - visibleCount})
          </button>
        </div>
      )}

      {viewing && viewingIdx !== null && (
        <TradeDetailModal
          trades={[viewing]}
          date={viewing.date}
          onClose={() => setViewingIdx(null)}
          onDelete={(id) => {
            onDelete(id);
            setViewingIdx(null);
          }}
          onNavigate={(dir) => {
            const next = viewingIdx + dir;
            if (next < 0 || next >= filtered.length) return;
            if (next >= visibleCount) setVisibleCount((c) => c + PAGE_SIZE);
            setViewingIdx(next);
          }}
          hasPrev={viewingIdx > 0}
          hasNext={viewingIdx < filtered.length - 1}
          positionLabel={`${viewingIdx + 1}/${filtered.length}`}
        />
      )}
    </PageContainer>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="stat-card px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="tv-label text-slate-500 truncate">{label}</span>
        {hint && <span className="tv-label text-slate-600 shrink-0">{hint}</span>}
      </div>
      <div
        className={cn(
          "mt-1 tv-figure text-base md:text-lg",
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Cellule éditable en place — un clic, on tape, Entrée valide.
 *
 * POURQUOI PAS LA MODALE. Corriger un R mal saisi ou un risque arrondi est le
 * geste de correction le plus fréquent du journal. L'ouvrir dans le formulaire
 * complet coûte cinq clics et fait perdre le contexte de la ligne. Ici, la
 * valeur est modifiée là où elle est lue.
 *
 * `Échap` annule, la perte de focus valide (personne ne s'attend à perdre sa
 * saisie en cliquant ailleurs), et une valeur inchangée ou illisible n'écrit
 * rien — une écriture inutile ferait clignoter toutes les statistiques.
 */
function QuickEditCell({
  value,
  onCommit,
  className,
  title,
  prefix = "",
  suffix = "",
  decimals = 2,
  min,
  disabled = false,
}: {
  value: number;
  onCommit: (next: number) => void;
  className?: string;
  title?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  min?: number;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    setEditing(false);
    const next = parseFloat(draft.replace(",", "."));
    if (!Number.isFinite(next)) return;
    if (min !== undefined && next < min) return;
    if (Math.abs(next - value) < 1e-9) return;
    onCommit(next);
  };

  if (disabled) {
    return (
      <span className={className}>
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={cn(
          "w-20 bg-white/[0.06] border border-cyan-500/50 rounded-md px-1.5 py-0.5",
          "tv-figure text-sm text-white focus:outline-none",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className={cn(
        className,
        "rounded-md px-1 -mx-1 text-left transition-colors",
        "hover:bg-white/[0.08] hover:ring-1 hover:ring-cyan-500/30",
        "focus:outline-none focus:ring-1 focus:ring-cyan-500/60",
      )}
    >
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </button>
  );
}
