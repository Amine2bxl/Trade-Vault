import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { Modal } from "@/shared/ui";

interface ConfirmOptions {
  danger?: boolean;
  /** Ligne secondaire sous la question (« Cette action est irréversible. »). */
  detail?: string;
  /** Libellé du bouton de confirmation — le verbe de l'action, pas « Confirmer ». */
  confirmLabel?: string;
}
interface PendingConfirm {
  message: string;
  danger: boolean;
  detail?: string;
  confirmLabel?: string;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    setPending({
      message,
      danger: !!options?.danger,
      detail: options?.detail,
      confirmLabel: options?.confirmLabel,
    });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
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
        <Modal
          open
          onClose={() => settle(false)}
          size="sm"
          // Passe au-dessus de toute autre modale — `--tv-z-modal-top` — avec un
          // fond plus sombre.
          wrapperClassName="z-[var(--tv-z-modal-top)]"
          backdropClassName="bg-black/70"
        >
          <div className="p-6">
            <div
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center mb-4",
                pending.danger
                  ? "bg-red-500/15 text-red-400"
                  : "bg-[rgb(var(--tv-accent-rgb)/0.15)] text-[var(--tv-highlight)]",
              )}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-[15px] font-semibold leading-snug text-white">{pending.message}</p>
            {pending.detail && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{pending.detail}</p>
            )}
            <div className="mb-6" />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => settle(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => settle(true)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-lg",
                  pending.danger ? "bg-red-500 hover:bg-red-400" : "tv-accent-fill",
                )}
              >
                {pending.confirmLabel ?? t("common.confirm")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
