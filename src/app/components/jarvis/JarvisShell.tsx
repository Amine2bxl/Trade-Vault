import { Suspense, useState, type ReactNode } from "react";
import { Bot, MessageSquare, PanelLeft, Settings2, Sparkles, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { useT } from "../../i18n/LanguageContext";
import { Modal, SubNav, type SubNavItem } from "@/shared/ui";
import type { JarvisContext } from "./context";
import { JARVIS_WORKSPACES, type JarvisWorkspaceId } from "./workspaces";

/**
 * JarvisShell — la FENÊTRE de Jarvis (architecture verrouillée, chrome refait).
 *
 * Jarvis est une PLATEFORME : le Shell n'affiche QUE le workspace actif
 * (lazy). Il expose deux slots optionnels sans dépendre d'aucun module métier :
 *  - `sidebar`  → colonne conversations (tiroir sur mobile) ;
 *  - `footer`   → bandeau bas (crédits IA).
 *
 * ── CE QUI CHANGE, ET POURQUOI ────────────────────────────────────────────
 *
 * L'en-tête était une bande de 64px portant un dégradé cyan, un avatar cerné
 * d'un halo flou, une pastille verte à point clignotant (« coach en ligne ») et
 * deux lignes de texte qui redisaient toutes les deux ce qu'est Jarvis. Il
 * annonçait l'assistant ; il ne disait pas OÙ on était ni où aller.
 *
 * La bande fait maintenant 48px et porte la seule chose qu'un en-tête doit
 * porter : la marque, et LA NAVIGATION. Les trois espaces (Accueil,
 * Conversation, Réglages) étaient jusqu'ici dispersés — « Accueil » dans la
 * colonne de gauche, « Réglages » derrière un engrenage anonyme à droite, et
 * la Conversation joignable seulement en ouvrant une conversation. Ils vivent
 * ensemble, dans le contrôle segmenté du produit (`SubNav`), toujours visible,
 * et l'espace courant est nommé.
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
  /** Actions globales supplémentaires, posées avant le bouton de fermeture. */
  actions?: ReactNode;
  /** Colonne conversations (facultative). */
  sidebar?: ReactNode;
  /** Bandeau bas (crédits IA). */
  footer?: ReactNode;
}

/** Les espaces réellement navigables — ceux que le registre sait rendre. */
const NAVIGABLE: readonly JarvisWorkspaceId[] = ["home", "conversation", "settings"];

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

  const ICON: Record<string, ReactNode> = {
    home: <Sparkles className="h-3.5 w-3.5" />,
    conversation: <MessageSquare className="h-3.5 w-3.5" />,
    settings: <Settings2 className="h-3.5 w-3.5" />,
  };
  const LABEL: Record<string, string> = {
    home: t("jarvisSide.home"),
    conversation: t("jarvis.conversation"),
    settings: t("jarvisSettings.title"),
  };
  const navItems: SubNavItem<JarvisWorkspaceId>[] = NAVIGABLE.map((id) => ({
    id,
    label: LABEL[id],
    icon: ICON[id],
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="jarvis-shell-title"
      wrapperClassName="p-0 md:p-6"
      className={cn(
        "h-[94vh] w-full sm:h-[92vh]",
        "md:h-[88vh] md:w-[88vw] lg:h-[86vh] lg:w-[84vw]",
        "max-h-[940px] max-w-[1400px]",
        // Le rayon de la coque, pas un 28px écrit à la main.
        "tv-jarvis-shell",
        "flex flex-col overflow-hidden",
      )}
    >
      {/* ── La bande de tête : marque, navigation, fermeture ── */}
      <header className="tv-jarvis-bar tv-jarvis-bar-top">
        {/* Le tiroir des conversations (mobile) — il n'existe que s'il y a une
            colonne à ouvrir. */}
        {sidebar && (
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={t("jarvisConv.toggle")}
            aria-expanded={sidebarOpen}
            className="tv-jarvis-icon-btn md:hidden"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {/* La marque + le nom. Le nom disparaît sous 640px : la navigation est
            plus utile que le mot « Jarvis » sur une fenêtre qui EST Jarvis. */}
        <span className="tv-jarvis-mark tv-jarvis-mark-on h-7 w-7 shrink-0">
          <Bot className="h-4 w-4" />
        </span>
        <h2 id="jarvis-shell-title" className="tv-title hidden min-w-0 shrink-0 truncate sm:block">
          {t("assistant.title")}
        </h2>

        {/* LA NAVIGATION. Elle prend la place que prenaient deux lignes de
            slogan, et elle défile sur téléphone au lieu de passer à la ligne. */}
        {onNavigateWorkspace && (
          <div className="min-w-0 flex-1">
            <SubNav
              items={navItems}
              value={activeWorkspace}
              onChange={onNavigateWorkspace}
              ariaLabel={t("assistant.title")}
              className="ml-auto w-fit max-w-full"
            />
          </div>
        )}
        {!onNavigateWorkspace && <div className="min-w-0 flex-1" />}

        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="tv-jarvis-icon-btn"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* ── Corps : [sidebar | workspace] ── */}
      <div className="relative flex min-h-0 flex-1">
        {sidebar && (
          <>
            {/* Desktop : colonne fixe, étroite, sans débordement dans la zone */}
            <aside className="hidden min-h-0 w-52 min-w-0 shrink-0 overflow-hidden border-r border-[var(--tv-border)] md:flex">
              {sidebar}
            </aside>
            {/* Mobile : tiroir superposé */}
            {sidebarOpen && (
              <>
                <div
                  className="absolute inset-0 z-20 bg-black/50 md:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
                <aside className="absolute inset-y-0 left-0 z-[var(--tv-z-rail)] min-h-0 w-72 border-r border-[var(--tv-border)] bg-[var(--tv-plate-1)] md:hidden">
                  {sidebar}
                </aside>
              </>
            )}
          </>
        )}

        {/* Workspace actif (lazy) + footer */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tv-border-strong)] border-t-[var(--tv-accent)]" />
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
                <div className="tv-prose flex flex-1 items-center justify-center text-slate-500">
                  {`${activeWorkspace} — bientôt disponible`}
                </div>
              )}
            </Suspense>
          </div>
          {footer && <div className="tv-jarvis-bar tv-jarvis-bar-bottom">{footer}</div>}
        </div>
      </div>
    </Modal>
  );
}
