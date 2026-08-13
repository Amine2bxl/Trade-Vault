import { useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Page, SECTIONS } from "../types";
import { SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { preloadPage } from "../pageModules";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useAuth } from "../contexts/AuthContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { cn } from "../utils/cn";
import logoSrc from "@/assets/tradevault-logo.webp";
import { useT } from "../i18n/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";
import { useUnreadCount } from "../hooks/useUnreadCount";

interface SidebarProps {
  page: Page;
  setPage: (p: Page) => void;
  totalPnl: number;
  winRate: number;
}

/**
 * La barre latérale — UNE colonne, deux largeurs, un seul rythme.
 *
 * ── CE QUI A ÉTÉ CORRIGÉ ───────────────────────────────────────────────────
 * L'ancienne version mélangeait trois rythmes verticaux (px-5/px-3/px-4),
 * deux tailles d'icônes, des cartes vitrées au bas et des lignes nues au
 * milieu. À l'œil, ça se lit comme trois composants collés, pas comme une
 * barre. Ici : UN gouttière (`px-3`), UNE taille d'icône (18 px), UNE hauteur
 * de ligne (40 px), et des titres de groupe en petites capitales qui disent où
 * l'on est au lieu de laisser deviner.
 *
 * ── DEUX GROUPES, PAS UNE LISTE PLATE ──────────────────────────────────────
 * « Naviguer » porte les six sections du produit. « Mon compte » porte ce qui
 * concerne l'utilisateur : notifications, réglages, déconnexion. Une liste
 * plate de neuf entrées oblige à lire les libellés un par un ; deux groupes de
 * cinq et trois se balaient d'un coup d'œil.
 *
 * ── LA LARGEUR NE S'ANIME PAS ──────────────────────────────────────────────
 * `MOTION_AND_PERF.md` interdit d'animer `width` : la propriété relaie la mise
 * en page à chaque frame et fait ramer toute la colonne de droite. La bascule
 * est donc instantanée ; seules les couleurs transitionnent.
 *
 * ── EN 76 px, RIEN NE DISPARAÎT SANS RECOURS ───────────────────────────────
 * Chaque icône garde son libellé en `title` et en `aria-label`, et la section
 * active garde son liseré. Ce qui ne se lit pas dans une colonne étroite — le
 * sélecteur de compte, les deux chiffres de performance, l'e-mail — est retiré
 * plutôt que tronqué.
 */
