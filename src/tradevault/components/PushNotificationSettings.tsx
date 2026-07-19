import { useState } from "react";
import { Bell, BellOff, Smartphone, AlertCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { sendPushToSelf } from "@/backend/push.functions";
import { useT } from "../i18n/LanguageContext";

export function PushNotificationSettings() {
  const { t } = useT();
  const { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, unsubscribe } =
    usePushNotifications();
  const sendPush = useServerFn(sendPushToSelf);
  const [isSending, setIsSending] = useState(false);

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast.success(t("push.disabled"));
      } else {
        await subscribe();
        toast.success(t("push.enabled"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleTest = async () => {
    setIsSending(true);
    try {
      const res = await sendPush({
        data: { title: t("push.testTitle"), body: t("push.testBody"), url: "/" },
      });
      if (res.sent > 0) toast.success(t("push.testSent"));
      else toast.error(t("push.testNoSub"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="glass-strong rounded-3xl p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
        {t("push.title")}
      </h2>

      {isiOS && !isPWA ? (
        <div className="flex gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <Smartphone className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <div className="font-semibold text-white mb-1">{t("push.iosInstallTitle")}</div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
              <li>{t("push.iosStep1")}</li>
              <li>{t("push.iosStep2")}</li>
              <li>{t("push.iosStep3")}</li>
            </ol>
          </div>
        </div>
      ) : !isSupported ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
          <AlertCircle className="w-4 h-4" /> {t("push.unsupported")}
        </div>
      ) : permission === "denied" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300">
          <AlertCircle className="w-4 h-4" /> {t("push.denied")}
        </div>
      ) : (
        <>
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition disabled:opacity-50"
          >
            <span className="flex items-center gap-3">
              {isSubscribed ? (
                <Bell className="w-4 h-4 text-emerald-400" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm text-white font-medium">
                {isSubscribed ? t("push.enabled") : t("push.enable")}
              </span>
            </span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <span
                className={`h-5 w-9 rounded-full p-0.5 transition ${
                  isSubscribed ? "bg-emerald-500/80" : "bg-white/10"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                    isSubscribed ? "translate-x-4" : ""
                  }`}
                />
              </span>
            )}
          </button>

          {isSubscribed && (
            <button
              onClick={handleTest}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/15 transition disabled:opacity-50 text-sm font-medium"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t("push.sendTest")}
            </button>
          )}

          <p className="text-[10px] text-slate-600">{t("push.hint")}</p>
        </>
      )}
    </div>
  );
}
