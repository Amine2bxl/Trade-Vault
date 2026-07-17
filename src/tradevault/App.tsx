import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import TradeModal from './components/TradeModal';
import AuthModal from './components/AuthModal';
import CursorGlow from './components/CursorGlow';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import CalendarPage from './pages/CalendarPage';
import Analytics from './pages/Analytics';
import Mistakes from './pages/Mistakes';
import MissedOpportunities from './pages/MissedOpportunities';
import Insights from './pages/Insights';
import Profile from './pages/Profile';
import Goals from './pages/Goals';
import TradingPlanPage from './pages/TradingPlan';
import MonthlyReports from './pages/MonthlyReports';
import AppearancePage from './pages/Appearance';
import SubscriptionPage from './pages/Subscription';
import Settings from './pages/Settings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AccountProvider, useAccounts } from './contexts/AccountContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { useT } from './i18n/LanguageContext';
import { Page, Trade } from './types';
import { useTradeStore } from './hooks/useTradeStore';
import { saveTrade, deleteTrade, deleteAllTrades, createTrade, loadTrade } from './store';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useGlobalTradeShortcuts } from './hooks/useGlobalTradeShortcuts';
import { usePushNotifications } from './hooks/usePushNotifications';
import { subscribeForPush, checkRuleViolations } from './pushRules';
import { CommandPalette } from './components/CommandPalette';
import AIChatWidget from './components/AIChatWidget';
import { loadTradingPlan, loadGoals } from './store';
import { DEFAULT_GOALS, DEFAULT_TRADING_PLAN } from './planning';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { activeId } = useAccounts();
  const { t } = useT();
  const [page, setPage] = useState<Page>('dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const { trades, setTrades, loading } = useTradeStore();
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [plan, setPlan] = useState(DEFAULT_TRADING_PLAN);
  const [themePanel, setThemePanel] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadGoals(user.id), loadTradingPlan(user.id)]).then(([nextGoals, nextPlan]) => {
      setGoals(nextGoals.length ? nextGoals : DEFAULT_GOALS);
      setPlan(nextPlan);
    }).catch(() => {});
  }, [user, activeId]);

  useAppShortcuts(setPage, () => setShowTrade(true));
  useGlobalTradeShortcuts(() => setShowTrade(true));
  useEffect(() => {
    if (!user || !('Notification' in window) || Notification.permission !== 'granted') return;
    subscribeForPush().catch(() => {});
  }, [user]);

  const handleSave = useCallback(async (trade: Trade) => {
    if (!user) return;
    try {
      const normalized = { ...trade, userId: user.id, accountId: activeId };
      const saved = await saveTrade(normalized);
      setTrades(prev => editingTrade ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]);
      setShowTrade(false); setEditingTrade(null);
      toast.success(t('common.saved'));
      checkRuleViolations(saved).then((violations) => violations.forEach((v) => toast.warning(`${t('rules.pushTitle')}: ${v}`))).catch(() => {});
    } catch (e) { console.error('Failed to save trade', e); toast.error(t('app.saveTradeFailed')); }
  }, [user, activeId, editingTrade, setTrades, t]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    await deleteTrade(id, user.id); setTrades(prev => prev.filter(t => t.id !== id));
  }, [user, setTrades]);
  const handleDeleteAll = useCallback(async () => {
    if (!user) return;
    await deleteAllTrades(user.id); setTrades([]);
  }, [user, setTrades]);
  const handleEdit = useCallback(async (id: string) => {
    const full = await loadTrade(id); if (full) { setEditingTrade(full); setShowTrade(true); }
  }, []);

  if (authLoading) return <div className="min-h-screen bg-[#060810] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" /></div>;
  if (!user) return <AuthModal open={showAuth} onOpenChange={setShowAuth} />;

  const shared = { trades, onEdit: handleEdit, onDelete: handleDelete, onAdd: () => { setEditingTrade(null); setShowTrade(true); } };
  const settings = { trades, onDeleteAll: handleDeleteAll, onOpenImport: () => setPage('journal'), onOpenReports: () => setPage('monthly-reports') };
  const pageContent = (() => {
    switch (page) {
      case 'dashboard': return <Dashboard {...shared} />;
      case 'journal': return <Journal {...shared} />;
      case 'calendar': return <CalendarPage {...shared} />;
      case 'analytics': return <Analytics trades={trades} />;
      case 'mistakes': return <Mistakes trades={trades} />;
      case 'missed': return <MissedOpportunities />;
      case 'insights': return <Insights trades={trades} />;
      case 'goals': return <Goals trades={trades} goals={goals} onGoalsChange={setGoals} />;
      case 'trading-plan': return <TradingPlanPage plan={plan} onPlanChange={setPlan} />;
      case 'monthly-reports': return <MonthlyReports trades={trades} />;
      case 'appearance': return <AppearancePage />;
      case 'subscription': return <SubscriptionPage />;
      case 'settings': return <Settings {...settings} onOpenReports={() => setPage('monthly-reports')} />;
      case 'profile': return <Profile />;
      default: return <Dashboard {...shared} />;
    }
  })();
  return (
    <ConfirmProvider>
      <CursorGlow />
      <div className="min-h-screen bg-[#060810] text-foreground flex">
        <Sidebar page={page} setPage={setPage} totalPnl={0} winRate={0} />
        <main className="flex-1 min-w-0 pb-20 md:pb-0">{pageContent}</main>
        <MobileNav page={page} setPage={setPage} onAdd={() => setShowTrade(true)} />
        <AIChatWidget trades={trades} />
      </div>
      {showTrade && <TradeModal trade={editingTrade} onClose={() => { setShowTrade(false); setEditingTrade(null); }} onSave={handleSave} />}
      <CommandPalette page={page} setPage={setPage} onAdd={() => setShowTrade(true)} />
      <Toaster position="top-right" theme="dark" />
    </ConfirmProvider>
  );
}

export default function App() { return <AuthProvider><LanguageProvider><ThemeProvider><AccountProvider><AppContent /></AccountProvider></ThemeProvider></LanguageProvider></AuthProvider>; }
