import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Page } from "../types";
import { NAV_GROUPS } from "../navigation";
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
    <aside className="hidden md:flex w-[260px] h-dvh sticky top-0 z-30 bg-[#08111e] border-r border-white/[0.05] flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.05] flex items-center gap-3 shrink-0">
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
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white tracking-tight leading-tight">
            TradeVault
          </h1>
          {/* 10px is the documented type floor (tokens.ts `type.micro`). The
              9px here and on the group labels below sat under it — small enough
              that the eye reads a texture instead of a word. */}
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-0.5">
            {t("nav.journal")}
          </p>
        </div>
      </div>

      {/* Active account switcher — available on every page. Carte CTA premium
          (même design que le cockpit Jarvis) */}
      <div className="px-3 pt-3 shrink-0">
        <AccountSwitcher variant="card" />
      </div>

      {/* Navigation — scrolls internally, never moves the rail */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
              {t(group.labelKey)}
            </div>
            <div className="space-y-px">
              {group.items.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  // Le chunk de la page part au survol ou au focus clavier,
                  // soit 100 à 300 ms avant le clic : au moment du clic il est
                  // déjà là et le squelette n'a plus lieu d'apparaître.
                  onPointerEnter={() => preloadPage(id)}
                  onFocus={() => preloadPage(id)}
                  aria-current={page === id ? "page" : undefined}
                  // UN seul état actif, pas quatre. L'entrée active portait
                  // simultanément un dégradé de fond, une ombre accent, une
                  // barre à gauche, une icône teintée ET un point à droite :
                  // cinq signaux pour une information binaire. Il reste la
                  // barre (la signature) + une teinte plate + la couleur du
                  // texte. `transition-colors` et non `transition-all` : « all »
                  // anime aussi la géométrie, donc chaque survol du menu
                  // demandait un calcul de mise en page.
                  className={cn(
                    "relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium",
                    "transition-colors duration-[var(--tv-dur-1)] ease-[var(--tv-ease)]",
                    page === id
                      ? "bg-cyan-500/[0.10] text-cyan-300"
                      : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]",
                  )}
                >
                  {page === id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-cyan-400" />
                  )}
                  <div className="relative shrink-0">
                    <Icon
                      className={cn("w-4 h-4", page === id ? "text-cyan-300" : "text-slate-500")}
                    />
                    {id === "inbox" && unread > 0 && (
                      <span
                        className="absolute -top-1 -right-1.5 h-4 min-w-[16px] px-[3px] rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center leading-none"
                        role="status"
                        aria-label={`${unread} ${unread > 1 ? t("inbox.unreadPlural") : t("inbox.unread")}`}
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                  <span className="truncate">{t(labelKey)}</span>
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
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400",
                mounted && "transition-all duration-700",
              )}
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
