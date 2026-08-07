import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Loader2, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Bot, Zap, CalendarDays } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useT } from "../i18n/LanguageContext";
import { loadMonthlyReports, type MonthlyReportRow } from "../store";
import { prevMonthOf, type MonthlyReportData } from "../utils/monthlyReport";
import { generateMyMonthlyReport } from "@/backend/reports.functions";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { Skeleton } from "../components/Skeleton";
import MarkdownAnswer from "../components/MarkdownAnswer";
import { cn } from "../utils/cn";
import { PageHeader, Button } from "@/shared/ui";

const LOCALE_MAP: Record<string, string> = { en: "en-US", es: "es-ES", pt: "pt-PT", fr: "fr-FR", de: "de-DE", it: "it-IT", nl: "nl-NL", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ar: "ar-SA", hi: "hi-IN" };

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Find all months YYYY-MM between start and end (inclusive) */
function monthsBetween(start: string, end: string): string[] {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const months: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export default function Reports() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const locale = LOCALE_MAP[lang] || "en-US";

  const [rows, setRows] = useState<MonthlyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [openMonth, setOpenMonth] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const m = new URLSearchParams(window.location.search).get("report");
    return m && /^\d{4}-\d{2}$/.test(m) ? m : null;
  });

  const refresh = useCallback(async () => {
    if (!user) return;
    try { setRows(await loadMonthlyReports(user.id)); }
    catch (e) { console.error("Failed to load reports", e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  const lastMonth = useMemo(() => prevMonthOf(new Date().toISOString().slice(0, 7)), []);
  const hasLastMonth = rows.some((r) => r.month === lastMonth);

  // Find months that have data but no reports (for "generate all")
  const existingMonths = new Set(rows.map((r) => r.month));
  const reportMonths = useMemo(() => {
    const first = rows.length > 0 ? rows[rows.length - 1].month : lastMonth;
    return monthsBetween(first, lastMonth).filter((m) => !existingMonths.has(m) && m !== new Date().toISOString().slice(0, 7));
  }, [rows, lastMonth, existingMonths]);

  const generate = useCallback(async (month: string) => {
    setGenerating(month);
    try {
      const res = await generateMyMonthlyReport({ data: { month } });
      if (!res.report) { toast(t("reports.noTradesForMonth"), "info"); }
      else { toast(t("reports.generated"), "success"); setOpenMonth(month); await refresh(); }
    } catch (e) { console.error("Failed to generate report", e); toast(t("reports.generateFailed"), "error"); }
    finally { setGenerating(null); }
  }, [refresh, t, toast]);

  const generateAll = useCallback(async () => {
    if (generatingAll) return;
    setGeneratingAll(true);
    let count = 0;
    for (const month of reportMonths) {
      try {
        const res = await generateMyMonthlyReport({ data: { month } });
        if (res.report) count++;
      } catch {}
    }
    if (count > 0) toast(`${count} rapport${count > 1 ? "s" : ""} généré${count > 1 ? "s" : ""}`, "success");
    else toast("Aucun rapport à générer", "info");
    await refresh();
    setGeneratingAll(false);
  }, [generatingAll, reportMonths, refresh, toast]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b.month.localeCompare(a.month)), [rows]);

  return (
    <div className="p-4 md:p-5 max-w-[900px] mx-auto">
      <PageHeader
        className="stagger-0"
        icon={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600"><FileText className="w-4 h-4 text-white" /></span>}
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        actions={
          <div className="flex items-center gap-2 shrink-0">
            {reportMonths.length > 1 && !loading && (
              <Button onClick={generateAll} disabled={generatingAll} variant="subtle" size="sm">
                {generatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{generatingAll ? "Génération..." : `Tout générer (${reportMonths.length})`}</span>
              </Button>
            )}
            {!hasLastMonth && !loading && (
              <Button onClick={() => generate(lastMonth)} disabled={generating === lastMonth} size="sm">
                {generating === lastMonth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{t("reports.generate")}</span>
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => (<Skeleton key={i} className="h-24 rounded-2xl" />))}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
            <FileText className="w-7 h-7 text-cyan-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">{t("reports.empty")}</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">{t("reports.emptySub")}</p>
          <Button onClick={() => generate(lastMonth)} disabled={!!generating} variant="accent" size="sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generating ? t("reports.generating") : t("reports.generate")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Missing months banner */}
          {reportMonths.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-4 py-2.5 text-xs text-amber-200/80">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{reportMonths.length} mois sans rapport — tes données existent mais n'ont pas encore été compilées</span>
              <button onClick={generateAll} disabled={generatingAll} className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 transition whitespace-nowrap">
                {generatingAll ? "..." : "Générer"}
              </button>
            </div>
          )}

          {sorted.map((row) => (
            <ReportCard key={row.month} row={row} open={openMonth === row.month} onToggle={() => setOpenMonth(openMonth === row.month ? null : row.month)} locale={locale} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ row, open, onToggle, locale, t }: { row: MonthlyReportRow; open: boolean; onToggle: () => void; locale: string; t: (k: any) => string }) {
  const d = row.report as MonthlyReportData;
  const gain = d.totalPnl >= 0;

  return (
    <div className={cn("glass rounded-2xl card-premium overflow-hidden transition-all", open && "ring-1 ring-cyan-500/20")}>
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", gain ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20")}>
          {gain ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{monthLabel(row.month, locale)}</div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-slate-500">{d.trades} trades</span>
            <span className={cn("text-[11px] font-semibold", gain ? "text-emerald-400" : "text-red-400")}>
              {formatPnl(d.totalPnl)}
            </span>
            <span className={cn("text-[11px] font-semibold", d.winRate >= 0.5 ? "text-emerald-400" : "text-amber-400")}>
              {formatPct(d.winRate)} WR
            </span>
          </div>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-slate-500 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-5 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Win Rate" value={formatPct(d.winRate)} tone={d.winRate >= 0.5 ? "up" : "warn"} />
            <Kpi label={t("quant.expectancy")} value={`${d.expectancy >= 0 ? "+" : ""}${formatPnl(d.expectancy)}`} tone={d.expectancy >= 0 ? "up" : "down"} />
            <Kpi label="Profit Factor" value={d.profitFactor >= 99 ? "99+" : d.profitFactor.toFixed(2)} tone={d.profitFactor >= 1 ? "up" : "down"} />
            <Kpi label="Max Drawdown" value={formatPnl(-d.maxDrawdown)} tone="down" />
          </div>

          {/* Top setups */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {d.bestSetups?.length > 0 && <SetupList title="Meilleurs setups" items={d.bestSetups} color="emerald" />}
            {d.worstSetups?.length > 0 && <SetupList title="Pires setups" items={d.worstSetups} color="red" />}
          </div>

          {/* Mistakes */}
          {d.mistakes?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Erreurs</div>
              <div className="flex flex-wrap gap-2">
                {d.mistakes.map((m: any) => (
                  <span key={m.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] font-semibold text-red-300">
                    <AlertTriangle className="w-3 h-3" />
                    {m.name} <span className="text-red-400/60">×{m.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weekly P&L */}
          {d.weekly?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">P&L hebdomadaire</div>
              <div className="flex gap-1.5 flex-wrap">
                {d.weekly.map((w, i: number) => {
                  const max = Math.max(...d.weekly.map((x) => Math.abs(x.pnl)), 1);
                  const barH = Math.max(2, Math.round((Math.abs(w.pnl) / max) * 48));
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[32px]">
                      <div className="w-full flex items-end justify-center" style={{ height: 50 }}>
                        <div className={cn("w-full max-w-[20px] rounded-t transition-all", w.pnl >= 0 ? "bg-emerald-500/60" : "bg-red-500/60")}
                          style={{ height: barH }} title={`S${w.week}: ${formatPnl(w.pnl)}`} />
                      </div>
                      <span className="text-[9px] text-slate-600 font-semibold">S{w.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {d.aiSummary && (
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Analyse IA</span>
              </div>
              <MarkdownAnswer content={d.aiSummary} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "up" | "down" | "warn" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">{label}</div>
      <div className={cn("font-display text-base font-extrabold tabular-nums", tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-amber-400")}>{value}</div>
    </div>
  );
}

function SetupList({ title, items, color }: { title: string; items: any[]; color: "emerald" | "red" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{title}</div>
      <div className="space-y-1">
        {items.map((s: any, i: number) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-1.5">
            <span className="text-[11px] font-medium text-slate-300 truncate flex-1">{s.strategy || s.name}</span>
            <span className={cn("text-[11px] font-bold tabular-nums shrink-0 ml-2", color === "emerald" ? "text-emerald-400" : "text-red-400")}>
              {formatPnl(s.pnl)} <span className="text-slate-600 font-normal">· {s.count} trades</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
