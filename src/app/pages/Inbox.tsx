import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Loader2,
  AlertTriangle,
  Goal,
  TrendingDown,
  Brain,
  Calendar,
} from "lucide-react";
import { loadNotifications, markNotificationRead } from "@/modules/notifications";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { PageContainer } from "@/shared/ui/PageContainer";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { AppNotification } from "@/modules/notifications/types";

type FilterKind = "all" | "discipline" | "goals" | "risk" | "ai" | "economic";

const KIND_ICON: Record<string, typeof Bell> = {
  discipline_warning: AlertTriangle,
  discipline_limit: AlertTriangle,
  discipline_success: Check,
  goal_completed: Goal,
  streak: Bell,
  max_loss: TrendingDown,
  ai_insight: Brain,
  economic: Calendar,
};

const FILTER_KINDS: FilterKind[] = ["all", "discipline", "goals", "risk", "ai", "economic"];

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
    return notifs.filter((n) => n.kind?.startsWith(filter));
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
    },
    [user?.id],
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    for (const n of filtered) {
      if (!n.readAt) await handleMarkRead(n.id);
    }
  }, [user?.id, filtered, handleMarkRead]);

  const IconComponent = (kind?: string) => {
    if (!kind) return Bell;
    return KIND_ICON[kind] ?? Bell;
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("inbox.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("inbox.subtitle")}</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-400 font-medium bg-cyan-500/10 px-2.5 py-1 rounded-lg">
              {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        {FILTER_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === k
                ? "bg-cyan-500/15 text-cyan-400"
                : "text-slate-500 hover:text-slate-300 bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
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
            const Icon = IconComponent(n.kind);
            return (
              <div
                key={n.id}
                className={`rounded-xl border px-4 py-3 transition ${
                  n.readAt
                    ? "border-white/[.04] bg-white/[.02]"
                    : "border-cyan-500/15 bg-cyan-500/05"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                        n.readAt
                          ? "bg-slate-800 text-slate-500"
                          : "bg-cyan-500/10 text-cyan-400"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.readAt && (
                          <span className="h-2 w-2 rounded-full bg-cyan-400 shrink-0" />
                        )}
                        <p
                          className={`text-sm truncate ${
                            n.readAt ? "text-slate-400" : "text-white font-medium"
                          }`}
                        >
                          {n.title}
                        </p>
                      </div>
                      {n.body && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-1.5">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!n.readAt && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 grid h-7 w-7 place-items-center rounded-lg bg-white/[.04] hover:bg-white/[.08] transition"
                      title={t("inbox.markRead")}
                    >
                      <Check className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
