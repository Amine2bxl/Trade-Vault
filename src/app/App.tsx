import { useState, useCallback, useEffect, useRef, lazy, Suspense, startTransition } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "./components/Sidebar";
import ChartDefs from "./components/ChartDefs";
import MobileNav from "./components/MobileNav";
import MobileActions from "./components/MobileActions";
import SectionTabs from "./components/SectionTabs";
import { pagesOfSection, sectionForPage } from "./navigation";
import { cn } from "./utils/cn";
// Dashboard is the landing page — keep it in the main chunk. Every other page
// (and its heavy deps: recharts, react-markdown) loads on demand.
import Dashboard from "./pages/Dashboard";
// Les pages différées et leur préchargement vivent dans `pageModules` : un
// seul endroit déclare quel module correspond à quelle page.
import {
  Journal,
  Checklist,
  CalendarPage,
  Analytics,
  Mistakes,
  Jarvis,
  Profile,
  MissedOpportunities,
  EconomicNews,
  Seasonality,
  LotSizeCalculator,
  Settings,
  Reports,
  Goals,
  TradingPlan,
  Appearance,
  Subscription,
  Inbox,
  MonteCarlo,
  preloadPage,
  LIKELY_NEXT_PAGES,
} from "./pageModules";
import LoadingScreen from "./components/LoadingScreen";
const AiAssistant = lazy(() => import("./components/AiAssistant"));
const Onboarding = lazy(() => import("./onboarding/Onboarding"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const ImportCsvModal = lazy(() => import("./components/ImportCsvModal"));
// Les modales ne sont montées que sur action : formulaire de trade (47 Ko de
// source à elle seule), détail d'un trade, détail d'une notification. Elles
// étaient importées en STATIQUE, donc payées au premier octet par un trader
// qui ouvre son tableau de bord et ne clique sur rien. Elles sont préchargées
// dès que le navigateur est libre (voir `preloadModals` plus bas) : au clic,
// le chunk est déjà là.
const TradeModal = lazy(() => import("./components/TradeModal"));
const TradeDetailModal = lazy(() => import("./components/TradeDetailModal"));
const NotificationDetailModal = lazy(() => import("./components/NotificationDetailModal"));
import TrustpilotPrompt from "./components/TrustpilotPrompt";
import { Trade, isPage, type Page } from "./types";
import { resolveLocation, buildPageUrl, DEFAULT_PAGE } from "./utils/pageUrl";
import {
  upsertTrade,
  importTrades,
  deleteTrade,
  deleteAllTrades,
  loadOnboarding,
  loadStartingBalance,
  loadMonthlyReports,
  attachTradeToSession,
  saveTradeIntent,
  saveTradeReflection,
  type TradeJournalMeta,
} from "./store";
import { useTrades, tradesQueryKey } from "./hooks/useTrades";
import { useRealtimeTrades } from "./hooks/useRealtimeTrades";
import { useSubscription } from "./hooks/useSubscription";
import { generateMyMonthlyReport } from "@/backend/reports.functions";
import { missingReportMonths } from "./utils/reportMonths";
import { withPnlFromRiskAndR } from "./utils/tradeCalcs";
import { useTradeStats } from "./hooks/useTradeStats";
import { loadTradingRules, type TradingRule } from "./utils/tradingRules";
import { sendPushToSelf } from "@/backend/push.functions";
import { AutomationEngine, initAutomationListeners } from "@/modules/automation";
import {
  NotificationEngine,
  persistNotification,
  initNotificationListeners,
  dispatchCodedNotifications,
  markNotificationRead,
} from "@/modules/notifications";
import type { AppNotification } from "@/modules/notifications/types";
import { buildDemoTrades } from "./utils/demoTrades";
import { previewTrades } from "./utils/previewTrades";
import { canLogTrade, isPlanLimitError } from "./utils/planLimits";
import { computeBehavioral } from "./utils/behavioral";
import { computeRuleAdherence } from "./utils/ruleAdherence";
import type { OnboardingAction } from "./onboarding/Onboarding";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AccountProvider, useAccounts } from "./contexts/AccountContext";
import { PageActionsProvider } from "./contexts/PageActionsContext";
const Landing = lazy(() => import("./pages/Landing"));
import AccountSwitcher from "./components/AccountSwitcher";
import FirstSessionWelcome from "./components/FirstSessionWelcome";
import { SkeletonForPage } from "./components/Skeleton";
import { DeferredFallback, PageTransition } from "./components/PageTransition";
import PageErrorBoundary from "./components/PageErrorBoundary";
import { PageGate, usePageLock } from "./components/PremiumGate";
import UpgradeModal from "./components/UpgradeModal";
import UpgradeSuccessOverlay from "./components/UpgradeSuccessOverlay";
import { LanguageProvider, useT } from "./i18n/LanguageContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ConfirmProvider, useConfirm } from "./contexts/ConfirmContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const { activeId, ready: accountsReady, activeAccount } = useAccounts();
  const { t, lang } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  // Trades now live in the React Query cache (keyed by user + active account).
  // Aucune conversion d'échelle ici : le recalibrage est un ÉVÉNEMENT qui
  // convertit les lignes une fois en base, pas une lentille appliquée à
  // chaque lecture (voir `utils/accountCalibration.ts`).
  const { trades, tradesLoading } = useTrades(user?.id, activeId, accountsReady);
  // Multi-appareils : ce qui est encodé/modifié/supprimé ailleurs arrive ici
  // instantanément, sans rafraîchissement (voir `useRealtimeTrades`).
  useRealtimeTrades(user?.id, activeId);
  // Shim preserving the exact `setTrades` signature the optimistic write
  // handlers already use — updates the cache in place instead of local state,
  // so none of the save/delete/import logic below had to change.
  const setTrades = useCallback(
    (updater: Trade[] | ((prev: Trade[]) => Trade[])) => {
      queryClient.setQueryData<Trade[]>(tradesQueryKey(user?.id, activeId), (prev) =>
        typeof updater === "function" ? (updater as (p: Trade[]) => Trade[])(prev ?? []) : updater,
      );
    },
    [queryClient, user?.id, activeId],
  );
  // L'URL est la SOURCE DE VÉRITÉ de la page courante — plus `sessionStorage`.
  // Deux emplacements auraient divergé au premier retour arrière, et c'est
  // l'URL qui rend la page partageable, mesurable et navigable au bouton
  // retour (voir `utils/pageUrl.ts` pour le raisonnement complet).
  const [page, setPageState] = useState<Page>(() => {
    if (typeof window === "undefined") return DEFAULT_PAGE;
    const { page: resolved } = resolveLocation(window.location.pathname, window.location.search);
    if (resolved) return resolved;
    // Reprise unique de l'ancien emplacement : un trader dont l'onglet est
    // ouvert au moment du déploiement reste sur sa page.
    try {
      const saved = sessionStorage.getItem("tv.page");
      if (isPage(saved)) return saved;
    } catch {
      /* sessionStorage indisponible */
    }
    return DEFAULT_PAGE;
  });

  const pageRef = useRef(page);
  pageRef.current = page;

  /**
   * Navigation : l'état ET l'URL changent ensemble, dans le même geste.
   *
   * `setPage` est passé à toute l'application (barre latérale, navigation
   * mobile, palette de commandes, CTA de Jarvis). En faisant écrire l'URL ICI
   * plutôt que dans un effet qui réagit après coup, on évite l'écart d'une
   * frame entre ce qui est affiché et ce que dit la barre d'adresse.
   *
   * `pushState` — et non `replaceState` — parce que c'est précisément l'entrée
   * d'historique qui fait fonctionner le bouton retour ; sans elle, « retour »
   * quitte l'application sur Android.
   */
  const setPage = useCallback((next: Page) => {
    // Transition React : l'ancienne page reste affichée pendant que le chunk de
    // la suivante charge, au lieu de laisser le Suspense remplacer le contenu
    // par un squelette à chaque navigation (le « chargement comme la première
    // fois »).
    startTransition(() => setPageState(next));
    if (typeof window === "undefined") return;
    const url = buildPageUrl(next, window.location.search);
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({ page: next }, "", url);
  }, []);

  // Réécriture des ANCIENNES URL `?p=` en chemin propre, une fois, sans entrée
  // d'historique : un lien partagé hier ne doit pas se transformer en
  // aller-retour aujourd'hui.
  useEffect(() => {
    const { page: resolved, redirectTo } = resolveLocation(
      window.location.pathname,
      window.location.search,
    );
    if (redirectTo && resolved) window.history.replaceState({ page: resolved }, "", redirectTo);
  }, []);

  // ── Préchargement des pages les plus visitées ──
  //
  // Remplace un effet qui appelait `import(mod)` sur une variable de chaîne.
  // Vite ne peut pas analyser un spécificateur dynamique : ces chemins
  // n'existent pas à l'exécution dans le navigateur, l'import échouait, et le
  // `.catch()` avalait l'échec. Ce préchargement n'a donc JAMAIS fonctionné —
  // ce qui explique une bonne part de la lenteur ressentie au premier clic sur
  // chaque page. Les loaders de `pageModules` sont, eux, des imports statiques
  // que le bundler résout à la compilation.
  //
  // `requestIdleCallback` garantit que ça ne dispute jamais le temps machine au
  // premier rendu du tableau de bord.
  useEffect(() => {
    if (!isAuthenticated) return;
    const run = () => {
      LIKELY_NEXT_PAGES.forEach(preloadPage);
      // Même raisonnement que pour les pages : le coût est retiré du démarrage,
      // pas déplacé sur le clic. Silencieux — un préchargement qui échoue ne
      // doit jamais remonter d'erreur, le chargement au clic réessaiera.
      void import("./components/TradeModal").catch(() => {});
      void import("./components/TradeDetailModal").catch(() => {});
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (ric) {
      ric(run);
      return;
    }
    const id = window.setTimeout(run, 1500);
    return () => window.clearTimeout(id);
  }, [isAuthenticated]);

  // Bouton retour / avant du navigateur.
  useEffect(() => {
    const onPop = () =>
      setPageState(
        resolveLocation(window.location.pathname, window.location.search).page ?? DEFAULT_PAGE,
      );
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Page verrouillée : elle est rendue avec un historique de DÉMONSTRATION, pas
  // avec le compte réel. Sans ça, l'aperçu d'un compte vide ne montrerait
  // aucun graphique — on ne s'abonne pas à un écran gris (voir `PreviewWall`).
  const pageLocked = usePageLock(page);
  const { tier } = useSubscription();
  const shownTrades = pageLocked ? previewTrades() : trades;

  // Tous les « Go Pro » ouvrent la modale d'abonnement (Pro/Elite, mensuel ou
  // annuel) au lieu d'un checkout forcé : l'utilisateur a décidé de payer,
  // on ne lui impose pas un plan. `UpgradeModal` gère le checkout lui-même.
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);

  useEffect(() => {
    const onUpgrade = () => setUpgradeOpen(true);
    window.addEventListener("tv:upgrade", onUpgrade);
    return () => window.removeEventListener("tv:upgrade", onUpgrade);
  }, []);

  // Confirmation visuelle d'abonnement : le checkout Stripe (et l'octroi d'un
  // code 100 %) redirigent vers `/?billing=success`. À l'arrivée on montre
  // les confettis + la carte, puis on nettoie l'URL pour ne pas rejouer.
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  useEffect(() => {
    if (window.location.search.includes("billing=success")) {
      setShowUpgradeSuccess(true);
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search.replace(/([?&])billing=success&?/, "$1"),
      );
    }
  }, []);

  const [importOpen, setImportOpen] = useState(false);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  // Actions d'en-tête de la page courante, remontées dans la barre d'onglets.
  const [pageActions, setPageActions] = useState<React.ReactNode | null>(null);
  /* Le résumé d'en-tête, posé par la page dans l'emplacement GAUCHE de la
     barre — celui que les onglets occupent quand la section en a. */
  const [pageLead, setPageLead] = useState<React.ReactNode | null>(null);
  const setHeaderSlot = useCallback((slot: "actions" | "lead", node: React.ReactNode | null) => {
    if (slot === "lead") setPageLead(node);
    else setPageActions(node);
  }, []);
  // Notification ouverte via tv:open-notification → popup centré (fond flouté).
  const [detailNotification, setDetailNotification] = useState<AppNotification | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const n = (e as CustomEvent<{ notification?: AppNotification }>).detail?.notification;
      if (n) setDetailNotification(n);
    };
    window.addEventListener("tv:open-notification", onOpen);
    return () => window.removeEventListener("tv:open-notification", onOpen);
  }, []);
  const markNotifRead = useCallback(
    (id: string) => {
      if (!user?.id) return;
      void markNotificationRead(user.id, id);
      window.dispatchEvent(new CustomEvent("tv:notif-updated"));
    },
    [user?.id],
  );
  // First-run gate: 'loading' until we know, 'needed' shows onboarding, 'done'
  // lets the app render. `onboarded_at` on the profile is the source of truth.
  const [onboarding, setOnboarding] = useState<"loading" | "needed" | "done">("loading");

  // Deep link from the monthly-report push notification: /?report=YYYY-MM
  // opens the Reports page directly (the page itself expands that month).
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("report");
    if (m && /^\d{4}-\d{2}$/.test(m)) setPage("reports");
  }, []);

  // Global navigation event — CTA de Jarvis (Premium, notifications) navigue
  // vers une page sans coupler les modales au composant racine.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ page?: string; filter?: string }>).detail;
      // Même garde que la restauration de session : la cible vient d'un
      // événement externe, elle doit être validée avant d'être appliquée.
      if (!isPage(detail?.page)) return;
      setPage(detail.page);
      // Deep-link : le filtre (`?f=`) accompagne la navigation. On le pose dans
      // l'URL puis on notifie les pages déjà montées (`tv:filter`) — le hook
      // `useTradeFilter` s'y synchronise.
      if (detail.filter) {
        const url = new URL(window.location.href);
        url.searchParams.set("f", detail.filter);
        window.history.replaceState(window.history.state, "", url.pathname + url.search);
        window.dispatchEvent(new CustomEvent("tv:filter"));
      }
    };
    window.addEventListener("tv:navigate", onNavigate);
    return () => window.removeEventListener("tv:navigate", onNavigate);
  }, []);

  // Deep link from lifecycle emails: /?upgrade=1&promo=VAULT20 lands on the
  // profile page, where the subscription section reads the promo param.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upgrade")) setPage("profile");
  }, []);

  // Cmd/Ctrl+K toggles the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!user) {
      setOnboarding("loading");
      return;
    }
    let active = true;
    loadOnboarding(user.id)
      .then((o) => {
        if (active) setOnboarding(o.onboardedAt ? "done" : "needed");
      })
      .catch(() => {
        // If the check fails, don't block the app — fall through to it.
        if (active) setOnboarding("done");
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Stats are derived from the trade list — memoized so they recompute only
  // when trades actually change, not on every render of the shell.
  const stats = useTradeStats(trades);

  // La section courante est celle qui contient la page courante — dérivée, pas
  // stockée : un second état aurait divergé au premier retour arrière.
  const currentSection = sectionForPage(page);
  /* La section a-t-elle plusieurs vues ? C'est ce qui décide si la barre de
     tête a un contenu à gauche — et donc si elle mérite sa propre bande. */
  const hasSectionTabs = !!currentSection && pagesOfSection(currentSection).length > 1;

  // Optimistic writes: the UI updates instantly and rolls back to the previous
  // snapshot if the request fails, so saving never blocks the workflow.
  // Anti-bias engine: the trader's own rules, checked on every save. Loaded
  // once per user into a ref so saving a trade never waits on a rules fetch.
  const sendPush = useServerFn(sendPushToSelf);
  const rulesRef = useRef<TradingRule[]>([]);

  // Bootstrap the Notification Engine with this runtime's delivery adapters.
  // Engines never import React contexts or server fns — they get them here.
  useEffect(() => {
    NotificationEngine.configure(user?.id ?? null, {
      toast: (message, type) => toast(message, type),
      push: (payload) => sendPush({ data: payload }),
      persist: (n) => {
        /* LES ALERTES GRAVES S'OUVRENT, ELLES N'ATTENDENT PAS.
           Une série de pertes, une limite de risque franchie, un motif qui
           vient d'être détecté : tout cela partait dans un toast de trois
           secondes et dans une boîte de réception qu'on ouvre le lendemain.
           Une notification de sévérité `error` ouvre maintenant le même popup
           que si le trader avait cliqué dessus dans sa boîte — la surface
           existait déjà (`tv:open-notification`), rien ne la déclenchait
           toute seule.

           SEULEMENT `error`. Étendre aux avertissements ferait un popup par
           séance, et le popup ne voudrait plus rien dire. */
        if (n.severity === "error") {
          window.dispatchEvent(
            new CustomEvent("tv:open-notification", { detail: { notification: n } }),
          );
        }
        return persistNotification(n);
      },
    });
  }, [user?.id, toast, sendPush]);

  useEffect(() => {
    if (!user) return;
    loadTradingRules(user.id)
      .then((r) => {
        rulesRef.current = r;
      })
      .catch(() => {});
    // Profile's rules editor broadcasts changes so the checker never goes stale.
    const onUpdate = (e: Event) => {
      rulesRef.current = (e as CustomEvent<TradingRule[]>).detail ?? [];
    };
    window.addEventListener("tv-rules-updated", onUpdate);
    return () => window.removeEventListener("tv-rules-updated", onUpdate);
  }, [user]);

  // ── PWA : enregistrement PRÉCOCE du service worker ──
  // Avant, il n'était enregistré qu'à l'opt-in push. En l'enregistrant dès le
  // chargement, le site est INSTALLABLE (Chrome/iOS le traitent comme une app)
  // et le shell hors-ligne fonctionne : le raccourci mobile s'ouvre sans la
  // chrome du navigateur. Idempotent — le push réutilise la même registration.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-push.js", { scope: "/" }).catch(() => {});
  }, []);

  // ── Règles de notification codées (0 IA) ──
  // Après chargement des trades, Jarvis évalue ses règles locales (série de
  // pertes, fuite, inactivité, revue hebdo) et livre les notifications une
  // fois par jour via l'engine (persist → inbox). Dédupliqué côté runner.
  useEffect(() => {
    if (!user?.id || !accountsReady || tradesLoading) return;
    const uid = user.id;
    void (async () => {
      // Le solde est nécessaire aux règles de risque en % ; il est chargé une
      // fois ici plutôt qu'à chaque évaluation.
      const balance =
        (await loadStartingBalance(uid).catch(() => 0)) + trades.reduce((s, tr) => s + tr.pnl, 0);
      await dispatchCodedNotifications(
        uid,
        {
          trades: trades.map((t) => ({ date: t.date, pnl: t.pnl, mistakes: t.mistakes ?? [] })),
          stats: {
            totalPnl: stats.totalPnl,
            winRate: stats.winRate,
            tradeCount: stats.totalTrades,
            mistakeStats: stats.mistakeStats,
          },
          rulesEnabled: rulesRef.current.filter((r) => r.enabled).length,
          // Alimenté par les moteurs déterministes : Jarvis peut désormais
          // signaler un progrès chiffré ou une règle qui échappe — sans appel
          // IA, donc sans coût et sans risque d'invention.
          mistakeTrends: computeBehavioral(trades)
            .rows.filter((r) => r.trend)
            .map((r) => ({
              mistake: r.mistake,
              deltaPct: r.trend!.deltaPct,
              recent: r.trend!.recent,
              previous: r.trend!.previous,
            })),
          adherence: computeRuleAdherence(trades, rulesRef.current, balance).map((a) => ({
            text: a.text,
            kept: a.kept,
            applicable: a.applicable,
            ratePct: a.ratePct,
          })),
        },
        (id, input) => NotificationEngine.notify(id, input),
      );
    })().catch(() => {});
  }, [user?.id, accountsReady, tradesLoading, trades, stats]);

  const handleSave = useCallback(
    async (trade: Trade, meta?: TradeJournalMeta) => {
      if (!user) return;
      // Quota mensuel d'encodage. Il porte sur les CRÉATIONS : corriger un
      // trade déjà saisi reste possible quel que soit le palier — bloquer une
      // correction serait punitif et sans rapport avec l'offre.
      const isEdit = trades.some((t) => t.id === trade.id);
      if (!canLogTrade(tier, trades, isEdit)) {
        setModalOpen(false);
        setEditingTrade(null);
        toast(
          lang === "fr"
            ? "Limite de 10 trades par mois atteinte — passe à Pro pour encoder sans limite."
            : "10 trades a month reached — go Pro to log without limits.",
          "info",
        );
        setPage("subscription");
        return;
      }
      setModalOpen(false);
      setEditingTrade(null);
      let snapshot: Trade[] = [];
      setTrades((prev) => {
        snapshot = prev;
        const exists = prev.find((t) => t.id === trade.id);
        return exists ? prev.map((t) => (t.id === trade.id ? trade : t)) : [trade, ...prev];
      });
      try {
        await upsertTrade(user.id, trade);
      } catch (e) {
        console.error("Failed to save trade", e);
        setTrades(snapshot);
        toast(t("app.saveTradeFailed"), "error");
        return;
      }

      // Intention & réflexion (Phase 0b) — écriture AU MIEUX, jamais bloquante.
      // Le trade est déjà enregistré : une capture qui échoue laisse un trade
      // parfaitement valide. On ne reécrit que ce que le trader a rempli.
      if (meta?.intent) {
        void saveTradeIntent(user.id, trade, meta.intent).catch(() => {});
      }
      if (meta?.reflection) {
        void saveTradeReflection(user.id, trade.id, meta.reflection).catch(() => {});
      }

      // Rattachement à la séance du jour — AU MIEUX, et surtout après coup.
      // Le trade est déjà enregistré à ce stade : s'il n'y a pas de séance
      // ouverte, ou si l'écriture échoue, il reste un trade parfaitement
      // valide. Le journal ne dépend jamais de la mécanique qui l'observe.
      void attachTradeToSession(user.id, trade.id, trade.date).catch(() => {});

      // All post-save side effects (analysis, discipline, notifications, AI
      // hooks) run through the Automation Engine — no business logic here.
      const isNew = !snapshot.some((tr) => tr.id === trade.id);
      void (async () => {
        const balance =
          (await loadStartingBalance(user.id).catch(() => 0)) +
          snapshot.reduce((s, tr) => s + tr.pnl, 0);
        await AutomationEngine.tradeSaved({
          userId: user.id,
          trade,
          previousTrades: snapshot,
          isNew,
          accountBalance: balance,
          rules: rulesRef.current,
          // Intention + réflexion capturées au moment de l'enregistrement :
          // l'étape d'observation (Step 6B) les lit pour produire son signal.
          extras: { intent: meta?.intent ?? null, reflection: meta?.reflection ?? null },
        });
      })();
    },
    [user, trades, tier, lang, toast, t, setPage],
  );

  /**
   * Édition RAPIDE depuis le journal : R multiple ou montant du risque, en
   * place, sans ouvrir le formulaire complet.
   *
   * Instantané par construction : le cache est mis à jour d'abord (le trade
   * est déjà à jour à l'écran avant même la réponse du serveur), et comme
   * toutes les pages dérivent de ce même cache, le Dashboard, l'Analytics et
   * Jarvis suivent dans la même frame. Aucun rechargement, aucune nouvelle
   * session.
   *
   * Aucune conversion d'échelle ici : depuis que le recalibrage est un
   * événement ponctuel, les montants stockés sont exactement ceux qui sont
   * affichés. La valeur saisie part telle quelle.
   */
  const handleQuickEdit = useCallback(
    async (id: string, patch: Partial<Pick<Trade, "riskAmount" | "rMultiple">>) => {
      if (!user) return;
      const shown = trades.find((t) => t.id === id);
      if (!shown) return;
      const next = withPnlFromRiskAndR(shown, patch);
      let snapshot: Trade[] = [];
      setTrades((prev) => {
        snapshot = prev;
        return prev.map((t) => (t.id === id ? next : t));
      });
      try {
        await upsertTrade(user.id, next);
      } catch (e) {
        console.error("Failed to quick-edit trade", e);
        setTrades(snapshot);
        toast(t("app.saveTradeFailed"), "error");
      }
    },
    [user, trades, t, toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!user) return;
      if (!(await confirm(t("app.confirmDeleteTrade"), { danger: true }))) return;
      let snapshot: Trade[] = [];
      setTrades((prev) => {
        snapshot = prev;
        return prev.filter((t) => t.id !== id);
      });
      try {
        await deleteTrade(user.id, id);
        AutomationEngine.tradeDeleted(user.id, id);
      } catch (e) {
        console.error("Failed to delete trade", e);
        setTrades(snapshot);
        toast(t("app.saveTradeFailed"), "error");
      }
    },
    [user, t, confirm, toast],
  );

  const handleDeleteAll = useCallback(async () => {
    if (!user) return;
    if (!(await confirm(t("app.confirmDeleteAllTrades"), { danger: true }))) return;
    try {
      await deleteAllTrades(user.id);
      setTrades([]);
      AutomationEngine.tradeDeleted(user.id, "all");
    } catch (e) {
      console.error("Failed to delete trades", e);
      toast(t("app.saveTradeFailed"), "error");
    }
  }, [user, t, confirm, toast]);

  const handleEdit = useCallback((trade: Trade) => {
    setEditingTrade(trade);
    setModalOpen(true);
  }, []);
  const handleAdd = useCallback(() => {
    setEditingTrade(null);
    setModalOpen(true);
  }, []);
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingTrade(null);
  }, []);
  // Stable — évite un nouveau nœud à chaque rendu (boucle `usePageActions`).
  const handleOpenMissed = useCallback(() => setPage("missed"), []);

  // Onboarding hand-off: "import" opens the CSV modal right away; "demo"
  // seeds three example trades so Dashboard/Analytics light up instantly.
  const handleOnboardingDone = useCallback(
    async (action?: OnboardingAction) => {
      setOnboarding("done");
      if (!user) return;
      if (action === "import") {
        setImportOpen(true);
        return;
      }
      if (action === "demo") {
        const demo = buildDemoTrades(t("journal.exampleNote"));
        setTrades((prev) => [...demo, ...prev]);
        try {
          for (const tr of demo) await upsertTrade(user.id, tr);
          toast(t("journal.demoInserted"), "success");
        } catch (e) {
          console.error("Failed to insert demo trades", e);
          toast(t("app.saveTradeFailed"), "error");
        }
      }
    },
    [user, t, toast],
  );

  // Import CSV : écriture par lots séquentiels, avec progression réelle et
  // comptage honnête des échecs (voir `importTrades`).
  const generateReport = useServerFn(generateMyMonthlyReport);
  const handleImportTrades = useCallback(
    async (
      imported: Trade[],
      onProgress?: (done: number, total: number) => void,
    ): Promise<{ saved: number; failed: number }> => {
      if (!user) return { saved: 0, failed: imported.length };
      const { saved, failed } = await importTrades(user.id, imported, onProgress);
      if (saved.length > 0) {
        setTrades((prev) => [...saved, ...prev]);
        // Backfill: a multi-month CSV history should come with its monthly
        // reports. Generate every past month that has trades but no report
        // yet — in-app only, never emailed. Fire-and-forget so the import
        // modal closes instantly.
        void (async () => {
          try {
            const existing = (await loadMonthlyReports(user.id)).map((r) => r.month);
            // Même définition que la page Rapports : « mois clos, avec des
            // trades, sans rapport ». Une seule source de vérité.
            const missing = missingReportMonths(
              saved.map((tr) => tr.date),
              existing,
            );
            let generated = 0;
            for (const month of missing) {
              try {
                const res = await generateReport({ data: { month, withAi: false } });
                if (res.report) generated++;
              } catch (e) {
                console.error("Report backfill failed for", month, e);
              }
            }
            if (generated > 0) {
              toast(t("reports.backfilled").replace("{n}", String(generated)), "success");
            }
          } catch (e) {
            console.error("Report backfill failed", e);
          }
        })();
      }
      return { saved: saved.length, failed };
    },
    [user, generateReport, t, toast],
  );

  if (loading) {
    return <LoadingScreen message="Vérification de ton compte…" />;
  }

  // Signed-out visitors get the public landing page (its CTAs open the auth
  // screen). Signed-in users fall through straight into the product.
  if (!isAuthenticated) return <Landing />;

  // First-time users get the onboarding; everyone else goes straight into the
  // shell (no intermediate loading screen — the dashboard is visible as soon
  // as auth resolves; data streams in behind the already-painted frame).
  if (onboarding === "needed" && user) {
    return (
      <Suspense fallback={<LoadingScreen message="Chargement de l'onboarding…" />}>
        <Onboarding userId={user.id} onDone={handleOnboardingDone} />
      </Suspense>
    );
  }

  // Les comptes se chargent en parallèle de l'auth : AUCUNE porte plein écran
  // « Chargement de tes comptes… » ne sépare le shell de ses pages. Le shell
  // (sidebar, navigation) se peint immédiatement ; seul le contenu montre un
  // squelette contextuel jusqu'à ce que les comptes soient prêts.

  return (
    // h-dvh + overflow-hidden: the shell is exactly one viewport tall — content
    // scrolls inside <main>, so the sidebar rail never moves on any page.
    <div className="relative flex h-dvh text-white overflow-hidden">
      <FirstSessionWelcome />
      {/* Les dégradés des histogrammes, montés une fois pour toute l'app. */}
      <ChartDefs />
      {/* Le halo qui suivait le curseur et les deux orbes cyan/teal d'ambiance
          ont été retirés : de la lumière décorative, repeinte en permanence,
          qui teintait chaque carte posée devant elle. Le fond est un à-plat. */}
      <Sidebar page={page} setPage={setPage} totalPnl={stats.totalPnl} />
      {/* La FENÊTRE de contenu. Sur desktop elle est, comme le rail, une plaque
          arrondie et détachée : les deux flottent côte à côte sur le fond de la
          page, et c'est cet écart — pas une bordure — qui sépare la navigation
          du produit. Sur mobile le cadre disparaît : l'écran est trop étroit
          pour s'offrir une marge, le contenu va d'un bord à l'autre. */}
      <main className="app-main app-frame relative z-0 my-0 mr-0 flex-1 overflow-y-auto md:my-3 md:mr-3 md:ml-2">
        {/* Onglets de la section courante à gauche, actions mobiles à droite —
            une seule ligne, dans le flux de la page. L'ancienne barre fixe
            répétait le titre que chaque page affiche déjà juste en dessous :
            un bandeau collé par-dessus le produit. Voir `MobileActions`.
            `pb-3` : un écart vertical unique et identique entre la barre
            d'onglets et le contenu, sur toutes les pages. */}
        {/* LA BARRE DE TÊTE — et le trou qu'elle laissait.
            Quand la section n'a qu'une vue (le Tableau de bord, Jarvis…), la
            moitié gauche est vide : il ne reste qu'un bouton à droite, posé sur
            sa propre bande de 64px, à laquelle s'ajoutent les 24px de marge
            haute de la page. Cent pixels avant la première carte, dont les deux
            tiers ne portent rien.
            Dans ce cas la barre se REPLIE DANS la marge de la page au lieu de
            s'y ajouter : le bouton occupe l'espace qui existait déjà. Quand il
            y a des onglets, rien ne change — la bande a alors un contenu qui
            justifie sa hauteur. */}
        <div
          className={cn(
            "flex items-center gap-3 px-4 md:px-6",
            hasSectionTabs ? "pt-3 pb-3" : "pt-3 pb-0 md:-mb-6 md:pt-4",
          )}
        >
          <div className="min-w-0 flex-1">
            {hasSectionTabs ? (
              <SectionTabs section={currentSection!} page={page} setPage={setPage} />
            ) : (
              pageLead
            )}
          </div>
          {pageActions && <div className="flex items-center gap-2 shrink-0">{pageActions}</div>}
          <MobileActions page={page} setPage={setPage} />
        </div>
        <PageActionsProvider setActions={setHeaderSlot}>
          {accountsReady ? (
            <PageErrorBoundary resetKey={page}>
              {/* Squelette CONTEXTUEL et DIFFÉRÉ. Le squelette imite la page de
              destination — mais il n'apparaît qu'au-delà de 320 ms d'attente.
              En dessous, le chunk est déjà en mémoire (préchargement au survol
              + `LIKELY_NEXT_PAGES`) et le squelette n'était qu'un clignotement
              gris de deux frames : le signal « ça charge » sans le chargement.
              L'espace, lui, reste réservé, donc rien ne bouge. */}
              <Suspense
                fallback={
                  <DeferredFallback key={page}>
                    <SkeletonForPage page={page} />
                  </DeferredFallback>
                }
              >
                {/* PageTransition est DANS le Suspense, pas autour.
                Autour, il jouait sa transition sur la boîte vide réservée
                pendant l'attente, puis le contenu réel arrivait après coup,
                sans aucune animation : on ne voyait donc jamais la transition
                sur ce qui compte. Ici, l'animation se déclenche au moment où
                la page est réellement peinte. Il ne remonte JAMAIS son enfant
                (voir le composant) : défilement, filtres et lignes dépliées
                survivent au changement de page. */}
                <PageTransition page={page}>
                  {/* Le verrou premium enveloppe la page rendue : la table
                    `PAGE_TIER` décide, les pages elles-mêmes ne savent rien de
                    la facturation. */}
                  <PageGate page={page} onUpgrade={openUpgrade}>
                    {page === "dashboard" && (
                      <Dashboard
                        trades={trades}
                        onAddTrade={handleAdd}
                        tradesLoading={tradesLoading}
                        onOpenChecklist={() => setPage("checklist")}
                        onOpenImport={() => setImportOpen(true)}
                        onEditTrade={handleEdit}
                        onOpenJournal={() => setPage("journal")}
                      />
                    )}
                    {page === "journal" && (
                      <Journal
                        trades={trades}
                        onEdit={handleEdit}
                        onQuickEdit={handleQuickEdit}
                        onDelete={handleDelete}
                        onDeleteAll={handleDeleteAll}
                        onAdd={handleAdd}
                        onOpenMissed={handleOpenMissed}
                      />
                    )}
                    {page === "checklist" && (
                      <Checklist setPage={setPage} onAddTrade={handleAdd} trades={trades} />
                    )}
                    {page === "calendar" && (
                      <CalendarPage trades={trades} onDelete={handleDelete} />
                    )}
                    {page === "analytics" && <Analytics trades={shownTrades} />}
                    {page === "mistakes" && <Mistakes trades={shownTrades} />}
                    {page === "missed" && <MissedOpportunities />}
                    {page === "insights" && <Jarvis />}
                    {page === "news" && <EconomicNews />}
                    {page === "seasonality" && (
                      <Seasonality trades={shownTrades} tradesLoading={tradesLoading} />
                    )}
                    {page === "calculator" && (
                      <LotSizeCalculator onAddTrade={handleAdd} setPage={setPage} />
                    )}
                    {page === "settings" && (
                      <Settings
                        trades={trades}
                        onDeleteAll={handleDeleteAll}
                        onOpenImport={() => setImportOpen(true)}
                        onOpenReports={() => setPage("reports")}
                      />
                    )}
                    {page === "reports" && <Reports trades={shownTrades} />}
                    {page === "goals" && <Goals trades={shownTrades} />}
                    {page === "tradingplan" && <TradingPlan setPage={setPage} />}
                    {page === "appearance" && <Appearance />}
                    {page === "subscription" && <Subscription />}
                    {page === "montecarlo" && <MonteCarlo trades={shownTrades} />}
                    {page === "inbox" && <Inbox />}
                    {page === "profile" && <Profile trades={trades} />}
                  </PageGate>
                </PageTransition>
              </Suspense>
            </PageErrorBoundary>
          ) : (
            /* Comptes en chargement : le shell est peint, la page répond avec
               son squelette contextuel — pas de porte plein écran. */
            <div className="p-4 md:p-5">
              <SkeletonForPage page={page} />
            </div>
          )}
        </PageActionsProvider>
      </main>
      {/* Mobile quick account switcher — FAB, bottom-left mirror of the AI Coach. Balance = starting + total P&L. */}
      <AccountSwitcher
        variant="fab"
        balance={(activeAccount?.startingBalance ?? 0) + stats.totalPnl}
      />
      {/* Discreet review nudge — self-gating, never during an active flow */}
      <TrustpilotPrompt tradeCount={trades.length} page={page} modalOpen={modalOpen} />
      <MobileNav page={page} setPage={setPage} onAddTrade={handleAdd} />
      <Suspense fallback={null}>
        <AiAssistant trades={trades} page={page} />
      </Suspense>
      <Suspense fallback={null}>
        {modalOpen && (
          <TradeModal trade={editingTrade} onClose={handleCloseModal} onSave={handleSave} />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {paletteOpen && (
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            trades={trades}
            setPage={setPage}
            onAddTrade={handleAdd}
            onOpenImport={() => setImportOpen(true)}
            onViewTrade={setViewingTrade}
          />
        )}
        {importOpen && (
          <ImportCsvModal
            existing={trades}
            onClose={() => setImportOpen(false)}
            onImport={handleImportTrades}
          />
        )}
      </Suspense>
      {/* Repli `null` : la modale s'affiche dès que son chunk est là. Il l'est
          déjà dans le cas normal (préchargé au repos), et sur une connexion
          lente un écran inchangé pendant 100 ms vaut mieux qu'un squelette de
          modale qui clignote. */}
      <Suspense fallback={null}>
        {viewingTrade && (
          <TradeDetailModal
            trades={[viewingTrade]}
            date={viewingTrade.date}
            onClose={() => setViewingTrade(null)}
            onDelete={(id) => {
              handleDelete(id);
              setViewingTrade(null);
            }}
          />
        )}
        {detailNotification && (
          <NotificationDetailModal
            notification={detailNotification}
            onClose={() => setDetailNotification(null)}
            onMarkRead={markNotifRead}
          />
        )}
      </Suspense>

      {/* Passer Pro — la modale ouverte par chaque « Go Pro » (mur d'aperçu,
          quota Jarvis, cadenas multi-comptes…). */}
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      {/* Confirmation d'abonnement — confettis + carte à l'arrivée. */}
      {showUpgradeSuccess && (
        <UpgradeSuccessOverlay
          onClose={() => setShowUpgradeSuccess(false)}
          onExplore={() => {
            setShowUpgradeSuccess(false);
            setPage("analytics");
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initNotificationListeners();
    initAutomationListeners();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AccountProvider>
          <LanguageProvider>
            <ToastProvider>
              <ConfirmProvider>
                <AppContent />
              </ConfirmProvider>
            </ToastProvider>
          </LanguageProvider>
        </AccountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
