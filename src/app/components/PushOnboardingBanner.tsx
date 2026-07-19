import { useEffect, useState } from "react";
import { Bell, X, Loader2, Lock, ChevronDown, CheckCircle2 } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

// Non-intrusive dashboard banner that sells push notifications in one line
// and enables them in one click. If the browser has them blocked, it swaps
// to a tiny visual walkthrough of the address-bar lock icon. Dismissal is
// remembered per user; the banner never comes back once enabled.

const DISMISS_KEY = "tv-push-banner-dismissed";

export default function PushOnboardingBanner({ userId }: { userId: string }) {
  const { t } = useT();
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);
  const [justEnabled, setJustEnabled] = useState(false);
  const [showBlockedHelp, setShowBlockedHelp] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setDismissed(!!localStorage.getItem(`${DISMISS_KEY}-${userId}`));
    } catch {
      setDismissed(false);
    }
  }, [userId]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`${DISMISS_KEY}-${userId}`, "1");
    } catch {
      /* noop */
    }
  };

  const enable = async () => {
    setError(false);
    try {
      await subscribe(); // triggers Notification.requestPermission() + SW + VAPID subscribe
      setJustEnabled(true);
      setTimeout(dismiss, 2500);
    } catch {
      // Permission denied (or hard-blocked): show the lock-icon walkthrough.
      setError(true);
      setShowBlockedHelp(true);
    }
  };

  if (!isSupported || isSubscribed || dismissed) return null;
  const blocked = permission === "denied";

  return (
    <div className="mx-4 md:mx-8 mt-4 max-w-[1400px] xl:mx-auto animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/[0.09] to-teal-500/[0.05] backdrop-blur-md">
        <div className="flex items-center gap-3.5 px-4 py-3">
          <div className="relative w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
            {justEnabled ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <>
                <Bell className="w-5 h-5 text-cyan-300" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400" />
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white leading-snug">
              {justEnabled ? t("pushBanner.enabled") : t("pushBanner.title")}
            </p>
            {!justEnabled && (
              <p className="text-[11px] text-slate-400 leading-snug hidden sm:block">
                {t("pushBanner.sub")}
              </p>
            )}
          </div>

          {!justEnabled &&
            (blocked || error ? (
              <button
                onClick={() => setShowBlockedHelp((v) => !v)}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                {t("pushBanner.blockedCta")}
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    showBlockedHelp && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <button
                onClick={enable}
                disabled={isLoading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all shrink-0 disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
                {t("pushBanner.cta")}
              </button>
            ))}

          <button
            onClick={dismiss}
            aria-label={t("common.close")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Blocked help: a mini address-bar mock showing exactly where to click. */}
        {showBlockedHelp && (
          <div className="border-t border-white/[0.06] px-4 py-3.5 animate-fade-in">
            <p className="text-[11px] text-slate-400 mb-2.5">{t("pushBanner.blockedHelp")}</p>
            <div className="max-w-sm rounded-xl bg-[#0a1220] border border-white/[0.1] p-2 flex items-center gap-2">
              {/* Fake address bar */}
              <span className="relative w-7 h-7 rounded-lg bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-400 text-[8px] font-black text-black flex items-center justify-center">
                  1
                </span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono truncate">
                tradevaultt.vercel.app
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black flex items-center justify-center shrink-0">
                2
              </span>
              {t("pushBanner.blockedStep2")}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black flex items-center justify-center shrink-0">
                3
              </span>
              {t("pushBanner.blockedStep3")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
