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

  // Symmetric 2 + FAB + 2 layout. Two primary tabs each side of the central
  // add button; everything else lives behind "More".
  const leftItems = [
    { id: 'dashboard' as Page, label: t('nav.home'), icon: LayoutDashboard },
    { id: 'journal' as Page, label: t('nav.journal'), icon: BookOpen },
  ];
  const rightItems = [
    { id: 'analytics' as Page, label: t('nav.analytics'), icon: BarChart3 },
  ];
  const moreItems = [
    { id: 'calendar' as Page, label: t('nav.calendar'), icon: Calendar },
    { id: 'missed' as Page, label: t('nav.missed'), icon: Target },
    { id: 'mistakes' as Page, label: t('nav.mistakes'), icon: AlertTriangle },
    { id: 'insights' as Page, label: t('nav.insights'), icon: Sparkles },
    { id: 'profile' as Page, label: t('nav.profile'), icon: User },
  ];
  const isMoreActive = moreItems.some((m) => m.id === page);

  const renderItem = ({ id, label, icon: Icon, active, onClick }: { id: string; label: string; icon: typeof LayoutDashboard; active: boolean; onClick: () => void }) => (
    <button
      key={id}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn('bottom-nav-item', active ? 'text-blue-400' : 'text-slate-500')}
    >
      <span className={cn('bottom-nav-dot', active && 'bottom-nav-dot-active')} />
      <Icon className="w-[22px] h-[22px]" />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );

  return (
    <>
      <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav">
        <div className="w-full glass-strong border-t border-white/[0.08]">
          <div className="grid grid-cols-5 items-stretch px-2 pt-2 pb-1 gap-1">
            {leftItems.map((it) => renderItem({ ...it, active: page === it.id, onClick: () => setPage(it.id) }))}
            <div className="flex justify-center items-center">
              <button
                onClick={onAddTrade}
                aria-label="Add trade"
                className="fab-button text-white -mt-6"
              >
                <Plus className="w-6 h-6" strokeWidth={2.5} />
              </button>
            </div>
            {rightItems.map((it) => renderItem({ ...it, active: page === it.id, onClick: () => setPage(it.id) }))}
            {renderItem({ id: 'more', label: t('nav.more'), icon: MoreHorizontal, active: isMoreActive, onClick: () => setMoreOpen(true) })}
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
