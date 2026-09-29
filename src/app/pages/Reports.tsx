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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
} from "lucide-react";
import logoSrc from "@/assets/tradevault-logo-128.png";
import { SITE_URL } from "@/shared/site";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useT } from "../i18n/LanguageContext";
import { loadMonthlyReports, type MonthlyReportRow } from "../store";
import { buildMonthlyReport, prevMonthOf, type MonthlyReportData } from "../utils/monthlyReport";
import { useAccounts } from "../contexts/AccountContext";
import { localMonthOf, todayLocalDate } from "@/shared/calendar-date";
import { statsBySession, MIN_BUCKET_SAMPLE } from "../utils/quantStats";
import { currencySymbol, useCurrency } from "@/shared/currency";
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
import { Button, Kpi, SelectPicker } from "@/shared/ui";
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
/** Le domaine imprimé au pied du PDF (`tradevault.be`, sans protocole). */
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
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
/**
 * LE MOIS EN COURS — construit à la volée, jamais archivé.
 *
 * Les rapports stockés ne couvrent que des mois TERMINÉS (règle de
 * `reportMonths`). Le mois courant est calculé ici, depuis les trades du
 * compte, par le même `buildMonthlyReport` que le serveur : mêmes chiffres,
 * mêmes définitions. Il est marqué « en cours » partout où il s'affiche, pour
 * qu'on ne le prenne jamais pour un bilan définitif.
 */
function useLiveMonthRow(trades: Trade[], startingBalance: number): MonthlyReportRow | null {
  return useMemo(() => {
    if (trades.length === 0) return null;
    const month = localMonthOf(new Date());
    const prev = prevMonthOf(month);
    const monthTrades = trades.filter((tr) => tr.date.slice(0, 7) === month);
    const prevTrades = trades.filter((tr) => tr.date.slice(0, 7) === prev);
    return {
      id: `live-${month}`,
      month,
      report: buildMonthlyReport(month, monthTrades, prevTrades, startingBalance),
      createdAt: new Date().toISOString(),
    };
  }, [trades, startingBalance]);
}

