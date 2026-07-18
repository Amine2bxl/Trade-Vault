import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
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
const Insights = lazy(() => import("./pages/Insights"));
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
const AiAssistant = lazy(() => import("./components/AiAssistant"));
const Onboarding = lazy(() => import("./onboarding/Onboarding"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const ImportCsvModal = lazy(() => import("./components/ImportCsvModal"));
import TradeDetailModal from "./components/TradeDetailModal";
import TrustpilotPrompt from "./components/TrustpilotPrompt";
import { Trade, Page } from "./types";
import {
  loadUserTrades,
  upsertTrade,
  deleteTrade,
  deleteAllTrades,
  migrateLegacyTradeScreenshots,
  loadOnboarding,
  loadStartingBalance,
  loadMonthlyReports,
} from "./store";
import { generateMyMonthlyReport } from "@/lib/reports.functions";
import { computeStats } from "./utils/tradeCalcs";
import { loadTradingRules, type TradingRule } from "./utils/tradingRules";
import { sendPushToSelf } from "@/lib/push.functions";
import { AutomationEngine } from "@/modules/automation";
import { NotificationEngine, persistNotification } from "@/modules/notifications";
import { buildDemoTrades } from "./utils/demoTrades";
import type { OnboardingAction } from "./onboarding/Onboarding";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AccountProvider, useAccounts } from "./contexts/AccountContext";
import Landing from "./pages/Landing";
import CursorGlow from "./components/CursorGlow";
import AccountSwitcher from "./components/AccountSwitcher";
import PushOnboardingBanner from "./components/PushOnboardingBanner";
import { SkeletonForPage } from "./components/Skeleton";
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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  // First-run gate: 'loading' until we know, 'needed' shows onboarding, 'done'
  // lets the app render. `onboarded_at` on the profile is the source of truth.
  const [onboarding, setOnboarding] = useState<"loading" | "needed" | "done">("loading");

  // Deep link from the monthly-report push notification: /?report=YYYY-MM
  // opens the Reports page directly (the page itself expands that month).
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("report");
    if (m && /^\d{4}-\d{2}$/.test(m)) setPage("reports");
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

  useEffect(() => {
    let active = true;
    // Wait until the active account is resolved so trades are scoped to it
    // from the first load (never a merged cross-account flash).
    if (user && accountsReady) {
      const userId = user.id;
      setTradesLoading(true);
      loadUserTrades(userId)
        .then((loaded) => {
          if (!active) return;
          setTrades(loaded);
          // One-time background migration: trades that still carry inline
          // base64 screenshots get their images moved to Storage. Each
          // migrated trade is swapped into state so the UI stays in sync.
          migrateLegacyTradeScreenshots(userId, loaded, (migrated) => {
            if (active) setTrades((prev) => prev.map((t) => (t.id === migrated.id ? migrated : t)));
          })
            .then((n) => {
              if (n > 0) console.info(`[migrate] moved screenshots of ${n} trade(s) to Storage`);
            })
            .catch(() => {});
        })
        .catch((e) => console.error("Failed to load trades", e))
        .finally(() => {
          if (active) setTradesLoading(false);
        });
    } else {
      setTrades([]);
    }
    return () => {
      active = false;
    };
  }, [user?.id, activeId, accountsReady]);

  const stats = computeStats(trades);

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
      const saved: Trade[] = [];
      for (const tr of imported) {
        try {
          await upsertTrade(user.id, tr);
          saved.push(tr);
        } catch (e) {
          console.error("Failed to import trade", e);
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
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
    );
  }

  // Signed-out visitors get the public landing page (its CTAs open the auth
  // screen). Signed-in users fall through straight into the product.
  if (!isAuthenticated) return <Landing />;

  if (onboarding === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
    );
  }

  if (onboarding === "needed" && user) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-slate-400">
            Loading…
          </div>
        }
      >
        <Onboarding userId={user.id} onDone={handleOnboardingDone} />
      </Suspense>
    );
  }

  return (
    // h-dvh + overflow-hidden: the shell is exactly one viewport tall — content
    // scrolls inside <main>, so the sidebar rail never moves on any page.
    <div className="relative flex h-dvh text-white overflow-hidden">
      <CursorGlow />
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
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
      <main className="app-main relative flex-1 overflow-y-auto">
        {/* One-click push opt-in — dashboard only, so it never nags mid-flow */}
        {page === "dashboard" && user && <PushOnboardingBanner userId={user.id} />}
        <div key={page} className="animate-fade-in">
          {/* Contextual skeleton: the loading frame mimics the destination
              page's real layout (chart grid, trade list, calendar…). */}
          <Suspense fallback={<SkeletonForPage page={page} />}>
            {page === "dashboard" && (
              <Dashboard
                trades={trades}
                onAddTrade={handleAdd}
                tradesLoading={tradesLoading}
                onOpenChecklist={() => setPage("checklist")}
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
            {page === "calendar" && <CalendarPage trades={trades} />}
            {page === "analytics" && <Analytics trades={trades} />}
            {page === "mistakes" && <Mistakes trades={trades} />}
            {page === "missed" && <MissedOpportunities />}
            {page === "insights" && <Insights trades={trades} />}
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
            {page === "profile" && <Profile trades={trades} />}
          </Suspense>
        </div>
      </main>
      {/* Mobile quick account switcher — floating FAB, bottom-left mirror of the AI Coach */}
      <AccountSwitcher variant="fab" />
      {/* Discreet review nudge — self-gating, never during an active flow */}
      <TrustpilotPrompt tradeCount={trades.length} page={page} modalOpen={modalOpen} />
      <MobileNav page={page} setPage={setPage} onAddTrade={handleAdd} />
      <Suspense fallback={null}>
        <AiAssistant trades={trades} />
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
        />
      )}
    </div>
  );
}

export default function App() {
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
