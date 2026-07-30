import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { loadNotifications, markNotificationRead } from "@/modules/notifications";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { PageContainer } from "@/shared/ui/PageContainer";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { AppNotification } from "@/modules/notifications/types";

export default function Inbox() {
  const { t } = useT();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    loadNotifications(user.id)
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

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

  return (
    <PageContainer>
      <PageHeader title={t("inbox.title")} subtitle={t("inbox.subtitle")} />
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">{t("inbox.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border px-4 py-3 transition ${
                n.readAt ? "border-white/[.04] bg-white/[.02]" : "border-cyan-500/15 bg-cyan-500/05"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-cyan-400 shrink-0" />}
                    <p
                      className={`text-sm truncate ${n.readAt ? "text-slate-400" : "text-white font-medium"}`}
                    >
                      {n.title}
                    </p>
                  </div>
                  {n.body && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
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
          ))}
        </div>
      )}
    </PageContainer>
  );
}
