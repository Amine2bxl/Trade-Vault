import { lazyPage } from "@/shared/lazy-page";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type CSSProperties,
} from "react";
import {
  Plus,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronRight,
  ClipboardCheck,
  Search,
  Target,
  Upload,
} from "@/shared/ui/icons";
import { Trade, isBreakEven } from "@/app/types";
import { computeStats, formatPnl, formatPct, formatShortDate } from "@/domain/tradeCalcs";
import { CHART_GREEN, CHART_RED } from "@/app/trading/chartTheme";
import { loadOnboarding, MONTHLY_TARGET_EVENT } from "@/app/store/profile";
import { useEdgeScore } from "@/app/trading/useEdgeScore";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useHasTradeDraft } from "@/app/utils/persistence";
import { PageContainer, Metric, Button, RollingFigure, ActionButton, density } from "@/shared/ui";
import { usePageActions, usePageLead } from "@/app/contexts/PageActionsContext";
import { DeferredFallback } from "@/app/shell/PageTransition";
import { cn } from "@/shared/ui/cn";
import { useGlidingIndicator } from "@/shared/ui/useGlidingIndicator";
import { tap } from "@/shared/haptics";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { newestFirst } from "@/app/trading/tradeOrder";
import { formatMoney } from "@/shared/currency";
import { useLiveTable } from "@/app/hooks/useLiveTable";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import AccountSwitcher from "@/app/shell/AccountSwitcher";
import { useUnreadCount } from "@/app/features/inbox/useUnreadCount";

// recharts (~150-200 KB) is loaded on demand: the Dashboard shell is eager
// (landing page), but the equity chart — below the fold — is code-split so it
// no longer weighs on the initial bundle.
const EquityChart = lazyPage(() => import("@/app/trading/EquityChart"));

interface DashboardProps {
  trades: Trade[];
  onAddTrade: () => void;
  tradesLoading?: boolean;
  onOpenChecklist?: () => void;
  /** Ouvre le plan de trading sur « Risque », où se règle l'objectif mensuel. */
  onSetObjective?: () => void;
  onOpenImport?: () => void;
  /** Ouvre un trade récent en édition. La liste affichait déjà un état `hover`
   *  qui promettait cette interaction sans la fournir. */
  onEditTrade?: (trade: Trade) => void;
  /** « Tout voir » — la liste est tronquée à 4, il faut un accès au reste. */
  onOpenJournal?: () => void;
}

/* 7J · 30J · 1A · TOUT. « YTD » (depuis le 1er janvier) laissait en janvier
   une courbe de quelques jours sous un bouton qui promettait l'année : 1A est
   une fenêtre glissante, toujours pleine. Un « ytd » mémorisé devient « 1y ». */
/* LES PÉRIODES DU TABLEAU DE BORD SONT CALENDAIRES (maquette Liquid v1) :
   « Mois » veut dire le mois en cours — « P&L net · octobre » —, pas les
   trente derniers jours. Les anciens choix enregistrés (fenêtres glissantes)
   sont convertis vers leur équivalent calendaire à la lecture. */
type Period = "day" | "week" | "month" | "year" | "all";
const PERIODS: Period[] = ["day", "week", "month", "year", "all"];
const PERIOD_STORAGE_KEY = "tv.dashboard.period";
const LEGACY_PERIOD: Record<string, Period> = {
  "7d": "week",
  "30d": "month",
  "1y": "year",
  ytd: "year",
};
const PERIOD_SHORT: Record<Period, TKey> = {
  day: "dashboard.pDay",
  week: "dashboard.pWeek",
  month: "dashboard.pMonth",
  year: "dashboard.pYear",
  all: "common.all",
};
const PERIOD_LONG: Record<Exclude<Period, "month">, TKey> = {
  day: "dashboard.pLongDay",
  week: "dashboard.pLongWeek",
  year: "dashboard.pLongYear",
  all: "dashboard.pLongAll",
};

