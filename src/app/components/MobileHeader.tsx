import { Bell, Bot } from "lucide-react";
import type { Page } from "../types";
import { PAGE_META } from "../navigation";
import { preloadPage } from "../pageModules";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadCount } from "../hooks/useUnreadCount";

interface MobileHeaderProps {
  page: Page;
  setPage: (p: Page) => void;
}

/**
 * En-tête mobile — la surface qui manquait.
 *
 * La barre du bas ne porte plus que quatre sections et le bouton d'ajout ; il
 * fallait donc un endroit pour ce qui n'est pas une destination de parcours :
 *
 * - la CLOCHE (`inbox`), avec son compteur de non-lus. Elle vivait jusqu'ici
 *   sur le bouton « Plus », qui disparaît avec le passage à six sections ;
 * - JARVIS, à une seule touche : c'est la différenciation du produit, pas une
 *   page à aller chercher ;
 * - l'AVATAR, qui mène aux réglages.
 *
 * `env(safe-area-inset-top)` : sur iPhone l'encoche mangerait la rangée.
 */
export default function MobileHeader({ page, setPage }: MobileHeaderProps) {
  const { t } = useT();
  const { user } = useAuth();
  const unread = useUnreadCount(user?.id);

  const go = (p: Page) => () => setPage(p);

  return (
    <header className="mobile-header md:hidden">
      <h1 className="flex-1 min-w-0 truncate text-[15px] font-bold text-white tracking-tight">
        {t(PAGE_META[page].labelKey)}
      </h1>

      <button
        onClick={go("insights")}
        onTouchStart={() => preloadPage("insights")}
        aria-label={t("nav.jarvis")}
        className={cn("mobile-header-action", page === "insights" && "text-cyan-300")}
      >
        <Bot className="w-[19px] h-[19px]" />
      </button>

      <button
        onClick={go("inbox")}
        onTouchStart={() => preloadPage("inbox")}
        aria-label={t("nav.inbox")}
        className={cn("mobile-header-action", page === "inbox" && "text-cyan-300")}
      >
        <Bell className="w-[19px] h-[19px]" />
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 h-3.5 min-w-[14px] px-[3px] rounded-full bg-cyan-500 text-[8px] font-bold text-white flex items-center justify-center leading-none shadow-[0_0_6px_rgba(6,182,212,0.6)]"
            role="status"
            aria-label={`${unread} ${unread > 1 ? t("inbox.unreadPlural") : t("inbox.unread")}`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <button
        onClick={go("settings")}
        onTouchStart={() => preloadPage("settings")}
        aria-label={t("nav.settings")}
        className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/10 text-[13px] font-bold text-cyan-400"
      >
        {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
      </button>
    </header>
  );
}
