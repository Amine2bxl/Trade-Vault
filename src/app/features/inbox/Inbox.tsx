import { numericText } from "@/shared/ui/NumericText";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Goal,
  TrendingDown,
  Brain,
  Calendar,
  ShieldAlert,
  Clock,
} from "@/shared/ui/icons";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead,
} from "@/modules/notifications";
import type { AppNotification, NotificationCategory } from "@/modules/notifications/types";
import { events } from "@/modules/events";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { usePageActions, usePageLead } from "@/app/contexts/PageActionsContext";
import { PageContainer, Button, FilterControls, FilterSection, MultiPicker } from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { cn } from "@/shared/ui/cn";
import { CATEGORY_LABEL, notificationTarget } from "./notificationMeta";

const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  discipline: ShieldAlert,
  goals: Goal,
  risk: TrendingDown,
  jarvis: Brain,
  economic: Calendar,
  activity: Clock,
  system: Bell,
};

/**
 * LA COULEUR DIT L'URGENCE, PAS LE SUJET.
 *
 * La couleur suit la SÉVÉRITÉ, le seul axe sur lequel une notification demande
 * une action différente. Le sujet, lui, est écrit.
 */
const SEVERITY: Record<AppNotification["severity"], { dot: string; icon: string; ring: string }> = {
  info: {
    dot: "bg-[var(--tv-highlight)]",
    icon: "text-slate-300 bg-[var(--tv-plate-3)]",
    ring: "",
  },
  success: {
    dot: "bg-[var(--tv-chart-green)]",
    icon: "text-[var(--tv-chart-green)] bg-[rgb(var(--tv-chart-green-rgb)/0.1)]",
    ring: "",
  },
  warning: {
    dot: "bg-amber-400",
    icon: "text-amber-300 bg-amber-500/10",
    ring: "border-amber-500/20",
  },
  error: {
    dot: "bg-[var(--tv-chart-red)]",
    icon: "text-[var(--tv-chart-red)] bg-[rgb(var(--tv-chart-red-rgb)/0.1)]",
    ring: "border-[rgb(var(--tv-chart-red-rgb)/0.28)]",
  },
};

/** Les tranches de temps, dans l'ordre où elles s'affichent. */
const GROUPS = [
  { key: "today", max: 0, label: "inbox.groupToday" },
  { key: "yesterday", max: 1, label: "inbox.groupYesterday" },
  { key: "week", max: 6, label: "inbox.groupThisWeek" },
  { key: "month", max: 29, label: "inbox.groupThisMonth" },
  { key: "older", max: Infinity, label: "inbox.groupOlder" },
] as const satisfies readonly { key: string; max: number; label: TKey }[];

function daysAgo(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today.getTime() - target.getTime()) / 86_400_000);
}

function groupIndex(date: Date): number {
  const d = daysAgo(date);
  return GROUPS.findIndex((g) => d <= g.max);
}

/** « il y a 12 min », « hier, 14:05 », « 3 sept. » — lisible d'un coup d'œil. */
function whenLabel(iso: string, lang: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  if (diff < 60_000) return rtf.format(0, "minute");
  if (diff < 3_600_000) return rtf.format(-Math.round(diff / 60_000), "minute");
  const days = daysAgo(d);
  const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return time;
  if (days === 1) return `${rtf.format(-1, "day")}, ${time}`;
  if (days < 7) return d.toLocaleDateString(lang, { weekday: "short" }) + ` ${time}`;
  return d.toLocaleDateString(lang, { day: "numeric", month: "short" });
}

/** Une alerte qui demande quelque chose : non lue ET avertissement ou plus. */
const needsAttention = (n: AppNotification) =>
  !n.readAt && (n.severity === "error" || n.severity === "warning");

