import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import TradeModal from "./components/TradeModal";
// Dashboard is the landing page — keep it in the main chunk. Every other page
// (and its heavy deps: recharts, react-markdown) loads on demand.
import Dashboard from "./pages/Dashboard";
const Journal = lazy(() => import("./pages/Journal"));
const Checklist = lazy(() => import("./pages/Checklist"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Mistakes = lazy(() => import("./pages/Mistakes"));
const Jarvis = lazy(() => import("./pages/Jarvis"));
const Profile = lazy(() => import("./pages/Profile"));
const MissedOpportunities = lazy(() => import("./pages/MissedOpportunities"));
const EconomicNews = lazy(() => import("./pages/EconomicNews"));
const Seasonality = lazy(() => import("./pages/Seasonality"));
const LotSizeCalculator = lazy(() => import("./pages/LotSizeCalculator"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Goals = lazy(() => import("./pages/Goals"));
const TradingPlan = lazy(() => import("./pages/TradingPlan"));
const Appearance = lazy(() => import("./pages/Appearance"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Inbox = lazy(() => import("./pages/Inbox"));
import LoadingScreen from "./components/LoadingScreen";
const AiAssistant = lazy(() => import("./components/AiAssistant"));
const Onboarding = lazy(() => import("./onboarding/Onboarding"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const ImportCsvModal = lazy(() => import("./components/ImportCsvModal"));
import TradeDetailModal from "./components/TradeDetailModal";
import TrustpilotPrompt from "./components/TrustpilotPrompt";
import { Trade, Page } from "./types";
import {
  upsertTrade,
  deleteTrade,
  deleteAllTrades,
  loadOnboarding,
  loadStartingBalance,
  loadMonthlyReports,
} from "./store";
import { useTrades, tradesQueryKey } from "./hooks/useTrades";
import { generateMyMonthlyReport } from "@/backend/reports.functions";
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
import type { OnboardingAction } from "./onboarding/Onboarding";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AccountProvider, useAccounts } from "./contexts/AccountContext";
const Landing = lazy(() => import("./pages/Landing"));
import CursorGlow from "./components/CursorGlow";
import NotificationDetailModal from "./components/NotificationDetailModal";
import FirstSessionWelcome from "./components/FirstSessionWelcome";
import { SkeletonForPage } from "./components/Skeleton";
import PageErrorBoundary from "./components/PageErrorBoundary";
import { LanguageProvider, useT } from "./i18n/LanguageContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ConfirmProvider, useConfirm } from "./contexts/ConfirmContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const { activeId, ready: accountsReady } = useAccounts();
  const { t } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  // Trades now live in the React Query cache (keyed by user + active account).
  const { trades, tradesLoading } = useTrades(user?.id, activeId, accountsReady);
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
  const [page, setPage] = useState<Page>(() => {
    try {
      const saved = sessionStorage.getItem("tv.page");
      if (
        saved &&
        [
          "dashboard",
          "inbox",
          "journal",
          "checklist",
          "calendar",
          "analytics",
          "mistakes",
          "missed",
          "insights",
          "news",
          "seasonality",
          "calculator",
          "settings",
          "reports",
          "goals",
          "tradingplan",
          "appearance",
          "subscription",
          "profile",
        ].includes(saved)
      ) {
        return saved as Page;
      }
    } catch {
      /* sessionStorage unavailable */
    }
    return "dashboard";
  });

  // Persist page changes to sessionStorage (survives refresh, not tabs)
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    try {
      sessionStorage.setItem("tv.page", page);
    } catch {
      /* sessionStorage unavailable */
    }
  }, [page]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
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
      const detail = (e as CustomEvent<{ page?: string }>).detail;
      if (
        detail?.page &&
        [
          "dashboard",
          "inbox",
          "journal",
          "checklist",
          "calendar",
          "analytics",
          "mistakes",
          "missed",
          "insights",
          "news",
          "seasonality",
          "calculator",
          "settings",
          "reports",
          "goals",
          "tradingplan",
          "appearance",
          "subscription",
          "profile",
        ].includes(detail.page)
      ) {
        setPage(detail.page as Page);
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
      persist: persistNotification,
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

  // ── Préchargement des pages les plus visitées ──
  // Une fois connecté et le premier rendu peint, on chauffe les chunks lazy
  // (Journal, Analytics, Inbox, …) en arrière-plan : la navigation devient
  // quasi instantanée au lieu de charger le module au premier clic.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setTimeout(() => {
      for (const mod of [
        "./pages/Dashboard",
        "./pages/Journal",
        "./pages/Analytics",
        "./pages/Inbox",
        "./pages/Mistakes",
        "./pages/CalendarPage",
      ]) {
        void import(mod).catch(() => {});
      }
    }, 900);
    return () => window.clearTimeout(id);
  }, [isAuthenticated]);

  // ── Règles de notification codées (0 IA) ──
  // Après chargement des trades, Jarvis évalue ses règles locales (série de
  // pertes, fuite, inactivité, revue hebdo) et livre les notifications une
  // fois par jour via l'engine (persist → inbox). Dédupliqué côté runner.
  useEffect(() => {
    if (!user?.id || !accountsReady || tradesLoading) return;
    void dispatchCodedNotifications(
      user.id,
      {
        trades: trades.map((t) => ({ date: t.date, pnl: t.pnl, mistakes: t.mistakes ?? [] })),
        stats: {
          totalPnl: stats.totalPnl,
          winRate: stats.winRate,
          tradeCount: stats.totalTrades,
          mistakeStats: stats.mistakeStats,
        },
        rulesEnabled: rulesRef.current.filter((r) => r.enabled).length,
      },
      (uid, input) => NotificationEngine.notify(uid, input),
    ).catch(() => {});
  }, [user?.id, accountsReady, tradesLoading, trades, stats]);

  const handleSave = useCallback(
    async (trade: Trade) => {
      if (!user) return;
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
        });
      })();
    },
    [user],
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

  // CSV import: persist each row, keep the ones that made it
  const generateReport = useServerFn(generateMyMonthlyReport);
  const handleImportTrades = useCallback(
    async (imported: Trade[]): Promise<number> => {
      if (!user) return 0;
      const results = await Promise.allSettled(imported.map((tr) => upsertTrade(user.id, tr)));
      const saved: Trade[] = [];
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          saved.push(imported[i]);
        } else {
          console.error("Failed to import trade", results[i].reason);
        }
      }
      if (saved.length > 0) {
        setTrades((prev) => [...saved, ...prev]);
        // Backfill: a multi-month CSV history should come with its monthly
        // reports. Generate every past month that has trades but no report
        // yet — in-app only, never emailed. Fire-and-forget so the import
        // modal closes instantly.
        void (async () => {
          try {
            const nowMonth = new Date().toISOString().slice(0, 7);
            const months = [...new Set(saved.map((tr) => tr.date.slice(0, 7)))]
              .filter((m) => /^\d{4}-\d{2}$/.test(m) && m < nowMonth)
              .sort();
            if (months.length === 0) return;
            const existing = new Set((await loadMonthlyReports(user.id)).map((r) => r.month));
            const missing = months.filter((m) => !existing.has(m));
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
      return saved.length;
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

  return (
    // h-dvh + overflow-hidden: the shell is exactly one viewport tall — content
    // scrolls inside <main>, so the sidebar rail never moves on any page.
    <div className="relative flex h-dvh text-white overflow-hidden">
      <FirstSessionWelcome />
      <CursorGlow />
      {/* Ambient background glow */}
      <div className="shell-bg-orbs pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="auth-orb w-[600px] h-[600px] bg-cyan-600 -top-64 -right-64"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="auth-orb w-[500px] h-[500px] bg-teal-600 top-1/2 -left-64"
          style={{ animationDelay: "-7s" }}
        />
      </div>
      <Sidebar page={page} setPage={setPage} totalPnl={stats.totalPnl} winRate={stats.winRate} />
      <main className="app-main relative flex-1 overflow-y-auto pb-[calc(110px+env(safe-area-inset-bottom,0px))] md:pb-8">
        {/* Push opt-in now lives in onboarding (and Settings), not as a
            dashboard banner. */}
        <div key={page}>
          {/* Contextual skeleton: the loading frame mimics the destination
              page's real layout (chart grid, trade list, calendar…). */}
          <PageErrorBoundary resetKey={page}>
            <Suspense fallback={<SkeletonForPage page={page} />}>
              {page === "dashboard" && (
                <Dashboard
                  trades={trades}
                  onAddTrade={handleAdd}
                  tradesLoading={tradesLoading}
                  onOpenChecklist={() => setPage("checklist")}
                  onOpenImport={() => setImportOpen(true)}
                />
              )}
              {page === "journal" && (
                <Journal
                  trades={trades}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDeleteAll={handleDeleteAll}
                  onAdd={handleAdd}
                  onOpenMissed={() => setPage("missed")}
                />
              )}
              {page === "checklist" && <Checklist setPage={setPage} onAddTrade={handleAdd} />}
              {page === "calendar" && <CalendarPage trades={trades} onDelete={handleDelete} />}
              {page === "analytics" && <Analytics trades={trades} />}
              {page === "mistakes" && <Mistakes trades={trades} />}
              {page === "missed" && <MissedOpportunities />}
              {page === "insights" && <Jarvis />}
              {page === "news" && <EconomicNews />}
              {page === "seasonality" && (
                <Seasonality trades={trades} tradesLoading={tradesLoading} />
              )}
              {page === "calculator" && <LotSizeCalculator onAddTrade={handleAdd} />}
              {page === "settings" && (
                <Settings
                  trades={trades}
                  onDeleteAll={handleDeleteAll}
                  onOpenImport={() => setImportOpen(true)}
                  onOpenReports={() => setPage("reports")}
                />
              )}
              {page === "reports" && <Reports />}
              {page === "goals" && <Goals trades={trades} />}
              {page === "tradingplan" && <TradingPlan setPage={setPage} />}
              {page === "appearance" && <Appearance />}
              {page === "subscription" && <Subscription />}
              {page === "inbox" && <Inbox />}
              {page === "profile" && <Profile trades={trades} setPage={setPage} />}
              {![
                "dashboard",
                "journal",
                "checklist",
                "calendar",
                "analytics",
                "mistakes",
                "missed",
                "insights",
                "news",
                "seasonality",
                "calculator",
                "settings",
                "reports",
                "goals",
                "tradingplan",
                "appearance",
                "subscription",
                "inbox",
                "profile",
              ].includes(page) && (
                <Dashboard
                  trades={trades}
                  stats={stats}
                  onAddTrade={handleAdd}
                  onEditTrade={handleEdit}
                  onOpenJournal={() => setPage("journal")}
                  onOpenMissed={() => setPage("missed")}
                  onOpenChecklist={() => setPage("checklist")}
                  onOpenImport={() => setImportOpen(true)}
                />
              )}
            </Suspense>
          </PageErrorBoundary>
        </div>
      </main>
      {/* Le sélecteur de sous-comptes mobile vit DANS la nav bar (MobileNav) —
          plus de pastille flottante qui cache le contenu. */}
      {/* Discreet review nudge — self-gating, never during an active flow */}
      <TrustpilotPrompt tradeCount={trades.length} page={page} modalOpen={modalOpen} />
      <MobileNav page={page} setPage={setPage} onAddTrade={handleAdd} />
      <Suspense fallback={null}>
        <AiAssistant trades={trades} page={page} />
      </Suspense>
      {modalOpen && (
        <TradeModal trade={editingTrade} onClose={handleCloseModal} onSave={handleSave} />
      )}
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
