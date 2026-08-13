import { useEffect, useState, type ReactNode } from "react";
import { Bell, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Page, SECTIONS } from "../types";
import { SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { preloadPage } from "../pageModules";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useAuth } from "../contexts/AuthContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { cn } from "../utils/cn";
import logoSrc from "@/assets/tradevault-logo.webp";
import { useT } from "../i18n/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";
import { useUnreadCount } from "../hooks/useUnreadCount";

interface SidebarProps {
  page: Page;
  setPage: (p: Page) => void;
  totalPnl: number;
  winRate: number;
}

/**
 * La barre latérale, dépliée (260 px) ou réduite à ses icônes (72 px).
 *
 * ── POURQUOI LA LARGEUR NE S'ANIME PAS ─────────────────────────────────────
 * `MOTION_AND_PERF.md` interdit d'animer `width` : la propriété relaie la mise
 * en page à chaque frame et fait ramer tout ce qui se trouve à droite — c'est
 * à dire l'application entière. La largeur bascule donc d'un coup, et seules
 * les couleurs transitionnent. Un pli net vaut mieux qu'un pli qui saccade.
 *
 * ── EN MODE RÉDUIT, RIEN NE DISPARAÎT SANS RECOURS ─────────────────────────
 * Chaque icône garde son libellé en `title` et en `aria-label` : replier la
 * barre ne doit pas transformer la navigation en devinette, ni la rendre
 * inutilisable au lecteur d'écran. Ce qui n'a aucun sens dans 72 px — le
 * sélecteur de compte, le bloc de performance, l'e-mail — est RETIRÉ plutôt
 * que tronqué à trois lettres suivies de points de suspension.
 */
