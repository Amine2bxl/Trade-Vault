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

  const groupLabel = (label: string) =>
    !collapsed && (
      <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tertiary">
        {label}
      </p>
    );

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
        "group relative flex h-10 w-full items-center rounded-md text-[13.5px] font-medium",
        "transition-colors duration-200",
        // Repliée : mêmes px-3 que dépliée, pour que l'icône ne bouge pas —
        // seule la largeur de la barre et l'étiquette (masquée) changent.
        collapsed ? "px-3" : "gap-3 px-3",
        active
          ? "bg-accent-subtle text-primary"
          : "text-secondary hover:bg-hover hover:text-primary",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
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
        "hidden md:flex h-dvh sticky top-0 z-30 shrink-0 flex-col bg-base border-r border-border",
        // Largeur animée, contenu clippé : au dépli, les étiquettes et la carte
        // de compte se révèlent au lieu de déborder sur la page ; au repli, la
        // barre rétrécit sans laisser de texte orphelin. 250 ms, easing symétrique.
        "transition-[width] duration-250 ease-in-out overflow-hidden",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      {/* ── MARQUE ── */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          // Repliée : logo + chevron empilés (le chevron ne déborde plus, la
          // barre est `overflow-hidden` pour l'animation de largeur).
          collapsed ? "flex-col justify-center gap-2 py-3 px-0" : "h-[72px] justify-between px-3",
        )}
      >
        <div className={cn("sidebar-brand", collapsed && "justify-center")}>
          <div className="sidebar-brand-logo">
            <img src={logoSrc} alt="TradeVault" width={40} height={40} />
          </div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">TradeVault</span>
              <span className="sidebar-brand-tagline">Trading Coach</span>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full",
            "border border-border bg-surface text-secondary",
            "transition-colors duration-200 hover:border-border-strong hover:text-primary",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── NAVIGATION ── */}
      <nav
        className={cn(
          "min-h-0 flex-1 px-3 py-2",
          collapsed ? "overflow-visible" : "overflow-y-auto",
        )}
      >
        {groupLabel(t("nav.groupNavigate"))}
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
                  className={cn("h-[18px] w-[18px]", active ? "text-accent" : "text-tertiary")}
                  strokeWidth={1.75}
                />
              ),
            });
          })}
        </div>

        {groupLabel(t("nav.groupAccount"))}
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
                  page === "inbox" ? "text-accent" : "text-tertiary",
                )}
                strokeWidth={1.75}
              />
            ),
            badge:
              unread > 0 ? (
                <span
                  className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-[3px] text-[10px] font-bold leading-none text-contrast"
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
                  sectionForPage(page) === "settings" ? "text-accent" : "text-tertiary",
                )}
                strokeWidth={1.75}
              />
            ),
          })}
        </div>
      </nav>

      {/* ── COMPTE ACTIF ── */}
      {user && !collapsed && (
        <div className="shrink-0 border-t border-border px-3 py-3">
          <AccountSwitcher
            variant="card"
            balance={(activeAccount?.startingBalance ?? 0) + totalPnl}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setPage(settingsTarget)}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[11px] font-semibold text-secondary bg-raised border border-border hover:text-primary hover:bg-hover transition"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              {t("nav.settings")}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label={t("common.signOut")}
              title={t("common.signOut")}
              className="h-8 w-8 rounded-md flex items-center justify-center text-secondary bg-raised border border-border hover:text-red-500 hover:bg-red-500/10 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {user && collapsed && (
        <div className="shrink-0 border-t border-border px-3 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.myAccount")}
            title={t("nav.myAccount")}
            className="w-full h-10 flex items-center justify-center rounded-md border border-border bg-surface text-secondary hover:text-primary hover:bg-hover transition"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Menu compact (sidebar repliée) : compte + déconnexion ── */}
      {user && (
        <Modal
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          wrapperClassName="z-[80] md:items-center md:justify-center"
          className="md:max-w-xs"
        >
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-accent/15 bg-accent-subtle text-[15px] font-semibold text-accent">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-primary">{user.name}</div>
              <div className="truncate text-[11px] text-tertiary">{user.email}</div>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                setPage(settingsTarget);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-secondary hover:bg-hover transition-colors"
            >
              <span className="w-7 h-7 rounded-md bg-raised flex items-center justify-center shrink-0">
                <SettingsIcon className="w-3.5 h-3.5 text-tertiary" />
              </span>
              <span className="text-[13px] font-medium">{t("nav.settings")}</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <span className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
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
