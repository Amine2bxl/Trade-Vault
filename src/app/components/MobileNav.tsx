import { useState } from "react";
import { LayoutDashboard, Plus, MoreHorizontal, X } from "lucide-react";
import { Page } from "../types";
import { MOBILE_BAR, MOBILE_MORE_GROUPS, NAV_ITEMS } from "../navigation";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useHasTradeDraft } from "../utils/persistence";

interface MobileNavProps {
  page: Page;
  setPage: (p: Page) => void;
  onAddTrade: () => void;
}

export default function MobileNav({ page, setPage, onAddTrade }: MobileNavProps) {
  const { t } = useT();
  const { user } = useAuth();
  const hasDraft = useHasTradeDraft(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);

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
                {/* "In progress" dot when a trade draft is waiting */}
                {hasDraft && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#060d16] shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse" />
                )}
              </button>
            </div>
            {rightItems.map((it) =>
              renderItem({ ...it, active: page === it.id, onClick: () => setPage(it.id) }),
            )}
            {renderItem({
              id: "more",
              label: t("nav.more"),
              icon: MoreHorizontal,
              active: isMoreActive,
              onClick: () => setMoreOpen(true),
            })}
          </div>
        </div>
      </div>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full glass-strong rounded-t-3xl border-t border-white/[0.08] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] animate-slide-up"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white">{t("nav.more")}</h2>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label={t("common.close")}
                className="w-11 h-11 -m-1.5 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 pt-2 max-h-[70dvh] overflow-y-auto">
              {MOBILE_MORE_GROUPS.map((g) => (
                <div key={g.labelKey} className="mb-1.5">
                  <div className="px-1 pt-2 pb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
                    {t(g.labelKey)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.map(({ id, labelKey, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => {
                          setPage(id);
                          setMoreOpen(false);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 border transition-all",
                          page === id
                            ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-400"
                            : "bg-white/[0.03] border-white/[0.06] text-slate-400",
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[11px] font-semibold text-center leading-tight">
                          {t(labelKey)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
