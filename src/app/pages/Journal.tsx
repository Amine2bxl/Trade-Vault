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
import { Trade, isBreakEven } from "../types";
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
import { useAvailableHeight } from "../hooks/useAvailableHeight";
import TradeDetailModal from "../components/TradeDetailModal";
import {
  PageContainer,
  Button,
  EmptyState,
  Card,
  Modal,
  Kpi,
  KpiGrid,
  SelectPicker,
  MultiPicker,
  RangePicker,
  rangeBounds,
  type RangeValue,
} from "@/shared/ui";
import { usePageActions } from "../contexts/PageActionsContext";
import { compareChronological } from "../utils/tradeOrder";
import { currencySymbol } from "@/shared/currency";

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
type PeriodPreset = "all" | "7d" | "30d" | "90d" | "1y";
const PERIOD_DAYS: Record<PeriodPreset, number | null> = {
  all: null,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};
/** Le tri, en une seule liste lisible (le tableau garde ses en-têtes cliquables). */
type SortChoice =
  | "date-desc"
  | "date-asc"
  | "pnl-desc"
  | "pnl-asc"
  | "rMultiple-desc"
  | "symbol-asc";

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
  /** Setups retenus — vide : tous. (Anciennement une chaîne unique.) */
  strategies: string[];
  resultFilter: ResultFilter;
  sortKey: SortKey;
  sortDir: SortDir;
  /** Jours retenus (0 = dimanche, comme `getDay()`) — vide : tous. */
  days: string[];
}

