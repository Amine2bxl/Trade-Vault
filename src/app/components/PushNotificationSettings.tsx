import { useState, type ComponentType } from "react";
import {
  Bell,
  BellRing,
  Smartphone,
  AlertCircle,
  Loader2,
  Send,
  ShieldAlert,
  Target,
  TrendingDown,
  Brain,
  Calendar,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { sendPushToSelf } from "@/backend/push.functions";
import { useT } from "../i18n/LanguageContext";
import { useSubscription } from "../hooks/useSubscription";
import { tierAtLeast } from "../utils/pricing";
import { cn } from "../utils/cn";

type NotifCategory = "discipline" | "goals" | "risk" | "ai" | "economic";

const CATEGORIES: {
  key: NotifCategory;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { key: "discipline", labelKey: "push.catDiscipline", icon: ShieldAlert },
  { key: "goals", labelKey: "push.catGoals", icon: Target },
  { key: "risk", labelKey: "push.catRisk", icon: TrendingDown },
  { key: "ai", labelKey: "push.catAi", icon: Brain },
  { key: "economic", labelKey: "push.catEconomic", icon: Calendar },
];

const PREFS_KEY = "tv.notif.prefs";

function loadPrefs(): Record<NotifCategory, boolean> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {
    /* localStorage unavailable */
  }
  return defaultPrefs();
}

function defaultPrefs(): Record<NotifCategory, boolean> {
  return { discipline: true, goals: true, risk: true, ai: true, economic: true };
}

function savePrefs(p: Record<NotifCategory, boolean>): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* localStorage unavailable */
  }
}

export { loadPrefs, type NotifCategory, PREFS_KEY };

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
        on ? "bg-gradient-to-r from-cyan-500 to-teal-500" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "block h-4 w-4 rounded-full bg-white shadow transition-transform",
          on && "translate-x-4",
        )}
      />
    </span>
  );
}

export function PushNotificationSettings() {
  const { t, lang } = useT();
  const { tier, loading: subLoading } = useSubscription();
  const canUse = subLoading ? true : tierAtLeast(tier, "elite");
  const { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, unsubscribe } =
    usePushNotifications();
  const sendPush = useServerFn(sendPushToSelf);
  const [isSending, setIsSending] = useState(false);
  const [prefs, setPrefs] = useState<Record<NotifCategory, boolean>>(loadPrefs);

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
    // Surface NUE : ce bloc vit maintenant dans le panneau des Réglages, qui
    // porte déjà sa vitre. Une carte dans une carte creuse un double cadre à
    // 4 px d'écart, et c'est exactement ce qui fait « collé » plutôt que
    // « intégré ».
    <div className="relative space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="relative shrink-0">
          <span className="absolute -inset-1 rounded-lg bg-cyan-500/30 blur-md" />
          <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
            <Bell className="w-4 h-4 text-white" />
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white tracking-tight">{t("push.title")}</h2>
          <p className="text-[11px] text-slate-500">{t("push.subtitle")}</p>
        </div>
      </div>

      {/* Alertes push = offre Elite. Un verrou le dit ici plutôt qu'un
          réglage qui semble permis puis échoue. `canUse` reste vrai tant que
          l'abonnement n'est pas chargé pour éviter un clignotement de cadenas
          chez un abonné Elite. */}
      {!canUse ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-slate-500">
              <Lock className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {lang === "fr" ? "Alertes push — offre Elite" : "Push alerts — Elite plan"}
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                {lang === "fr"
                  ? "Les alertes push et les rappels de session sont réservés à l'offre Elite."
                  : "Push alerts and session reminders are reserved for the Elite plan."}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2.5 text-[13px] font-bold text-[#04101a] shadow-lg shadow-cyan-500/20 hover:brightness-110 transition"
          >
            <Lock className="h-3.5 w-3.5" />
            {lang === "fr" ? "Passer à Elite" : "Go Elite"}
          </button>
        </div>
      ) : (
        <>
          {isiOS && !isPWA ? (
            <div className="flex gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3.5">
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
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-xs text-slate-400">
              <AlertCircle className="w-4 h-4" /> {t("push.unsupported")}
            </div>
          ) : permission === "denied" ? (
            <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-3.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4" /> {t("push.denied")}
            </div>
          ) : (
            <>
              {/* Toggle principal — carte action */}
              <button
                onClick={handleToggle}
                disabled={isLoading}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition disabled:opacity-50"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl border",
                      isSubscribed
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                        : "bg-white/[0.04] border-white/[0.08] text-slate-400",
                    )}
                  >
                    {isSubscribed ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </span>
                  <span className="text-left">
                    <span className="block text-sm text-white font-semibold">
                      {isSubscribed ? t("push.enabled") : t("push.enable")}
                    </span>
                    <span className="block text-[10px] text-slate-500">{t("push.hint")}</span>
                  </span>
                </span>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Switch on={isSubscribed} />
                )}
              </button>

              {isSubscribed && (
                <button
                  onClick={handleTest}
                  disabled={isSending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/15 transition disabled:opacity-50 text-sm font-semibold"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {t("push.sendTest")}
                </button>
              )}
            </>
          )}

          {/* Notification category preferences */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            <p className="px-1 pt-1 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {t("push.categories")}
            </p>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <label
                  key={cat.key}
                  className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs text-slate-300 truncate">{t(cat.labelKey)}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[cat.key]}
                    onChange={() =>
                      setPrefs((p) => {
                        const next = { ...p, [cat.key]: !p[cat.key] };
                        savePrefs(next);
                        return next;
                      })
                    }
                    className="sr-only"
                  />
                  <Switch on={prefs[cat.key]} />
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