/** Date locale `YYYY-MM-DD` — jamais `toISOString()` (UTC), qui décale le filtre
 *  d'un jour selon le fuseau et fait disparaître la journée la plus récente. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* Mesure avant la peinture côté client ; repli silencieux côté serveur. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function periodCutoff(period: Period): string | null {
  const now = new Date();
  if (period === "day") return localDateStr(now);
  if (period === "week") {
    // La semaine de trading commence le lundi.
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return localDateStr(d);
  }
  if (period === "month") return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  if (period === "year") return localDateStr(new Date(now.getFullYear(), 0, 1));
  return null;
}

/** Jours ouvrés (lun.–ven.) qui restent dans le mois APRÈS aujourd'hui. */
function tradingDaysLeftInMonth(now = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let n = 0;
  for (let day = now.getDate() + 1; day <= last; day++) {
    const wd = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export default function Dashboard({
  trades,
  onAddTrade,
  tradesLoading,
  onOpenChecklist,
  onSetObjective,
  // Déclaré dans `DashboardProps` et UTILISÉ dans l'état vide, mais il n'était
  // pas destructuré : la référence levait un ReferenceError au rendu du premier
  // écran d'un nouvel utilisateur. Vite ne typecheckant pas au build, le défaut
  // passait la CI.
  onOpenImport,
  onEditTrade,
  onOpenJournal,
}: DashboardProps) {
  const { t, lang } = useT();
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeAccount } = useAccounts();
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const raw = localStorage.getItem(PERIOD_STORAGE_KEY) ?? "";
      const saved = LEGACY_PERIOD[raw] ?? raw;
      return PERIODS.includes(saved as Period) ? (saved as Period) : "month";
    } catch {
      return "month";
    }
  });
  // La pilule des périodes glisse d'un choix à l'autre (même geste que les
  // onglets de section et le rail).
  const periodGlide = useGlidingIndicator<HTMLDivElement>(period);
  // Le solde de départ vient DU COMPTE ACTIF déjà chargé (AccountContext), pas
  // d'un `loadStartingBalance` séparé : cet aller-retour Supabase redondant se
  // résolvait APRÈS le premier rendu et re-peignait les chiffres (expectancy,
  // % de période, objectif) une seconde plus tard — le « chargement en deux
  // temps » du tableau de bord. La valeur est la même (même colonne `starting_balance`).
  const startingBalance = activeAccount?.startingBalance ?? 0;
  const [monthlyTarget, setMonthlyTarget] = useState<number | null>(null);
  const hasDraft = useHasTradeDraft(user?.id);
  // L'événement MONTHLY_TARGET_EVENT suit déjà les changements (ici ou ailleurs) ;
  // ceci couvre le rattrapage après une coupure, où aucun événement n'arrive.
  useLiveTable("profiles", () => {
    if (!user?.id) return;
    loadOnboarding(user.id)
      .then((o) => setMonthlyTarget(o.monthlyTarget ?? null))
      .catch(() => {});
  });

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
    // Réglé depuis le plan de trading ou les préférences : la jauge suit.
    const onTarget = (e: Event) => {
      const v = (e as CustomEvent<number | null>).detail;
      setMonthlyTarget(typeof v === "number" ? v : null);
    };
    window.addEventListener(MONTHLY_TARGET_EVENT, onTarget);
    return () => {
      active = false;
      window.removeEventListener(MONTHLY_TARGET_EVENT, onTarget);
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
  const recentTrades = useMemo(() => [...filtered].sort(newestFirst).slice(0, 6), [filtered]);

  /* ── UN ÉCRAN, PAS UNE PAGE ────────────────────────────────────────────
     Sur ordinateur, le tableau de bord tient dans la fenêtre : le héros garde
     sa hauteur naturelle, et les deux rangées (courbe + chiffres, derniers
     trades + objectif) se partagent ce qui reste, en PIXELS — un graphe en
     `height: 100%` ne se dessine que si toute la chaîne de parents a une
     hauteur définie (voir tests/fullScreenPages.test.ts). Trop court pour
     rester lisible (moins de 200px par rangée) : la page reprend son flux
     normal et défile, plutôt que d'écraser son contenu. */
  const { boxRef, height: available } = useAvailableHeight();
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroH, setHeroH] = useState(0);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const hasTrades = trades.length > 0 && !tradesLoading;
  useIsoLayoutEffect(() => {
    const el = heroRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => setHeroH((prev) => (prev === el.offsetHeight ? prev : el.offsetHeight));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasTrades]);
  const ROW_GAP = 16;
  /* La courbe est la PREMIÈRE donnée de la page : sa rangée prend 58 % de la
     place, les derniers trades et l'objectif se partagent le reste. */
  // 1 px de marge : les hauteurs mesurées sont arrondies, la somme pouvait
  // dépasser d'un pixel et faire apparaître une barre de défilement.
  const rest = wide && available && heroH ? available - heroH - ROW_GAP * 2 - 1 : null;
  // …sans jamais laisser moins de 180 px aux derniers trades et à l'objectif.
  const row1H = rest !== null ? Math.floor(Math.min(rest * 0.64, rest - 170)) : null;
  const rowH = rest !== null && row1H !== null ? rest - row1H : null;
  const fit = rowH !== null && row1H !== null && rowH >= 160 && row1H >= 180;
  /* Fenêtre basse (≈ 768 px) : le héros se resserre — la pilule du compte,
     déjà dans le rail, s'efface — pour rendre la place aux deux rangées. Le
     mode dépend de la place disponible, jamais de la hauteur du héros : pas
     de boucle de mesure. */
  const short = wide && available !== undefined && available < 700;
  const tight = fit && (rowH as number) < 250;
  const tightWidgets = fit && (row1H as number) < 260;
  // En-tête de carte (titre + marge) et rembourrage : ce que le contenu n'a pas.
  const CARD_CHROME = 86;
  // Hauteur d'une ligne de trade : 58 px, 50 px en rangée serrée (pastille de 36).
  const ROW_ITEM = tight ? 50 : 58;
  const listRows = fit
    ? Math.max(1, Math.min(6, Math.floor(((rowH as number) - CARD_CHROME) / ROW_ITEM)))
    : 4;
  const fitRow = fit ? ({ height: rowH as number } as CSSProperties) : undefined;
  const fitRow1 = fit ? ({ height: row1H as number } as CSSProperties) : undefined;

  // % variation of the period relative to the equity at its start
  // (starting balance + PnL accumulated before the period).
  const baseline = startingBalance + pnlBefore;
  const periodPct = baseline > 0 ? stats.totalPnl / baseline : null;

  /* LE TABLEAU DE BORD TIENT EN UN ÉCRAN (retour du propriétaire) : le
     copilote Jarvis et la série de checklist ont quitté la page — Jarvis
     reste à un appui (action ronde), la série vit sur la page Checklist, et
     le score de discipline garde sa tuile. */
  // Edge Score via le hook PARTAGÉ avec Jarvis : une seule définition de ce
  // score dans tout le produit.
  const edge = useEdgeScore(trades, user?.id);
  const today = localDateStr(new Date());

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
    const monthTrades = trades.filter((tr) => tr.date >= monthStart);
    return {
      currentPct: base > 0 ? monthPnl / base : 0,
      targetPct: monthlyTarget,
      monthPnl,
      targetAmount: monthlyTarget !== null && base > 0 ? monthlyTarget * base : null,
      monthDrawdown: computeStats(monthTrades).maxDrawdown,
      monthTrades: monthTrades.length,
    };
  }, [trades, startingBalance, monthlyTarget]);
  const daysLeft = tradingDaysLeftInMonth();
  const unread = useUnreadCount(user?.id);
  /* Le libellé de la période : « octobre » pour le mois en cours (le nom du
     mois dans la langue de l'app), sinon la période en toutes lettres. */
  const periodLabel =
    period === "month"
      ? new Date().toLocaleDateString(lang, { month: "long" })
      : t(PERIOD_LONG[period]);

  const gain = stats.totalPnl >= 0;
  /* `streakLabel` / `streakColor` ont été supprimés : la série s'affichait en
     pied de tuile, dans la grille de détail ET dans la carte de série — trois
     fois sur le même écran. Elle ne vit plus que dans la carte qui lui est
     consacrée. */

  const headerActions = useMemo(
    () => (
      /* L'EN-TÊTE DE LA MAQUETTE LIQUID v1 : la recherche (palette ⌘K), la
         cloche (boîte de réception, point d'accent s'il y a du non-lu) et
         l'ajout plein. Bureau seulement : sur téléphone, la barre du bas et
         les accès mobiles portent déjà ces trois gestes. */
      <div className="hidden shrink-0 items-center gap-2.5 md:flex">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("tv:open-palette"))}
          className="dash-search"
          aria-label={t("common.search")}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t("common.search")}</span>
          <kbd>⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: "inbox" } }))
          }
          className="dash-icon-btn"
          aria-label={t("nav.inbox")}
        >
          <Bell className="h-[17px] w-[17px]" aria-hidden />
          {unread > 0 && <span className="dash-icon-dot" aria-hidden />}
        </button>
        <Button variant="entry" size="sm" onClick={onAddTrade} className="tv-dashboard-add">
          <span className="tv-dashboard-add-icon">
            <Plus className="h-3.5 w-3.5" />
          </span>
          <span>{t("dashboard.actionTrade")}</span>
        </Button>
        {hasDraft && (
          <button type="button" onClick={onAddTrade} className="tv-draft-badge">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t("trade.draftBadge")}
          </button>
        )}
      </div>
    ),
    [onAddTrade, hasDraft, t, unread],
  );
  usePageActions(headerActions);

  /* ── LE RÉSUMÉ DU JOUR ──
     La barre de tête du Tableau de bord n'a pas d'onglets : sa moitié gauche
     était une bande vide au-dessus de la courbe. Elle porte maintenant la
     seule chose qu'un trader cherche avant tout le reste en ouvrant son
     journal — où en est LA JOURNÉE. Trois faits, une ligne, aucune phrase :
     la date, le P&L du jour, le nombre de trades. Rien qui ne soit déjà une
     donnée : ce n'est pas un message d'accueil. */
  const jour = useMemo(() => {
    const duJour = trades.filter((t) => t.date === today);
    return { pnl: duJour.reduce((s, t) => s + t.pnl, 0), n: duJour.length };
  }, [trades, today]);

  const dateLongue = useMemo(
    () =>
      new Date().toLocaleDateString(lang, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [lang],
  );

  const lead = useMemo(
    () => (
      /* Le SOUS-TITRE du grand titre : la date, puis où en est la journée —
         le P&L du jour et le nombre de trades, ou l'absence de trade. Rien
         qui ne soit déjà une donnée : ce n'est pas un message d'accueil. */
      <p className="dash-lead">
        <span className="dash-lead-date">{dateLongue}</span>
        <span aria-hidden>·</span>
        {jour.n === 0 ? (
          <span>{t("dashboard.noTradeToday")}</span>
        ) : (
          <>
            <span className={cn("tv-figure", jour.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {formatPnl(jour.pnl)}
            </span>
            <span className="tv-num">
              {jour.n} {jour.n > 1 ? t("dashboard.tradesToday") : t("dashboard.tradeToday")}
            </span>
          </>
        )}
      </p>
    ),
    [dateLongue, jour.n, jour.pnl, t],
  );
  usePageLead(lead);

  return (
    <PageContainer>
      <div
        ref={boxRef}
        className={cn(fit && "dash-fit", tight && "dash-tight", short && "dash-short")}
      >
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
              <div className="stat-card h-60 skeleton md:h-72" />
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
              <div className="glass rounded-3xl p-5 md:p-10 text-center  relative overflow-hidden">
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
                <h2 className="tv-title mb-2">{t("empty.title")}</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                  {t("empty.subtitle")}
                </p>
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
                  <div className="tv-label text-slate-500 mb-2">{t("empty.example")}</div>
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
                      <div className="tv-num text-[10px] text-slate-600">
                        10:03 · 2R · {formatMoney(150, { whole: true })} {t("dashboard.riskSuffix")}
                      </div>
                    </div>
                    <div className="tv-num text-sm font-bold text-emerald-400">
                      {formatMoney(300, { signed: true })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ══ LA MAQUETTE LIQUID v1 ══
                  1. le compte, le P&L de la période, sa fenêtre, la période,
                     les quatre actions rondes ;
                  2. la courbe d'equity (deux tiers) et quatre widgets qui
                     portent chacun leur échantillon ;
                  3. les derniers trades (deux tiers) et l'objectif du mois ;
                  4. la discipline (copilote, série) en dessous. */}
                <section ref={heroRef} className="dash-hero" aria-label={t("dashboard.netPnl")}>
                  <AccountSwitcher variant="pill" balance={startingBalance + stats.totalPnl} />
                  <span
                    className={cn(
                      "tv-figure dash-hero-figure",
                      gain ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {/* Le compteur Lucid : le P&L roule quand un trade le change. */}
                    <RollingFigure value={formatPnl(stats.totalPnl)} />
                  </span>
                  {/* Ce que le chiffre couvre, en mots : la période et
                    l'échantillon. Un P&L sans sa fenêtre ne se lit pas. */}
                  <p className="dash-hero-meta">
                    <span>{t("dashboard.netPnl")}</span>
                    <span aria-hidden>·</span>
                    <span>{periodLabel}</span>
                    <span aria-hidden>·</span>
                    <span className="tv-num">
                      {t("dashboard.periodTrades").replace("{n}", String(stats.totalTrades))}
                    </span>
                    {periodPct !== null && (
                      <span
                        className={cn(
                          "tv-figure tv-figure-secondary dash-hero-pct",
                          gain
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400",
                        )}
                      >
                        {periodPct >= 0 ? "+" : ""}
                        {(periodPct * 100).toFixed(2)}%
                      </span>
                    )}
                  </p>
                  <div
                    ref={periodGlide.trackRef}
                    className={cn("dash-period", periodGlide.on && "tv-glide-on")}
                    role="group"
                    aria-label={t("dashboard.periodAria")}
                  >
                    {periodGlide.style && (
                      <span
                        data-glide="1"
                        aria-hidden
                        className={cn(
                          "tv-glide tv-glide-period",
                          periodGlide.ready && "tv-glide-ready",
                        )}
                        style={periodGlide.style}
                      />
                    )}
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => changePeriod(p)}
                        aria-pressed={period === p}
                        className="dash-period-btn"
                      >
                        {t(PERIOD_SHORT[p])}
                      </button>
                    ))}
                  </div>
                  <div className="dash-hero-actions">
                    <ActionButton
                      variant="primary"
                      icon={<Plus strokeWidth={2.4} />}
                      label={t("dashboard.actionTrade")}
                      onClick={() => {
                        tap();
                        onAddTrade();
                      }}
                    />
                    {onOpenImport && (
                      <ActionButton
                        icon={<Upload />}
                        label={t("dashboard.actionImport")}
                        onClick={onOpenImport}
                      />
                    )}
                    {onOpenChecklist && (
                      <ActionButton
                        icon={<ClipboardCheck />}
                        label={t("dashboard.actionChecklist")}
                        onClick={onOpenChecklist}
                      />
                    )}
                    <ActionButton
                      icon={<Bot />}
                      label={t("nav.jarvis")}
                      onClick={() => window.dispatchEvent(new CustomEvent("tv:open-jarvis"))}
                    />
                  </div>
                </section>

                {/* ── 2. LA COURBE ET SES QUATRE CHIFFRES ── */}
                <div className="dash-grid">
                  <div
                    className="stat-card-elevated dash-span-2 overflow-hidden p-4 md:p-5"
                    style={fitRow1}
                  >
                    <div className="dash-card-head">
                      <div className="flex min-w-0 items-center gap-4">
                        <h2 className="dash-card-title">{t("dashboard.equityCurve")}</h2>
                        {/* La légende monte dans l'en-tête : la courbe garde toute
                            la hauteur de la carte. */}
                        <span className="dash-legend" aria-hidden>
                          <i style={{ background: CHART_GREEN }} />
                          {t("chart.balance")}
                        </span>
                        <span className="dash-legend" aria-hidden>
                          <i style={{ background: CHART_RED }} />
                          {t("chart.breakEven")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="dash-link"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("tv:navigate", { detail: { page: "analytics" } }),
                          )
                        }
                      >
                        {t("common.viewAll")}
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    {stats.equityCurve.length > 0 ? (
                      <div
                        className={cn("chart-draw", !fit && "h-48 md:h-60")}
                        style={fit ? { height: (row1H as number) - CARD_CHROME } : undefined}
                      >
                        <Suspense
                          fallback={
                            <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.03]" />
                          }
                        >
                          <EquityChart data={stats.equityCurve} legend={false} />
                        </Suspense>
                      </div>
                    ) : (
                      <div className="h-48 md:h-60 flex items-center justify-center text-slate-600 text-sm">
                        {t("dashboard.noTradesInPeriod")}
                      </div>
                    )}
                  </div>

                  {/* Chaque widget affiche son échantillon : un chiffre sans
                    son `n` ne se lit pas (AGENTS.md). */}
                  <div className="dash-widgets" style={fitRow1}>
                    <Metric
                      compact={tightWidgets}
                      title={t("stats.winRate")}
                      value={stats.wins + stats.losses > 0 ? formatPct(stats.winRate) : "—"}
                      valueClass={
                        stats.wins + stats.losses === 0
                          ? undefined
                          : stats.winRate >= 0.5
                            ? "text-emerald-400"
                            : "text-red-400"
                      }
                      visual={{
                        kind: "track",
                        pct: stats.winRate,
                        color: stats.winRate >= 0.5 ? CHART_GREEN : CHART_RED,
                      }}
                      subtitle={t("dashboard.sampleTrades").replace(
                        "{n}",
                        String(stats.wins + stats.losses),
                      )}
                      delay={0}
                    />
                    <Metric
                      compact={tightWidgets}
                      title={t("dashboard.profitFactor")}
                      value={stats.profitFactor === null ? "—" : stats.profitFactor.toFixed(2)}
                      valueClass={
                        stats.profitFactor !== null && stats.profitFactor >= 1.5
                          ? "text-emerald-400"
                          : stats.profitFactor !== null && stats.profitFactor < 1
                            ? "text-red-400"
                            : undefined
                      }
                      visual={{
                        kind: "track",
                        pct: stats.profitFactor === null ? 0 : Math.min(stats.profitFactor / 3, 1),
                        color:
                          stats.profitFactor !== null && stats.profitFactor >= 1
                            ? CHART_GREEN
                            : CHART_RED,
                      }}
                      subtitle={t("dashboard.sampleTrades").replace(
                        "{n}",
                        String(stats.totalTrades),
                      )}
                      delay={40}
                    />
                    <Metric
                      compact={tightWidgets}
                      title={t("dashboard.avgR")}
                      value={
                        stats.avgRR === null
                          ? "—"
                          : `${stats.avgRR >= 0 ? "+" : "−"}${Math.abs(stats.avgRR).toFixed(2)} R`
                      }
                      valueClass={
                        stats.avgRR === null
                          ? undefined
                          : stats.avgRR >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }
                      visual={{
                        kind: "track",
                        pct: stats.avgRR === null ? 0 : Math.min(Math.abs(stats.avgRR) / 2, 1),
                        color: stats.avgRR !== null && stats.avgRR < 0 ? CHART_RED : CHART_GREEN,
                      }}
                      subtitle={t("dashboard.sampleTrades").replace(
                        "{n}",
                        String(stats.rSampleSize),
                      )}
                      delay={80}
                    />
                    <Metric
                      compact={tightWidgets}
                      title={t("dashboard.discipline")}
                      value={edge.score === null ? "—" : `${Math.round(edge.score)}/100`}
                      visual={{ kind: "track", pct: edge.score === null ? 0 : edge.score / 100 }}
                      subtitle={t("dashboard.sampleSessions").replace(
                        "{n}",
                        String(edge.tradedDays),
                      )}
                      delay={120}
                    />
                  </div>
                </div>

                {/* ── 3. LES DERNIERS TRADES ET L'OBJECTIF ── */}
                <div className="dash-grid">
                  <div className="stat-card dash-span-2 overflow-hidden p-4 md:p-5" style={fitRow}>
                    <div className="dash-card-head">
                      <h2 className="dash-card-title">{t("dashboard.recentTrades")}</h2>
                      {onOpenJournal && (
                        <button type="button" className="dash-link" onClick={onOpenJournal}>
                          {t("common.viewAll")}
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                    {recentTrades.length === 0 ? (
                      <div className="py-10 text-center text-sm text-slate-600">
                        {t("dashboard.noTradesInPeriod")}
                      </div>
                    ) : (
                      <div className="dash-list">
                        {recentTrades.slice(0, listRows).map((trade) => {
                          const be = isBreakEven(trade);
                          const RowTag = onEditTrade ? "button" : "div";
                          const side =
                            trade.direction === "long"
                              ? t("common.long")
                              : trade.direction === "short"
                                ? t("common.short")
                                : "BE";
                          const r = trade.rMultiple;
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
                              className={cn("dash-row", onEditTrade && "dash-row-action")}
                            >
                              <span className="dash-row-avatar" aria-hidden>
                                {trade.symbol.slice(0, 3)}
                              </span>
                              <span className="dash-row-main">
                                <span className="dash-row-title">
                                  {trade.symbol} · {side}
                                </span>
                                <span className="dash-row-sub tv-num">
                                  {formatShortDate(trade.date)}
                                  {trade.entryTime ? ` · ${trade.entryTime}` : ""}
                                  {trade.quantity
                                    ? ` · ${trade.quantity} ${t("trade.contracts")}`
                                    : ""}
                                </span>
                              </span>
                              <span className="dash-row-end">
                                <span
                                  className={cn(
                                    "tv-figure dash-row-pnl",
                                    be
                                      ? "text-slate-300"
                                      : trade.pnl >= 0
                                        ? "text-emerald-400"
                                        : "text-red-400",
                                  )}
                                >
                                  {formatPnl(trade.pnl)}
                                </span>
                                <span className="dash-row-sub tv-num">
                                  {r >= 0 ? "+" : "−"}
                                  {Math.abs(r).toFixed(1)} R
                                </span>
                              </span>
                            </RowTag>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="stat-card dash-goal overflow-hidden p-4 md:p-5" style={fitRow}>
                    <div className="dash-card-head">
                      <h2 className="dash-card-title">{t("copilot.objTitle")}</h2>
                      <Target className="h-4 w-4 text-slate-500" aria-hidden />
                    </div>
                    {objective.targetPct !== null && objective.targetAmount !== null ? (
                      <>
                        <span className="tv-figure dash-goal-figure">
                          {formatPct(
                            objective.targetAmount > 0
                              ? Math.max(0, objective.monthPnl / objective.targetAmount)
                              : 0,
                          )}
                        </span>
                        <span className="dash-row-sub tv-num">
                          {t("dashboard.objOf")
                            .replace("{a}", formatMoney(objective.monthPnl, { whole: true }))
                            .replace("{b}", formatMoney(objective.targetAmount, { whole: true }))}
                        </span>
                        <span className="dash-goal-track" aria-hidden>
                          <span
                            className="metric-bar-fill"
                            style={
                              {
                                "--metric-fill":
                                  objective.targetAmount > 0
                                    ? Math.max(
                                        0,
                                        Math.min(1, objective.monthPnl / objective.targetAmount),
                                      )
                                    : 0,
                              } as CSSProperties
                            }
                          />
                        </span>
                      </>
                    ) : (
                      onSetObjective && (
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={onSetObjective}
                          className="self-start"
                        >
                          <Target className="h-4 w-4" aria-hidden />
                          {t("copilot.objNone")}
                        </Button>
                      )
                    )}
                    <div className="dash-goal-tiles">
                      <span className="dash-goal-tile">
                        <small className="tv-label">{t("dashboard.monthDrawdown")}</small>
                        <b className="tv-figure">
                          {objective.monthTrades > 0
                            ? formatMoney(objective.monthDrawdown, { whole: true })
                            : "—"}
                        </b>
                      </span>
                      <span className="dash-goal-tile">
                        <small className="tv-label">{t("dashboard.daysLeft")}</small>
                        <b className="tv-figure">{daysLeft}</b>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