/** Lit les filtres enregistrés, y compris l'ancien format à valeur unique. */
function migrateStored(raw: Record<string, unknown>): Partial<StoredFilters> {
  const arr = (v: unknown, legacy: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : typeof legacy === "string" && legacy !== "all"
        ? [legacy]
        : [];
  return {
    strategies: arr(raw.strategies, raw.strategyFilter),
    days: arr(raw.days, raw.dayFilter),
    resultFilter: raw.resultFilter as ResultFilter | undefined,
    sortKey: raw.sortKey as SortKey | undefined,
    sortDir: raw.sortDir as SortDir | undefined,
  };
}

function loadStoredFilters(): Partial<StoredFilters> {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? migrateStored(JSON.parse(raw)) : {};
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
  const [period, setPeriod] = useState<RangeValue<PeriodPreset>>({ kind: "preset", preset: "all" });
  const [strategies, setStrategies] = useState<string[]>(stored.strategies ?? []);
  const [resultFilter, setResultFilter] = useState<ResultFilter>(stored.resultFilter ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(stored.sortKey ?? "date");
  const [sortDir, setSortDir] = useState<SortDir>(stored.sortDir ?? "desc");
  const [days, setDays] = useState<string[]>(stored.days ?? []);
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          strategies,
          resultFilter,
          sortKey,
          sortDir,
          days,
        } satisfies StoredFilters),
      );
    } catch {
      /* best-effort persistence */
    }
  }, [strategies, resultFilter, sortKey, sortDir, days]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [strategies, resultFilter, days, period]);

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

    // Bornes CIVILES comparées en chaînes : `new Date("YYYY-MM-DD")` est minuit
    // UTC, la veille à New York — la période perdait ou gagnait un jour.
    const bounds = rangeBounds(period, PERIOD_DAYS);
    if (bounds) list = list.filter((t) => t.date >= bounds.from && t.date <= bounds.to);

    if (strategies.length > 0) list = list.filter((t) => strategies.includes(t.strategy));

    if (days.length > 0) {
      // Midi local : `new Date("YYYY-MM-DD")` est minuit UTC, donc la veille à New York.
      list = list.filter((t) => days.includes(String(new Date(`${t.date}T12:00:00`).getDay())));
    }

    if (resultFilter === "win") list = list.filter((t) => !isBreakEven(t) && t.pnl > 0);
    if (resultFilter === "loss") list = list.filter((t) => !isBreakEven(t) && t.pnl < 0);
    if (resultFilter === "be") list = list.filter((t) => isBreakEven(t));

    list.sort((a, b) => {
      let cmp = 0;
      // Date PUIS heure d'entrée : le plus récent en haut, jusque dans la journée.
      if (sortKey === "date") cmp = compareChronological(a, b);
      else if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "pnl") cmp = a.pnl - b.pnl;
      else if (sortKey === "strategy") cmp = a.strategy.localeCompare(b.strategy);
      else if (sortKey === "rMultiple") cmp = a.rMultiple - b.rMultiple;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [trades, deepLinked, searchQuery, period, strategies, resultFilter, sortKey, sortDir, days]);

  const counts = useMemo(() => {
    const base =
      strategies.length === 0 ? trades : trades.filter((t) => strategies.includes(t.strategy));
    return {
      all: base.length,
      win: base.filter((t) => !isBreakEven(t) && t.pnl > 0).length,
      loss: base.filter((t) => !isBreakEven(t) && t.pnl < 0).length,
      be: base.filter(isBreakEven).length,
    } as Record<ResultFilter, number>;
  }, [trades, strategies]);

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
  const periodActive = period.kind === "custom" || period.preset !== "all";
  const sheetFilterCount =
    (periodActive ? 1 : 0) + (strategies.length > 0 ? 1 : 0) + (days.length > 0 ? 1 : 0);

  const resetFilters = () => {
    setPeriod({ kind: "preset", preset: "all" });
    setStrategies([]);
    setDays([]);
  };

  const activeFilterCount =
    sheetFilterCount + (resultFilter !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  /* LES SETUPS PROPOSÉS — CEUX QU'IL A TRADÉS, LES PLUS FRÉQUENTS D'ABORD.
     La liste mêlait les presets du produit à ses setups : une quinzaine de
     choix dont la plupart ne filtraient RIEN (zéro trade), et c'est elle qui
     faisait défiler la feuille de filtres. Un filtre qui rend une liste vide
     n'est pas un choix. Un setup déjà sélectionné reste proposé même s'il
     n'a plus de trade, pour pouvoir le désélectionner. */
  const strategyOptions = useMemo(() => {
    const count = new Map<string, number>();
    for (const tr of trades) {
      if (tr.strategy) count.set(tr.strategy, (count.get(tr.strategy) ?? 0) + 1);
    }
    for (const s of strategies) if (!count.has(s)) count.set(s, 0);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([n, c]) => ({ value: n, label: n, count: c }));
  }, [trades, strategies]);
  /* Lundi d'abord : c'est l'ordre d'une semaine de trading. Le samedi et le
     dimanche n'apparaissent que si le journal en contient — sinon ce sont
     deux filtres qui ne peuvent rien rendre. */
  const dayOptions = useMemo(() => {
    const traded = new Set(trades.map((tr) => new Date(`${tr.date}T12:00:00`).getDay()));
    return [1, 2, 3, 4, 5, 6, 0]
      .filter((i) => (i >= 1 && i <= 5 ? true : traded.has(i) || days.includes(String(i))))
      .map((i) => ({ value: String(i), label: jours[i] }));
  }, [jours, trades, days]);
  /* Sur téléphone, six setups d'abord ; les autres derrière « +N ». */
  const [allSetups, setAllSetups] = useState(false);
  const SETUPS_FIRST = 6;
  const setupChips =
    allSetups || strategyOptions.length <= SETUPS_FIRST + 1
      ? strategyOptions
      : strategyOptions.slice(0, SETUPS_FIRST);
  const toggleSetup = (v: string) =>
    setStrategies(strategies.includes(v) ? strategies.filter((x) => x !== v) : [...strategies, v]);
  const periodPresets: { value: PeriodPreset; label: string }[] = [
    { value: "all", label: t("common.all") },
    { value: "7d", label: t("common.7d") },
    { value: "30d", label: t("common.30d") },
    { value: "90d", label: t("common.90d") },
    { value: "1y", label: t("common.1y") },
  ];
  const pickerText = {
    allLabel: t("common.all"),
    clearLabel: t("common.clear"),
    doneLabel: t("common.done"),
    countLabel: t("picker.nSelected"),
    searchLabel: t("picker.search"),
  };
  const rangeText = {
    customLabel: t("picker.custom"),
    fromLabel: t("picker.from"),
    toLabel: t("picker.to"),
    applyLabel: t("picker.apply"),
    todayLabel: t("calendar.today"),
    locale: intlLocale(lang),
  };
  const sortChoice = `${sortKey}-${sortDir}` as SortChoice;
  const sortOptions: { value: SortChoice; label: string }[] = [
    { value: "date-desc", label: t("sort.newest") },
    { value: "date-asc", label: t("sort.oldest") },
    { value: "pnl-desc", label: t("sort.bestPnl") },
    { value: "pnl-asc", label: t("sort.worstPnl") },
    { value: "rMultiple-desc", label: t("sort.highestR") },
    { value: "symbol-asc", label: t("sort.symbol") },
  ];
  const pickSort = (v: SortChoice) => {
    const [k, d] = v.split("-") as [SortKey, SortDir];
    setSortKey(k);
    setSortDir(d);
  };

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

  /* LA PAGE NE DÉFILE PAS, LE BLOC DES TRADES SI.
     Parcourir deux cents trades faisait défiler toute la page : les KPI et la
     barre de filtres partaient avec, et il fallait remonter pour changer un
     filtre. La page prend la hauteur réellement disponible (mesurée, comme le
     calendrier) ; le bloc des trades en occupe le reste et défile seul. En
     approchant du bas, la page suivante de trades se charge d'elle-même. */
  const { boxRef, height } = useAvailableHeight();
  const onListScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 240)
      setVisibleCount((c) => c + PAGE_SIZE);
  };
  const loadMore = hasMore && (
    <div className="py-3 text-center">
      <button
        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
      >
        {t("journal.loadMore")} ({filtered.length - visibleCount})
      </button>
    </div>
  );

  return (
    <PageContainer>
      <div ref={boxRef} style={height ? { height } : undefined} className="flex min-h-0 flex-col">
        {/* Quatre cases statiques : un libellé, un chiffre, aucune interaction.
          C'est `Kpi`, la case du produit — pas une tuile de carte réécrite
          ici. Elles suivent donc la compaction de toutes les autres. */}
        {filtered.length > 0 && (
          <KpiGrid cols={4} className="mb-2.5 shrink-0">
            <Kpi
              label={t("stats.totalPnl")}
              value={formatPnl(summary.totalPnl)}
              tone={summary.totalPnl >= 0 ? "pos" : "neg"}
            />
            <Kpi label={t("stats.winRate")} value={formatPct(summary.winRate)} />
            <Kpi label={t("dashboard.avgRR")} value={`${summary.avgRR.toFixed(2)}R`} />
            <Kpi
              /* « P&L » + la mention « BEST » se lisaient « P&L BEST », qui
               n'est le nom de rien. La tuile a déjà un libellé pour ça. */
              label={t("dashboard.bestTrade")}
              value={formatPnl(summary.bestTrade?.pnl ?? 0)}
              tone="pos"
            />
          </KpiGrid>
        )}

        {/* Deep-link filter actif — un chip qui permet de revenir à la vue complète */}
        {deepFilter.trades && deepFilter.trades.length > 0 && (
          <div className="mb-2.5 md:mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2 text-xs">
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
        <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-1.5 md:mb-3">
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

          <div className="hidden items-center gap-1.5 lg:flex">
            <RangePicker
              label={t("common.period")}
              value={period}
              presets={periodPresets}
              onChange={setPeriod}
              neutralPreset="all"
              {...rangeText}
            />
            <MultiPicker
              label={t("journal.colStrategy")}
              values={strategies}
              options={strategyOptions}
              onChange={setStrategies}
              {...pickerText}
            />
            <MultiPicker
              label={t("journal.filterDay")}
              values={days}
              options={dayOptions}
              onChange={setDays}
              {...pickerText}
            />
            <SelectPicker
              label={t("sort.label")}
              value={sortChoice}
              options={sortOptions}
              onChange={pickSort}
              neutralValue="date-desc"
            />
          </div>

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

        {/* LA FEUILLE DE FILTRES — sous `lg`, là où la barre ne tient pas.
            Elle était montée sous `md` seulement alors que son bouton existe
            jusqu'à `lg` : sur une tablette, « Filtres » n'ouvrait rien.

            TOUT TIENT SANS DÉFILER, même sur un iPhone SE. Ce qui la faisait
            défiler : une quinzaine de setups (presets compris, la plupart sans
            un seul trade), sept jours dont deux jamais tradés, six pastilles de
            tri et un lien de navigation (« setups manqués », déjà dans la
            barre de tête). Restent les setups tradés — six d'abord —, les
            jours ouvrés, et le tri en une liste compacte dans le pied. */}
        <Modal
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          wrapperClassName="z-[var(--tv-z-modal)] lg:hidden"
          className="md:max-w-md"
        >
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
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
          <div className="space-y-3.5 px-4 pb-2 pt-1">
            <RangePicker
              inline
              label={t("common.period")}
              value={period}
              presets={periodPresets}
              onChange={setPeriod}
              neutralPreset="all"
              className="[&>div]:p-0"
              {...rangeText}
            />
            {strategyOptions.length > 0 && (
              <div className="tv-pick-inline">
                <span className="tv-label mb-1.5 block text-slate-500">
                  {t("journal.colStrategy")}
                </span>
                <div className="tv-pick-chips">
                  <button
                    type="button"
                    aria-pressed={strategies.length === 0}
                    onClick={() => setStrategies([])}
                    className={cn("tv-pick-chip", strategies.length === 0 && "tv-pick-chip-on")}
                  >
                    {t("common.all")}
                  </button>
                  {setupChips.map((o) => {
                    const on = strategies.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleSetup(o.value)}
                        className={cn("tv-pick-chip max-w-full", on && "tv-pick-chip-on")}
                      >
                        <span className="truncate">{o.label}</span>
                        <span className="tv-figure opacity-60">{o.count}</span>
                      </button>
                    );
                  })}
                  {setupChips.length < strategyOptions.length && (
                    <button
                      type="button"
                      onClick={() => setAllSetups(true)}
                      className="tv-pick-chip border-dashed"
                    >
                      +{strategyOptions.length - setupChips.length}
                    </button>
                  )}
                </div>
              </div>
            )}
            <MultiPicker
              inline
              label={t("journal.filterDay")}
              values={days}
              options={dayOptions}
              onChange={setDays}
              {...pickerText}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-[var(--tv-border)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <SelectPicker
                label={t("sort.label")}
                value={sortChoice}
                options={sortOptions}
                onChange={pickSort}
                neutralValue="date-desc"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="btn-primary shrink-0 px-5"
            >
              {t("common.done")}
            </button>
          </div>
        </Modal>

        {/* ── Mobile: Card List ── */}
        <div
          onScroll={onListScroll}
          className="journal-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain md:hidden"
        >
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
                    resetFilters();
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
          {loadMore}
        </div>

        {/* ── Desktop: Table ── */}
        <Card className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
          <div
            onScroll={onListScroll}
            className="journal-scroll min-h-0 flex-1 overflow-auto overscroll-contain"
          >
            <table className="w-full min-w-[880px]">
              <thead className="sticky top-0 z-10 bg-[var(--tv-plate-1)]">
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
                  <th className="tv-label px-4 py-2 text-left text-slate-500">
                    {t("common.side")}
                  </th>
                  <th className="tv-label px-4 py-2 text-left text-slate-500">
                    {t("common.risk")}
                  </th>
                  <th className="tv-label px-4 py-2 text-right text-slate-500">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center">
                      <div className="text-sm font-semibold text-white mb-1">
                        {t("empty.title")}
                      </div>
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
                            prefix={currencySymbol()}
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
            {loadMore}
          </div>
        </Card>
      </div>

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
