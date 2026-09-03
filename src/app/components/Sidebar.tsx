import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings as SettingsIcon,
  User,
} from "lucide-react";
import { Page, SECTIONS } from "../types";
import { SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { preloadPage } from "../pageModules";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { Modal, BrandMark, BrandWord } from "@/shared/ui";
import AccountSwitcher from "./AccountSwitcher";

interface SidebarProps {
  page: Page;
  setPage: (p: Page) => void;
  totalPnl: number;
}

export default function Sidebar({ page, setPage, totalPnl }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const { activeAccount } = useAccounts();
  const unread = useUnreadCount(user?.id);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);

  // Infobulle de la barre repliée, rendue en PORTAL (position fixe) : la barre
  // repliée est `overflow-hidden` pour un repli/dépli animé sans débordement de
  // texte, ce qui clipperait une infobulle absolue posée à droite de l'icône.
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const showTip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);

  /* Une entrée du rail. Pliée ou dépliée, c'est la MÊME pilule : dépliée elle
     contient icône + libellé, pliée elle se referme sur son icône. Rien ne
     change de forme au pli, seule la largeur du rail bouge — c'est ce qui rend
     l'animation lisible au lieu de donner l'impression que la barre se
     recompose. */
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
      onPointerEnter={target ? () => preloadPage(target) : undefined}
      onFocus={target ? () => preloadPage(target) : undefined}
      onMouseEnter={collapsed ? (e) => showTip(e, label) : undefined}
      onMouseLeave={collapsed ? hideTip : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rail-item w-full",
        collapsed ? "justify-center px-0" : "px-3",
        active && "rail-item-active",
      )}
    >
      <span className="rail-icon relative">
        {icon}
        {badge}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const settingsSection = SECTION_META.settings;
  const settingsTarget = defaultPageOfSection("settings");

  return (
    <aside
      className={cn(
        "rail relative z-30 hidden shrink-0 flex-col rounded-[28px] md:flex",
        // Une capsule qui FLOTTE : elle ne touche aucun bord. La hauteur se
        // calcule sur le viewport moins ses propres marges, pour que le fond de
        // la page passe au-dessus ET en dessous d'elle.
        "sticky top-3 my-3 ml-3 h-[calc(100dvh-1.5rem)]",
        collapsed ? "rail-collapsed w-[68px]" : "w-[212px]",
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* ── MARQUE + PLI ──
            Déplié : disque blanc + nom à gauche, chevron à droite.
            Plié : le disque seul, centré. Le chevron descend sous la marque,
            car sur 68px de large il n'y a pas de place pour deux objets. */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 px-3 pt-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rail-brand" aria-label="TradeVault">
              <BrandMark size={19} className="text-[var(--tv-rail-bot)]" />
            </div>
            {!collapsed && <BrandWord className="truncate text-[15px] text-white" />}
          </div>
          {/* Le chevron n'existe en haut que DÉPLIÉ. Plié, la tête du rail est
              le disque de marque et rien d'autre — un second objet sur 68px de
              large casserait la colonne d'icônes. Il repasse au pied. */}
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              aria-expanded
              aria-label={t("nav.collapseSidebar")}
              title={t("nav.collapseSidebar")}
              className="rail-toggle"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── NAVIGATION ── */}
        <nav className="min-h-0 flex-1 px-2.5 py-3">
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
                // L'icône HÉRITE de la couleur de la pilule : blanche au repos,
                // vert foncé quand la pilule est active. Aucune couleur propre.
                icon: <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />,
              });
            })}
          </div>

          {/* Séparateur discret entre les sections et le compte — visible plié et déplié. */}
          <div className="rail-divider my-2.5" />

          <div className="space-y-1">
            {row({
              key: "inbox",
              label: t("nav.inbox"),
              active: page === "inbox",
              target: "inbox",
              onActivate: () => setPage("inbox"),
              icon: <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />,
              badge:
                unread > 0 ? (
                  <span
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--tv-danger)] px-[3px] text-[10px] font-bold leading-none text-white"
                    role="status"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : undefined,
            })}
            {row({
              key: "settings",
              label: t(settingsSection.labelKey),
              active: sectionForPage(page) === "settings",
              target: settingsTarget,
              onActivate: () => setPage(settingsTarget),
              icon: <settingsSection.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />,
            })}
          </div>
        </nav>

        {/* ── COMPTE ACTIF ── */}
        {user && !collapsed && (
          <div className="shrink-0 px-2.5 pb-3">
            <div className="rail-divider mb-3" />
            <AccountSwitcher
              variant="card"
              balance={(activeAccount?.startingBalance ?? 0) + totalPnl}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <button onClick={() => setPage(settingsTarget)} className="rail-chip flex-1">
                <SettingsIcon className="h-3.5 w-3.5" />
                {t("nav.settings")}
              </button>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label={t("common.signOut")}
                title={t("common.signOut")}
                className="rail-chip rail-chip-danger w-8 shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="shrink-0 px-2.5 pb-3">
            <div className="rail-divider mb-3" />
            <div className="space-y-1.5">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label={t("nav.myAccount")}
                title={t("nav.myAccount")}
                className="rail-chip mx-auto h-10 w-10"
              >
                <User className="h-4 w-4" />
              </button>
              <button
                onClick={toggleCollapsed}
                aria-expanded={false}
                aria-label={t("nav.expandSidebar")}
                title={t("nav.expandSidebar")}
                className="rail-chip mx-auto h-10 w-10"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Menu compact (sidebar repliée) : compte + déconnexion ── */}
      {user && (
        <Modal
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          wrapperClassName="z-[80] md:items-center md:justify-center"
          className="md:max-w-xs"
        >
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[rgb(var(--tv-accent-rgb)/0.14)] text-sm font-bold text-[var(--tv-highlight)]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{user.name}</div>
              <div className="truncate text-[11px] text-slate-500">{user.email}</div>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                setPage(settingsTarget);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-white/[0.06] transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <span className="text-[13px] font-medium">{t("nav.settings")}</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </span>
              <span className="text-[13px] font-medium">{t("common.signOut")}</span>
            </button>
          </div>
        </Modal>
      )}

      {typeof document !== "undefined" &&
        tip &&
        createPortal(
          <div
            className="rail-tip"
            style={{
              position: "fixed",
              top: tip.top,
              left: tip.left,
              transform: "translateY(-50%)",
              opacity: 1,
              zIndex: 100,
            }}
          >
            {tip.text}
          </div>,
          document.body,
        )}
    </aside>
  );
}
