import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MoreVertical,
  Settings as SettingsIcon,
  User,
  Layers,
} from "lucide-react";
import { Page, SECTIONS } from "../types";
import { SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { preloadPage } from "../pageModules";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { cn } from "../utils/cn";
import logoSrc from "@/assets/tradevault-logo.webp";
import { useT } from "../i18n/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { Modal } from "@/shared/ui";

interface SidebarProps {
  page: Page;
  setPage: (p: Page) => void;
  totalPnl: number;
  winRate: number;
}

export default function Sidebar({ page, setPage, totalPnl, winRate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const { accounts, activeAccount, switchAccount } = useAccounts();
  const unread = useUnreadCount(user?.id);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const groupLabel = (label: string) =>
    !collapsed && (
      <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
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
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-full items-center rounded-xl text-[13.5px] font-medium",
        "transition-colors duration-200",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active ? "bg-cyan-500/10 text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan-400" />}
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {icon}
        {badge}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <span className="rail-tip">{label}</span>}
    </button>
  );

  const settingsSection = SECTION_META.settings;
  const settingsTarget = defaultPageOfSection("settings");

  return (
    <aside
      className={cn(
        "hidden md:flex h-dvh sticky top-0 z-30 shrink-0 flex-col bg-[#08111e] border-r border-white/[0.05]",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      {/* ── MARQUE ── */}
      <div className={cn("relative flex h-16 shrink-0 items-center px-3", collapsed ? "justify-center" : "gap-2.5")}>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-lg bg-cyan-500/30 blur-md" />
          <img src={logoSrc} alt="TradeVault" width={32} height={32} className="relative h-8 w-8 rounded-lg" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-tight text-white">TradeVault</span>
            <span className="block truncate text-[9px] uppercase tracking-[0.2em] text-slate-600">Trading Coach</span>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          className={cn(
            "absolute -right-3 top-[22px] z-10 grid h-6 w-6 place-items-center rounded-full",
            "border border-white/10 bg-[#0d1a2b] text-slate-400",
            "transition-colors duration-200 hover:border-cyan-400/40 hover:text-cyan-300",
          )}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── COMPTE ACTIF ── */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-1">
          <AccountSwitcher variant="card" />
        </div>
      )}

      {/* ── NAVIGATION ── */}
      <nav className={cn("min-h-0 flex-1 px-3 pb-2", collapsed ? "overflow-visible" : "overflow-y-auto")}>
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
              icon: <Icon className={cn("h-[18px] w-[18px]", active ? "text-cyan-400" : "text-slate-500")} strokeWidth={1.9} />,
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
            icon: <Bell className={cn("h-[18px] w-[18px]", page === "inbox" ? "text-cyan-400" : "text-slate-500")} strokeWidth={1.9} />,
            badge: unread > 0 ? (
              <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-cyan-500 px-[3px] text-[8px] font-bold leading-none text-white" role="status">
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
            icon: <settingsSection.icon className={cn("h-[18px] w-[18px]", sectionForPage(page) === "settings" ? "text-cyan-400" : "text-slate-500")} strokeWidth={1.9} />,
          })}
        </div>
      </nav>

      {/* ── PERFORMANCE ── */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-2">
          <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-slate-500">{t("stats.totalPnl")}</span>
              <span className={cn("font-display text-[13px] font-extrabold tabular-nums", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>{formatPnl(totalPnl)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10.5px] text-slate-500">{t("stats.winRate")}</span>
              <span className="font-display text-[13px] font-extrabold tabular-nums text-white">{formatPct(winRate)}</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className={cn("h-full rounded-full bg-cyan-400", mounted && "transition duration-250")} style={{ width: `${winRate * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── MON COMPTE (avec menu ⋮) ── */}
      {user && (
        <div className={cn("flex shrink-0 items-center border-t border-white/[0.05] px-3 py-3", collapsed ? "justify-center" : "gap-2.5")}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-500/15 bg-cyan-500/10 text-[13px] font-bold text-cyan-300">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-white">{t("nav.myAccount")}</div>
              <div className="truncate text-[10.5px] text-slate-600">{user.email}</div>
            </div>
          )}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.myAccount")}
            title={t("nav.myAccount")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Menu ⋮ : compte, sous-comptes, déconnexion ── */}
      {user && (
        <Modal
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          wrapperClassName="z-[80] md:items-center md:justify-center"
          className="md:max-w-xs max-h-[80vh] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-500/15 bg-cyan-500/10 text-sm font-bold text-cyan-300">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{user.name}</div>
              <div className="truncate text-[11px] text-slate-500">{user.email}</div>
            </div>
          </div>

          <div className="p-3 space-y-1">
            {/* Réglages */}
            <button
              onClick={() => { setMenuOpen(false); setPage("settings"); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-white/[0.06] transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0"><SettingsIcon className="w-3.5 h-3.5 text-slate-400" /></span>
              <span className="text-[13px] font-medium">{t("nav.settings")}</span>
            </button>

            {/* Sous-comptes */}
            <div className="px-2.5 pt-2 pb-1">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                <Layers className="w-3 h-3" /> {t("account.title")}
              </span>
            </div>
            {accounts.map((a) => {
              const active = a.id === activeAccount?.id;
              return (
                <button
                  key={a.id}
                  onClick={() => { switchAccount(a.id); setMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors",
                    active ? "bg-cyan-500/10" : "hover:bg-white/[0.06]",
                  )}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}22`, color: a.color }}>
                    <span className="text-[11px] font-bold">{a.name.charAt(0).toUpperCase()}</span>
                  </span>
                  <span className={cn("flex-1 text-left text-[13px] font-medium truncate", active ? "text-white" : "text-slate-300")}>{a.name}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
                </button>
              );
            })}

            <div className="h-px bg-white/[0.06] my-1.5 mx-1" />

            {/* Déconnexion */}
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0"><LogOut className="w-3.5 h-3.5" /></span>
              <span className="text-[13px] font-medium">{t("common.signOut")}</span>
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
