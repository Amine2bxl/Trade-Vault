import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import TradeModal from './components/TradeModal';
// Dashboard is the landing page — keep it in the main chunk. Every other page
// (and its heavy deps: recharts, react-markdown) loads on demand.
import Dashboard from './pages/Dashboard';
const Journal = lazy(() => import('./pages/Journal'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Mistakes = lazy(() => import('./pages/Mistakes'));
const Insights = lazy(() => import('./pages/Insights'));
const Profile = lazy(() => import('./pages/Profile'));
const MissedOpportunities = lazy(() => import('./pages/MissedOpportunities'));
const AiAssistant = lazy(() => import('./components/AiAssistant'));
import { Trade, Page } from './types';
import { loadUserTrades, upsertTrade, deleteTrade, deleteAllTrades, migrateLegacyTradeScreenshots } from './store';
import { computeStats } from './utils/tradeCalcs';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import { LanguageProvider, useT } from './i18n/LanguageContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ConfirmProvider, useConfirm } from './contexts/ConfirmContext';

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const { t } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [page, setPage] = useState<Page>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  useEffect(() => {
    let active = true;
    if (user) {
      const userId = user.id;
      loadUserTrades(userId)
        .then((loaded) => {
          if (!active) return;
          setTrades(loaded);
          // One-time background migration: trades that still carry inline
          // base64 screenshots get their images moved to Storage. Each
          // migrated trade is swapped into state so the UI stays in sync.
          migrateLegacyTradeScreenshots(userId, loaded, (migrated) => {
            if (active) setTrades((prev) => prev.map((t) => (t.id === migrated.id ? migrated : t)));
          }).then((n) => {
            if (n > 0) console.info(`[migrate] moved screenshots of ${n} trade(s) to Storage`);
          }).catch(() => {});
        })
        .catch((e) => console.error('Failed to load trades', e));
    } else {
      setTrades([]);
    }
    return () => { active = false; };
  }, [user?.id]);

  const stats = computeStats(trades);

  const handleSave = useCallback(async (trade: Trade) => {
    if (!user) return;
    try {
      await upsertTrade(user.id, trade);
      setTrades(prev => {
        const exists = prev.find(t => t.id === trade.id);
        return exists ? prev.map(t => t.id === trade.id ? trade : t) : [trade, ...prev];
      });
    } catch (e) {
      console.error('Failed to save trade', e);
      toast(t('app.saveTradeFailed'), 'error');
    }
    setModalOpen(false);
    setEditingTrade(null);
  }, [user, t, toast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    if (!(await confirm(t('app.confirmDeleteTrade'), { danger: true }))) return;
    try {
      await deleteTrade(user.id, id);
      setTrades(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('Failed to delete trade', e);
      toast(t('app.saveTradeFailed'), 'error');
    }
  }, [user, t, confirm, toast]);

  const handleDeleteAll = useCallback(async () => {
    if (!user) return;
    if (!(await confirm(t('app.confirmDeleteAllTrades'), { danger: true }))) return;
    try {
      await deleteAllTrades(user.id);
      setTrades([]);
    } catch (e) {
      console.error('Failed to delete trades', e);
      toast(t('app.saveTradeFailed'), 'error');
    }
  }, [user, t, confirm, toast]);

  const handleEdit = useCallback((trade: Trade) => { setEditingTrade(trade); setModalOpen(true); }, []);
  const handleAdd = useCallback(() => { setEditingTrade(null); setModalOpen(true); }, []);
  const handleCloseModal = useCallback(() => { setModalOpen(false); setEditingTrade(null); }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) return <AuthModal />;


  return (
    <div className="relative flex min-h-screen text-white overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="auth-orb w-[600px] h-[600px] bg-blue-600 -top-64 -right-64" style={{ animationDelay: '0s' }} />
        <div className="auth-orb w-[500px] h-[500px] bg-indigo-600 top-1/2 -left-64" style={{ animationDelay: '-7s' }} />
      </div>
      <Sidebar page={page} setPage={setPage} totalPnl={stats.totalPnl} winRate={stats.winRate} />
      <main className="app-main relative flex-1 overflow-y-auto">
        <div key={page} className="animate-fade-in">
          <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>}>
            {page === 'dashboard' && <Dashboard trades={trades} onAddTrade={handleAdd} />}
            {page === 'journal' && <Journal trades={trades} onEdit={handleEdit} onDelete={handleDelete} onDeleteAll={handleDeleteAll} onAdd={handleAdd} onOpenMissed={() => setPage('missed')} />}
            {page === 'calendar' && <CalendarPage trades={trades} />}
            {page === 'analytics' && <Analytics trades={trades} />}
            {page === 'mistakes' && <Mistakes trades={trades} />}
            {page === 'missed' && <MissedOpportunities />}
            {page === 'insights' && <Insights trades={trades} />}
            {page === 'profile' && <Profile trades={trades} onDeleteAll={handleDeleteAll} />}
          </Suspense>
        </div>
      </main>
      <MobileNav page={page} setPage={setPage} onAddTrade={handleAdd} />
      <Suspense fallback={null}>
        <AiAssistant trades={trades} />
      </Suspense>
      {modalOpen && <TradeModal trade={editingTrade} onClose={handleCloseModal} onSave={handleSave} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppContent />
          </ConfirmProvider>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
