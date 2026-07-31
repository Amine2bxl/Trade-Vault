import { type ReactNode } from "react";
import { Bot, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { useT } from "../../i18n/LanguageContext";
import { Modal } from "@/shared/ui";

/**
 * JarvisShell — la FENÊTRE de Jarvis (Phase 0).
 *
 * Architecture (terminologie TradeVault) :
 *   JarvisShell      → ce composant : la fenêtre centrée (80–85 % × 85–90 %),
 *                      overlay premium, coins arrondis, responsive.
 *     JarvisWorkspace → le layout 3 colonnes (nav / centre / contexte) — Phase P3/P4.
 *       JarvisCore    → le moteur IA front (canal de conversation) — Phase P2+.
 *         AI Router   → le routeur de modèles, BACKEND, interne — jamais dans l'UI.
 *
 * Règles :
 *   - Composant 100 % présentational : aucune logique IA/métier ici.
 *   - L'application reste visible derrière (overlay dim + léger blur) : ouvrir
 *     Jarvis est un espace de travail, pas une sortie de TradeVault.
 *   - Le contenu central (Accueil, Conversation, blocs…) arrive dans `children`.
 *   - Seul « Jarvis » et « Assistant IA de TradeVault » sont affichés — aucun
 *     nom de fournisseur n'est jamais rendu ici.
 */

export interface JarvisShellProps {
  open: boolean;
  onClose: () => void;
  /** Actions du header (nouvelle discussion, paramètres, voix…) avant « Fermer ». */
  actions?: ReactNode;
  /** Contenu central de l'espace de travail. */
  children: ReactNode;
}

export default function JarvisShell({ open, onClose, actions, children }: JarvisShellProps) {
  const { t } = useT();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="jarvis-shell-title"
      // Overlay premium : la fenêtre flotte sur l'app (dim + léger blur) avec
      // un léger liseré autour du panneau pour la sensation d'« espace de travail ».
      wrapperClassName="p-2 sm:p-4 md:p-6"
      className={cn(
        // ~85 % × 88 % sur desktop (plafonné), bottom-sheet quasi plein écran mobile.
        "w-[98vw] h-[94vh] sm:w-[92vw] sm:h-[92vh]",
        "md:w-[85vw] md:h-[88vh] lg:w-[82vw] lg:h-[85vh]",
        "max-w-[1440px] max-h-[940px]",
        "md:rounded-[28px] rounded-t-[28px]",
        "flex flex-col overflow-hidden",
      )}
    >
      {/* ── Header premium ── */}
      <header className="relative flex items-center gap-3 px-4 md:px-6 py-3.5 md:py-4 border-b border-white/[0.06] bg-gradient-to-b from-cyan-500/[0.06] to-transparent shrink-0">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        {/* Logo Jarvis */}
        <div className="relative shrink-0">
          <span className="absolute -inset-1 rounded-2xl bg-cyan-500/30 blur-md" />
          <div className="relative grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
            <Bot className="w-4.5 h-4.5 md:w-5 md:h-5 text-white" />
          </div>
        </div>
        {/* Identité */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              id="jarvis-shell-title"
              className="text-base font-bold text-white tracking-tight truncate"
            >
              {t("assistant.title")}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {t("assistant.dockStatus")}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{t("assistant.subtitle")}</p>
        </div>
        {/* Actions */}
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* ── Contenu central (Accueil / Conversation / blocs) ── */}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </Modal>
  );
}
