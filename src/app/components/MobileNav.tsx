import { useState } from "react";
import { LayoutDashboard, MoreHorizontal, Plus } from "lucide-react";
import type { Page } from "../types";
import { preloadPage } from "../pageModules";
import {
  MOBILE_SECTIONS,
  PAGE_META,
  SECTION_META,
  defaultPageOfSection,
  pagesOfSection,
  sectionForPage,
} from "../navigation";
import type { SectionId } from "../types";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useHasTradeDraft } from "../utils/persistence";
import { Sheet } from "@/shared/ui";

interface MobileNavProps {
  page: Page;
  setPage: (p: Page) => void;
  onAddTrade: () => void;
}

/**
 * LA BARRE DU BAS — Accueil · Journal · [+] · Analyse · Plus.
 *
 * ══ CE QUI CHANGE ══
 *
 *   • « Préparation » quitte la barre pour « Plus » : sur téléphone, on
 *     consulte son journal et ses chiffres ; la checklist et le calculateur
 *     restent à deux gestes, groupés avec Jarvis, la stratégie et les réglages.
 *   • L'ONGLET ACTIF N'EST PLUS UN BLOC. L'icône était posée sur une pastille
 *     pleine, découpée dans la barre : un aplat lourd, difficile à lire comme
 *     « tu es ici ». L'actif est maintenant l'icône et le libellé en blanc, et
 *     un trait d'accent de 3 px sous le libellé — rien d'autre.
 *   • LE « + » EST L'ACTION PRINCIPALE, et se lit comme telle : la seule
 *     surface pleine de la barre, légèrement surélevée, 52 px de cible.
 */

/** Les sections rangées derrière « Plus », dans l'ordre du déroulé d'une session. */
const MORE_SECTIONS: SectionId[] = ["preparation", "coach", "strategy", "settings"];

export default function MobileNav({ page, setPage, onAddTrade }: MobileNavProps) {
  const { t } = useT();
  const { user } = useAuth();
  const hasDraft = useHasTradeDraft(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);

  const activeSection = sectionForPage(page);
  const moreActive = activeSection !== null && MORE_SECTIONS.includes(activeSection);

  const items = MOBILE_SECTIONS.map((id) => {
    const { labelKey, icon } = SECTION_META[id];
    return {
      id,
      target: defaultPageOfSection(id),
      icon,
      // L'onglet du tableau de bord lit « Accueil » sur mobile — plus court.
      label: id === "dashboard" ? t("nav.home") : t(labelKey),
      active: activeSection === id,
    };
  });
  const [home, journal, analysis] = items;

  const go = (target: Page) => {
    setMoreOpen(false);
    setPage(target);
  };

  const tab = ({
    key,
    label,
    icon: Icon,
    active,
    onClick,
    onTouchStart,
  }: {
    label: string;
    icon: typeof LayoutDashboard;
    active: boolean;
    onClick: () => void;
    onTouchStart?: () => void;
    key?: string;
  }) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      // Le doigt touche l'écran avant que le clic ne se déclenche : le chunk
      // part dès ce premier contact.
      onTouchStart={onTouchStart}
      aria-current={active ? "page" : undefined}
      className={cn("bottom-nav-item", active ? "text-white" : "text-white/50")}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
      <span className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
        {label}
      </span>
      <span className={cn("bottom-nav-dot", active && "bottom-nav-dot-on")} aria-hidden />
    </button>
  );

  return (
    <>
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-[var(--tv-z-float)] md:hidden">
        <div className="bottom-nav-shell">
          <div className="grid grid-cols-5 items-center gap-1 px-2 py-1.5">
            {[home, journal].map((it) =>
              tab({
                key: it.id,
                label: it.label,
                icon: it.icon,
                active: it.active,
                onClick: () => go(it.target),
                onTouchStart: () => preloadPage(it.target),
              }),
            )}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={onAddTrade}
                aria-label={hasDraft ? t("trade.draftBadge") : t("common.addTrade")}
                className="fab-button relative"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} aria-hidden />
                {hasDraft && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--tv-bg)] bg-amber-400" />
                )}
              </button>
            </div>
            {tab({
              label: analysis.label,
              icon: analysis.icon,
              active: analysis.active,
              onClick: () => go(analysis.target),
              onTouchStart: () => preloadPage(analysis.target),
            })}
            {tab({
              label: t("nav.more"),
              icon: MoreHorizontal,
              active: moreActive || moreOpen,
              onClick: () => setMoreOpen(true),
            })}
          </div>
        </div>
      </nav>

      {/* « Plus » : les autres sections, groupées, une ligne par page. */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("nav.more")}>
        <div className="space-y-5 pb-[env(safe-area-inset-bottom,0px)]">
          {MORE_SECTIONS.map((sid) => (
            <section key={sid}>
              <h3 className="tv-label mb-1.5 px-1 text-slate-500">
                {t(SECTION_META[sid].labelKey)}
              </h3>
              <ul className="space-y-0.5">
                {pagesOfSection(sid).map((p) => {
                  const { labelKey, icon: Icon } = PAGE_META[p];
                  const on = p === page;
                  return (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => go(p)}
                        onTouchStart={() => preloadPage(p)}
                        aria-current={on ? "page" : undefined}
                        className={cn("more-row", on && "more-row-on")}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
