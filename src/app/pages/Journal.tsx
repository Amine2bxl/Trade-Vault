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
  BookOpen,
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
import TradeDetailModal from "../components/TradeDetailModal";
import { PageHeader, PageContainer, Button, EmptyState, Card } from "@/shared/ui";

interface JournalProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onAdd: () => void;
  onOpenMissed: () => void;
}
type SortKey = "date" | "symbol" | "pnl" | "strategy" | "rMultiple";
type SortDir = "asc" | "desc";
type ResultFilter = "all" | "win" | "loss" | "be";

const PAGE_SIZE = 50;
const FILTERS_STORAGE_KEY = "tv.journal.filters";

interface StoredFilters {
  strategyFilter: string;
  resultFilter: ResultFilter;
  sortKey: SortKey;
  sortDir: SortDir;
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
  onDelete,
  onDeleteAll,
  onAdd,
  onOpenMissed,
}: JournalProps) {
  const { t } = useT();
  const stored = useMemo(loadStoredFilters, []);
  // strategyFilter is applied from persisted filters; there is no live control
  // for it (the setter was dropped with the old strategy dropdown), so it stays
  // at whatever was last stored — hence no setter here.
  const [strategyFilter] = useState(stored.strategyFilter ?? "all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>(stored.resultFilter ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(stored.sortKey ?? "date");
  const [sortDir, setSortDir] = useState<SortDir>(stored.sortDir ?? "desc");
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filters survive reloads.
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ strategyFilter, resultFilter, sortKey, sortDir } satisfies StoredFilters),
      );
    } catch {
      /* best-effort persistence — ignore */
    }
  }, [strategyFilter, resultFilter, sortKey, sortDir]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [strategyFilter, resultFilter]);

  const filtered = useMemo(() => {
    let list = [...trades];
    if (strategyFilter !== "all") list = list.filter((t) => t.strategy === strategyFilter);
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
  }, [trades, strategyFilter, resultFilter, sortKey, sortDir]);

  // Counts per result filter — shown inside the pills so the trader sees the
  // shape of their journal before clicking, not after.
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

  // The journal's headline numbers, recomputed on the CURRENT selection. Making
  // the summary follow the filter is what turns the list into an analysis tool:
  // "show me my losses" instantly answers "what do they cost me".
  const summary = useMemo(() => computeStats(filtered), [filtered]);

  // Render at most `visibleCount` rows — keeps the DOM light on big journals
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

  return (
    <PageContainer>
      <PageHeader
        className="mb-3 md:mb-4 items-center stagger-0"
        title={t("journal.title")}
        subtitle={`${filtered.length} ${t("common.trades")}`}
        actions={
          <div className="flex items-center gap-1.5 md:gap-2 animate-fade-in-up stagger-1 shrink-0">
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
            <Button size="sm" onClick={onAdd} className="hidden md:inline-flex">
              <Plus className="w-4 h-4" /> {t("common.addTrade")}
            </Button>
          </div>
        }
      />

      {/* Summary of the CURRENT selection — the journal reads as an analysis,
          not just a list. Recomputed from the same deterministic engine. */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2.5 animate-fade-in-up stagger-1">
          <SummaryTile
            label={t("stats.totalPnl")}
            value={formatPnl(summary.totalPnl)}
            tone={summary.totalPnl >= 0 ? "up" : "down"}
          />
          <SummaryTile label={t("stats.winRate")} value={formatPct(summary.winRate)} />
          <SummaryTile label={t("dashboard.avgRR")} value={`${summary.avgRR.toFixed(2)}R`} />
          <SummaryTile
            label={t("journal.colPnl")}
            hint={t("common.best")}
            value={formatPnl(summary.bestTrade?.pnl ?? 0)}
            tone="up"
          />
        </div>
      )}

      {/* Result filter pill group + Missed Setups shortcut */}
      <div className="flex items-center gap-1.5 mb-2.5 md:mb-3">
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 flex-1 md:flex-none md:w-auto md:inline-flex">
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
                "flex-1 md:flex-none md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
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
                  "tabular-nums text-[10px] font-bold",
                  resultFilter === opt.v ? "opacity-70" : "text-slate-600",
                )}
              >
                {counts[opt.v]}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={onOpenMissed}
          title={t("missed.title")}
          className="shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-400 hover:text-slate-200 text-xs md:text-sm font-semibold transition-all"
        >
          <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">{t("missed.title")}</span>
        </button>
      </div>

      {/* ── Mobile: Card List ── */}
      <div className="md:hidden space-y-1.5 animate-fade-in-up stagger-2">
        {trades.length === 0 ? (
          <EmptyState
            icon={<Target className="w-7 h-7" />}
            title={t("empty.title")}
            description={t("empty.subtitle")}
            action={
              <Button size="sm" onClick={onAdd}>
                <Plus className="w-3.5 h-3.5" /> {t("empty.cta")}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("common.noTradesFound")}
            action={
              <Button size="sm" variant="ghost" onClick={() => setResultFilter("all")}>
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
      <Card className="hidden md:block overflow-hidden animate-fade-in-up stagger-2">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[880px]">
            <thead className="sticky top-0 z-10 bg-[#0a0f1e]/85 backdrop-blur-md">
              <tr className="border-b border-white/[0.06]">
                {(["date", "symbol", "strategy", "pnl", "rMultiple"] as SortKey[]).map((key) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none"
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
                <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("common.side")}
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("common.risk")}
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center">
                    <div className="text-sm font-semibold text-white mb-1">{t("empty.title")}</div>
                    <p className="text-xs text-slate-500 mb-3">{t("empty.subtitle")}</p>
                    <Button size="sm" onClick={onAdd}>
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
                      <td className="px-4 py-1.5">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            be
                              ? "text-slate-300"
                              : trade.rMultiple >= 0
                                ? "text-emerald-400"
                                : "text-red-400",
                          )}
                        >
                          {trade.rMultiple.toFixed(2)}R
                        </span>
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
                      <td className="px-4 py-1.5 text-sm font-semibold text-slate-300 tabular-nums">
                        ${trade.riskAmount.toFixed(0)}
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

      {/* Load more (both layouts) */}
      {hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-300 transition-all"
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
 * One number of the current selection. Deliberately flatter than `Metric` (no
 * hover glow, no corner accent): four of these sit in a row directly under the
 * page title, so they have to read as a quiet summary line, not as four cards
 * competing with the table below.
 */
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </span>
        {hint && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 shrink-0">
            {hint}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-0.5 font-display text-[15px] md:text-base font-extrabold tabular-nums tracking-tight",
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}
