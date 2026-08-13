import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Bot,
  History,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useT } from "../i18n/LanguageContext";
import { loadMonthlyReports, type MonthlyReportRow } from "../store";
import { type MonthlyReportData } from "../utils/monthlyReport";
import { missingReportMonths } from "../utils/reportMonths";
import { generateMyMonthlyReport } from "@/backend/reports.functions";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { Skeleton } from "../components/Skeleton";
import MarkdownAnswer from "../components/MarkdownAnswer";
import { cn } from "../utils/cn";
import type { Trade } from "../types";
import { PageHeader, Button } from "@/shared/ui";

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

export default function Reports({ trades }: { trades: Trade[] }) {
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

  // Les mois générables viennent des TRADES, plus du seul « mois dernier ».
  // Un historique de six mois saisi à la main ou importé donne donc bien six
  // rapports — c'est exactement ce que le backfill CSV fait déjà, via la même
  // fonction pure (`missingReportMonths`) pour éviter deux définitions.
  const missing = useMemo(
    () =>
      missingReportMonths(
        trades.map((tr) => tr.date),
        rows.map((r) => r.month),
      ),
    [trades, rows],
  );

  /** Nombre de trades par mois — sert à montrer ce que le rapport contiendra. */
  const tradesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const tr of trades) {
      const m = tr.date.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    return map;
  }, [trades]);

  /** Génère une liste de mois à la suite, puis rafraîchit une seule fois. */
  const generateMonths = useCallback(
    async (months: string[]) => {
      if (generating || months.length === 0) return;
      setGenerating(true);
      let done = 0;
      try {
        for (const month of months) {
          try {
            const res = await generateMyMonthlyReport({ data: { month } });
            if (res.report) done++;
          } catch (e) {
            console.error("Failed to generate report", month, e);
          }
        }
        if (done === 0) {
          toast(t("reports.noTradesForMonth"), "info");
        } else {
          toast(
            done === 1
              ? t("reports.generated")
              : t("reports.generatedN").replace("{n}", String(done)),
            "success",
          );
          if (months.length === 1) setOpenMonth(months[0]);
          await refresh();
        }
      } finally {
        setGenerating(false);
      }
    },
    [generating, refresh, t, toast],
  );

  return (
    <div className="p-4 md:p-5 max-w-[900px] mx-auto">
      <PageHeader
        className="stagger-0"
        icon={
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <FileText className="w-4 h-4 text-white" />
          </span>
        }
        title={t("reports.title")}
        actions={
          missing.length > 0 &&
          !loading && (
            <Button
              onClick={() => generateMonths(missing)}
              disabled={generating}
              className="shrink-0 disabled:opacity-60 animate-fade-in-up stagger-1"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {generating
                  ? t("reports.generating")
                  : missing.length === 1
                    ? t("reports.generate")
                    : t("reports.generateAll").replace("{n}", String(missing.length))}
              </span>
            </Button>
          )
        }
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Historique générable — le cœur du chantier : tous les mois clos
              qui ont des trades mais pas encore de rapport. */}
          {missing.length > 0 && (
            <section className="glass rounded-2xl overflow-hidden animate-fade-in-up stagger-1">
              <header className="flex items-center gap-2.5 px-4 md:px-5 py-3.5 border-b border-white/[0.05]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <History className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-white leading-tight">
                    {t("reports.available")}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("reports.availableSub").replace("{n}", String(missing.length))}
                  </p>
                </div>
              </header>
              <ul className="divide-y divide-white/[0.04]">
                {missing.map((month) => (
                  <li
                    key={month}
                    className="flex items-center gap-3 px-4 md:px-5 py-2.5 hover:bg-white/[0.02] transition"
                  >
                    <span className="font-display text-[13px] font-semibold text-slate-200 capitalize flex-1 min-w-0 truncate">
                      {monthLabel(month, locale)}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                      {tradesByMonth.get(month) ?? 0} {t("common.trades")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateMonths([month])}
                      disabled={generating}
                      className="shrink-0 disabled:opacity-50"
                    >
                      {t("reports.generateOne")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rows.length === 0 ? (
            <div className="glass rounded-3xl p-10 md:p-14 text-center animate-fade-in-up stagger-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-cyan-400" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">{t("reports.empty")}</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">{t("reports.emptySub")}</p>
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
              {missing.length === 0 && (
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-600 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" />
                  {t("reports.upToDate")}
                </p>
              )}
            </div>
          )}
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
      className="relative glass rounded-2xl overflow-hidden card-premium animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Liseré vertical : signature « document de performance ». La couleur
          donne le verdict du mois avant même de lire un chiffre. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          gain
            ? "bg-gradient-to-b from-emerald-400 to-emerald-600/30"
            : "bg-gradient-to-b from-red-400 to-red-600/30",
        )}
      />
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
        className="w-full flex items-center gap-3 pl-5 pr-4 md:pl-6 md:pr-5 py-4 text-left hover:bg-white/[0.02] transition"
      >
        <div className="relative shrink-0">
          <span
            className={cn(
              "absolute -inset-0.5 rounded-xl blur-sm",
              gain ? "bg-emerald-500/30" : "bg-red-500/30",
            )}
          />
          <div
            className={cn(
              "relative grid h-10 w-10 place-items-center rounded-xl",
              gain
                ? "bg-gradient-to-br from-emerald-500/25 to-emerald-600/10"
                : "bg-gradient-to-br from-red-500/25 to-red-600/10",
            )}
          >
            {gain ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-slate-600 font-bold">
            {t("reports.docLabel")}
          </div>
          <div className="font-display text-base md:text-lg font-bold text-white capitalize leading-tight">
            {monthLabel(row.month, locale)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
            <span>
              {r.trades} {t("common.trades")}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>
              {formatPct(r.winRate)} {t("stats.winRate")}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={cn(
              "font-display text-lg md:text-xl font-extrabold tabular-nums leading-none",
              gain ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatPnl(r.totalPnl)}
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] font-bold uppercase tracking-wider",
              gain ? "text-emerald-500/70" : "text-red-500/70",
            )}
          >
            {gain ? t("reports.positive") : t("reports.negative")}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-500 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="pl-5 pr-4 md:pl-6 md:pr-5 pb-5 animate-fade-in border-t border-white/[0.05] pt-4 space-y-5">
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

          {/* Débrief du coach — placé AVANT le détail chiffré : c'est la
              lecture experte du mois, ce qu'un vrai rapport met en synthèse. */}
          {r.aiSummary && (
            <div className="relative rounded-2xl bg-cyan-500/[0.05] border border-cyan-500/15 p-4 overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              <div className="flex items-center gap-2 mb-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-teal-600">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </span>
                <h4 className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold">
                  {t("reports.aiSummary")}
                </h4>
              </div>
              <div className="text-sm text-slate-300 leading-relaxed">
                <MarkdownAnswer content={r.aiSummary} />
              </div>
            </div>
          )}

          {/* Weekly P&L bars */}
          {r.weekly.length > 0 && (
            <div>
              <SectionTitle>{t("reports.weekly")}</SectionTitle>
              <div className="space-y-1.5">
                {r.weekly.map((w) => {
                  const max = Math.max(...r.weekly.map((x) => Math.abs(x.pnl)), 1);
                  const win = w.pnl >= 0;
                  return (
                    <div key={w.week} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 shrink-0 tabular-nums">
                        {t("reports.week")} {w.week}
                      </span>
                      <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition",
                            win
                              ? "bg-gradient-to-r from-emerald-600/70 to-emerald-400"
                              : "bg-gradient-to-r from-red-600/70 to-red-400",
                          )}
                          style={{ width: `${(Math.abs(w.pnl) / max) * 100}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-bold tabular-nums w-20 text-right",
                          win ? "text-emerald-400" : "text-red-400",
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
              <SectionTitle icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}>
                {t("reports.mistakes")}
              </SectionTitle>
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
        </div>
      )}
    </div>
  );
}

/**
 * Titre de section d'un rapport : filet horizontal + libellé court.
 *
 * Un même composant pour toutes les sections — c'est ce qui donne au rapport
 * sa hiérarchie régulière plutôt qu'une suite de blocs juxtaposés.
 */
function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 mb-2.5">
      {icon}
      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-bold shrink-0">
        {children}
      </span>
      <span aria-hidden className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
    </h4>
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
    <div className="relative glass rounded-xl p-3 overflow-hidden">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          neutral ? "via-white/20" : good ? "via-emerald-400/40" : "via-amber-400/40",
        )}
      />
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1 truncate">
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
      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{sub}</div>
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
      <SectionTitle>{title}</SectionTitle>
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
