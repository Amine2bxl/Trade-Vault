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
import { intlLocale } from "../i18n/locale";
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

const PAGE_SIZE = 50;
const FILTERS_STORAGE_KEY = "tv.journal.filters";

/* LES NOMS DE JOURS VIENNENT D'`Intl`, PAS D'UNE LISTE.
   Ils étaient écrits en français en dur — « Dim, Lun, Mar… » — dans une
   application traduite en douze langues. `Intl` les donne dans la langue de
   l'utilisateur, et l'index 0 y désigne bien le dimanche, comme
   `Date.getDay()`. La semaine de référence part du dimanche 2023-01-01. */
function dayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
}

interface StoredFilters {
  strategyFilter: string;
  resultFilter: ResultFilter;
  sortKey: SortKey;
  sortDir: SortDir;
  dayFilter: string;
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
  const { t, lang } = useT();
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
        } satisfies StoredFilters),
      );
    } catch {
      /* best-effort persistence */
    }
  }, [strategyFilter, resultFilter, sortKey, sortDir, dayFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [strategyFilter, resultFilter, dayFilter]);

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
  const jours = useMemo(() => dayNames(intlLocale(lang)), [lang]);

  /* Le compteur du bouton « Filtres » ne compte QUE ce qui est dans la
     feuille. La recherche et le segment Résultat restent visibles à l'écran :
     les compter donnerait un badge qui s'allume pour un filtre qu'on a sous
     les yeux. */
  const sheetFilterCount =
    (periodFilter !== "all" ? 1 : 0) +
    (strategyFilter !== "all" ? 1 : 0) +
    (dayFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setPeriodFilter("all");
    setStrategyFilter("all");
    setDayFilter("all");
  };

  const activeFilterCount =
    (periodFilter !== "all" ? 1 : 0) +
    (strategyFilter !== "all" ? 1 : 0) +
    (dayFilter !== "all" ? 1 : 0) +
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
        {/* Il vivait au milieu de la RANGÉE DE FILTRES, en vert plein : une
            navigation posée entre deux listes déroulantes. Sa place est ici,
            avec les autres actions de la page — en `subtle`, parce que la
            barre porte déjà un vert (« ajouter un trade ») et que deux verts
            se disputent. */}
        <Button variant="subtle" size="sm" onClick={onOpenMissed} title={t("missed.title")}>
          <Target className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t("missed.title")}</span>
        </Button>
        <Button variant="accent" size="sm" onClick={onAdd} className="hidden md:inline-flex">
          <Plus className="w-4 h-4" /> {t("common.addTrade")}
        </Button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, onDeleteAll, onAdd, onOpenMissed, t],
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

      {/* ── LA BARRE DE FILTRES — UNE SEULE RANGÉE ──
          Elle en occupait DEUX sur bureau, et la seconde portait, en plus de
          deux listes, le bouton vert « setups manqués » : une NAVIGATION posée
          au milieu de filtres, du vert au centre de l'écran là où le vert doit
          rester l'action principale. Ce bouton est remonté dans la barre de
          tête, avec les autres actions de la page.

          Ce qui a sauté : le filtre de DURÉE. Ses cinq intitulés étaient écrits
          en français en dur (« Toute durée », « 30 min – 1h »…) dans une
          application traduite en douze langues, il ne fonctionnait que sur les
          trades ayant une heure d'entrée ET de sortie, et il répondait à une
          question que personne ne pose en ouvrant son journal.

          Ce qui a changé : les listes portent leur NOM. Deux pastilles marquées
          « All » côte à côte ne disent pas ce qu'elles filtrent — il fallait
          les ouvrir pour savoir laquelle était la période et laquelle la
          stratégie.

          La bascule passe de `md` à `lg` : sur une tablette, le rail laisse
          570px de contenu, où cinq contrôles ne tiennent pas sur une ligne. En
          dessous, la feuille de filtres prend le relais. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5 md:mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("journal.searchPlaceholder")}
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-[var(--tv-border-accent)] lg:h-9 lg:w-44 lg:flex-none"
        />
        {/* Le bouton n'existe que sous `lg` — au-dessus les listes sont
            directement là, il n'aurait rien à ouvrir. */}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog"
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 text-sm font-semibold text-slate-300 transition-colors active:bg-white/[0.07] lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("common.filters")}
          {sheetFilterCount > 0 && (
            <span className="tv-figure tv-accent-fill grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px]">
              {sheetFilterCount}
            </span>
          )}
        </button>

        <FiltrePill
          label={t("common.period")}
          value={periodFilter}
          onChange={setPeriodFilter}
          options={[
            { v: "all", l: t("common.all") },
            { v: "7d", l: t("common.7d") },
            { v: "30d", l: t("common.30d") },
            { v: "90d", l: t("common.90d") },
            { v: "1y", l: t("common.1y") },
          ]}
        />
        <FiltrePill
          label={t("journal.colStrategy")}
          value={strategyFilter}
          onChange={setStrategyFilter}
          options={[{ v: "all", l: t("common.all") }, ...STRATEGIES.map((x) => ({ v: x, l: x }))]}
        />
        <FiltrePill
          label={t("journal.filterDay")}
          value={dayFilter}
          onChange={setDayFilter}
          options={[
            { v: "all", l: t("common.all") },
            ...jours.map((n, i) => ({ v: String(i), l: n })),
          ]}
        />

        {/* Le segment RÉSULTAT — le filtre qu'on touche vraiment, et le seul
            qui porte des compteurs. */}
        <div className="flex w-full items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 lg:w-auto lg:flex-none">
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
                "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition lg:h-8 lg:flex-none lg:px-3",
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

        {/* Il n'apparaît que s'il y a quelque chose à effacer. */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setResultFilter("all");
              setSearchQuery("");
            }}
            className="hidden h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-white lg:inline-flex"
          >
            {t("common.reset")}
          </button>
        )}
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
                label: t("journal.filterDay"),
                value: dayFilter,
                set: setDayFilter,
                opts: [
                  { v: "all", l: t("common.all") },
                  ...jours.map((n, i) => ({ v: String(i), l: n })),
                ],
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
      /* `h-8` : la cellule éditable était haute de 20px — la hauteur de son
         texte. Ce n'est pas une cible tactile, et il y en a une par ligne,
         donc deux cents sur un journal ordinaire. Le texte garde sa taille,
         c'est la zone qui s'ouvre, et le `-mx-1 -my-1` empêche la colonne de
         s'élargir pour autant. */
      className={cn(
        className,
        "-mx-1 -my-1 inline-flex h-8 items-center rounded-md px-1 text-left transition-colors",
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

/**
 * UNE PASTILLE DE FILTRE — son NOM, puis sa valeur.
 *
 * Les listes portaient « All » et rien d'autre : deux pastilles identiques
 * côte à côte, et il fallait les ouvrir pour savoir laquelle était la période
 * et laquelle la stratégie. Le nom est écrit devant, en petit ; la valeur suit,
 * en clair. Le `<select>` reste natif (donc accessible et utilisable au
 * clavier) mais transparent, posé par-dessus la pastille.
 */
function FiltrePill({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  const actif = value !== "all";
  const courant = options.find((o) => o.v === value)?.l ?? value;
  return (
    <label
      className={cn(
        "relative hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 transition-colors lg:inline-flex",
        actif
          ? "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.08)]"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]",
      )}
    >
      <span className="tv-label shrink-0 text-slate-500">{label}</span>
      <span
        className={cn(
          "max-w-[7rem] truncate text-xs font-semibold",
          actif ? "text-[var(--tv-highlight)]" : "text-slate-300",
        )}
      >
        {courant}
      </span>
      <ChevronDown className="h-3 w-3 shrink-0 text-slate-600" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
