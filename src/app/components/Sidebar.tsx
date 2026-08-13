import { useEffect, useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { Page, SECTIONS } from "../types";
import { SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { preloadPage } from "../pageModules";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useAuth } from "../contexts/AuthContext";
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

export default function Sidebar({ page, setPage, totalPnl, winRate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const unread = useUnreadCount(user?.id);
  // Only transition the win-rate bar once it changes AFTER mount — on a fresh
  // load (F5) the bar must render at its final width instantly, otherwise the
  // 0→X transition is what made the navbar "shake" on every refresh.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    // Fluid rail : une seule surface continue, sans blocs séparés par des
    // bordures dures. Le compte actif, la navigation, la perf et l'utilisateur
    // coulent les uns dans les autres avec un simple espacement.
    <aside className="hidden md:flex w-[260px] h-dvh sticky top-0 z-30 bg-[#08111e] border-r border-white/[0.05] flex-col shrink-0">
      {/* Brand — discret, sans bordure dure */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl bg-cyan-500/40 blur-xl opacity-70" />
          <img
            src={logoSrc}
            alt="TradeVault"
            width={34}
            height={34}
            className="relative w-8.5 h-8.5 rounded-xl drop-shadow-[0_0_12px_rgba(6,182,212,0.55)]"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white tracking-tight leading-tight">
            TradeVault
          </h1>
          <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em] mt-0.5">
            {t("nav.journal")}
          </p>
        </div>
      </div>

      {/* Compte actif — intégré, pas une carte séparée */}
      <div className="px-3 pb-2 shrink-0">
        <AccountSwitcher variant="card" />
      </div>

      {/* Navigation — sections, espacées sans bordures */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0">
        {SECTIONS.map((section) => {
          const { labelKey, icon: Icon } = SECTION_META[section.id];
          const active = sectionForPage(page) === section.id;
          const target = defaultPageOfSection(section.id);
          return (
            <button
              key={section.id}
              onClick={() => setPage(target)}
              onPointerEnter={() => preloadPage(target)}
              onFocus={() => preloadPage(target)}
              className={cn(
                "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-white/[0.05] text-white"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]",
              )}
            >
              <Icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0 transition-colors",
                  active ? "text-cyan-400" : "text-slate-600",
                )}
              />
              <span className="truncate">{t(labelKey)}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_6px_rgba(6,182,212,0.7)]" />
              )}
            </button>
          );
        })}

        {/* Inbox — cloche, surface de notification */}
        <button
          onClick={() => setPage("inbox")}
          onPointerEnter={() => preloadPage("inbox")}
          onFocus={() => preloadPage("inbox")}
          aria-label={t("nav.inbox")}
          className={cn(
            "relative mt-1.5 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
            page === "inbox"
              ? "bg-white/[0.05] text-white"
              : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]",
          )}
        >
          <div className="relative shrink-0">
            <Bell
              className={cn(
                "w-[18px] h-[18px]",
                page === "inbox" ? "text-cyan-400" : "text-slate-600",
              )}
            />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] px-[3px] rounded-full bg-cyan-500 text-[8px] font-bold text-white flex items-center justify-center leading-none shadow-[0_0_6px_rgba(6,182,212,0.6)]">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
          <span className="truncate">{t("nav.inbox")}</span>
        </button>
      </nav>

      {/* Bas — perf + utilisateur, une seule zone fluide */}
      <div className="px-3 pt-2 pb-4 shrink-0 space-y-3">
        {/* Performance — compacte, sans carte lourde */}
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1.5">
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
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500">{t("stats.winRate")}</span>
            <span className="font-display text-sm font-extrabold text-white tabular-nums">
              {formatPct(winRate)}
            </span>
          </div>
          <div className="w-full bg-white/[0.05] rounded-full h-1 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400",
                mounted && "transition-all duration-500",
              )}
              style={{ width: `${winRate * 100}%` }}
            />
          </div>
        </div>

        {/* Utilisateur — avatar + logout, discret */}
        {user && (
          <div className="flex items-center gap-2.5 px-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-cyan-400 border border-cyan-500/10 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-600 truncate">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
              title={t("common.signOut")}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
