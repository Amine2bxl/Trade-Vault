import { LogOut } from "lucide-react";
import { Page } from "../types";
import { NAV_GROUPS } from "../navigation";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../utils/cn";
import logoSrc from "@/assets/tradevault-logo.png";
import { useT } from "../i18n/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";

interface SidebarProps {
  page: Page;
  setPage: (p: Page) => void;
  totalPnl: number;
  winRate: number;
}

export default function Sidebar({ page, setPage, totalPnl, winRate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();

  return (
    // h-dvh + sticky top-0: the rail is always exactly viewport-height and never
    // moves with page scroll — content scrolls in <main>, nav scrolls internally
    // if it ever overflows. Identical position and alignment on every page.
    <aside className="hidden md:flex w-[260px] h-dvh sticky top-0 bg-[#08111e]/85 border-r border-white/[0.05] flex-col shrink-0 backdrop-blur-xl">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.05] flex items-center gap-3 shrink-0">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl bg-cyan-500/40 blur-xl opacity-70 animate-pulse" />
          <img
            src={logoSrc}
            alt="TradeVault"
            width={36}
            height={36}
            className="relative w-9 h-9 rounded-xl drop-shadow-[0_0_12px_rgba(6,182,212,0.55)]"
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

      {/* Active account switcher — available on every page */}
      <div className="px-3 pt-3 shrink-0">
        <AccountSwitcher />
      </div>

      {/* Navigation — scrolls internally, never moves the rail */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5 min-h-0">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <div className="px-3 pb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
              {t(group.labelKey)}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className={cn(
                    "relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
                    page === id
                      ? "bg-gradient-to-r from-cyan-500/15 to-teal-500/5 text-cyan-400 shadow-sm shadow-cyan-500/10"
                      : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.03] hover:translate-x-0.5",
                  )}
                >
                  {page === id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-teal-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  )}
                  <Icon
                    className={cn(
                      "w-[17px] h-[17px] transition-transform shrink-0",
                      page === id ? "text-cyan-400" : "text-slate-600",
                    )}
                  />
                  <span className="truncate">{t(labelKey)}</span>
                  {page === id && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Performance */}
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
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-700"
              style={{ width: `${winRate * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* User Section */}
      {user && (
        <div className="px-4 pb-4 shrink-0">
          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-cyan-400 border border-cyan-500/10">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-600 truncate">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title={t("common.signOut")}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
