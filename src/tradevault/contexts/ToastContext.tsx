import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "../utils/cn";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface Ctx {
  toast: (message: string, type?: ToastType) => void;
}
const ToastCtx = createContext<Ctx | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
};
const ACCENT: Record<ToastType, string> = {
  success: "border-emerald-500/20 shadow-emerald-500/10",
  error: "border-red-500/20 shadow-red-500/10",
  info: "border-cyan-500/20 shadow-cyan-500/10",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed z-[100] bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 flex flex-col gap-2 items-center md:items-end pointer-events-none px-4 md:px-0 w-full md:w-auto">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 max-w-sm w-full md:w-auto glass-strong rounded-2xl px-4 py-3 shadow-2xl border animate-slide-up",
              ACCENT[t.type],
            )}
          >
            {ICONS[t.type]}
            <span className="text-sm text-slate-200 flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-slate-500 hover:text-white transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
