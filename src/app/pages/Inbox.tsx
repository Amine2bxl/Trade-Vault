import { useState, useEffect, useCallback, useMemo } from "react";
import {
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
} from "lucide-react";
import { loadNotifications, markNotificationRead } from "@/modules/notifications";
import type { AppNotification, NotificationCategory } from "@/modules/notifications/types";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { usePageActions, usePageLead } from "../contexts/PageActionsContext";
import { Button } from "@/shared/ui";
import { todayLocalDate } from "@/shared/calendar-date";
import { cn } from "../utils/cn";

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

/** Le libellé de chaque catégorie — le mot que la ligne portait pas. */
const CATEGORY_LABEL: Record<NotificationCategory, TKey> = {
  discipline: "inbox.filterDiscipline",
  goals: "inbox.filterGoals",
  risk: "inbox.filterRisk",
  jarvis: "inbox.filterJarvis",
  economic: "inbox.filterEconomic",
  activity: "inbox.filterActivity",
  system: "inbox.filterAll",
};

/**
 * LA COULEUR DIT L'URGENCE, PAS LE SUJET.
 *
 * Chacune des sept catégories avait sa teinte — cyan, émeraude, rouge, violet,
 * ambre, ardoise. Six couleurs dans une liste verticale, c'est un confetti :
 * l'œil trie des teintes au lieu de lire des lignes, et le rouge de « risque »
 * hurlait aussi fort pour une notification anodine que pour une vraie alerte.
 *
 * La couleur suit maintenant la SÉVÉRITÉ, qui est le seul axe sur lequel une
 * notification demande une action différente. Le sujet, lui, est écrit : la
 * ligne porte son nom de catégorie en toutes lettres — ce qu'aucune pastille
 * colorée n'a jamais réussi à dire.
 */
const SEVERITY: Record<AppNotification["severity"], { rail: string; icon: string }> = {
  info: { rail: "bg-white/20", icon: "text-slate-300 bg-white/[0.06]" },
  success: {
    rail: "bg-[var(--tv-chart-green)]",
    icon: "text-[var(--tv-chart-green)] bg-[rgb(var(--tv-chart-green-rgb)/0.1)]",
  },
  warning: { rail: "bg-amber-400", icon: "text-amber-300 bg-amber-500/10" },
  error: {
    rail: "bg-[var(--tv-chart-red)]",
    icon: "text-[var(--tv-chart-red)] bg-[rgb(var(--tv-chart-red-rgb)/0.1)]",
  },
};

/** Les cinq tranches de temps, dans l'ordre où elles s'affichent. */
const GROUPS = [
  { key: "today", max: 0, label: "inbox.groupToday" },
  { key: "yesterday", max: 1, label: "inbox.groupYesterday" },
  { key: "week", max: 6, label: "inbox.groupThisWeek" },
  { key: "month", max: 29, label: "inbox.groupThisMonth" },
  { key: "older", max: Infinity, label: "inbox.groupOlder" },
] as const satisfies readonly { key: string; max: number; label: TKey }[];

/** Le groupe d'une date — un index dans `GROUPS`, plus une chaîne française. */
function groupIndex(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jours = Math.floor((today.getTime() - target.getTime()) / 86_400_000);
  return GROUPS.findIndex((g) => jours <= g.max);
}

