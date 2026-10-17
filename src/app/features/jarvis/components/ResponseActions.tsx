import { useState, type ReactNode } from "react";
import { Check, Copy } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { useToast } from "@/app/contexts/ToastContext";

/** Actions de lecture séparées de l'analyse : le contenu ne bouge pas au survol. */
export function ResponseActions({ text, children }: { text: string; children?: ReactNode }) {
  const { t } = useT();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast(t("jarvis.copyError"), "error");
    }
  };
  return (
    <div className="jarvis-response-actions">
      {text && (
        <button
          type="button"
          onClick={copy}
          className="jarvis-listen"
          aria-label={t(copied ? "jarvis.copied" : "jarvis.copy")}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span aria-live="polite">{t(copied ? "jarvis.copied" : "jarvis.copy")}</span>
        </button>
      )}
      {children}
    </div>
  );
}