/**
 * LA BOÎTE DE RÉCEPTION.
 *
 * Ce qu'elle doit donner envie de faire : l'ouvrir, parce qu'il y a peu de
 * choses et que chacune compte. La stratégie qui la nourrit est dans
 * `modules/notifications` (cadence par événement, déduplication en base,
 * expiration, popups en contexte seulement) ; la page, elle :
 *
 *   1. MET EN TÊTE CE QUI DEMANDE UNE ACTION — les alertes non lues
 *      d'avertissement ou plus, en cartes pleines avec leur plan d'action et
 *      le bouton qui mène au bon endroit ;
 *   2. DIT POURQUOI chaque notification existe (« Pourquoi : 3 pertes
 *      d'affilée ») — on ne se demande plus d'où elle sort ;
 *   3. RANGE LE RESTE PAR JOUR, lu en gris, non lu marqué d'un point ;
 *   4. COMPTE JUSTE : toutes les non lues sont chargées, le chiffre de la
 *      page est celui du badge, et « tout marquer comme lu » vide les deux.
 */
export default function Inbox() {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { boxRef, height } = useAvailableHeight();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setFailed(false);
    loadNotifications(user.id)
      .then(setNotifs)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  // En direct : une notification émise pendant qu'on regarde la boîte y entre.
  useEffect(() => {
    if (!user?.id) return;
    return events.on("NotificationCreated", ({ userId, notification }) => {
      if (userId !== user.id || !notification.channels.includes("dashboard")) return;
      setTimeout(reload, 400);
    });
  }, [user?.id, reload]);

  const unreadTotal = useMemo(() => notifs.filter((n) => !n.readAt).length, [notifs]);

  const filtered = useMemo(
    () =>
      notifs.filter(
        (n) =>
          (!unreadOnly || !n.readAt) && (!categories.length || categories.includes(n.category)),
      ),
    [notifs, unreadOnly, categories],
  );
  const attention = useMemo(() => filtered.filter(needsAttention), [filtered]);
  const rest = useMemo(() => filtered.filter((n) => !needsAttention(n)), [filtered]);
  const hasUnreadFiltered = filtered.some((n) => !n.readAt);
  const categoryOptions = useMemo(() => {
    const counts = new Map<NotificationCategory, number>();
    for (const n of notifs) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    for (const c of categories) if (!counts.has(c)) counts.set(c, 0);
    return [...counts].map(([value, count]) => ({ value, label: t(CATEGORY_LABEL[value]), count }));
  }, [notifs, categories, t]);

  const markLocal = (ids: Set<string> | "all") => {
    const now = new Date().toISOString();
    setNotifs((prev) =>
      prev.map((n) => (!n.readAt && (ids === "all" || ids.has(n.id)) ? { ...n, readAt: now } : n)),
    );
  };

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      markLocal(new Set([id]));
      await markNotificationRead(user.id, id).catch(() => {});
      window.dispatchEvent(new CustomEvent("tv:notif-updated"));
    },
    [user?.id],
  );

  /* UNE REQUÊTE, PAS N. En vue « toutes » ou « non lues », on marque TOUTES
     les non lues du compte en base — pas seulement celles affichées. */
  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    if (categories.length === 0) {
      markLocal("all");
      await markAllNotificationsRead(user.id).catch(() => {});
    } else {
      const ids = filtered.filter((n) => !n.readAt).map((n) => n.id);
      markLocal(new Set(ids));
      await markNotificationsRead(user.id, ids).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent("tv:notif-updated"));
  }, [user?.id, categories.length, filtered]);

  const openNotification = useCallback((n: AppNotification) => {
    window.dispatchEvent(new CustomEvent("tv:open-notification", { detail: { notification: n } }));
  }, []);

  /* L'action directe, sans passer par le popup : la notification est lue, et
     on part là où elle mène (avec son filtre, ex. « ce trade »). */
  const act = useCallback(
    (n: AppNotification) => {
      void handleMarkRead(n.id);
      const target = notificationTarget(n);
      window.dispatchEvent(new CustomEvent("tv:navigate", { detail: target }));
    },
    [handleMarkRead],
  );

  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Bell className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="tv-label shrink-0 text-slate-400">{t("inbox.title")}</span>
        <span aria-hidden className="h-3.5 w-px shrink-0 bg-white/[0.12]" />
        <span
          className={cn(
            "tv-row-label truncate",
            unreadTotal > 0 && "font-semibold text-[var(--tv-highlight)]",
          )}
        >
          {unreadTotal > 0
            ? t("inbox.unreadCount").replace("{n}", String(unreadTotal))
            : t("inbox.allRead")}
        </span>
      </div>
    ),
    [unreadTotal, t],
  );
  usePageLead(lead);

  const actions = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2">
        <FilterControls
          label={t("common.filters")}
          count={categories.length + Number(unreadOnly)}
          summary={[
            unreadOnly ? t("inbox.filterUnread") : "",
            ...categories.map((c) => t(CATEGORY_LABEL[c])),
          ]
            .filter(Boolean)
            .join(" · ")}
          onReset={() => {
            setCategories([]);
            setUnreadOnly(false);
          }}
          resetLabel={t("common.reset")}
          doneLabel={t("common.done")}
          liveLabel={t("filters.live")}
        >
          <label className="tv-inbox-unread-filter">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            <span>{t("inbox.filterUnread")}</span>
            <span className="tv-num ml-auto text-slate-500">{unreadTotal}</span>
          </label>
          <FilterSection
            label={t("inbox.categories")}
            summary={
              categories.length
                ? categories.map((c) => t(CATEGORY_LABEL[c])).join(", ")
                : t("common.all")
            }
            defaultOpen
          >
            <MultiPicker
              inline
              label={t("inbox.categories")}
              values={categories}
              options={categoryOptions}
              onChange={setCategories}
              allLabel={t("common.all")}
              moreLabel={t("filters.more")}
              lessLabel={t("filters.less")}
              searchLabel={t("picker.search")}
            />
          </FilterSection>
        </FilterControls>
        {hasUnreadFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            className="shrink-0"
            aria-label={t("inbox.markAllRead")}
            title={t("inbox.markAllRead")}
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{t("inbox.markAllRead")}</span>
          </Button>
        )}
      </div>
    ),
    [categories, unreadOnly, unreadTotal, categoryOptions, hasUnreadFiltered, markAllRead, t],
  );
  usePageActions(actions);

  const groupes = useMemo(() => {
    const buckets = new Map<number, AppNotification[]>();
    for (const n of rest) {
      const i = groupIndex(new Date(n.createdAt));
      (buckets.get(i) ?? buckets.set(i, []).get(i)!).push(n);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([i, items]) => ({ label: t(GROUPS[i].label), key: GROUPS[i].key, items }));
  }, [rest, t]);

  return (
    <PageContainer
      ref={boxRef}
      style={height ? { height } : undefined}
      className="tv-inbox flex h-full max-w-3xl flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="tv-inbox-list" aria-busy="true" aria-label={t("common.loading")}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="tv-inbox-skeleton">
                <div />
                <div>
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="p-4 text-center">
            <p className="tv-prose text-slate-400">{t("inbox.loadError")}</p>
            <Button variant="subtle" size="sm" onClick={reload}>
              {t("error.retry")}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={unreadOnly || categories.length > 0} />
        ) : (
          <div className="space-y-5 pb-3">
            {/* ── À TRAITER ─────────────────────────────────────────────── */}
            {attention.length > 0 && (
              <section>
                <SectionTitle label={t("inbox.attention")} count={attention.length} accent />
                <div className="tv-inbox-list">
                  {attention.map((n) => (
                    <AttentionCard
                      key={n.id}
                      n={n}
                      lang={lang}
                      onOpen={() => openNotification(n)}
                      onAct={() => act(n)}
                      onRead={() => handleMarkRead(n.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── LE RESTE, PAR JOUR ────────────────────────────────────── */}
            {groupes.map(({ label, key, items }) => (
              <section key={key}>
                <SectionTitle label={label} count={items.length} />
                <div className="tv-inbox-list">
                  <div className="divide-y divide-[var(--tv-border)]">
                    {items.map((n) => (
                      <Row
                        key={n.id}
                        n={n}
                        lang={lang}
                        onOpen={() => openNotification(n)}
                        onRead={() => handleMarkRead(n.id)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function SectionTitle({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className={cn(
          "tv-label shrink-0",
          accent ? "text-[var(--tv-highlight)]" : "text-slate-500",
        )}
      >
        {label}
      </span>
      <span aria-hidden className="rp-rule h-px flex-1" />
      <span className="tv-figure tv-figure-secondary shrink-0 text-[10px] text-slate-600">
        {count}
      </span>
    </div>
  );
}

/** Une alerte garde ses actions directes, avec la même densité que la liste. */
function AttentionCard(props: {
  n: AppNotification;
  lang: string;
  onOpen: () => void;
  onAct: () => void;
  onRead: () => void;
}) {
  return <Row {...props} priority />;
}

function Row({
  n,
  lang,
  onOpen,
  onRead,
  onAct,
  priority = false,
}: {
  n: AppNotification;
  lang: string;
  onOpen: () => void;
  onRead: () => void;
  onAct?: () => void;
  priority?: boolean;
}) {
  const { t } = useT();
  const Icon = CATEGORY_ICON[n.category] ?? Bell;
  const unread = !n.readAt;
  const tone = SEVERITY[n.severity] ?? SEVERITY.info;
  return (
    <article
      className="tv-inbox-row"
      data-unread={unread || undefined}
      data-priority={priority || undefined}
      data-severity={n.severity}
    >
      <button type="button" onClick={onOpen} className="tv-inbox-open">
        <span className={cn("tv-inbox-icon", priority ? tone.icon : "text-slate-400")}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="tv-inbox-copy">
          <span className="tv-inbox-title">
            {unread && (
              <span
                className={cn("tv-inbox-dot", priority ? tone.dot : "bg-[var(--tv-highlight)]")}
                aria-label={t("inbox.filterUnread")}
              />
            )}
            <span>{numericText(n.title)}</span>
          </span>
          {n.body && <span className="tv-inbox-body">{numericText(n.body)}</span>}
          <span className="tv-inbox-meta">
            <span>{t(CATEGORY_LABEL[n.category])}</span>
            <span aria-hidden>·</span>
            <time
              className="tv-num"
              dateTime={n.createdAt}
              title={new Date(n.createdAt).toLocaleString(lang)}
            >
              {whenLabel(n.createdAt, lang)}
            </time>
          </span>
        </span>
      </button>
      {(unread || onAct) && (
        <div className="tv-inbox-actions">
          {onAct && (
            <button
              type="button"
              onClick={onAct}
              className="tv-inbox-cta"
              aria-label={(n.data?.ctaLabel as string | undefined) ?? t("inbox.ctaDefault")}
              title={(n.data?.ctaLabel as string | undefined) ?? t("inbox.ctaDefault")}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {unread && (
            <button
              type="button"
              onClick={onRead}
              className="tv-inbox-read"
              title={t("inbox.markRead")}
              aria-label={t("inbox.markRead")}
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Rien à lire — et ce qui fera apparaître quelque chose ici. */
function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <span className="tv-relief mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]">
        <BellOff className="h-5 w-5 text-slate-500" />
      </span>
      <p className="text-sm font-semibold text-slate-200">
        {filtered ? t("inbox.emptyFiltered") : t("inbox.caughtUpTitle")}
      </p>
      {!filtered && (
        <p className="tv-hint mt-1.5 max-w-sm leading-relaxed">{t("inbox.caughtUpBody")}</p>
      )}
    </div>
  );
}
