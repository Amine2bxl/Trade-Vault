import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings as SettingsIcon,
  User,
} from "lucide-react";
import { Page, SECTIONS } from "../types";
import { SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { preloadPage } from "../pageModules";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { cn } from "../utils/cn";
import logoSrc from "@/assets/tradevault-logo.webp";
import { useT } from "../i18n/LanguageContext";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { Modal } from "@/shared/ui";
import AccountSwitcher from "./AccountSwitcher";

interface SidebarProps {
  page: Page;
  setPage: (p: Page) => void;
  totalPnl: number;
}

export default function Sidebar({ page, setPage, totalPnl }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const { activeAccount } = useAccounts();
  const unread = useUnreadCount(user?.id);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);

  // Infobulle de la barre repliée, rendue en PORTAL (position fixe) : la barre
  // repliée est `overflow-hidden` pour un repli/dépli animé sans débordement de
  // texte, ce qui clipperait une infobulle absolue posée à droite de l'icône.
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const showTip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);

  const row = ({
    key,
    label,
    icon,
    active,
    target,
    onActivate,
    badge,
  }: {
    key: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    target?: Page;
    onActivate: () => void;
    badge?: ReactNode;
  }) => (
    <button
      key={key}
      onClick={onActivate}
      onPointerEnter={target ? () => preloadPage(target) : undefined}
      onFocus={target ? () => preloadPage(target) : undefined}
      onMouseEnter={collapsed ? (e) => showTip(e, label) : undefined}
      onMouseLeave={collapsed ? hideTip : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-full items-center rounded-xl text-[13.5px] font-medium",
        "transition-colors duration-200",
        // Repliée : icône centrée dans la largeur fixe. Dépliée : icône à gauche.
        // La largeur de la barre est la SEULE chose qui anime ; l'icône reste
        // quasi immobile (décalage de ~3px absorbé par l'easing fluide).
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active
          ? "bg-cyan-500/10 text-white"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan-400" />
      )}
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {icon}
        {badge}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const settingsSection = SECTION_META.settings;
  const settingsTarget = defaultPageOfSection("settings");

  return (
    <aside
      className={cn(
        "relative hidden md:flex h-dvh sticky top-0 z-[var(--tv-z-rail)] shrink-0 flex-col bg-[#08111e] border-r border-white/[0.05]",
        // Largeur animée, contenu clippé par le wrapper interne : au dépli, les
        // étiquettes et la carte de compte se révèlent au lieu de déborder ; au
        // repli, la barre rétrécit sans texte orphelin. 300 ms, easing fluide
        // (jamais agressif).
        "transition-[width] duration-500 ease-[var(--tv-ease-out)]",
        collapsed ? "w-[72px]" : "w-[248px]",
      )}
    >
      {/* Wrapper interne : clippe le contenu pendant l'animation de largeur. */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* ── MARQUE — hauteur constante, le logo ne saute pas ── */}
        <div
          className={cn(
            "flex h-[72px] shrink-0 items-center",
            collapsed ? "justify-center px-0" : "justify-start px-3",
          )}
        >
          <div className={cn("sidebar-brand", collapsed && "justify-center")}>
            <div className="sidebar-brand-logo">
              <img src={logoSrc} alt="TradeVault" width={40} height={40} />
            </div>
            {!collapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">TradeVault</span>
              </div>
            )}
          </div>
        </div>

        {/* ── NAVIGATION ── */}
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          <div className="space-y-1">
            {SECTIONS.filter((section) => section.id !== "settings").map((section) => {
              const { labelKey, icon: Icon } = SECTION_META[section.id];
              const active = sectionForPage(page) === section.id;
              const target = defaultPageOfSection(section.id);
              return row({
                key: section.id,
                label: t(labelKey),
                active,
                target,
                onActivate: () => setPage(target),
                icon: (
                  <Icon
                    className={cn("h-[18px] w-[18px]", active ? "text-cyan-400" : "text-slate-500")}
                    strokeWidth={1.9}
                  />
                ),
              });
            })}
          </div>

          {/* Séparateur discret entre les sections et le compte — visible plié et déplié. */}
          <div className="my-2 h-px bg-white/[0.06]" />

          <div className="space-y-1">
            {row({
              key: "inbox",
              label: t("nav.inbox"),
              active: page === "inbox",
              target: "inbox",
              onActivate: () => setPage("inbox"),
              icon: (
                <Bell
                  className={cn(
                    "h-[18px] w-[18px]",
                    page === "inbox" ? "text-cyan-400" : "text-slate-500",
                  )}
                  strokeWidth={1.9}
                />
              ),
              badge:
                unread > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-[3px] text-[10px] font-bold leading-none text-white"
                    role="status"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : undefined,
            })}
            {row({
              key: "settings",
              label: t(settingsSection.labelKey),
              active: sectionForPage(page) === "settings",
              target: settingsTarget,
              onActivate: () => setPage(settingsTarget),
              icon: (
                <settingsSection.icon
                  className={cn(
                    "h-[18px] w-[18px]",
                    sectionForPage(page) === "settings" ? "text-cyan-400" : "text-slate-500",
                  )}
                  strokeWidth={1.9}
                />
              ),
            })}
          </div>
        </nav>

        {/* ── COMPTE ACTIF ── */}
        {user && !collapsed && (
          <div className="shrink-0 border-t border-white/[0.05] px-3 py-3">
            <AccountSwitcher
              variant="card"
              balance={(activeAccount?.startingBalance ?? 0) + totalPnl}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setPage(settingsTarget)}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold text-slate-400 bg-white/[0.03] border border-white/[0.06] hover:text-white hover:bg-white/[0.06] transition"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                {t("nav.settings")}
              </button>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label={t("common.signOut")}
                title={t("common.signOut")}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 bg-white/[0.03] border border-white/[0.06] hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="shrink-0 border-t border-white/[0.05] px-3 py-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label={t("nav.myAccount")}
              title={t("nav.myAccount")}
              className="w-full h-10 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Bouton plier/déplier — fixé sur la bordure droite, position stable,
          il glisse avec le bord pendant l'animation au lieu de sauter. ── */}
      <button
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        className="absolute -right-3 top-[24px] z-20 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-[#0d1a2b] text-slate-400 shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-colors duration-200 hover:border-cyan-400/40 hover:text-cyan-300"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* ── Menu compact (sidebar repliée) : compte + déconnexion ── */}
      {user && (
        <Modal
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          wrapperClassName="z-[var(--tv-z-modal)] md:items-center md:justify-center"
          className="md:max-w-xs"
        >
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-500/15 bg-cyan-500/10 text-[15px] font-bold text-cyan-300">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{user.name}</div>
              <div className="truncate text-[11px] text-slate-500">{user.email}</div>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                setPage(settingsTarget);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-white/[0.06] transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <span className="text-[13px] font-medium">{t("nav.settings")}</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </span>
              <span className="text-[13px] font-medium">{t("common.signOut")}</span>
            </button>
          </div>
        </Modal>
      )}

      {typeof document !== "undefined" &&
        tip &&
        createPortal(
          <div
            className="rail-tip"
            style={{
              position: "fixed",
              top: tip.top,
              left: tip.left,
              transform: "translateY(-50%)",
              opacity: 1,
              zIndex: 100,
            }}
          >
            {tip.text}
          </div>,
          document.body,
        )}
    </aside>
  );
}
