import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Plus, BarChart3, ArrowUpRight, ArrowDownRight, Minus, LineChart } from "lucide-react";
import { Trade, isBreakEven } from "../types";
import {
  computeStats,
  formatPnl,
  formatPct,
  formatShortDate,
  directionLabel,
  directionBadgeClass,
} from "../utils/tradeCalcs";
import { computeQuantStats } from "../utils/quantStats";
import { loadOnboarding } from "../store/profile";
import { deriveDailyRule } from "../utils/edgeScore";
import { useEdgeScore } from "../hooks/useEdgeScore";
import {
  readHistory,
  writeHistory,
  appendToday,
  dayOverDayDelta,
  trend,
  type EdgePoint,
} from "../utils/edgeHistory";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useToast } from "../contexts/ToastContext";
import { useHasTradeDraft } from "../utils/persistence";
import { PageContainer, Metric, Card, Button, StreakCard, density } from "@/shared/ui";
import type { StreakPeriod } from "@/shared/ui";
import { usePageActions } from "../contexts/PageActionsContext";
import CopilotBlock from "./dashboard/CopilotBlock";
import { DeferredFallback } from "../components/PageTransition";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { computeChecklistStreakStats, recentChecklistPeriods } from "../utils/checklistStreak";

// recharts (~150-200 KB) is loaded on demand: the Dashboard shell is eager
// (landing page), but the equity chart — below the fold — is code-split so it
// no longer weighs on the initial bundle.
const EquityChart = lazy(() => import("../components/EquityChart"));

interface DashboardProps {
  trades: Trade[];
  onAddTrade: () => void;
  tradesLoading?: boolean;
  onOpenChecklist?: () => void;
  onOpenImport?: () => void;
  /** Ouvre un trade récent en édition. La liste affichait déjà un état `hover`
   *  qui promettait cette interaction sans la fournir. */
  onEditTrade?: (trade: Trade) => void;
  /** « Tout voir » — la liste est tronquée à 4, il faut un accès au reste. */
  onOpenJournal?: () => void;
}

type Period = "7d" | "30d" | "ytd" | "all";
const PERIODS: Period[] = ["7d", "30d", "ytd", "all"];
const PERIOD_STORAGE_KEY = "tv.dashboard.period";

