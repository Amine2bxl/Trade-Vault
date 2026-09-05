import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FileText,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Bot,
  History,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useT } from "../i18n/LanguageContext";
import { loadMonthlyReports, type MonthlyReportRow } from "../store";
import { type MonthlyReportData } from "../utils/monthlyReport";
import { missingReportMonths } from "../utils/reportMonths";
import { generateMyMonthlyReport } from "@/backend/reports.functions";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import {
  AXIS_TICK,
  BAR_FILL_GREEN,
  BAR_FILL_RED,
  BAR_RADIUS,
  CHART_ANIMATION,
  EQUITY_GRID,
  moneyAxisProps,
  tooltipStyle,
} from "../utils/chartTheme";
import { Skeleton } from "../components/Skeleton";
import EquityChart from "../components/EquityChart";
import MarkdownAnswer from "../components/MarkdownAnswer";
import { cn } from "../utils/cn";
import type { Trade } from "../types";
import { Button } from "@/shared/ui";
import { usePageActions } from "../contexts/PageActionsContext";

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

/** "2026-06" → "Jun 26" — la pastille du sélecteur, qui doit rester courte. */
function monthChip(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/**
 * LA PAGE RAPPORTS — un DOCUMENT, plus une pile d'accordéons.
 *
 * L'ancienne page empilait tous les mois repliés : on ouvrait une ligne, on
 * lisait un montant, on refermait. Le rapport n'existait jamais comme objet —
 * d'où la sensation de « juste le profit du mois ».
 *
 * Ici la page a deux étages, et un seul rapport à la fois :
 *
 *   • LE SÉLECTEUR — une rangée de mois. On choisit une période, exactement
 *     comme on choisit un relevé bancaire.
 *   • LA FEUILLE — le rapport, toujours déplié, dans l'ordre d'une vraie note
 *     de performance : verdict, chiffres de tête, courbe du mois, semaines,
 *     composition, comparaison, débrief, setups, erreurs.
 *
 * Et parce que c'est une feuille, elle S'IMPRIME : `window.print()` plus la
 * feuille de style d'impression (`@media print` dans styles.css) donnent un
 * PDF A4 sur fond blanc via « Enregistrer au format PDF » du navigateur.
 * Zéro dépendance ajoutée, et le PDF contient le vrai texte — pas une image.
 */
export default function Reports({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const locale = LOCALE_MAP[lang] || "en-US";

  const [rows, setRows] = useState<MonthlyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<string | null>(() => {
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
          if (months.length === 1) setSelected(months[0]);
          await refresh();
        }
      } finally {
        setGenerating(false);
      }
    },
    [generating, refresh, t, toast],
  );

  // Le mois affiché : celui qu'on a choisi s'il existe encore, sinon le plus
  // récent. Un seul rapport est monté à la fois — c'est ce qui permet à
  // l'impression de n'avoir qu'une feuille à sortir.
  const current = useMemo(
    () => rows.find((r) => r.month === selected) ?? rows[0] ?? null,
    [rows, selected],
  );

  // Étape 7: consulter un rapport positif arme la sollicitation d'avis.
  useEffect(() => {
    if (current && current.report.totalPnl > 0) {
      window.dispatchEvent(new CustomEvent("tv:trustpilot-nudge"));
    }
  }, [current]);

  const headerActions = useMemo(
    () => (
      <>
        {current && !loading && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => window.print()}
            className="shrink-0 animate-fade-in-up"
            title={t("reports.exportPdf")}
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reports.exportPdf")}</span>
          </Button>
        )}
        {missing.length > 0 && !loading && (
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
        )}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missing, loading, generating, current, t],
  );
  usePageActions(headerActions);

  return (
    <div className="mx-auto max-w-[1000px] p-4 md:p-5">
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-11 rounded-2xl" />
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Historique générable — tous les mois clos qui ont des trades mais
              pas encore de rapport. Hors de la feuille : ce n'est pas du
              rapport, c'est de l'administration. */}
          {missing.length > 0 && (
            <section className="glass animate-fade-in-up stagger-1 overflow-hidden rounded-2xl">
              <header className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-3.5 md:px-5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/10">
                  <History className="h-3.5 w-3.5 text-amber-400" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display tv-title leading-tight">{t("reports.available")}</h2>
                  <p className="tv-row-label mt-0.5">
                    {t("reports.availableSub").replace("{n}", String(missing.length))}
                  </p>
                </div>
              </header>
              <ul className="divide-y divide-white/[0.04]">
                {missing.map((month) => (
                  <li
                    key={month}
                    className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.02] md:px-5"
                  >
                    <span className="font-display min-w-0 flex-1 truncate text-[13px] font-semibold capitalize text-slate-200">
                      {monthLabel(month, locale)}
                    </span>
                    <span className="tv-figure shrink-0 text-[11px] text-slate-500">
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

          {rows.length === 0 || !current ? (
            <div className="glass animate-fade-in-up stagger-2 rounded-3xl p-10 text-center md:p-14">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                <FileText className="h-6 w-6 text-cyan-400" />
              </div>
              <h2 className="tv-title mb-1.5">{t("reports.empty")}</h2>
              <p className="mx-auto max-w-sm text-sm text-slate-500">{t("reports.emptySub")}</p>
            </div>
          ) : (
            <>
              {/* LE SÉLECTEUR DE PÉRIODE — une rangée, pas une pile. */}
              {rows.length > 1 && (
                <div className="animate-fade-in-up flex items-center gap-2.5">
                  <span className="tv-label shrink-0 text-slate-500">{t("common.period")}</span>
                  <div className="tv-scroll-x -mx-1 min-w-0 flex-1 rounded-xl px-1">
                    <div className="flex w-max gap-1.5 py-0.5">
                      {rows.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelected(r.month)}
                          aria-pressed={r.month === current.month}
                          className={cn("rp-chip", r.month === current.month && "rp-chip-active")}
                        >
                          <span className="capitalize">{monthChip(r.month, locale)}</span>
                          <span
                            aria-hidden
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              r.report.totalPnl >= 0
                                ? "bg-[var(--tv-chart-green)]"
                                : "bg-[var(--tv-chart-red)]",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <ReportSheet
                key={current.id}
                row={current}
                locale={locale}
                trades={trades}
                generatedAt={current.createdAt}
              />

              {missing.length === 0 && (
                <p className="tv-row-label flex items-center justify-center gap-1.5 pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                  {t("reports.upToDate")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LA FEUILLE
   ──────────────────────────────────────────────────────────────────────────*/

function ReportSheet({
  row,
  locale,
  trades,
  generatedAt,
}: {
  row: MonthlyReportRow;
  locale: string;
  trades: Trade[];
  generatedAt: string;
}) {
  const { t } = useT();
  const r = row.report;
  const gain = r.totalPnl >= 0;

  // LA COURBE DU MOIS — le cumul jour par jour, reconstruit depuis les trades
  // du compte affiché. Le rapport stocké ne garde que des paquets
  // hebdomadaires ; la courbe, elle, demande le détail quotidien.
  const curve = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const tr of trades) {
      if (tr.date.slice(0, 7) !== row.month) continue;
      byDay.set(tr.date, (byDay.get(tr.date) ?? 0) + tr.pnl);
    }
    const days = [...byDay.keys()].sort();
    let cum = 0;
    return days.map((d) => {
      cum += byDay.get(d) ?? 0;
      return { date: d, equity: Math.round(cum * 100) / 100 };
    });
  }, [trades, row.month]);

  const weekly = useMemo(
    () => r.weekly.map((w) => ({ ...w, label: `${t("reports.week")} ${w.week}` })),
    [r.weekly, t],
  );

  const printedOn = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(generatedAt || Date.now()),
      ),
    [locale, generatedAt],
  );

  const momDelta = r.prev ? r.totalPnl - r.prev.totalPnl : null;

  return (
    <article className="tv-print-sheet glass animate-fade-in-up overflow-hidden rounded-3xl">
      {/* L'EN-TÊTE DE PAPIER — invisible à l'écran (la page a déjà son titre),
          il n'apparaît que sur le PDF, où la feuille arrive seule. */}
      <div className="rp-print-only rp-paper-head">
        <span className="rp-paper-brand">TradeVault</span>
        <span>{t("reports.docLabel")}</span>
        <span className="rp-paper-date">{printedOn}</span>
      </div>

      {/* ── LE VERDICT ─────────────────────────────────────────────────── */}
      <header className="rp-section rp-head">
        <div className="min-w-0">
          {/* Sur le papier, l'en-tête de feuille porte déjà « rapport
              mensuel » : le sourcil ne le répéterait que pour rien. */}
          <div className="rp-eyebrow tv-label text-slate-500">{t("reports.docLabel")}</div>
          <h2 className="font-display mt-0.5 text-xl font-bold capitalize leading-tight text-white md:text-2xl">
            {monthLabel(row.month, locale)}
          </h2>
          <p className="tv-row-label mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>
              {r.trades} {t("common.trades")}
            </span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-slate-700" />
            <span>
              {formatPct(r.winRate)} {t("stats.winRate")}
            </span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-slate-700" />
            <span>
              {r.wins}W / {r.losses}L{r.breakEven ? ` / ${r.breakEven}BE` : ""}
            </span>
          </p>
        </div>

        <div className="rp-verdict">
          <div
            className={cn(
              "tv-figure text-3xl leading-none md:text-4xl",
              gain ? "rp-pos" : "rp-neg",
            )}
          >
            {formatPnl(r.totalPnl)}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className={cn("rp-pill", gain ? "rp-pill-pos" : "rp-pill-neg")}>
              {gain ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {gain ? t("reports.positive") : t("reports.negative")}
            </span>
            {momDelta !== null && (
              <span className={cn("tv-figure text-[11px]", momDelta >= 0 ? "rp-pos" : "rp-neg")}>
                {momDelta >= 0 ? "▲" : "▼"} {formatPnl(Math.abs(momDelta))}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── LES CHIFFRES DE TÊTE ───────────────────────────────────────── */}
      <div className="rp-section rp-kpis">
        <Kpi
          label={t("stats.winRate")}
          value={formatPct(r.winRate)}
          sub={`${r.wins}W / ${r.losses}L${r.breakEven ? ` / ${r.breakEven}BE` : ""}`}
          good={r.winRate >= 0.5}
        />
        <Kpi
          label={t("quant.expectancy")}
          value={formatPnl(r.expectancy)}
          sub={`${r.expectancyR >= 0 ? "+" : ""}${r.expectancyR.toFixed(2)}R ${t("reports.perTrade")}`}
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

      {/* ── LA COURBE DU MOIS ──────────────────────────────────────────── */}
      {curve.length > 1 && (
        <section className="rp-section">
          <SectionTitle sub={t("reports.curveSub")}>{t("reports.curve")}</SectionTitle>
          <div className="h-[240px] md:h-[280px]">
            <EquityChart data={curve} />
          </div>
        </section>
      )}

      {/* ── LES SEMAINES ───────────────────────────────────────────────── */}
      {weekly.length > 0 && (
        <section className="rp-section">
          <SectionTitle sub={t("reports.weeklySub")}>{t("reports.weekly")}</SectionTitle>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid {...EQUITY_GRID} />
                <XAxis
                  dataKey="label"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis {...moneyAxisProps(weekly.map((w) => w.pnl))} />
                <ReferenceLine y={0} stroke="var(--tv-border-strong)" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number | string) => [formatPnl(Number(v)), t("stats.totalPnl")]}
                />
                {/* `maxBarSize` : quatre semaines sur toute la largeur d'une
                    feuille A4 donnent des barres de 300px — des dalles, pas un
                    histogramme. La barre garde une largeur d'objet lisible et
                    l'espace passe entre elles. */}
                <Bar dataKey="pnl" radius={BAR_RADIUS} maxBarSize={72} {...CHART_ANIMATION}>
                  {weekly.map((w) => (
                    <Cell key={w.week} fill={w.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* La table qui va avec le graphe : le graphe donne la forme, la
              table donne les montants — et c'est elle qui survit au PDF. */}
          <div className="rp-weekgrid">
            {weekly.map((w) => (
              <div key={w.week} className="rp-weekcell">
                <div className="tv-label text-slate-500">{w.label}</div>
                <div className={cn("tv-figure mt-0.5 text-sm", w.pnl >= 0 ? "rp-pos" : "rp-neg")}>
                  {formatPnl(w.pnl)}
                </div>
                <div className="tv-row-label mt-0.5">
                  {w.trades} {t("common.trades")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── LA COMPOSITION ─────────────────────────────────────────────── */}
      {r.trades > 0 && (
        <section className="rp-section">
          <SectionTitle sub={t("reports.mixSub")}>{t("reports.mix")}</SectionTitle>
          <MixBar wins={r.wins} losses={r.losses} breakEven={r.breakEven} total={r.trades} />
        </section>
      )}

      {/* ── LA COMPARAISON ─────────────────────────────────────────────── */}
      {r.prev && (
        <section className="rp-section">
          <SectionTitle>{t("reports.mom")}</SectionTitle>
          <div className="rp-momgrid">
            <MomCell
              label={t("stats.totalPnl")}
              prev={formatPnl(r.prev.totalPnl)}
              now={formatPnl(r.totalPnl)}
              up={r.totalPnl >= r.prev.totalPnl}
            />
            <MomCell
              label={t("stats.winRate")}
              prev={formatPct(r.prev.winRate)}
              now={formatPct(r.winRate)}
              up={r.winRate >= r.prev.winRate}
            />
            <MomCell
              label={t("stats.trades")}
              prev={String(r.prev.trades)}
              now={String(r.trades)}
              up={r.trades >= r.prev.trades}
              neutral
            />
          </div>
          <p className="tv-row-label mt-2 capitalize">{monthLabel(r.prev.month, locale)}</p>
        </section>
      )}

      {/* ── LE DÉBRIEF DE JARVIS ───────────────────────────────────────── */}
      {r.aiSummary && (
        <section className="rp-section">
          <SectionTitle icon={<Bot className="h-3.5 w-3.5 text-cyan-400" />}>
            {t("reports.aiSummary")}
          </SectionTitle>
          <div className="rp-debrief">
            <MarkdownAnswer content={r.aiSummary} />
          </div>
        </section>
      )}

      {/* ── LES SETUPS ─────────────────────────────────────────────────── */}
      {(r.bestSetups.length > 0 || r.worstSetups.length > 0) && (
        <section className="rp-section">
          <div className="grid gap-4 md:grid-cols-2">
            {r.bestSetups.length > 0 && (
              <SetupList title={t("reports.bestSetups")} setups={r.bestSetups} positive />
            )}
            {r.worstSetups.length > 0 && (
              <SetupList title={t("reports.worstSetups")} setups={r.worstSetups} positive={false} />
            )}
          </div>
        </section>
      )}

      {/* ── LES ERREURS ────────────────────────────────────────────────── */}
      {r.mistakes.length > 0 && (
        <section className="rp-section">
          <SectionTitle icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}>
            {t("reports.mistakes")}
          </SectionTitle>
          <BarList
            rows={r.mistakes.map((m) => ({
              key: m.name,
              label: m.name,
              meta: `×${m.count}`,
              value: m.cost,
            }))}
          />
        </section>
      )}

      <div className="rp-print-only rp-paper-foot">
        TradeVault · {monthLabel(row.month, locale)} · {printedOn}
      </div>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LES PIÈCES DE LA FEUILLE
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * Titre de section : libellé court, filet, et une ligne de sous-titre
 * facultative qui dit ce que la section apprend. C'est cette ligne qui
 * transforme un graphe posé là en section d'un rapport.
 */
function SectionTitle({
  children,
  icon,
  sub,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-3">
      <h4 className="flex items-center gap-2">
        {icon}
        <span className="tv-label shrink-0 text-slate-400">{children}</span>
        <span aria-hidden className="rp-rule h-px flex-1" />
      </h4>
      {sub && <p className="tv-row-label mt-1">{sub}</p>}
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
    <div className="rp-kpi">
      <div className="tv-label mb-1 truncate text-slate-500">{label}</div>
      <div
        className={cn("tv-figure text-base", neutral ? "text-white" : good ? "rp-pos" : "rp-warn")}
      >
        {value}
      </div>
      <div className="tv-row-label mt-0.5 truncate">{sub}</div>
    </div>
  );
}

/**
 * LA COMPOSITION DU MOIS — une seule barre segmentée.
 *
 * Trois nombres (gagnants, perdants, neutres) et leur proportion, lus d'un
 * coup d'œil. Un camembert aurait demandé une légende pour trois valeurs.
 */
function MixBar({
  wins,
  losses,
  breakEven,
  total,
}: {
  wins: number;
  losses: number;
  breakEven: number;
  total: number;
}) {
  const { t } = useT();
  const parts = [
    { key: "w", n: wins, cls: "rp-fill-pos", label: t("reports.wins") },
    { key: "l", n: losses, cls: "rp-fill-neg", label: t("reports.losses") },
    { key: "b", n: breakEven, cls: "rp-fill-flat", label: t("reports.breakEvenTrades") },
  ].filter((p) => p.n > 0);

  return (
    <div>
      <div
        className="rp-mix"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.n}`).join(", ")}
      >
        {parts.map((p) => (
          <span key={p.key} className={p.cls} style={{ width: `${(p.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", p.cls)} />
            <span className="tv-row-label">{p.label}</span>
            <span className="tv-figure text-[11px] text-slate-300">
              {p.n} · {Math.round((p.n / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MomCell({
  label,
  prev,
  now,
  up,
  neutral,
}: {
  label: string;
  prev: string;
  now: string;
  up: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="rp-momcell">
      <div className="tv-label truncate text-slate-500">{label}</div>
      {/* `flex-wrap` : sur téléphone, « avant → après » ne tient pas sur une
          ligne dans une colonne de 156px. Il passe à la ligne au lieu de
          déborder de sa case. */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="tv-figure text-sm text-slate-500 line-through decoration-slate-700">
          {prev}
        </span>
        <span aria-hidden className="tv-row-label">
          →
        </span>
        <span
          className={cn("tv-figure text-base", neutral ? "text-white" : up ? "rp-pos" : "rp-neg")}
        >
          {now}
        </span>
      </div>
    </div>
  );
}

/**
 * UNE LISTE À BARRES — le motif partagé des setups et des erreurs.
 *
 * Chaque ligne porte sa part du plus gros montant de la liste : on compare
 * des poids sans lire trois nombres. La barre est posée SOUS le texte, pas
 * derrière : sur du papier, un texte sur fond teinté perd son contraste.
 */
function BarList({
  rows,
}: {
  rows: { key: string; label: string; meta?: string; value: number }[];
}) {
  const max = Math.max(...rows.map((x) => Math.abs(x.value)), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="rp-barrow">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
              {row.label}
              {row.meta && <span className="ml-1.5 text-slate-600">{row.meta}</span>}
            </span>
            <span
              className={cn("tv-figure shrink-0 text-xs", row.value >= 0 ? "rp-pos" : "rp-neg")}
            >
              {formatPnl(row.value)}
            </span>
          </div>
          <div className="rp-bartrack mt-1.5">
            <span
              className={row.value >= 0 ? "rp-fill-pos" : "rp-fill-neg"}
              style={{ width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
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
      <SectionTitle
        icon={
          positive ? (
            <TrendingUp className="h-3.5 w-3.5 text-[var(--tv-chart-green)]" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-[var(--tv-chart-red)]" />
          )
        }
      >
        {title}
      </SectionTitle>
      <BarList
        rows={setups.map((s) => ({
          key: s.strategy,
          label: s.strategy,
          meta: `×${s.count}${s.winRate !== null ? ` · ${Math.round(s.winRate * 100)}% ${t("stats.winRate")}` : ""}`,
          value: s.pnl,
        }))}
      />
    </div>
  );
}
