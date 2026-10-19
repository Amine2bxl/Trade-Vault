import { useEffect, useState } from "react";
import { Lock, Send, Smartphone } from "@/shared/ui/icons";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";
import { sendPushToSelf } from "@/backend/push.functions";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useSubscription } from "@/app/hooks/useSubscription";
import { useAuth } from "@/app/contexts/AuthContext";
import { tierAtLeast } from "@/app/utils/pricing";
import { loadUserPref, saveUserPref } from "@/app/utils/userPrefs";
import { useUserPrefsChange } from "@/app/hooks/useUserPrefsChange";
import { SettingsAction, SettingsGroup, SettingsRow, Toggle } from "@/shared/ui";
import {
  DEFAULT_NOTIF_PREFS,
  NOTIF_PREF_KEYS,
  NOTIF_PREFS_EVENT,
  NOTIF_PREFS_KEY,
  normalizeNotifPrefs,
  type NotifPrefKey,
  type NotifPrefs,
} from "@/modules/notifications";

/**
 * LES NOTIFICATIONS — deux questions, deux groupes.
 *
 *   1. DE QUOI veux-tu être averti ? Une rangée par catégorie. Les choix
 *      vivent dans les préférences du COMPTE (`user_preferences`) et le moteur
 *      les applique (`preferences.ts`) — avant, ils dormaient dans le
 *      navigateur sans que rien ne les lise.
 *   2. SUR CET APPAREIL : le push, et un test.
 */

const ROWS: { key: NotifPrefKey; label: TKey; hint: TKey }[] = [
  { key: "economic", label: "push.catEconomic", hint: "push.catEconomicHint" },
  { key: "discipline", label: "push.catDiscipline", hint: "push.catDisciplineHint" },
  { key: "risk", label: "push.catRisk", hint: "push.catRiskHint" },
  { key: "goals", label: "push.catGoals", hint: "push.catGoalsHint" },
  { key: "jarvis", label: "push.catAi", hint: "push.catJarvisHint" },
];

/** Anciens choix restés dans le navigateur (avant les préférences du compte). */
const LEGACY_KEY = "tv.notif.prefs";

export function PushNotificationSettings() {
  const { t } = useT();
  const { user } = useAuth();
  const { tier, loading: subLoading } = useSubscription();
  const canUse = subLoading ? true : tierAtLeast(tier, "elite");
  const { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, unsubscribe } =
    usePushNotifications();
  const sendPush = useServerFn(sendPushToSelf);
  const [isSending, setIsSending] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void loadUserPref<unknown>(user.id, NOTIF_PREFS_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw !== undefined) return setPrefs(normalizeNotifPrefs(raw));
        let legacy: unknown = null;
        try {
          legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null");
        } catch {
          /* stockage indisponible */
        }
        if (legacy) setPrefs(normalizeNotifPrefs(legacy));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Catégories changées sur un autre appareil : la page suit.
  useUserPrefsChange(user?.id, () => {
    if (!user?.id) return;
    void loadUserPref<unknown>(user.id, NOTIF_PREFS_KEY)
      .then((raw) => {
        if (raw !== undefined) setPrefs(normalizeNotifPrefs(raw));
      })
      .catch(() => {});
  });

  const setPref = (key: NotifPrefKey, on: boolean) => {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    if (user?.id) saveUserPref(user.id, NOTIF_PREFS_KEY, next);
    window.dispatchEvent(new CustomEvent(NOTIF_PREFS_EVENT, { detail: next }));
  };

  const togglePush = async () => {
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

  const sendTest = async () => {
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
    <div className="space-y-5">
      <SettingsGroup title={t("push.categories")}>
        {NOTIF_PREF_KEYS.map((key) => {
          const row = ROWS.find((r) => r.key === key)!;
          return (
            <SettingsRow key={key} label={t(row.label)} hint={t(row.hint)}>
              <Toggle on={prefs[key]} onChange={(on) => setPref(key, on)} label={t(row.label)} />
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      {/* Le push est réservé à l'offre Elite : un verrou le dit ici plutôt
          qu'un interrupteur qui semble permis puis échoue. */}
      <SettingsGroup title={t("push.deviceTitle")}>
        {!canUse ? (
          <SettingsAction
            icon={<Lock className="h-4 w-4" />}
            label={t("push.eliteTitle")}
            hint={t("push.eliteBody")}
            onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
          />
        ) : isiOS && !isPWA ? (
          <SettingsRow
            label={
              <>
                <Smartphone className="h-4 w-4 text-slate-500" /> {t("push.iosInstallTitle")}
              </>
            }
            hint={`${t("push.iosStep1")} · ${t("push.iosStep2")} · ${t("push.iosStep3")}`}
          />
        ) : !isSupported ? (
          <SettingsRow label={t("push.unsupported")} />
        ) : permission === "denied" ? (
          <SettingsRow label={t("push.denied")} />
        ) : (
          <>
            <SettingsRow label={t("push.enable")} hint={t("push.hint")}>
              <Toggle
                on={isSubscribed}
                onChange={() => void togglePush()}
                label={t("push.enable")}
                disabled={isLoading}
              />
            </SettingsRow>
            {isSubscribed && (
              <SettingsAction
                icon={<Send className="h-4 w-4" />}
                label={t("push.sendTest")}
                onClick={() => void sendTest()}
                disabled={isSending}
              />
            )}
          </>
        )}
      </SettingsGroup>
    </div>
  );
}