export default function Sidebar({ page, setPage, totalPnl, winRate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const unread = useUnreadCount(user?.id);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  // Only transition the win-rate bar once it changes AFTER mount — on a fresh
  // load (F5) the bar must render at its final width instantly, otherwise the
  // 0→X transition is what made the navbar "shake" on every refresh.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Une entrée de navigation, dans les deux états — un seul rendu à maintenir. */
  const navRow = ({
    key,
    label,
    icon,
    active,
    onActivate,
    className,
  }: {
    key: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    onActivate: () => void;
    className?: string;
  }) => (
    <button
      key={key}
      onClick={onActivate}
      // Le chunk de la page part au survol ou au focus clavier, soit
      // 100 à 300 ms avant le clic : au moment du clic il est déjà là
      // et le squelette n'a plus lieu d'apparaître.
      onPointerEnter={() => preloadPage(key === "inbox" ? "inbox" : (key as Page))}
      onFocus={() => preloadPage(key === "inbox" ? "inbox" : (key as Page))}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative w-full flex items-center rounded-lg text-[13px] font-medium",
        "transition-colors duration-200",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
        active
          ? "bg-gradient-to-r from-cyan-500/15 to-teal-500/5 text-cyan-400 shadow-sm shadow-cyan-500/10"
          : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]",
        className,
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-gradient-to-b from-cyan-400 to-teal-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
      )}
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && active && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
      )}
    </button>
  );

  return (
    // h-dvh + sticky top-0: the rail is always exactly viewport-height and never
    // moves with page scroll — content scrolls in <main>, nav scrolls internally
    // if it ever overflows. Identical position and alignment on every page.
    // z-30 keeps the rail above any page's full-viewport background layers
    // (e.g. the Checklist's fixed particle/grid canvas), so the navbar keeps
    // the exact same solid style on every page and never looks tinted or
    // transparent — while staying below modals, the palette and the AI FAB.
    //
    // SOLID background (no `backdrop-blur`): the ambient orbs behind the shell
    // animate continuously (orb-float, blur(80px)). A translucent rail with
    // backdrop-filter re-blurs that moving content every frame — expensive on
    // a cold start (the F5 stutter). Solid #08111e keeps the rail pixel-stable
    // on refresh and on every page, with zero per-frame repaint.
    <aside
      className={cn(
        "hidden md:flex h-dvh sticky top-0 z-30 bg-[#08111e] border-r border-white/[0.05] flex-col shrink-0",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "border-b border-white/[0.05] flex items-center shrink-0",
          collapsed ? "flex-col gap-2.5 px-3 py-4" : "gap-3 px-5 py-5",
        )}
      >
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl bg-cyan-500/40 blur-xl opacity-70" />
          <img
            src={logoSrc}
            alt="TradeVault"
            width={36}
            height={36}
            className="relative w-9 h-9 rounded-xl drop-shadow-[0_0_12px_rgba(6,182,212,0.55)]"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">
              TradeVault
            </h1>
            <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em] mt-0.5">
              {t("nav.journal")}
            </p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-600",
            "transition-colors duration-200 hover:bg-white/[0.05] hover:text-slate-200",
            !collapsed && "ml-auto",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Active account switcher — available on every page. Carte CTA premium
          (même design que le cockpit Jarvis). Retiré en mode réduit : un
          sélecteur de compte dans 72 px ne se lit pas. */}
      {!collapsed && (
        <div className="px-3 pt-3 shrink-0">
          <AccountSwitcher variant="card" />
        </div>
      )}

      {/* Navigation — SIX sections. Les pages d'une section vivent dans sa
          barre d'onglets, sous le titre : vingt-et-une entrées à plat ne se
          lisent pas d'un coup d'œil, six oui. Chaque page garde son URL. */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-2 space-y-px min-h-0",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {SECTIONS.map((section) => {
          const { labelKey, icon: Icon } = SECTION_META[section.id];
          const active = sectionForPage(page) === section.id;
          const target = defaultPageOfSection(section.id);
          return navRow({
            key: target,
            label: t(labelKey),
            active,
            onActivate: () => setPage(target),
            icon: (
              <Icon
                className={cn("w-4 h-4 shrink-0", active ? "text-cyan-400" : "text-slate-600")}
              />
            ),
          });
        })}

        {/* L'inbox n'est pas une destination de parcours : c'est une surface de
            notification. Elle sort de la liste des sections et devient une
            cloche, ici comme dans l'en-tête mobile. */}
        {navRow({
          key: "inbox",
          label: t("nav.inbox"),
          active: page === "inbox",
          onActivate: () => setPage("inbox"),
          className: "mt-2",
          icon: (
            <div className="relative shrink-0">
              <Bell
                className={cn("w-4 h-4", page === "inbox" ? "text-cyan-400" : "text-slate-600")}
              />
              {unread > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] px-[3px] rounded-full bg-cyan-500 text-[8px] font-bold text-white flex items-center justify-center leading-none shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                  role="status"
                  aria-label={`${unread} ${unread > 1 ? t("inbox.unreadPlural") : t("inbox.unread")}`}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
          ),
        })}
      </nav>

      {/* Performance — deux nombres et une barre n'entrent pas dans 72 px sans
          devenir illisibles : en mode réduit, on les retire. */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-3 space-y-2 border-t border-white/[0.04] shrink-0">
          <div className="glass rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">{t("stats.totalPnl")}</span>
              <span
                className={cn(
                  "font-display text-sm font-extrabold tabular-nums",
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {formatPnl(totalPnl)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">{t("stats.winRate")}</span>
              <span className="font-display text-sm font-extrabold text-white tabular-nums">
                {formatPct(winRate)}
              </span>
            </div>
            <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400",
                  mounted && "transition duration-250",
                )}
                style={{ width: `${winRate * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* User Section */}
      {user && (
        <div className={cn("pb-4 shrink-0", collapsed ? "px-2 pt-3" : "px-4")}>
          <div
            className={cn(
              "glass rounded-2xl flex items-center",
              collapsed ? "flex-col gap-2 p-2" : "gap-3 p-3",
            )}
          >
            <div
              title={collapsed ? user.name : undefined}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-cyan-400 border border-cyan-500/10 shrink-0"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user.name}</div>
                <div className="text-[10px] text-slate-600 truncate">{user.email}</div>
              </div>
            )}
            <button
              onClick={logout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 shrink-0"
              title={t("common.signOut")}
              aria-label={t("common.signOut")}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