/** Premier passage du jour : `localStorage` garde la date de dernière visite. */
function useFirstLoginToday(): boolean {
  return useMemo(() => {
    try {
      const today = todayLocalDate();
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

/**
 * LE CENTRE DE NOTIFICATIONS.
 *
 * Trois choses le rendaient illisible, et aucune ne tenait au moteur — qui
 * produit huit règles nourries par les vraies données du trader (série de
 * pertes, fuite la plus coûteuse, cinq jours sans session, revue de la
 * semaine, bilan de la veille, fuite qui recule, règle qui échappe, discipline
 * armée). C'était la PAGE qui ne les servait pas.
 *
 *   1. LE SUJET N'ÉTAIT NULLE PART ÉCRIT. Une notification n'avait qu'une
 *      pastille colorée pour dire de quoi elle parlait. Chaque ligne porte
 *      maintenant le nom de sa catégorie.
 *   2. SEPT FILTRES, TOUJOURS LES SEPT. Ils s'affichaient même vides — une
 *      barre de boutons à zéro. Seules les catégories PRÉSENTES paraissent, et
 *      un filtre « non lues » les précède, parce que c'est la seule question
 *      qu'on se pose vraiment en ouvrant sa boîte.
 *   3. DU FRANÇAIS EN DUR dans une application traduite en douze langues :
 *      les cinq intitulés de période, la bannière du premier passage et
 *      l'infobulle du bouton « lu ».
 *
 * Et le bouton « marquer comme lu » n'apparaissait qu'AU SURVOL : sur un
 * téléphone, il n'existait pas.
 */
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
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const unreadTotal = notifs.filter((n) => !n.readAt).length;

  const filtered = useMemo(() => {
    if (filter === "all") return notifs;
    if (filter === "unread") return notifs.filter((n) => !n.readAt);
    return notifs.filter((n) => n.category === filter);
  }, [notifs, filter]);

  const hasUnreadFiltered = filtered.some((n) => !n.readAt);

  /* LES FILTRES SONT DÉRIVÉS DE CE QU'IL Y A. Une catégorie sans notification
     n'a pas de bouton : la barre ne montre jamais un chemin qui ne mène nulle
     part. */
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
        nonLues: 0,
      });
    }
    for (const [cat, e] of parCategorie) {
      list.push({ kind: cat, label: t(CATEGORY_LABEL[cat]), total: e.total, nonLues: e.nonLues });
    }
    return list;
  }, [notifs, unreadTotal, t]);

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

  /* L'EN-TÊTE DE PAGE MONTE DANS LA BARRE DE TÊTE. La boîte de réception
     n'appartient à aucune section : la moitié gauche de la barre est vide, et
     un bandeau de titre en pleine page sous une barre vide, c'est deux fois la
     même chose et cent pixels de moins pour les notifications. */
  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Bell className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="tv-label shrink-0 text-slate-400">{t("inbox.title")}</span>
        <span aria-hidden className="h-3.5 w-px shrink-0 bg-white/[0.12]" />
        <span
          className={cn(
            "tv-row-label truncate",
            unreadTotal > 0 && "text-[var(--tv-highlight)] font-semibold",
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
    for (const n of filtered) {
      const i = groupIndex(new Date(n.createdAt));
      (buckets.get(i) ?? buckets.set(i, []).get(i)!).push(n);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([i, items]) => ({ label: t(GROUPS[i].label), key: GROUPS[i].key, items }));
  }, [filtered, t]);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-5">
      {/* ── LES FILTRES ─────────────────────────────────────────────────── */}
      {notifs.length > 0 && (
        <div className="animate-fade-in-up mb-3 flex flex-wrap items-center gap-1.5">
          {filtres.map((f) => (
            <button
              key={f.kind}
              onClick={() => setFilter(f.kind)}
              aria-pressed={filter === f.kind}
              className={cn("rp-chip", filter === f.kind && "rp-chip-active")}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "tv-figure text-[10px]",
                  f.nonLues > 0 ? "text-[var(--tv-highlight)]" : "text-slate-600",
                )}
              >
                {f.total}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── LA BANNIÈRE DU PREMIER PASSAGE ──────────────────────────────── */}
      {isFirstVisitToday && unreadTotal > 0 && (
        <div className="animate-fade-in-up mb-3 flex items-center gap-2.5 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.06] px-3.5 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
          <span className="text-xs font-medium text-cyan-200/90">
            {t("inbox.newSinceLastVisit").replace("{n}", String(unreadTotal))}
          </span>
        </div>
      )}

      {/* ── LA LISTE ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff className="mb-3 h-10 w-10 text-slate-600" />
          <p className="max-w-sm text-sm text-slate-500">
            {filter === "all" ? t("inbox.empty") : t("inbox.emptyFiltered")}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupes.map(({ label, key, items }) => (
            <section key={key}>
              <div className="mb-2 flex items-center gap-2">
                <span className="tv-label shrink-0 text-slate-500">{label}</span>
                <span aria-hidden className="rp-rule h-px flex-1" />
                <span className="tv-figure shrink-0 text-[10px] text-slate-600">
                  {items.length}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="divide-y divide-white/[0.04]">
                  {items.map((n) => (
                    <Ligne
                      key={n.id}
                      n={n}
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
  );
}

/**
 * UNE LIGNE DE NOTIFICATION.
 *
 * Trois signaux disaient « non lue » en même temps — une pastille en haut à
 * droite, un fond teinté et une bordure teintée. Il n'en reste qu'UN, mais il
 * est structurel : un liseré vertical à gauche, à la couleur de la sévérité.
 * Le titre en blanc gras contre gris fait le reste.
 */
function Ligne({
  n,
  onOpen,
  onRead,
}: {
  n: AppNotification;
  onOpen: () => void;
  onRead: () => void;
}) {
  const { t } = useT();
  const Icon = CATEGORY_ICON[n.category] ?? Bell;
  const nonLue = !n.readAt;
  const ton = SEVERITY[n.severity] ?? SEVERITY.info;
  const heure = new Date(n.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group relative flex w-full cursor-pointer items-start gap-3 py-3 pl-4 pr-3 text-left transition hover:bg-white/[0.03]"
    >
      {/* Le liseré — l'unique marque de « non lue ». */}
      {nonLue && (
        <span aria-hidden className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r", ton.rail)} />
      )}

      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", ton.icon)}>
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-snug",
              nonLue ? "font-semibold text-white" : "text-slate-400",
            )}
          >
            {n.title}
          </p>
          <span className="tv-figure shrink-0 text-[10px] text-slate-600">{heure}</span>
        </div>
        {/* LE SUJET, ÉCRIT. C'est la ligne qui manquait. */}
        <div className="tv-label mt-1 text-slate-600">{t(CATEGORY_LABEL[n.category])}</div>
        {n.body && <p className="tv-prose mt-1 line-clamp-2 text-slate-500">{n.body}</p>}
      </div>

      {nonLue && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRead();
          }}
          title={t("inbox.markRead")}
          aria-label={t("inbox.markRead")}
          /* TOUJOURS VISIBLE. Il n'apparaissait qu'au survol : sur un écran
             tactile, il n'existait pas. */
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 opacity-70 transition hover:bg-white/[0.08] hover:text-white group-hover:opacity-100"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