/** Date locale `YYYY-MM-DD` — jamais `toISOString()` (UTC), qui décale le filtre
 *  d'un jour selon le fuseau et fait disparaître la journée la plus récente. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function periodCutoff(period: Period): string | null {
  const now = new Date();
  if (period === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return localDateStr(d);
  }
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return localDateStr(d);
  }
  if (period === "ytd") return `${now.getFullYear()}-01-01`;
  return null;
}

export default function Dashboard({
  trades,
  onAddTrade,
  tradesLoading,
  onOpenChecklist,
  // Déclaré dans `DashboardProps` et UTILISÉ dans l'état vide, mais il n'était
  // pas destructuré : la référence levait un ReferenceError au rendu du premier
  // écran d'un nouvel utilisateur. Vite ne typecheckant pas au build, le défaut
  // passait la CI.
  onOpenImport,
  onEditTrade,
  onOpenJournal,
}: DashboardProps) {
  const { t } = useT();
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeAccount } = useAccounts();
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
      return PERIODS.includes(saved as Period) ? (saved as Period) : "all";
    } catch {
      return "all";
    }
  });
  // Le solde de départ vient DU COMPTE ACTIF déjà chargé (AccountContext), pas
  // d'un `loadStartingBalance` séparé : cet aller-retour Supabase redondant se
  // résolvait APRÈS le premier rendu et re-peignait les chiffres (expectancy,
  // % de période, objectif) une seconde plus tard — le « chargement en deux
  // temps » du tableau de bord. La valeur est la même (même colonne `starting_balance`).
  const startingBalance = activeAccount?.startingBalance ?? 0;
  const [monthlyTarget, setMonthlyTarget] = useState<number | null>(null);
  const hasDraft = useHasTradeDraft(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    loadOnboarding(user.id)
      .then((o) => {
        if (active) setMonthlyTarget(o.monthlyTarget ?? null);
      })
      .catch(() => {
        if (active) toast(t("dashboard.loadError"), "error");
      });
    return () => {
      active = false;
    };
  }, [user?.id, toast, t]);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, p);
    } catch {
      /* best-effort persistence — ignore */
    }
  };

  const cutoff = periodCutoff(period);
  const { filtered, pnlBefore } = useMemo(() => {
    if (!cutoff) return { filtered: trades, pnlBefore: 0 };
    let before = 0;
    const list: Trade[] = [];
    for (const tr of trades) {
      if (tr.date >= cutoff) list.push(tr);
      else before += tr.pnl;
    }
    return { filtered: list, pnlBefore: before };
  }, [trades, cutoff]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const quant = useMemo(
    () => computeQuantStats(filtered, startingBalance),
    [filtered, startingBalance],
  );
  const recentTrades = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
    [filtered],
  );

  // Extra at-a-glance context for the period: how many days actually traded,
  // average per trading day, and the long/short lean of the sample.
  const insight = useMemo(() => {
    const tradingDays = Object.keys(stats.dailyPnl).length;
    const avgPerDay = tradingDays > 0 ? stats.totalPnl / tradingDays : 0;
    const directional = filtered.filter((tr) => tr.direction !== "be");
    const longs = directional.filter((tr) => tr.direction === "long").length;
    const longShare = directional.length > 0 ? longs / directional.length : null;
    return { tradingDays, avgPerDay, longShare, longs, shorts: directional.length - longs };
  }, [stats.dailyPnl, stats.totalPnl, filtered]);

  // % variation of the period relative to the equity at its start
  // (starting balance + PnL accumulated before the period).
  const baseline = startingBalance + pnlBefore;
  const periodPct = baseline > 0 ? stats.totalPnl / baseline : null;

  // Pre-market checklist status (written by the Checklist page in localStorage)
  const chkStatus = useMemo(() => {
    if (!user) return null;
    try {
      const key = `tv-chk-${user.id}-${localDateStr(new Date())}`;
      const raw = localStorage.getItem(key);
      if (!raw) return { locked: false, n: 0, total: 0 };
      const p = JSON.parse(raw) as { locked?: boolean; checked?: boolean[] };
      const arr = Array.isArray(p.checked) ? p.checked : [];
      return { locked: !!p.locked, n: arr.filter(Boolean).length, total: arr.length };
    } catch {
      return null;
    }
  }, [user?.id]);

  // ── Série de checklist (la mécanique de rétention du rituel) ──
  // Lecture seule de l'historique `tv-chk-*` déjà écrit par la page Checklist :
  // aucune nouvelle donnée stockée, aucune migration. La série suit la routine
  // pré-market — la seule surface du produit qui intervient avant le trade.
  const streak = useMemo(() => {
    if (!user?.id) return { current: 0, longest: 0, total: 0, doneToday: false, atRisk: false };
    try {
      return computeChecklistStreakStats(window.localStorage, user.id);
    } catch {
      return { current: 0, longest: 0, total: 0, doneToday: false, atRisk: false };
    }
  }, [user?.id]);

  const streakPeriods = useMemo<StreakPeriod[]>(() => {
    if (!user?.id) return [];
    try {
      return recentChecklistPeriods(window.localStorage, user.id, 7);
    } catch {
      return [];
    }
  }, [user?.id]);

  // ── Copilot block: Edge Score, rule of the day, objective ──
  // Edge Score via le hook PARTAGÉ avec Jarvis : une seule définition de ce
  // score dans tout le produit. L'assemblage des entrées (checklist par jour,
  // risque max, solde initial) vit désormais dans `useEdgeScore`.
  const edge = useEdgeScore(trades, user?.id);

  const dailyRule = useMemo(() => deriveDailyRule(computeStats(trades)), [trades]);

  // ── Trajectoire de discipline ──────────────────────────────────────────────
  // On conserve un HISTORIQUE borné du score, pas seulement l'instantané de la
  // veille : le delta jour/jour dit « tu as monté depuis hier », il ne dit pas
  // « tu progresses ». La logique vit dans un module pur et testé
  // (`utils/edgeHistory.ts`), ici on ne fait que la brancher.
  const today = localDateStr(new Date());
  const [edgeHistory, setEdgeHistory] = useState<EdgePoint[]>([]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    setEdgeHistory(readHistory(window.localStorage, user.id));
  }, [user?.id]);

  // Enregistre (ou réécrit) le score du jour : il bouge à chaque trade ajouté,
  // c'est la valeur de fin de journée qui fait foi.
  useEffect(() => {
    if (!user || edge.score === null || typeof window === "undefined") return;
    setEdgeHistory((prev) => {
      const next = appendToday(prev, today, edge.score as number);
      writeHistory(window.localStorage, user.id, next);
      return next;
    });
  }, [user?.id, edge.score, today]);

  const edgeDelta = useMemo(
    () => (edge.score === null ? null : dayOverDayDelta(edgeHistory, today, edge.score)),
    [edgeHistory, edge.score, today],
  );

  const edgeTrend = useMemo(() => trend(edgeHistory), [edgeHistory]);

  // Monthly objective: current-month PnL as a fraction of the month's opening
  // equity (starting balance + PnL accumulated before this month).
  const objective = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    let monthPnl = 0;
    let before = 0;
    for (const tr of trades) {
      if (tr.date >= monthStart) monthPnl += tr.pnl;
      else before += tr.pnl;
    }
    const base = startingBalance + before;
    return { currentPct: base > 0 ? monthPnl / base : 0, targetPct: monthlyTarget };
  }, [trades, startingBalance, monthlyTarget]);

  const gain = stats.totalPnl >= 0;
  /* `streakLabel` / `streakColor` ont été supprimés : la série s'affichait en
     pied de tuile, dans la grille de détail ET dans la carte de série — trois
     fois sur le même écran. Elle ne vit plus que dans la carte qui lui est
     consacrée. */

  const headerActions = useMemo(
    () => (
      <Button variant="accent" onClick={onAddTrade} className="relative hidden md:flex">
        <Plus className="w-4 h-4" /> {t("common.addTrade")}
        {hasDraft && (
          <span className="flex items-center gap-1 ml-1 pl-2 border-l border-white/25 text-[10px] font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" /> {t("trade.draftBadge")}
          </span>
        )}
      </Button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onAddTrade, hasDraft, t],
  );
  usePageActions(headerActions);

  return (
    <PageContainer>
      {/* Le « Bonjour » horodaté a été retiré. C'était la PREMIÈRE chose que
          l'œil rencontrait sur la page la plus consultée du produit, et il ne
          portait aucune information : ni un chiffre, ni un état, ni une action.
          Le premier objet de la page est désormais le seul qui compte à
          l'ouverture — le P&L. */}
      {/* Frame paints instantly; data sections show a skeleton only while the
          first trades load. The skeleton is deferred (>320 ms) so it never
          flashes for the 50 ms it takes the React Query cache to re-read. */}
      {tradesLoading ? (
        <DeferredFallback reserve="min-h-[420px]">
          {/* Le squelette suit la MÊME hiérarchie que la page : le hero
              d'abord, les quatre tuiles ensuite. Il annonçait l'ordre inverse
              — c'est-à-dire qu'il promettait une mise en page qui n'existe
              plus, et le contenu réel sautait par-dessus en arrivant. */}
          <div className={cn(density.sectionGap)}>
            <div className="stat-card h-72 skeleton md:h-80" />
          </div>
          <div className={cn("grid grid-cols-2 md:grid-cols-4", density.gridGap)}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card h-28 skeleton" />
            ))}
          </div>
        </DeferredFallback>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════
              LA HIÉRARCHIE DE LA PAGE — quatre niveaux, dans cet ordre.

              Avant, la page ouvrait sur un « Bonjour » puis quatre tuiles, et
              le P&L du mois — la seule chose qu'un trader vient vérifier en
              ouvrant son journal — apparaissait DEUX FOIS : en petit dans la
              première tuile, puis en grand au tiers de la page. Le win rate y
              était aussi deux fois, le R:R deux fois, la série trois fois. Une
              vingtaine de chiffres se disputaient le même rang.

                1. LE CHIFFRE — le P&L de la période et sa courbe, pleine
                   largeur, seul en haut. Rien ne le concurrence.
                2. LES QUATRE AUTRES — ce que le hero ne dit PAS : win rate,
                   profit factor, R:R, drawdown max. Un chiffre par tuile, et
                   aucun qui soit déjà affiché ailleurs.
                3. LA DISCIPLINE — le focus du jour et la série. C'est de la
                   conduite, pas de la performance : ça vient après.
                4. LE DÉTAIL — les statistiques secondaires et les derniers
                   trades. On y descend quand on cherche, pas quand on ouvre.
              ══════════════════════════════════════════════════════════════ */}
          {trades.length === 0 ? (
            /* ── Empty state: first-run experience ── */
            <div className="glass rounded-3xl p-5 md:p-10 text-center card-premium  relative overflow-hidden">
              <svg
                viewBox="0 0 200 80"
                className="w-48 md:w-64 mx-auto mb-6 opacity-80"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="emptyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--tv-highlight)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--tv-highlight)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 68 L36 52 L62 60 L96 30 L128 40 L162 14 L196 22"
                  fill="none"
                  stroke="var(--tv-highlight)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 68 L36 52 L62 60 L96 30 L128 40 L162 14 L196 22 L196 78 L4 78 Z"
                  fill="url(#emptyGrad)"
                  stroke="none"
                />
                <circle cx="162" cy="14" r="3.5" fill="var(--tv-highlight)" />
              </svg>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">{t("empty.title")}</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">{t("empty.subtitle")}</p>
              <Button variant="accent" onClick={onAddTrade}>
                <Plus className="w-4 h-4" /> {t("empty.cta")}
              </Button>
              {onOpenImport && (
                <button
                  onClick={onOpenImport}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
                >
                  {t("settings.importCsv")}
                </button>
              )}
              {/* Ghost example of what a logged trade looks like */}
              <div
                className="max-w-sm mx-auto mt-8 text-left opacity-50 pointer-events-none select-none"
                aria-hidden="true"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  {t("empty.example")}
                </div>
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 border-dashed">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">NQ</span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        L
                      </span>
                      <span className="text-[10px] text-slate-600">Silver Bullet</span>
                    </div>
                    <div className="text-[10px] text-slate-600">
                      10:03 · 2R · $150 {t("dashboard.riskSuffix")}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">+$300.00</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ── 1. LE CHIFFRE ── */}
              <div className={cn(density.sectionGap)}>
                {/* Performance */}
                <div className="relative stat-card-elevated card-premium overflow-hidden p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                        <LineChart className="w-3.5 h-3.5 text-slate-500" />
                        {t("dashboard.equityCurve")}
                      </div>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span
                          className={cn(
                            "tv-figure text-3xl md:text-4xl",
                            gain ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {formatPnl(stats.totalPnl)}
                        </span>
                        {periodPct !== null && (
                          <span
                            className={cn(
                              "text-xs md:text-sm font-bold px-2 py-0.5 rounded-lg tabular-nums",
                              gain
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400",
                            )}
                          >
                            {periodPct >= 0 ? "+" : ""}
                            {(periodPct * 100).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Le sélecteur de période emprunte le contrôle segmenté du
                        produit (`.section-tabs`) au lieu de re-dériver le sien :
                        une seule grammaire pour « je choisis UNE vue parmi N »,
                        du haut de page jusqu'ici. */}
                    <div className="section-tabs shrink-0">
                      {PERIODS.map((p) => (
                        <button
                          key={p}
                          onClick={() => changePeriod(p)}
                          className={cn(
                            "section-tab px-2.5 text-[11px] uppercase md:px-3.5 md:text-xs",
                            period === p ? "section-tab-active" : "section-tab-idle",
                          )}
                        >
                          {p === "7d"
                            ? "7D"
                            : p === "30d"
                              ? "30D"
                              : p === "ytd"
                                ? "YTD"
                                : t("common.all")}
                        </button>
                      ))}
                    </div>
                  </div>
                  {stats.equityCurve.length > 0 ? (
                    <div className="h-56 md:h-72 chart-draw">
                      <Suspense
                        fallback={
                          <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.03]" />
                        }
                      >
                        <EquityChart data={stats.equityCurve} />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="h-56 md:h-72 flex items-center justify-center text-slate-600 text-sm">
                      {t("dashboard.noTradesInPeriod")}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 2. LES QUATRE AUTRES ──
                  Chacune de ces tuiles porte UN chiffre qui n'existe nulle part
                  ailleurs sur la page. Ce qui a sauté :
                    • « P&L total » — le hero l'affiche déjà, en quatre fois
                      plus gros, juste au-dessus.
                    • « Trades » — la grille de détail le donne, et le nombre
                      brut de trades ne se lit pas au réveil.
                  Ce qui les remplace : profit factor et drawdown max, les deux
                  chiffres qu'une prop firm regarde et que la page cachait au
                  fond d'une grille de huit lignes.

                  Les sous-titres ont sauté aussi. « Today $0.00 » était codé en
                  dur — il affichait un zéro quoi qu'il arrive, donc un faux
                  chiffre. « Avg Win / Loss » et « N trading days » étaient de
                  l'anglais en dur dans une application traduite en douze
                  langues, et ne décrivaient même pas la valeur au-dessus. */}
              <div
                className={cn(
                  "grid grid-cols-2 md:grid-cols-4",
                  density.gridGap,
                  density.sectionGap,
                )}
              >
                <Metric
                  title={t("stats.winRate")}
                  value={formatPct(stats.winRate)}
                  valueClass={stats.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"}
                  visual={{
                    kind: "radial",
                    pct: stats.winRate,
                    color: stats.winRate >= 0.5 ? "#10b981" : "#ef4444",
                    center: `${stats.wins}/${stats.losses}`,
                  }}
                  delay={0}
                />
                <Metric
                  title={t("dashboard.profitFactor")}
                  value={stats.profitFactor >= 99 ? "99+" : stats.profitFactor.toFixed(2)}
                  valueClass={
                    stats.profitFactor >= 1.5
                      ? "text-emerald-400"
                      : stats.profitFactor < 1
                        ? "text-red-400"
                        : undefined
                  }
                  visual={{
                    kind: "bar",
                    pct: Math.min(stats.profitFactor / 3, 1),
                    color: stats.profitFactor >= 1 ? "#10b981" : "#ef4444",
                  }}
                  delay={40}
                />
                <Metric
                  title={t("dashboard.avgRR")}
                  value={stats.avgRR.toFixed(2)}
                  valueClass={stats.avgRR >= 1 ? "text-emerald-400" : undefined}
                  visual={{
                    kind: "bar",
                    pct: Math.min(stats.avgRR / 3, 1),
                    color: stats.avgRR >= 1 ? "#10b981" : "#ef4444",
                  }}
                  delay={80}
                />
                <Metric
                  title={t("dashboard.maxDrawdown")}
                  value={formatPnl(-stats.maxDrawdown)}
                  valueClass="text-red-400"
                  delay={120}
                />
              </div>

              {/* ── 3. LA DISCIPLINE ── */}
              {/* Copilot block + série de checklist — le focus du jour + la discipline
                dans la durée, côte à côte. */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-4 md:gap-5 mb-4 md:mb-6">
                <CopilotBlock
                  edge={edge}
                  edgeDelta={edgeDelta}
                  edgeTrend={edgeTrend}
                  edgeScores={edgeHistory.map((p) => p.score)}
                  rule={dailyRule}
                  checklist={chkStatus}
                  objective={objective}
                  onOpenChecklist={onOpenChecklist}
                />
                <StreakCard
                  streak={streakPeriods}
                  currentStreak={streak.current}
                  longestStreak={streak.longest}
                  total={streak.total}
                  title={t("streak.title")}
                  daysLabel={t("streak.days")}
                  longestLabel={t("streak.longest")}
                  totalLabel={t("streak.total")}
                  actionLabel={t("streak.viewChecklist")}
                  onActionClick={onOpenChecklist}
                  howItWorksTitle={t("streak.howItWorks")}
                  howItWorksItems={[
                    t("streak.howItWorks.i1"),
                    t("streak.howItWorks.i2"),
                    t("streak.howItWorks.i3"),
                  ]}
                  className="animate-fade-in-up stagger-1"
                />
              </div>

              {/* ── 4. LE DÉTAIL ── */}
              <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                {/* Statistics */}
                <div className="stat-card overflow-hidden">
                  <div className="px-4 md:px-5 py-3 md:py-4 border-b border-[var(--tv-border)] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm md:text-[15px] font-bold text-white">
                      {t("stats.performance")}
                    </h3>
                  </div>
                  <div className="p-3 md:p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    {/* Win rate, profit factor, R:R et drawdown max ne sont plus
                        ici : ils ont leur tuile, en haut. Une statistique
                        affichée deux fois sur le même écran n'est pas
                        « rassurante », elle fait douter qu'il s'agisse de la
                        même. La grille garde ce qui est réellement secondaire. */}
                    <StatRow
                      label={t("quant.expectancy")}
                      value={formatPnl(quant.expectancy)}
                      valueClass={quant.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}
                    />
                    <StatRow
                      label={t("quant.cleanTrades")}
                      value={formatPct(quant.cleanTrades)}
                      valueClass={quant.cleanTrades >= 0.8 ? "text-emerald-400" : "text-amber-400"}
                    />
                    <StatRow
                      label={t("stats.trades")}
                      value={String(stats.totalTrades)}
                      sub={`${insight.tradingDays} ${t("dashboard.tradingDays").toLowerCase()}`}
                    />
                    <StatRow
                      label={t("dashboard.bestWorst")}
                      value={stats.bestTrade ? formatPnl(stats.bestTrade.pnl) : "—"}
                      sub={stats.worstTrade ? formatPnl(stats.worstTrade.pnl) : "—"}
                      valueClass="text-emerald-400"
                    />
                    <StatRow
                      label={t("dashboard.longShort")}
                      value={
                        insight.longShare !== null
                          ? `${Math.round(insight.longShare * 100)}% L`
                          : "—"
                      }
                      sub={`${insight.longs}L · ${insight.shorts}S`}
                    />
                  </div>
                </div>
                {/* Recent Trades */}
                <Card variant="solid" hover className="overflow-hidden">
                  <div className="px-4 md:px-5 py-3 md:py-4 border-b border-[var(--tv-border)] flex items-center justify-between gap-3">
                    <h3 className="text-sm md:text-[15px] font-bold text-white">
                      {t("dashboard.recentTrades")}
                    </h3>
                    {onOpenJournal && trades.length > recentTrades.length && (
                      <button
                        onClick={onOpenJournal}
                        className="text-xs font-semibold text-[var(--tv-highlight)] hover:text-white transition-colors shrink-0"
                      >
                        {t("common.viewAll")}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-[var(--tv-border)]">
                    {recentTrades.length === 0 ? (
                      <div className="px-4 py-10 text-center text-slate-600 text-sm">
                        {t("dashboard.noTradesInPeriod")}
                      </div>
                    ) : (
                      recentTrades.map((trade) => {
                        const be = isBreakEven(trade);
                        const RowTag = onEditTrade ? "button" : "div";
                        return (
                          <RowTag
                            key={trade.id}
                            {...(onEditTrade
                              ? {
                                  type: "button" as const,
                                  onClick: () => onEditTrade(trade),
                                  "aria-label": `${t("common.edit")} ${trade.symbol} ${formatShortDate(trade.date)}`,
                                }
                              : {})}
                            className={cn(
                              "px-4 md:px-5 py-3 trade-card flex items-center gap-3 transition-colors",
                              onEditTrade
                                ? "w-full text-left hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none cursor-pointer"
                                : "hover:bg-white/[0.02]",
                            )}
                          >
                            <div
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
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
                              <div className="flex items-center gap-2">
                                <span className="text-sm md:text-[15px] font-bold text-white">
                                  {trade.symbol}
                                </span>
                                <span
                                  className={cn(
                                    "text-[11px] font-bold px-1.5 py-0.5 rounded",
                                    directionBadgeClass(trade.direction),
                                  )}
                                >
                                  {directionLabel(trade.direction)}
                                </span>
                                <span className="hidden md:inline text-[11px] text-slate-500">
                                  {trade.strategy}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatShortDate(trade.date)} · {trade.rMultiple.toFixed(1)}R
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={cn(
                                  "text-sm md:text-base font-bold tabular-nums",
                                  be
                                    ? "text-slate-300"
                                    : trade.pnl >= 0
                                      ? "text-emerald-400"
                                      : "text-red-400",
                                )}
                              >
                                {formatPnl(trade.pnl)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ${trade.riskAmount.toFixed(0)} {t("dashboard.riskSuffix")}
                              </div>
                            </div>
                          </RowTag>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}

function StatRow({
  label,
  value,
  sub,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold truncate">
        {label}
      </div>
      <div className={cn("tv-figure text-sm md:text-base truncate mt-0.5", valueClass)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-600 tabular-nums truncate">{sub}</div>}
    </div>
  );
}
