import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Loader2,
  Goal,
  TrendingDown,
  Brain,
  Calendar,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";
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
import { Button } from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { cn } from "@/app/utils/cn";
import { CATEGORY_LABEL, notificationTarget, WHY_KEY } from "./notificationMeta";

/** « Toutes », « non lues », ou une catégorie. */
type FilterKind = NotificationCategory | "all" | "unread";

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
  const [filter, setFilter] = useState<FilterKind>("all");

  const reload = useCallback(() => {
    if (!user?.id) return;
    loadNotifications(user.id)
      .then(setNotifs)
      .catch(() => {})
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

  const filtered = useMemo(() => {
    if (filter === "all") return notifs;
    if (filter === "unread") return notifs.filter((n) => !n.readAt);
    return notifs.filter((n) => n.category === filter);
  }, [notifs, filter]);

  const attention = useMemo(() => filtered.filter(needsAttention), [filtered]);
  const rest = useMemo(() => filtered.filter((n) => !needsAttention(n)), [filtered]);
  const hasUnreadFiltered = filtered.some((n) => !n.readAt);

  /* LES FILTRES SONT DÉRIVÉS DE CE QU'IL Y A : une catégorie vide n'a pas de
     bouton. Le chiffre de chaque filtre est celui des NON LUES quand il y en
     a — c'est la question qu'on se pose — sinon le total, en gris. */
  const filtres = useMemo(() => {
    const parCategorie = new Map<NotificationCategory, { total: number; nonLues: number }>();
    for (const n of notifs) {
      const e = parCategorie.get(n.category) ?? { total: 0, nonLues: 0 };
      e.total++;
      if (!n.readAt) e.nonLues++;
      parCategorie.set(n.category, e);
    }
    const list: { kind: FilterKind; label: string; total: number; nonLues: number }[] = [
      { kind: "all", label: t("inbox.filterAll"), total: notifs.length, nonLues: unreadTotal },
    ];
    if (unreadTotal > 0) {
      list.push({
        kind: "unread",
        label: t("inbox.filterUnread"),
        total: unreadTotal,
        nonLues: unreadTotal,
      });
    }
    for (const [cat, e] of parCategorie) {
      list.push({ kind: cat, label: t(CATEGORY_LABEL[cat]), total: e.total, nonLues: e.nonLues });
    }
    return list;
  }, [notifs, unreadTotal, t]);

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
    if (filter === "all" || filter === "unread") {
      markLocal("all");
      await markAllNotificationsRead(user.id).catch(() => {});
    } else {
      const ids = filtered.filter((n) => !n.readAt).map((n) => n.id);
      markLocal(new Set(ids));
      await markNotificationsRead(user.id, ids).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent("tv:notif-updated"));
  }, [user?.id, filter, filtered]);

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
    () =>
      hasUnreadFiltered ? (
        <Button variant="subtle" size="sm" onClick={markAllRead} className="shrink-0">
          <CheckCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("inbox.markAllRead")}</span>
        </Button>
      ) : null,
    [hasUnreadFiltered, markAllRead, t],
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
    <div
      ref={boxRef}
      style={height ? { height } : undefined}
      className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden px-3 py-2 md:px-5 md:py-3"
    >
      {/* ── LES FILTRES — fixes en tête, la liste défile dessous. */}
      {notifs.length > 0 && (
        <div className="animate-fade-in-up flex shrink-0 flex-wrap items-center gap-1.5 pb-3">
          {filtres.map((f) => (
            <button
              key={f.kind}
              onClick={() => setFilter(f.kind)}
              aria-pressed={filter === f.kind}
              className={cn("rp-chip shrink-0", filter === f.kind && "rp-chip-active")}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "tv-figure text-[10px]",
                  f.nonLues > 0 ? "text-[var(--tv-highlight)]" : "text-slate-600",
                )}
              >
                {f.nonLues > 0 ? f.nonLues : f.total}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={filter !== "all"} />
        ) : (
          <div className="space-y-5 pb-3">
            {/* ── À TRAITER ─────────────────────────────────────────────── */}
            {attention.length > 0 && (
              <section>
                <SectionTitle label={t("inbox.attention")} count={attention.length} accent />
                <div className="space-y-2">
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
                <div className="tv-relief overflow-hidden rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]">
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
    </div>
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
      <span className="tv-figure shrink-0 text-[10px] text-slate-600">{count}</span>
    </div>
  );
}

/** « Pourquoi : … » — la raison d'être de la notification, en une ligne. */
function Why({ n }: { n: AppNotification }) {
  const { t } = useT();
  const key = WHY_KEY[n.kind];
  if (!key) return null;
  return (
    <p className="mt-1.5 truncate text-[11px] text-slate-500">
      <span className="font-semibold text-slate-400">{t("inbox.why")}</span> {t(key)}
    </p>
  );
}

/**
 * LA CARTE « À TRAITER » — une alerte qui demande une action. Pleine, en
 * relief, avec le plan d'action et le bouton qui y mène : on peut agir
 * depuis la boîte, sans ouvrir le détail.
 */
function AttentionCard({
  n,
  lang,
  onOpen,
  onAct,
  onRead,
}: {
  n: AppNotification;
  lang: string;
  onOpen: () => void;
  onAct: () => void;
  onRead: () => void;
}) {
  const { t } = useT();
  const Icon = CATEGORY_ICON[n.category] ?? Bell;
  const ton = SEVERITY[n.severity] ?? SEVERITY.info;
  const plan = n.data?.plan as string | undefined;
  const ctaLabel = (n.data?.ctaLabel as string | undefined) ?? t("inbox.ctaDefault");

  return (
    <article
      className={cn(
        "tv-relief animate-fade-in-up rounded-2xl border bg-[var(--tv-plate-1)] p-3.5 md:p-4",
        ton.ring || "border-[var(--tv-border)]",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="flex cursor-pointer items-start gap-3"
      >
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", ton.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-white">{n.title}</p>
            <span className="tv-figure shrink-0 pt-0.5 text-[10px] text-slate-500">
              {whenLabel(n.createdAt, lang)}
            </span>
          </div>
          <p className="tv-prose mt-1 text-slate-300">{n.body}</p>
          <Why n={n} />
        </div>
      </div>

      {plan && (
        <div className="tv-relief-inset mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tv-highlight)]" />
          <p className="text-[12.5px] leading-relaxed text-slate-300">{plan}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onRead}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <Check className="h-3.5 w-3.5" />
          {t("inbox.markRead")}
        </button>
        <button
          type="button"
          onClick={onAct}
          className="tv-accent-fill inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

/**
 * UNE LIGNE — information, bilan, progrès, ou alerte déjà lue. Non lue : un
 * point à la couleur de la sévérité et le titre en blanc. Lue : tout en gris.
 */
function Row({
  n,
  lang,
  onOpen,
  onRead,
}: {
  n: AppNotification;
  lang: string;
  onOpen: () => void;
  onRead: () => void;
}) {
  const { t } = useT();
  const Icon = CATEGORY_ICON[n.category] ?? Bell;
  const nonLue = !n.readAt;
  const ton = SEVERITY[n.severity] ?? SEVERITY.info;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group relative flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--tv-plate-2)]"
    >
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          nonLue ? ton.icon : "bg-[var(--tv-plate-2)] text-slate-500",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              nonLue ? "font-semibold text-white" : "text-slate-400",
            )}
          >
            {n.title}
          </p>
          <span className="tv-figure shrink-0 pt-0.5 text-[10px] text-slate-600">
            {whenLabel(n.createdAt, lang)}
          </span>
        </div>
        {n.body && (
          <p
            className={cn(
              "tv-prose mt-0.5 line-clamp-2",
              nonLue ? "text-slate-400" : "text-slate-500",
            )}
          >
            {n.body}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="tv-label truncate text-slate-600">{t(CATEGORY_LABEL[n.category])}</span>
        </div>
      </div>

      {nonLue && (
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span aria-hidden className={cn("mt-1.5 h-2 w-2 rounded-full", ton.dot)} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRead();
            }}
            title={t("inbox.markRead")}
            aria-label={t("inbox.markRead")}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
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
