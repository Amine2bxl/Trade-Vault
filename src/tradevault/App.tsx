import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import TradeModal from "./components/TradeModal";
// Dashboard is the landing page — keep it in the main chunk. Every other page
// (and its heavy deps: recharts, react-markdown) loads on demand.
import Dashboard from "./pages/Dashboard";
const Journal = lazy(() => import("./pages/Journal"));
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
const AiAssistant = lazy(() => import("./components/AiAssistant"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const ImportCsvModal = lazy(() => import("./components/ImportCsvModal"));
import TradeDetailModal from "./components/TradeDetailModal";
import { Trade, Page } from "./types";
import {
  loadUserTrades,
  upsertTrade,
  deleteTrade,
  deleteAllTrades,
  migrateLegacyTradeScreenshots,
} from "./store";
import { computeStats } from "./utils/tradeCalcs";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthModal from "./components/AuthModal";
import { PageSkeleton } from "./components/Skeleton";
import { LanguageProvider, useT } from "./i18n/LanguageContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ConfirmProvider, useConfirm } from "./contexts/ConfirmContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
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
    let active = true;
    if (user) {
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
  }, [user?.id]);

  const stats = computeStats(trades);

  // Optimistic writes: the UI updates instantly and rolls back to the previous
  // snapshot if the request fails, so saving never blocks the workflow.
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
      }
    },
    [user, t, toast],
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

  // CSV import: persist each row, keep the ones that made it
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
      if (saved.length > 0) setTrades((prev) => [...saved, ...prev]);
      return saved.length;
    },
    [user],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
    );
  }

  if (!isAuthenticated) return <AuthModal />;

  return (
    // h-dvh + overflow-hidden: the shell is exactly one viewport tall — content
    // scrolls inside <main>, so the sidebar rail never moves on any page.
    <div className="relative flex h-dvh text-white overflow-hidden">
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
        <div key={page} className="animate-fade-in">
          <Suspense fallback={<PageSkeleton />}>
            {page === "dashboard" && (
              <Dashboard trades={trades} onAddTrade={handleAdd} tradesLoading={tradesLoading} />
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
              />
            )}
            {page === "profile" && <Profile trades={trades} />}
          </Suspense>
        </div>
      </main>
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
        <LanguageProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AppContent />
            </ConfirmProvider>
          </ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
