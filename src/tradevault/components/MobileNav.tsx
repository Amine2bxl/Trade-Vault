import { LayoutDashboard, BookOpen, Calendar, BarChart3, Sparkles, User, Plus } from 'lucide-react';
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
  const leftItems = [
    { id: 'dashboard' as Page, label: t('nav.home'), icon: LayoutDashboard },
    { id: 'journal' as Page, label: t('nav.journal'), icon: BookOpen },
    { id: 'calendar' as Page, label: t('nav.calendar'), icon: Calendar },
  ];
  const rightItems = [
    { id: 'analytics' as Page, label: t('nav.analytics'), icon: BarChart3 },
    { id: 'insights' as Page, label: t('nav.ai'), icon: Sparkles },
    { id: 'profile' as Page, label: t('nav.profile'), icon: User },
  ];
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
        </div>
      </div>
    </div>
  );
}
