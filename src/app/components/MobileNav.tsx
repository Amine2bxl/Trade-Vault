import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Plus,
  MoreHorizontal,
  X,
  Bell,
  Search,
  Bot,
  ChevronRight,
} from "lucide-react";
import { Page } from "../types";
import { MOBILE_BAR, MOBILE_MORE_GROUPS, NAV_ITEMS } from "../navigation";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useHasTradeDraft } from "../utils/persistence";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { Modal } from "@/shared/ui";
import AccountSwitcher from "./AccountSwitcher";
import logoSrc from "@/assets/tradevault-logo.png";

interface MobileNavProps {
  page: Page;
  setPage: (p: Page) => void;
  onAddTrade: () => void;
}

export default function MobileNav({ page, setPage, onAddTrade }: MobileNavProps) {
  const { t } = useT();
  const { user } = useAuth();
  const hasDraft = useHasTradeDraft(user?.id);
  const unread = useUnreadCount(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Symmetric 2 + FAB + 2 layout. The promoted tabs come from MOBILE_BAR
  // (single source of truth in navigation.ts); everything else lives behind
  // "More", which mirrors the desktop sidebar's workflow groups.
  const barItems = MOBILE_BAR.map((id) => {
    const item = NAV_ITEMS.find((n) => n.id === id)!;
    // The dashboard tab reads "Home" on mobile — friendlier thumb-reach label.
    return { ...item, label: id === "dashboard" ? t("nav.home") : t(item.labelKey) };
  });
  const leftItems = barItems.slice(0, 2);
  const rightItems = barItems.slice(2);
  const isMoreActive = !MOBILE_BAR.includes(page);

  // Recherche dans le menu plein écran : filtre les entrées par libellé.
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      MOBILE_MORE_GROUPS.map((g) => ({
        ...g,
        items: q ? g.items.filter((i) => t(i.labelKey).toLowerCase().includes(q)) : g.items,
      })).filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );

  const navigate = (id: Page) => {
    setPage(id);
    setMoreOpen(false);
    setQuery("");
  };

  const renderItem = ({
    id,
    label,
    icon: Icon,
    active,
    onClick,
  }: {
    id: string;
    label: string;
    icon: typeof LayoutDashboard;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      key={id}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn("bottom-nav-item", active ? "text-cyan-300" : "text-slate-500")}
    >
      {/* Active top bar indicator */}
      <span className={cn("bottom-nav-bar", active && "bottom-nav-bar-active")} />
      {/* Icon on an active pill that lights up cyan */}
      <span className={cn("bottom-nav-icon", active && "bottom-nav-icon-active")}>
        <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        className={cn(
          "text-[10px] leading-none transition-all",
          active ? "font-bold" : "font-semibold",
        )}
      >
        {label}
      </span>
    </button>
  );

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav">
        <div className="bottom-nav-shell">
          <div className="grid grid-cols-5 items-end px-2 pt-2 pb-2 gap-1">
            {leftItems.map((it) =>
              renderItem({ ...it, active: page === it.id, onClick: () => setPage(it.id) }),
            )}
            <div className="flex justify-center items-center">
              <button
                onClick={onAddTrade}
                aria-label={hasDraft ? t("trade.draftBadge") : t("common.addTrade")}
                className="fab-button relative text-white -mt-7"
              >
                <Plus className="w-6 h-6" strokeWidth={2.5} />
                {hasDraft && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#060d16] shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse" />
                )}
              </button>
            </div>
            {rightItems.map((it) =>
              renderItem({ ...it, active: page === it.id, onClick: () => setPage(it.id) }),
            )}
            <div className="relative">
              {renderItem({
                id: "more",
                label: t("nav.more"),
                icon: MoreHorizontal,
                active: isMoreActive,
                onClick: () => setMoreOpen(true),
              })}
              {unread > 0 && (
                <span className="absolute top-0 right-1 h-3.5 min-w-[14px] px-[3px] rounded-full bg-cyan-500 text-[8px] font-bold text-white flex items-center justify-center leading-none shadow-[0_0_6px_rgba(6,182,212,0.6)]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Menu plein écran premium ── */}
      {moreOpen && (
        <Modal
          open
          onClose={() => setMoreOpen(false)}
          wrapperClassName="md:hidden p-0"
          backdropClassName="bg-black/70 backdrop-blur-md"
          className="w-full h-dvh max-w-none rounded-none flex flex-col"
          focusPanel={false}
        >
          <div
            className="relative flex-1 min-h-0 flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(14,58,82,.35), rgba(7,14,24,.97) 45%)",
            }}
          >
            {/* Glow d'ambiance */}
            <div className="pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            {/* Header : marque + recherche + fermer */}
            <div className="relative shrink-0 px-5 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
                    <img
                      src={logoSrc}
                      alt="TradeVault"
                      width={32}
                      height={32}
                      className="relative w-8 h-8 rounded-xl"
                    />
                  </div>
                  <span className="text-[15px] font-bold text-white tracking-tight">
                    TradeVault
                  </span>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  aria-label={t("common.close")}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Recherche rapide */}
              <div className="relative mt-3">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("nav.search")}
                  className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all"
                />
              </div>
            </div>

            {/* Corps : entrée Jarvis + groupes */}
            <div className="relative flex-1 min-h-0 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
              {/* Jarvis — l'intelligence du produit, toujours sous le pouce */}
              <button
                onClick={() => navigate("insights")}
                className="w-full flex items-center gap-3 rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/[0.12] to-teal-500/[0.06] p-3.5 mb-1 text-left"
              >
                <span className="relative shrink-0">
                  <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
                  <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
                    <Bot className="w-4.5 h-4.5 text-white" />
                  </span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white">{t("nav.jarvis")}</span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {t("jarvis.copilot")}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </button>

              {/* Groupes de navigation */}
              {groups.length === 0 ? (
                <p className="px-3 pt-6 text-center text-xs text-slate-500">{t("nav.noResults")}</p>
              ) : (
                groups.map((g) => (
                  <div key={g.labelKey} className="mb-2">
                    <div className="px-1 pt-3 pb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
                      {t(g.labelKey)}
                    </div>
                    <div className="divide-y divide-white/[0.04] rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                      {g.items.map(({ id, labelKey, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => navigate(id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors",
                            page === id ? "bg-cyan-500/[0.08]" : "active:bg-white/[0.05]",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition-colors",
                              page === id
                                ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                                : "bg-white/[0.04] border-white/[0.07] text-slate-400",
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span
                            className={cn(
                              "flex-1 text-sm",
                              page === id ? "font-bold text-white" : "font-medium text-slate-300",
                            )}
                          >
                            {t(labelKey)}
                          </span>
                          {page === id && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer : compte actif */}
            <div className="relative shrink-0 border-t border-white/[0.06] px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              <AccountSwitcher variant="card" />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
