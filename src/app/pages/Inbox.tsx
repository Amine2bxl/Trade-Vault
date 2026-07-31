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

/**
 * Inbox — toutes les notifications de Jarvis, au même endroit.
 *
 * Chaque entrée est SIGNÉE Jarvis (avatar gradient) et classée par catégorie
 * produit. Un clic redirige vers la bonne page puis ouvre le popup de détail
 * (résumé + CTA + plan d'action) via `tv:open-notification`.
 */

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

export default function Inbox() {
  const { t } = useT();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>("all");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    loadNotifications(user.id)
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (filter === "all") return notifs;
    return notifs.filter((n) => n.category === filter);
  }, [notifs, filter]);

  const unreadCount = notifs.filter((n) => !n.readAt).length;
  const hasUnreadFiltered = filtered.some((n) => !n.readAt);

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
    for (const n of filtered) {
      if (!n.readAt) await handleMarkRead(n.id);
    }
    window.dispatchEvent(new CustomEvent("tv:notif-updated"));
  }, [user?.id, filtered, handleMarkRead]);

  // Cliquer une notification → OUVRE LE POPUP uniquement. La redirection vers
  // la page cible ne se fait QUE quand l'utilisateur appuie sur le bouton CTA
  // (dans le popup) — pas de navigation surprise au clic.
  const openNotification = useCallback((n: AppNotification) => {
    window.dispatchEvent(new CustomEvent("tv:open-notification", { detail: { notification: n } }));
  }, []);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-white">{t("inbox.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("inbox.subtitle")}</p>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-bold text-cyan-300">
            <BellRing className="w-3.5 h-3.5" />
            {unreadCount} {unreadCount > 1 ? t("inbox.unreadPlural") : t("inbox.unread")}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        {FILTER_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filter === k
                ? "bg-cyan-500/15 text-cyan-400"
                : "text-slate-500 hover:text-slate-300 bg-white/[0.02] hover:bg-white/[0.04]",
            )}
          >
            {t(`inbox.filter${k.charAt(0).toUpperCase() + k.slice(1)}`)}
          </button>
        ))}
        {hasUnreadFiltered && (
          <button
            onClick={markAllRead}
            className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t("inbox.markAllRead")}
          </button>
        )}
      </div>

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
        <div className="space-y-2">
          {filtered.map((n) => {
            const Icon = CATEGORY_ICON[n.category] ?? Bell;
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => openNotification(n)}
                onKeyDown={(e) => e.key === "Enter" && openNotification(n)}
                className={cn(
                  "group relative w-full text-left rounded-2xl border px-3.5 py-2.5 transition-all cursor-pointer",
                  "hover:border-cyan-500/25 hover:bg-white/[0.03]",
                  n.readAt
                    ? "border-white/[.04] bg-white/[.02]"
                    : "border-cyan-500/15 bg-cyan-500/05",
                )}
              >
                {!n.readAt && (
                  <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-cyan-400" />
                )}
                <div className="flex items-start gap-3 pr-4">
                  {/* Avatar Jarvis — chaque notification est signée. */}
                  <span className="relative shrink-0">
                    <span className="absolute -inset-0.5 rounded-lg bg-cyan-500/25 blur-sm" />
                    <span
                      className={cn(
                        "relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-md shadow-cyan-500/20",
                        n.readAt && "opacity-60 saturate-50",
                      )}
                    >
                      <Bot className="w-4 h-4 text-white" />
                    </span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider shrink-0">
                        Jarvis
                      </span>
                      <span className="h-px flex-1 bg-white/[0.06]" />
                      <span
                        className={cn(
                          "shrink-0 grid h-5 w-5 place-items-center rounded-md",
                          CATEGORY_ACCENT[n.category] ?? "text-slate-400 bg-slate-500/10",
                        )}
                      >
                        <Icon className="w-3 h-3" />
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm truncate mt-1",
                        n.readAt ? "text-slate-400" : "text-white font-semibold",
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!n.readAt && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(n.id);
                    }}
                    className="absolute bottom-3 right-3 grid h-6 w-6 place-items-center rounded-md bg-white/[.04] hover:bg-white/[.08] transition text-slate-400"
                    title={t("inbox.markRead")}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
