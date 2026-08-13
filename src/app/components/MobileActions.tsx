import { Bell, Bot, Settings } from "lucide-react";
import type { Page } from "../types";
import { preloadPage } from "../pageModules";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadCount } from "../hooks/useUnreadCount";

interface MobileActionsProps {
  page: Page;
  setPage: (p: Page) => void;
}

/**
 * Les trois accès mobiles qui ne sont pas des destinations de parcours.
 *
 * ── POURQUOI L'EN-TÊTE MOBILE A DISPARU ────────────────────────────────────
 * Il y avait ici une barre fixe portant le TITRE DE LA PAGE, Jarvis, la cloche
 * et l'avatar. Le titre y était affiché une deuxième fois — chaque page rend
 * déjà le sien, plus grand, deux centimètres plus bas. Une barre dont la
 * moitié du contenu est un doublon et l'autre moitié trois pastilles se lit
 * comme un bandeau collé par-dessus le produit, pas comme une partie de lui.
 *
 * Ce qui reste est le nécessaire : Jarvis, les notifications, les réglages.
 * Sans fond, sans bordure, sans position fixe — aligné à droite de la ligne
 * d'onglets, dans le flux de la page. Ça ne coiffe plus l'écran, ça
 * l'accompagne.
 *
 * Desktop : la barre latérale porte déjà ces trois-là, d'où `md:hidden`.
 */
export default function MobileActions({ page, setPage }: MobileActionsProps) {
  const { t } = useT();
  const { user } = useAuth();
  const unread = useUnreadCount(user?.id);

  const go = (p: Page) => () => setPage(p);

  const action = (
    target: Page,
    label: string,
    icon: React.ReactNode,
    active: boolean,
    badge?: number,
  ) => (
    <button
      key={target}
      onClick={go(target)}
      onTouchStart={() => preloadPage(target)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-xl",
        "transition-colors duration-200",
        active ? "bg-cyan-500/10 text-cyan-300" : "text-slate-400 hover:bg-white/[0.04]",
      )}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-cyan-500 px-[3px] text-[8px] font-bold leading-none text-white"
          role="status"
          aria-label={`${badge} ${badge > 1 ? t("inbox.unreadPlural") : t("inbox.unread")}`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex items-center gap-1 md:hidden">
      {action(
        "insights",
        t("nav.jarvis"),
        <Bot className="h-[19px] w-[19px]" strokeWidth={1.9} />,
        page === "insights",
      )}
      {action(
        "inbox",
        t("nav.inbox"),
        <Bell className="h-[19px] w-[19px]" strokeWidth={1.9} />,
        page === "inbox",
        unread,
      )}
      {action(
        "settings",
        t("nav.settings"),
        <Settings className="h-[19px] w-[19px]" strokeWidth={1.9} />,
        page === "settings",
      )}
    </div>
  );
}
