import { Suspense, useState, type ReactNode } from "react";
import { Bot, Menu, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { useT } from "../../i18n/LanguageContext";
import { Modal } from "@/shared/ui";
import type { JarvisContext } from "./context";
import { JARVIS_WORKSPACES, type JarvisWorkspaceId } from "./workspaces";

/**
 * JarvisShell — la FENÊTRE de Jarvis (architecture verrouillée, enrichie UX).
 *
 * Jarvis est une PLATEFORME : le Shell n'affiche QUE le workspace actif
 * (lazy). Il expose deux slots optionnels sans dépendre d'aucun module métier :
 *  - `sidebar`  → colonne conversations (drawer sur mobile) ;
 *  - `footer`   → bandeau bas (crédits IA + compte actif).
 * Le header affiche l'identité Jarvis « copilote IA » + un bouton paramètres.
 *
 * Seuls « Jarvis » et « Assistant IA de TradeVault » sont affichés — aucun
 * nom de fournisseur n'est jamais rendu ici.
 */

export interface JarvisShellProps {
  open: boolean;
  onClose: () => void;
  /** Workspace actif affiché dans la fenêtre. */
  activeWorkspace: JarvisWorkspaceId;
  /** Contexte agrégé (compte, page, profil, trades…) transmis aux workspaces. */
  context: JarvisContext;
  /** Prompt fourni par une page externe (`tv:ask-coach`), consommé à l'ouverture. */
  initialPrompt?: string;
  /** Navigation entre espaces. */
  onNavigateWorkspace?: (id: JarvisWorkspaceId) => void;
  /** Actions globales du header (paramètres…). */
  actions?: ReactNode;
  /** Colonne conversations (facultative). */
  sidebar?: ReactNode;
  /** Bandeau bas (crédits IA + compte actif). */
  footer?: ReactNode;
}

export default function JarvisShell({
  open,
  onClose,
  activeWorkspace,
  context,
  initialPrompt,
  onNavigateWorkspace,
  actions,
  sidebar,
  footer,
}: JarvisShellProps) {
  const { t } = useT();
  const Workspace = JARVIS_WORKSPACES[activeWorkspace];
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="jarvis-shell-title"
      wrapperClassName="p-2 sm:p-4 md:p-6"
      className={cn(
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
        {/* Ouverture de la sidebar (mobile) */}
        {sidebar && (
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={t("jarvisConv.toggle")}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors shrink-0"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        {/* Avatar Jarvis */}
        <div className="relative shrink-0">
          <span className="absolute -inset-1 rounded-2xl bg-cyan-500/30 blur-md" />
          <div className="relative grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
            <Bot className="w-4.5 h-4.5 md:w-5 md:h-5 text-white" />
          </div>
        </div>
        {/* Identité copilote */}
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
          <p className="text-[11px] text-slate-500 truncate">{t("jarvis.copilot")}</p>
        </div>
        {/* Actions globales */}
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* ── Corps : [sidebar | workspace] ── */}
      <div className="relative flex-1 min-h-0 flex">
        {sidebar && (
          <>
            {/* Desktop : colonne fixe, étroite, sans débordement dans la zone */}
            <aside className="hidden md:flex w-56 shrink-0 min-w-0 overflow-hidden border-r border-white/[0.05] bg-white/[0.01] min-h-0">
              {sidebar}
            </aside>
            {/* Mobile : drawer superposé */}
            {sidebarOpen && (
              <>
                <div
                  className="md:hidden absolute inset-0 z-20 bg-black/60 backdrop-blur-sm"
                  onClick={() => setSidebarOpen(false)}
                />
                <aside className="md:hidden absolute inset-y-0 left-0 z-30 w-72 bg-[#0a1120] border-r border-white/[0.06] min-h-0">
                  {sidebar}
                </aside>
              </>
            )}
          </>
        )}

        {/* Workspace actif (lazy) + footer */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    Chargement…
                  </div>
                </div>
              }
            >
              {Workspace ? (
                <Workspace
                  context={context}
                  initialPrompt={initialPrompt}
                  openWorkspace={onNavigateWorkspace ?? (() => {})}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                  {`${activeWorkspace} — bientôt disponible`}
                </div>
              )}
            </Suspense>
          </div>
          {footer && (
            <div className="shrink-0 border-t border-white/[0.05] bg-gradient-to-b from-transparent to-white/[0.02] flex items-center justify-between gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