export default function Reports({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { activeAccount } = useAccounts();
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

  const liveRow = useLiveMonthRow(trades, activeAccount?.startingBalance ?? 0);
  /** Les rapports affichables : le mois en cours d'abord, puis les archivés. */
  const allRows = useMemo(
    () => (liveRow && !rows.some((r) => r.month === liveRow.month) ? [liveRow, ...rows] : rows),
    [liveRow, rows],
  );

  // Le mois affiché : celui qu'on a choisi s'il existe encore, sinon le plus
  // récent. Un seul rapport est monté à la fois — c'est ce qui permet à
  // l'impression de n'avoir qu'une feuille à sortir.
  const current = useMemo(
    () => allRows.find((r) => r.month === selected) ?? allRows[0] ?? null,
    [allRows, selected],
  );
  const currentIsLive = !!current && current.id.startsWith("live-");

  // Étape 7: consulter un rapport positif arme la sollicitation d'avis.
  useEffect(() => {
    if (current && !current.id.startsWith("live-") && current.report.totalPnl > 0) {
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

          {allRows.length === 0 || !current ? (
            <div className="glass animate-fade-in-up stagger-2 rounded-3xl p-10 text-center md:p-14">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                <FileText className="h-6 w-6 text-cyan-400" />
              </div>
              <h2 className="tv-title mb-1.5">{t("reports.empty")}</h2>
              <p className="mx-auto max-w-sm text-sm text-slate-500">{t("reports.emptySub")}</p>
            </div>
          ) : (
            <>
              {/* LE SÉLECTEUR DE PÉRIODE — précédent · mois · suivant.
                  C'était une rangée de pastilles qui défilait à l'horizontale :
                  sur téléphone, douze mois faisaient glisser toute la page de
                  côté. Un seul contrôle compact, de la même largeur partout. */}
              {allRows.length > 1 && (
                <MonthSwitcher
                  months={allRows.map((r) => ({
                    month: r.month,
                    live: r.id.startsWith("live-"),
                    pnl: r.report.totalPnl,
                  }))}
                  value={current.month}
                  onChange={setSelected}
                  locale={locale}
                />
              )}

              <ReportSheet
                key={current.id}
                row={current}
                locale={locale}
                trades={trades}
                generatedAt={current.createdAt}
                inProgress={currentIsLive}
                accountName={activeAccount?.name ?? null}
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
  inProgress,
  accountName,
}: {
  row: MonthlyReportRow;
  locale: string;
  trades: Trade[];
  generatedAt: string;
  inProgress: boolean;
  accountName: string | null;
}) {
  const { t } = useT();
  const currency = useCurrency();
  const r = row.report;
  const gain = r.totalPnl >= 0;

  /* OÙ EN EST LE MOIS. Pour le mois en cours : le jour atteint sur le nombre de
     jours du mois, et la date jusqu'à laquelle les données vont. */
  const progress = useMemo(() => {
    if (!inProgress) return null;
    const today = todayLocalDate();
    const [y, m] = row.month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const day = Number(today.slice(8, 10));
    const through = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(
      new Date(`${today}T12:00:00`),
    );
    return { day, daysInMonth, through };
  }, [inProgress, row.month, locale]);

  /** La période couverte, en toutes lettres — pour la couverture du PDF. */
  const period = useMemo(() => {
    const [y, m] = row.month.split("-").map(Number);
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
    const start = fmt.format(new Date(y, m - 1, 1, 12));
    const endDate = inProgress ? new Date(`${todayLocalDate()}T12:00:00`) : new Date(y, m, 0, 12);
    return `${start} – ${fmt.format(endDate)}`;
  }, [row.month, locale, inProgress]);

  /* LES SESSIONS DU MOIS — seulement celles qui ont assez de trades pour dire
     quelque chose (même plancher que les setups). */
  const sessions = useMemo(() => {
    const monthTrades = trades.filter((tr) => tr.date.slice(0, 7) === row.month);
    const by = statsBySession(monthTrades);
    return (Object.keys(by) as (keyof typeof by)[])
      .map((k) => ({ key: k, ...by[k] }))
      .filter((b) => b.count >= MIN_BUCKET_SAMPLE)
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades, row.month]);

  /* LES CONSTATS — tirés des chiffres du rapport, jamais inventés. Une ligne
     n'apparaît que si la donnée qui la fonde existe. */
  const takeaways = useMemo(() => {
    const out: string[] = [];
    const bestWeek = [...r.weekly].sort((a, b) => b.pnl - a.pnl)[0];
    if (bestWeek && r.weekly.length > 1)
      out.push(
        t("reports.tkBestWeek")
          .replace("{week}", String(bestWeek.week))
          .replace("{pnl}", formatPnl(bestWeek.pnl)),
      );
    if (r.bestSetups[0])
      out.push(
        t("reports.tkBestSetup")
          .replace("{setup}", r.bestSetups[0].strategy)
          .replace("{pnl}", formatPnl(r.bestSetups[0].pnl)),
      );
    if (r.mistakes[0] && r.mistakes[0].cost < 0)
      out.push(
        t("reports.tkMistake")
          .replace("{mistake}", r.mistakes[0].name)
          .replace("{n}", String(r.mistakes[0].count))
          .replace("{pnl}", formatPnl(r.mistakes[0].cost)),
      );
    if (r.prev)
      out.push(
        t(r.totalPnl >= r.prev.totalPnl ? "reports.tkMomUp" : "reports.tkMomDown").replace(
          "{pnl}",
          formatPnl(Math.abs(r.totalPnl - r.prev.totalPnl)),
        ),
      );
    return out;
    // `currency` : les montants des constats se réécrivent avec la devise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, t, currency]);

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
      {/* LE BANDEAU DE TÊTE DU PDF — invisible à l'écran (la page a déjà son
          titre et son sélecteur).

          Il remplace une COUVERTURE pleine page : un logo, un titre et quatre
          métadonnées sur une feuille A4 entière, soit un tiers du document pour
          ne rien dire que ces quatre lignes ne disent pas. Le rapport visait
          trois ou quatre pages ; il en vise désormais une, deux au plus, et
          tout ce que la couverture annonçait — marque, nature du document,
          statut, compte, période, devise, date — tient ici sur deux lignes. */}
      <div className="rp-print-only rp-masthead">
        <div className="rp-mast-row">
          <span className="rp-paper-brand">
            <img src={logoSrc} alt="" width={22} height={22} />
            TradeVault
          </span>
          <span className="rp-mast-doc">{t("reports.docLabel")}</span>
          <span className={cn("rp-cover-status", inProgress && "rp-cover-status-live")}>
            {inProgress ? t("reports.inProgress") : t("reports.final")}
          </span>
        </div>
        <dl className="rp-mast-meta">
          {accountName && (
            <div>
              <dt>{t("reports.coverAccount")}</dt>
              <dd>{accountName}</dd>
            </div>
          )}
          <div>
            <dt>{t("reports.coverPeriod")}</dt>
            <dd>{period}</dd>
          </div>
          <div>
            <dt>{t("reports.coverCurrency")}</dt>
            <dd>
              {currency} · {currencySymbol(currency)}
            </dd>
          </div>
          <div>
            <dt>{t("reports.coverGenerated")}</dt>
            <dd>{printedOn}</dd>
          </div>
        </dl>
      </div>

      {/* ── LE VERDICT ─────────────────────────────────────────────────── */}
      <header className="rp-section rp-head">
        <div className="min-w-0">
          {/* Sur le papier, l'en-tête de feuille porte déjà « rapport
              mensuel » : le sourcil ne le répéterait que pour rien. */}
          <div className="rp-eyebrow tv-label flex items-center gap-2 text-slate-500">
            {inProgress ? t("reports.currentMonth") : t("reports.docLabel")}
            {inProgress && (
              <span className="rp-pill rp-pill-live">
                <Clock3 className="h-3 w-3" />
                {t("reports.inProgress")}
              </span>
            )}
          </div>
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
          {progress && (
            <p className="rp-progress mt-2">
              <span className="rp-progress-track" aria-hidden>
                <span style={{ width: `${(progress.day / progress.daysInMonth) * 100}%` }} />
              </span>
              <span className="tv-row-label">
                {t("reports.progressDays")
                  .replace("{d}", String(progress.day))
                  .replace("{n}", String(progress.daysInMonth))
                  .replace("{date}", progress.through)}
              </span>
            </p>
          )}
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
            {/* Un mois en cours n'a pas encore de verdict : « mois positif »
                sur un 12 du mois serait une conclusion prématurée. */}
            {!inProgress && (
              <span className={cn("rp-pill", gain ? "rp-pill-pos" : "rp-pill-neg")}>
                {gain ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {gain ? t("reports.positive") : t("reports.negative")}
              </span>
            )}
            {momDelta !== null && (
              <span className={cn("tv-figure text-[11px]", momDelta >= 0 ? "rp-pos" : "rp-neg")}>
                {momDelta >= 0 ? "▲" : "▼"} {formatPnl(Math.abs(momDelta))}
              </span>
            )}
          </div>
        </div>
      </header>

      {inProgress && (
        <div className="rp-section rp-provisional">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span>{t("reports.provisionalNote")}</span>
        </div>
      )}

      {/* ── LES CHIFFRES DE TÊTE ───────────────────────────────────────── */}
      <div className="rp-section rp-kpis">
        <ReportKpi
          label={t("stats.winRate")}
          value={formatPct(r.winRate)}
          sub={`${r.wins}W / ${r.losses}L${r.breakEven ? ` / ${r.breakEven}BE` : ""}`}
          good={r.winRate >= 0.5}
        />
        <ReportKpi
          label={t("quant.expectancy")}
          value={formatPnl(r.expectancy)}
          sub={`${r.expectancyR >= 0 ? "+" : ""}${r.expectancyR.toFixed(2)}R ${t("reports.perTrade")}`}
          good={r.expectancy >= 0}
        />
        <ReportKpi
          label={t("reports.profitFactor")}
          value={r.profitFactor >= 99 ? "99+" : r.profitFactor.toFixed(2)}
          sub={`Sharpe ${r.sharpe ?? "—"} · Sortino ${r.sortino ?? "—"}`}
          good={r.profitFactor >= 1}
        />
        <ReportKpi
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
          <div className="rp-curve h-[240px] md:h-[280px]">
            <EquityChart data={curve} />
          </div>
        </section>
      )}

      {/* ── LES SEMAINES ───────────────────────────────────────────────── */}
      {weekly.length > 0 && (
        <section className="rp-section">
          <SectionTitle sub={t("reports.weeklySub")}>{t("reports.weekly")}</SectionTitle>
          {/* Sur le papier, le graphe s'efface devant la table qui le suit :
              mêmes montants, cinq fois moins de hauteur. */}
          <div className="rp-screen-only h-[190px]">
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

      {/* Composition et sessions : l'une sous l'autre à l'écran, côte à côte
          sur le papier (`.rp-duo`) — deux blocs courts qui prenaient chacun
          toute la largeur d'une A4. */}
      <div className="rp-duo">
        {/* ── LA COMPOSITION ─────────────────────────────────────────────── */}
        {r.trades > 0 && (
          <section className="rp-section">
            <SectionTitle sub={t("reports.mixSub")}>{t("reports.mix")}</SectionTitle>
            <MixBar wins={r.wins} losses={r.losses} breakEven={r.breakEven} total={r.trades} />
          </section>
        )}

        {/* ── LES SESSIONS ───────────────────────────────────────────────── */}
        {sessions.length > 0 && (
          <section className="rp-section">
            <SectionTitle sub={t("reports.sessionsSub")}>{t("reports.sessions")}</SectionTitle>
            <BarList
              rows={sessions.map((b) => ({
                key: b.key,
                label: t(`session.${b.key}` as never),
                meta: `×${b.count}`,
                value: Math.round(b.pnl * 100) / 100,
              }))}
            />
          </section>
        )}
      </div>

      <div className="rp-duo">
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

        {/* ── LES CONSTATS ───────────────────────────────────────────────── */}
        {takeaways.length > 0 && (
          <section className="rp-section">
            <SectionTitle>{t("reports.takeaways")}</SectionTitle>
            <ul className="rp-takeaways">
              {takeaways.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

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
          <div className="rp-setups grid gap-4 md:grid-cols-2">
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

      {/* LE PIED — le domaine d'abord : c'est l'adresse où l'on retrouve le
          produit quand le PDF circule hors de l'application. */}
      <div className="rp-print-only rp-paper-foot">
        <span className="rp-paper-domain">{SITE_HOST}</span>
        <span>
          TradeVault · <span className="capitalize">{monthLabel(row.month, locale)}</span> ·{" "}
          {inProgress ? t("reports.inProgress") : printedOn}
        </span>
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

/**
 * La case chiffrée du rapport.
 *
 * Elle DÉFINISSAIT une fonction `Kpi` locale, qui masquait la primitive du même
 * nom dans `@/shared/ui` : la page paraissait migrée — on y lit bien `<Kpi …>` —
 * alors qu'elle rendait sa propre plaque (`.rp-kpi`, c'est-à-dire
 * `.tv-kpi-inset` réécrit à 0.05rem près). Le masquage est ce qui rend ce genre
 * de copie invisible en revue.
 *
 * Ce composant ne fait plus que TRADUIRE le vocabulaire du rapport
 * (`good`/`neutral`, hérité de la feuille imprimable) vers le ton de la case.
 * `inset` parce qu'elle vit DANS la feuille, qui est déjà une carte.
 */
function ReportKpi({
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
    <Kpi
      inset
      label={label}
      value={value}
      hint={sub}
      tone={neutral ? "neutral" : good ? "pos" : "warn"}
    />
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

/**
 * LE SÉLECTEUR DE MOIS — précédent · mois · suivant, et la liste complète au
 * toucher du libellé : le sélecteur de la famille TradeVault, pas la liste
 * système, et rien à faire défiler de côté.
 */
function MonthSwitcher({
  months,
  value,
  onChange,
  locale,
}: {
  months: { month: string; live: boolean; pnl: number }[];
  value: string;
  onChange: (m: string) => void;
  locale: string;
}) {
  const { t } = useT();
  // `months` va du plus récent au plus ancien.
  const idx = Math.max(
    0,
    months.findIndex((m) => m.month === value),
  );
  const cur = months[idx];
  const older = months[idx + 1];
  const newer = idx > 0 ? months[idx - 1] : undefined;
  return (
    <div className="rp-switch animate-fade-in-up">
      <button
        type="button"
        className="rp-switch-btn"
        onClick={() => older && onChange(older.month)}
        disabled={!older}
        aria-label={t("reports.prevMonth")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <SelectPicker
        label={t("reports.pickMonth")}
        value={value}
        onChange={onChange}
        width="16rem"
        className="min-w-0 flex-1"
        options={months.map((m) => ({
          value: m.month,
          label: monthLabel(m.month, locale),
          hint: m.live ? t("reports.inProgress") : undefined,
        }))}
        renderTrigger={({ open, toggle, controls }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={controls}
            aria-label={t("reports.pickMonth")}
            className="rp-switch-label w-full"
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                cur.live
                  ? "bg-amber-400"
                  : cur.pnl >= 0
                    ? "bg-[var(--tv-chart-green)]"
                    : "bg-[var(--tv-chart-red)]",
              )}
            />
            <span className="truncate capitalize">{monthLabel(cur.month, locale)}</span>
            {cur.live && <span className="rp-switch-live">{t("reports.inProgress")}</span>}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        )}
      />
      <button
        type="button"
        className="rp-switch-btn"
        onClick={() => newer && onChange(newer.month)}
        disabled={!newer}
        aria-label={t("reports.nextMonth")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
