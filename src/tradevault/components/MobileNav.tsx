import { useState } from 'react';
import { LayoutDashboard, BookOpen, Calendar, BarChart3, Sparkles, User, Plus, Target, AlertTriangle, MoreHorizontal, X } from 'lucide-react';
import { Page } from '../types';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';

interface MobileNavProps {
  page: Page;
  setPage: (p: Page) => void;
  onAddTrade: () => void;
}

export default function MobileNav({ page, setPage, onAddTrade }: MobileNavProps) {
  const { t } = useT();
  const [moreOpen, setMoreOpen] = useState(false);

  const leftItems = [
    { id: 'dashboard' as Page, label: t('nav.home'), icon: LayoutDashboard },
    { id: 'journal' as Page, label: t('nav.journal'), icon: BookOpen },
    { id: 'missed' as Page, label: t('nav.missed'), icon: Target },
  ];
  const rightItems = [
    { id: 'calendar' as Page, label: t('nav.calendar'), icon: Calendar },
    { id: 'analytics' as Page, label: t('nav.analytics'), icon: BarChart3 },
  ];
  // Pages that don't fit in the 7-slot bottom bar live behind "More".
  const moreItems = [
    { id: 'mistakes' as Page, label: t('nav.mistakes'), icon: AlertTriangle },
    { id: 'insights' as Page, label: t('nav.insights'), icon: Sparkles },
    { id: 'profile' as Page, label: t('nav.profile'), icon: User },
  ];
  const isMoreActive = moreItems.some((m) => m.id === page);

  const renderItem = ({ id, label, icon: Icon }: { id: Page; label: string; icon: typeof LayoutDashboard }) => (
    <button
      key={id}
      onClick={() => setPage(id)}
      className={cn('bottom-nav-item', page === id ? 'text-blue-400' : 'text-slate-500')}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-semibold">{label}</span>
    </button>
  );

  return (
    <>
      <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav">
        <div className="w-full glass-strong border-t border-white/[0.08]">
          <div className="grid grid-cols-7 items-end px-1 pt-1.5 pb-1 gap-0.5">
            {leftItems.map(renderItem)}
            <div className="flex justify-center">
              <button
                onClick={onAddTrade}
                aria-label="Add trade"
                className="fab-button text-white -mt-5"
              >
                <Plus className="w-6 h-6" strokeWidth={2.5} />
              </button>
            </div>
            {rightItems.map(renderItem)}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn('bottom-nav-item', isMoreActive ? 'text-blue-400' : 'text-slate-500')}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[9px] font-semibold">{t('nav.more')}</span>
            </button>
          </div>
        </div>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMoreOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full glass-strong rounded-t-3xl border-t border-white/[0.08] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white">{t('nav.more')}</h2>
              <button onClick={() => setMoreOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {moreItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setPage(id); setMoreOpen(false); }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-2xl p-4 border transition-all',
                    page === id
                      ? 'bg-blue-500/15 border-blue-500/25 text-blue-400'
                      : 'bg-white/[0.03] border-white/[0.06] text-slate-400'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-semibold text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
