import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import TradeModal from './components/TradeModal';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import CalendarPage from './pages/CalendarPage';
import Analytics from './pages/Analytics';
import Mistakes from './pages/Mistakes';
import Insights from './pages/Insights';
import Profile from './pages/Profile';
import MissedOpportunities from './pages/MissedOpportunities';
import { Trade, Page } from './types';
import { loadUserTrades, upsertTrade, deleteTrade, deleteAllTrades } from './store';
import { computeStats } from './utils/tradeCalcs';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import { LanguageProvider } from './i18n/LanguageContext';

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [page, setPage] = useState<Page>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  useEffect(() => {
    let active = true;
    if (user) {
      loadUserTrades(user.id)
        .then((t) => { if (active) setTrades(t); })
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
      alert('Could not save trade. Please try again.');
    }
    setModalOpen(false);
    setEditingTrade(null);
  }, [user]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    if (!confirm('Delete this trade?')) return;
    try {
      await deleteTrade(user.id, id);
      setTrades(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('Failed to delete trade', e);
    }
  }, [user]);

  const handleDeleteAll = useCallback(async () => {
    if (!user) return;
    if (!confirm('⚠️ Delete ALL trades? This cannot be undone.')) return;
    try {
      await deleteAllTrades(user.id);
      setTrades([]);
    } catch (e) {
      console.error('Failed to delete trades', e);
    }
  }, [user]);

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
    <div className="flex min-h-screen text-white">
      <Sidebar page={page} setPage={setPage} totalPnl={stats.totalPnl} winRate={stats.winRate} />
      <main className="flex-1 overflow-y-auto min-h-screen pb-24 md:pb-0">
        {page === 'dashboard' && <Dashboard trades={trades} onAddTrade={handleAdd} />}
        {page === 'journal' && <Journal trades={trades} onEdit={handleEdit} onDelete={handleDelete} onDeleteAll={handleDeleteAll} onAdd={handleAdd} />}
        {page === 'calendar' && <CalendarPage trades={trades} />}
        {page === 'analytics' && <Analytics trades={trades} />}
        {page === 'mistakes' && <Mistakes trades={trades} />}
        {page === 'missed' && <MissedOpportunities />}
        {page === 'insights' && <Insights trades={trades} />}
        {page === 'profile' && <Profile trades={trades} onDeleteAll={handleDeleteAll} />}
      </main>
      <MobileNav page={page} setPage={setPage} onAddTrade={handleAdd} />
      {modalOpen && <TradeModal trade={editingTrade} onClose={handleCloseModal} onSave={handleSave} />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><LanguageProvider><AppContent /></LanguageProvider></AuthProvider>;
}
