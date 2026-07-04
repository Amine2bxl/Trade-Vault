import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';

interface ConfirmOptions { danger?: boolean }
interface PendingConfirm { message: string; danger: boolean }

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    setPending({ message, danger: !!options?.danger });
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setPending(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => settle(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-sm md:rounded-3xl rounded-t-3xl glass-strong border border-white/10 p-6 animate-slide-up md:animate-slide-in"
          >
            <div className={cn(
              'w-11 h-11 rounded-2xl flex items-center justify-center mb-4',
              pending.danger ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
            )}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mb-6">{pending.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => settle(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => settle(true)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg',
                  pending.danger
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-red-500/20'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-blue-500/20'
                )}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