export default function Sidebar({ page, setPage, totalPnl, winRate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const unread = useUnreadCount(user?.id);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  // Only transition the win-rate bar once it changes AFTER mount — on a fresh
  // load (F5) the bar must render at its final width instantly, otherwise the
  // 0→X transition is what made the navbar "shake" on every refresh.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Titre de groupe. Disparaît en mode réduit : un mot coupé n'informe pas. */
  const groupLabel = (label: string) =>
    !collapsed && (
      <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>
    );

  /** Une entrée. Même hauteur, même icône, même gouttière dans les deux états. */
  const row = ({
    key,
    label,
    icon,
    active,
    target,
    onActivate,
    badge,
  }: {
    key: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    target?: Page;
    onActivate: () => void;
    badge?: ReactNode;
  }) => (
    <button
      key={key}
      onClick={onActivate}
      // Le chunk de la page part au survol ou au focus clavier, soit
      // 100 à 300 ms avant le clic : au moment du clic il est déjà là.
      onPointerEnter={target ? () => preloadPage(target) : undefined}
      onFocus={target ? () => preloadPage(target) : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-full items-center rounded-xl text-[13.5px] font-medium",
        "transition-colors duration-200",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active
          ? "bg-cyan-500/10 text-white"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan-400" />
      )}
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {icon}
        {badge}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {/* Le libellé au survol, sans le délai d'une seconde du `title` natif. */}
      {collapsed && <span className="rail-tip">{label}</span>}
    </button>
  );

  /**
   * Le groupe « Mon compte » : la cloche et la section Réglages.
   *
   * Les Réglages SORTENT de la liste des sections pour venir ici. Ce n'est pas
   * une destination de parcours au même titre que le Journal ou l'Analyse :
   * personne n'ouvre l'application pour aller dans les réglages. Les mettre à
   * la suite des cinq autres les faisait lire comme une sixième étape du
   * travail.
   */
  const settingsSection = SECTION_META.settings;
  const settingsTarget = defaultPageOfSection("settings");
  const accountRows: {
    key: string;
    label: string;
    target: Page;
    active: boolean;
    icon: ReactNode;
  }[] = [
    {
      key: "inbox",
      label: t("nav.inbox"),
      target: "inbox",
      active: page === "inbox",
      icon: (
        <Bell
          className={cn("h-[18px] w-[18px]", page === "inbox" ? "text-cyan-400" : "text-slate-500")}
          strokeWidth={1.9}
        />
      ),
    },
    {
      key: "settings",
      label: t(settingsSection.labelKey),
      target: settingsTarget,
      active: sectionForPage(page) === "settings",
      icon: (
        <settingsSection.icon
          className={cn(
            "h-[18px] w-[18px]",
            sectionForPage(page) === "settings" ? "text-cyan-400" : "text-slate-500",
          )}
          strokeWidth={1.9}
        />
      ),
    },
  ];

  return (
    // h-dvh + sticky top-0: the rail is always exactly viewport-height and never
    // moves with page scroll — content scrolls in <main>, nav scrolls internally
    // if it ever overflows.
    //
    // SOLID background (no `backdrop-blur`): the ambient orbs behind the shell
    // animate continuously. A translucent rail with backdrop-filter re-blurs
    // that moving content every frame — expensive on a cold start.
    <aside
      className={cn(
        "hidden md:flex h-dvh sticky top-0 z-30 shrink-0 flex-col bg-[#08111e] border-r border-white/[0.05]",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      {/* ── MARQUE ── */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center px-3",
          collapsed ? "justify-center" : "gap-2.5",
        )}
      >
        <img
          src={logoSrc}
          alt="TradeVault"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-lg"
        />
        {!collapsed && (
          <span className="truncate text-[15px] font-bold tracking-tight text-white">
            TradeVault
          </span>
        )}
        {/* Le bouton de pli est posé SUR la bordure, comme une poignée : c'est
            le bord que l'on tire, pas un bouton perdu dans l'en-tête. */}
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          className={cn(
            "absolute -right-3 top-[22px] z-10 grid h-6 w-6 place-items-center rounded-full",
            "border border-white/10 bg-[#0d1a2b] text-slate-400",
            "transition-colors duration-200 hover:border-cyan-400/40 hover:text-cyan-300",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── COMPTE ACTIF ── */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-1">
          <AccountSwitcher variant="card" />
        </div>
      )}

      {/* ── NAVIGATION ──
          SIX sections. Les pages d'une section vivent dans sa barre d'onglets,
          sous le titre : vingt-et-une entrées à plat ne se lisent pas d'un coup
          d'œil, six oui. Chaque page garde son URL. */}
      <nav
        className={cn(
          "min-h-0 flex-1 px-3 pb-2",
          // En mode réduit, l'infobulle sort de la colonne : un défilement
          // masquerait exactement ce qu'elle sert à montrer. Huit lignes de
          // 40 px tiennent sans défilement dans toutes les hauteurs d'écran.
          collapsed ? "overflow-visible" : "overflow-y-auto",
        )}
      >
        {groupLabel(t("nav.groupNavigate"))}
        <div className="space-y-1">
          {SECTIONS.filter((section) => section.id !== "settings").map((section) => {
            const { labelKey, icon: Icon } = SECTION_META[section.id];
            const active = sectionForPage(page) === section.id;
            const target = defaultPageOfSection(section.id);
            return row({
              key: section.id,
              label: t(labelKey),
              active,
              target,
              onActivate: () => setPage(target),
              icon: (
                <Icon
                  className={cn("h-[18px] w-[18px]", active ? "text-cyan-400" : "text-slate-500")}
                  strokeWidth={1.9}
                />
              ),
            });
          })}
        </div>

        {groupLabel(t("nav.groupAccount"))}
        <div className="space-y-1">
          {accountRows.map((entry) =>
            row({
              key: entry.key,
              label: entry.label,
              active: entry.active,
              target: entry.target,
              onActivate: () => setPage(entry.target),
              icon: entry.icon,
              badge:
                entry.key === "inbox" && unread > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-cyan-500 px-[3px] text-[8px] font-bold leading-none text-white"
                    role="status"
                    aria-label={`${unread} ${unread > 1 ? t("inbox.unreadPlural") : t("inbox.unread")}`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : undefined,
            }),
          )}
        </div>
      </nav>

      {/* ── PERFORMANCE ──
          Deux chiffres et une barre. Ils ne tiennent pas dans une colonne de
          76 px sans devenir illisibles : en mode réduit on les retire. */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-2">
          <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-slate-500">{t("stats.totalPnl")}</span>
              <span
                className={cn(
                  "font-display text-[13px] font-extrabold tabular-nums",
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {formatPnl(totalPnl)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10.5px] text-slate-500">{t("stats.winRate")}</span>
              <span className="font-display text-[13px] font-extrabold tabular-nums text-white">
                {formatPct(winRate)}
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full bg-cyan-400",
                  mounted && "transition duration-250",
                )}
                style={{ width: `${winRate * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── UTILISATEUR ── */}
      {user && (
        <div
          className={cn(
            "flex shrink-0 items-center border-t border-white/[0.05] px-3 py-3",
            collapsed ? "flex-col gap-2" : "gap-2.5",
          )}
        >
          <div
            title={collapsed ? user.name : undefined}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-500/15 bg-cyan-500/10 text-[13px] font-bold text-cyan-300"
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-white">{user.name}</div>
              <div className="truncate text-[10.5px] text-slate-600">{user.email}</div>
            </div>
          )}
          <button
            onClick={logout}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400"
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
