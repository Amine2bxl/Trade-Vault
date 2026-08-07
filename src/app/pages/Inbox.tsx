import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Loader2,
  Goal,
  TrendingDown,
  Brain,
  Calendar,
  Bot,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { loadNotifications, markNotificationRead } from "@/modules/notifications";
import type { AppNotification, NotificationCategory } from "@/modules/notifications/types";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { PageContainer } from "@/shared/ui/PageContainer";
import { cn } from "../utils/cn";

type FilterKind = NotificationCategory | "all";

const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  discipline: ShieldAlert,
  goals: Goal,
  risk: TrendingDown,
  jarvis: Brain,
  economic: Calendar,
  activity: Clock,
  system: Bell,
};

const CATEGORY_ACCENT: Record<NotificationCategory, string> = {
  discipline: "text-cyan-300 bg-cyan-500/10",
  goals: "text-emerald-300 bg-emerald-500/10",
  risk: "text-red-300 bg-red-500/10",
  jarvis: "text-violet-300 bg-violet-500/10",
  economic: "text-amber-300 bg-amber-500/10",
  activity: "text-slate-300 bg-slate-500/10",
  system: "text-slate-300 bg-slate-500/10",
};

const FILTER_KINDS: FilterKind[] = [
  "all",
  "discipline",
  "risk",
  "goals",
  "jarvis",
  "activity",
  "economic",
];

/** Groupe une date sous un libellé naturel. */
function groupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  if (diffDays < 30) return "Ce mois-ci";
  return "Plus ancien";
}

/** Premier-login badge : localStorage stocke la date de dernière visite. */
function useFirstLoginToday(): boolean {
  return useMemo(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem("tv.lastInboxVisit");
      if (last !== today) {
        localStorage.setItem("tv.lastInboxVisit", today);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);
}

export default function Inbox() {
  const { t } = useT();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>("all");

  const isFirstVisitToday = useFirstLoginToday();

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    loadNotifications(user.id)
      .then((list) => {
        // Marque les non lues comme "nouvelles aujourd'hui" au premier chargement
        setNotifs(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (filter === "all") return notifs;
    return notifs.filter((n) => n.category === filter);
  }, [notifs, filter]);

  // Compte les non lues du filtre courant
  const unreadTotal = notifs.filter((n) => !n.readAt).length;
  const unreadFiltered = filtered.filter((n) => !n.readAt).length;
  const hasUnreadFiltered = unreadFiltered > 0;

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      await markNotificationRead(user.id, id);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      window.dispatchEvent(new CustomEvent("tv:notif-updated"));
    },
    [user?.id],
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const unread = filtered.filter((n) => !n.readAt);
    for (const n of unread) {
      await markNotificationRead(user.id, n.id);
      setNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    }
    window.dispatchEvent(new CustomEvent("tv:notif-updated"));
  }, [user?.id, filtered]);

  const openNotification = useCallback((n: AppNotification) => {
    window.dispatchEvent(new CustomEvent("tv:open-notification", { detail: { notification: n } }));
  }, []);

  // Regroupe les notifs par période
  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const label = groupLabel(new Date(n.createdAt));
      const existing = map.get(label) ?? [];
      existing.push(n);
      map.set(label, existing);
    }
    // Ordre : plus récent d'abord (Aujourd'hui → Hier → ...)
    const order = ["Aujourd'hui", "Hier", "Cette semaine", "Ce mois-ci", "Plus ancien"];
    return order.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }));
  }, [filtered]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifs) {
      counts[n.category] = (counts[n.category] ?? 0) + 1;
    }
    return counts;
  }, [notifs]);

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <Bell className="w-4 h-4 text-white" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-white">{t("inbox.title")}</h1>
            <p className="text-xs text-slate-500">
              {unreadTotal > 0
                ? `${unreadTotal} non ${unreadTotal > 1 ? "lues" : "lue"}`
                : "Tout lu"}
            </p>
          </div>
        </div>
        {unreadTotal > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-bold text-cyan-300">
            <BellRing className="w-3.5 h-3.5" />
            {unreadTotal}
          </span>
        )}
      </div>

      {/* Filter tabs with category counts */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {FILTER_KINDS.map((k) => {
          const count = k === "all" ? notifs.length : (countByCategory[k] ?? 0);
          const unread = k === "all"
            ? unreadTotal
            : notifs.filter((n) => n.category === k && !n.readAt).length;
          return (
            <button key={k} onClick={() => setFilter(k)} className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
              filter === k
                ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-300"
                : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]",
            )}>
              {k === "all" ? "Toutes" : t(`inbox.filter${k.charAt(0).toUpperCase() + k.slice(1)}`)}
              {unread > 0 && (
                <span className={cn(
                  "min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold",
                  filter === k ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.08] text-slate-400",
                )}>
                  {unread}
                </span>
              )}
            </button>
          );
        })}
        {hasUnreadFiltered && (
          <button onClick={markAllRead}
            className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all">
            <CheckCheck className="w-3.5 h-3.5" />
            Tout lu
          </button>
        )}
      </div>

      {/* New today banner */}
      {isFirstVisitToday && unreadTotal > 0 && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15 px-3.5 py-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
          </span>
          <span className="text-xs text-cyan-200/90 font-medium">
            {unreadTotal} nouvelle{unreadTotal > 1 ? "s" : ""} notification{unreadTotal > 1 ? "s" : ""} depuis ta dernière visite
          </span>
        </div>
      )}

      {/* Notification list grouped by period */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">
            {filter === "all" ? t("inbox.empty") : t("inbox.emptyFiltered")}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                  {label}
                </span>
                <span className="flex-1 h-px bg-white/[0.04]" />
                <span className="text-[10px] text-slate-600 font-semibold">{items.length}</span>
              </div>
              <div className="space-y-1">
                {items.map((n) => {
                  const Icon = CATEGORY_ICON[n.category] ?? Bell;
                  const unread = !n.readAt;
                  const time = new Date(n.createdAt);
                  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openNotification(n)}
                      onKeyDown={(e) => e.key === "Enter" && openNotification(n)}
                      className={cn(
                        "group relative w-full text-left rounded-xl border transition-all cursor-pointer flex items-start gap-3 px-3 py-2.5",
                        unread
                          ? "border-cyan-500/10 bg-cyan-500/[0.03] hover:border-cyan-500/25"
                          : "border-white/[0.04] bg-transparent hover:bg-white/[0.02]",
                      )}
                    >
                      {unread && (
                        <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-cyan-400" />
                      )}
                      {/* Category icon */}
                      <span className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg mt-0.5",
                        CATEGORY_ACCENT[n.category] ?? "text-slate-400 bg-slate-500/10",
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-sm truncate flex-1",
                            unread ? "text-white font-semibold" : "text-slate-400",
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-600 font-medium shrink-0 tabular-nums">
                            {timeStr}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.body}
                          </p>
                        )}
                      </div>
                      {unread && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                          className="absolute bottom-2 right-2.5 grid h-6 w-6 place-items-center rounded-md bg-white/[0.04] hover:bg-white/[0.08] transition text-slate-400 opacity-0 group-hover:opacity-100"
                          title="Marquer comme lu"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
