import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useT } from "../i18n/LanguageContext";
import { loadMonthlyReports, type MonthlyReportRow } from "../store";
import { prevMonthOf, type MonthlyReportData } from "../utils/monthlyReport";
import { generateMyMonthlyReport } from "@/lib/reports.functions";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { Skeleton } from "../components/Skeleton";
import MarkdownAnswer from "../components/MarkdownAnswer";
import { cn } from "../utils/cn";

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-PT",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
  ar: "ar-SA",
  hi: "hi-IN",
};

/** "2026-06" → "June 2026" in the app language. */
function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export default function Reports() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const locale = LOCALE_MAP[lang] || "en-US";

  const [rows, setRows] = useState<MonthlyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openMonth, setOpenMonth] = useState<string | null>(() => {
    // Deep link from the push notification: /?report=YYYY-MM
    if (typeof window === "undefined") return null;
    const m = new URLSearchParams(window.location.search).get("report");
    return m && /^\d{4}-\d{2}$/.test(m) ? m : null;
  });

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setRows(await loadMonthlyReports(user.id));
    } catch (e) {
      console.error("Failed to load reports", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const lastMonth = useMemo(() => prevMonthOf(new Date().toISOString().slice(0, 7)), []);
  const hasLastMonth = rows.some((r) => r.month === lastMonth);

  const generate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await generateMyMonthlyReport({ data: { month: lastMonth } });
      if (!res.report) {
        toast(t("reports.noTradesForMonth"), "info");
      } else {
        toast(t("reports.generated"), "success");
        setOpenMonth(lastMonth);
        await refresh();
      }
    } catch (e) {
      console.error("Failed to generate report", e);
      toast(t("reports.generateFailed"), "error");
    } finally {
      setGenerating(false);
    }
  }, [generating, lastMonth, refresh, t, toast]);

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-6">
        <div className="animate-fade-in-up stagger-0">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("reports.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t("reports.subtitle")}</p>
        </div>
        {!hasLastMonth && !loading && (
          <button
            onClick={generate}
            disabled={generating}
            className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-3 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 animate-fade-in-up stagger-1"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {generating ? t("reports.generating") : t("reports.generate")}
            </span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-3xl p-10 md:p-14 text-center animate-fade-in-up stagger-1">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-cyan-400" />
          </div>
          <h2 className="text-base font-bold text-white mb-1.5">{t("reports.empty")}</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">{t("reports.emptySub")}</p>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {generating ? t("reports.generating") : t("reports.generate")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <ReportCard
              key={row.id}
              row={row}
              locale={locale}
              open={openMonth === row.month}
              onToggle={() => setOpenMonth((m) => (m === row.month ? null : row.month))}
              delay={i * 60}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  row,
  locale,
  open,
  onToggle,
  delay,
}: {
  row: MonthlyReportRow;
  locale: string;
  open: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const { t } = useT();
  const r = row.report;
  const gain = r.totalPnl >= 0;

  return (
    <div
      className="glass rounded-2xl overflow-hidden card-premium animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header row (always visible) */}
      <button
        onClick={() => {
          onToggle();
          // Étape 7: viewing a positive monthly report arms the review nudge.
          if (!open && r.totalPnl > 0) {
            window.dispatchEvent(new CustomEvent("tv:trustpilot-nudge"));
          }
        }}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 md:px-5 py-4 text-left hover:bg-white/[0.02] transition"
      >
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            gain ? "bg-emerald-500/10" : "bg-red-500/10",
          )}
        >
          {gain ? (
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white capitalize">
            {monthLabel(row.month, locale)}
          </div>
          <div className="text-[11px] text-slate-500">
            {r.trades} {t("common.trades")} · {formatPct(r.winRate)} {t("stats.winRate")}
          </div>
        </div>
        <div
          className={cn(
            "font-display text-base md:text-lg font-extrabold tabular-nums shrink-0",
            gain ? "text-emerald-400" : "text-red-400",
          )}
        >
          {formatPnl(r.totalPnl)}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-500 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-4 md:px-5 pb-5 animate-fade-in border-t border-white/[0.05] pt-4 space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Kpi
              label={t("stats.winRate")}
              value={formatPct(r.winRate)}
              sub={`${r.wins}W / ${r.losses}L${r.breakEven ? ` / ${r.breakEven}BE` : ""}`}
              good={r.winRate >= 0.5}
            />
            <Kpi
              label={t("quant.expectancy")}
              value={formatPnl(r.expectancy)}
              sub={`${r.expectancyR >= 0 ? "+" : ""}${r.expectancyR.toFixed(2)}R`}
              good={r.expectancy >= 0}
            />
            <Kpi
              label={t("reports.profitFactor")}
              value={r.profitFactor >= 99 ? "99+" : r.profitFactor.toFixed(2)}
              sub={`Sharpe ${r.sharpe ?? "—"} · Sortino ${r.sortino ?? "—"}`}
              good={r.profitFactor >= 1}
            />
            <Kpi
              label={t("reports.maxDrawdown")}
              value={formatPnl(-r.maxDrawdown)}
              sub={t("dashboard.peakToTrough")}
              good={false}
              neutral
            />
          </div>

          {/* MoM comparison */}
          {r.prev && (
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5 text-xs">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] shrink-0">
                {t("reports.mom")}
              </span>
              <span className="text-slate-400">
                {monthLabel(r.prev.month, locale)}:{" "}
                <span
                  className={cn(
                    "font-bold",
                    r.prev.totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {formatPnl(r.prev.totalPnl)}
                </span>
                {" · "}
                <span className="font-bold text-slate-300">{formatPct(r.prev.winRate)}</span>
                {" · "}
                {r.prev.trades} {t("common.trades")}
              </span>
              <span
                className={cn(
                  "ml-auto font-bold tabular-nums shrink-0",
                  r.totalPnl - r.prev.totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {r.totalPnl - r.prev.totalPnl >= 0 ? "+" : ""}
                {formatPnl(r.totalPnl - r.prev.totalPnl)}
              </span>
            </div>
          )}

          {/* Weekly P&L bars */}
          {r.weekly.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                {t("reports.weekly")}
              </h4>
              <div className="space-y-1.5">
                {r.weekly.map((w) => {
                  const max = Math.max(...r.weekly.map((x) => Math.abs(x.pnl)), 1);
                  return (
                    <div key={w.week} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 shrink-0">
                        {t("reports.week")} {w.week}
                      </span>
                      <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            w.pnl >= 0 ? "bg-emerald-500/60" : "bg-red-500/60",
                          )}
                          style={{ width: `${(Math.abs(w.pnl) / max) * 100}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-bold tabular-nums w-20 text-right",
                          w.pnl >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {formatPnl(w.pnl)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Setups */}
          {(r.bestSetups.length > 0 || r.worstSetups.length > 0) && (
            <div className="grid md:grid-cols-2 gap-3">
              {r.bestSetups.length > 0 && (
                <SetupList title={t("reports.bestSetups")} setups={r.bestSetups} positive />
              )}
              {r.worstSetups.length > 0 && (
                <SetupList
                  title={t("reports.worstSetups")}
                  setups={r.worstSetups}
                  positive={false}
                />
              )}
            </div>
          )}

          {/* Mistakes */}
          {r.mistakes.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> {t("reports.mistakes")}
              </h4>
              <div className="space-y-1">
                {r.mistakes.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between text-xs rounded-lg bg-white/[0.02] px-3 py-2"
                  >
                    <span className="text-slate-300">
                      {m.name} <span className="text-slate-600">×{m.count}</span>
                    </span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        m.cost >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {formatPnl(m.cost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI summary (Étape 5, option A) */}
          {r.aiSummary && (
            <div className="rounded-xl bg-cyan-500/[0.05] border border-cyan-500/15 p-3.5">
              <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-cyan-400 font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" /> {t("reports.aiSummary")}
              </h4>
              <div className="text-sm text-slate-300">
                <MarkdownAnswer content={r.aiSummary} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  good,
  neutral,
}: {
  label: string;
  value: string;
  sub: string;
  good: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 truncate">
        {label}
      </div>
      <div
        className={cn(
          "font-display text-base font-extrabold tabular-nums",
          neutral ? "text-white" : good ? "text-emerald-400" : "text-amber-400",
        )}
      >
        {value}
      </div>
      <div className="text-[9px] text-slate-600 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function SetupList({
  title,
  setups,
  positive,
}: {
  title: string;
  setups: MonthlyReportData["bestSetups"];
  positive: boolean;
}) {
  const { t } = useT();
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {setups.map((s) => (
          <div
            key={s.strategy}
            className="flex items-center justify-between text-xs rounded-lg bg-white/[0.02] px-3 py-2"
          >
            <span className="text-slate-300 truncate">
              {s.strategy}{" "}
              <span className="text-slate-600">
                ×{s.count}
                {s.winRate !== null
                  ? ` · ${Math.round(s.winRate * 100)}% ${t("stats.winRate")}`
                  : ""}
              </span>
            </span>
            <span
              className={cn(
                "font-bold tabular-nums shrink-0 ml-2",
                positive ? "text-emerald-400" : "text-red-400",
              )}
            >
              {formatPnl(s.pnl)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
