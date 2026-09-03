import { LayoutDashboard, Plus } from "lucide-react";
import type { Page } from "../types";
import { preloadPage } from "../pageModules";
import { MOBILE_SECTIONS, SECTION_META, defaultPageOfSection, sectionForPage } from "../navigation";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useHasTradeDraft } from "../utils/persistence";

interface MobileNavProps {
  page: Page;
  setPage: (p: Page) => void;
  onAddTrade: () => void;
}

/**
 * Barre du bas — QUATRE sections + le bouton d'ajout, en cinq colonnes :
 * Tableau de bord · Préparation · [+] · Journal · Analyse.
 *
 * Le menu « Plus » a disparu. Il existait pour loger vingt-et-une entrées dans
 * une barre qui n'en montre que quelques-unes ; avec six sections il n'a plus
 * rien à porter. Sa recherche faisait double emploi avec la palette de
 * commandes (⌘K), qui reste. Sa cloche est passée dans l'en-tête mobile, et
 * son sélecteur de compte dans la section Réglages.
 *
 * Les pages d'une section s'atteignent par la barre d'onglets, dans la page.
 */
export default function MobileNav({ page, setPage, onAddTrade }: MobileNavProps) {
  const { t } = useT();
  const { user } = useAuth();
  const hasDraft = useHasTradeDraft(user?.id);

  const activeSection = sectionForPage(page);

  const items = MOBILE_SECTIONS.map((id) => {
    const { labelKey, icon } = SECTION_META[id];
    const target = defaultPageOfSection(id);
    return {
      id,
      target,
      icon,
      // L'onglet du tableau de bord lit « Accueil » sur mobile — libellé plus
      // court, plus proche du geste du pouce.
      label: id === "dashboard" ? t("nav.home") : t(labelKey),
      active: activeSection === id,
    };
  });
  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2);

  const renderItem = ({
    id,
    target,
    label,
    icon: Icon,
    active,
  }: {
    id: string;
    target: Page;
    label: string;
    icon: typeof LayoutDashboard;
    active: boolean;
  }) => (
    <button
      key={id}
      onClick={() => setPage(target)}
      // Le doigt touche l'écran avant que le clic ne se déclenche : le chunk
      // part dès ce premier contact, ce qui suffit souvent à le rendre prêt.
      onTouchStart={() => preloadPage(target)}
      aria-current={active ? "page" : undefined}
      className={cn("bottom-nav-item", active ? "text-cyan-300" : "text-slate-500")}
    >
      {/* Active top bar indicator */}
      <span className={cn("bottom-nav-bar", active && "bottom-nav-bar-active")} />
      {/* Icon on an active pill that lights up cyan */}
      <span className={cn("bottom-nav-icon", active && "bottom-nav-icon-active")}>
        <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        className={cn(
          "text-[10px] leading-none transition",
          active ? "font-bold" : "font-semibold",
        )}
      >
        {label}
      </span>
    </button>
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav">
      <div className="bottom-nav-shell">
        {/* 2 + bouton d'ajout + 2 = cinq enfants, cinq colonnes. */}
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-2 gap-1">
          {leftItems.map(renderItem)}
          <div className="flex justify-center items-center">
            <button
              onClick={onAddTrade}
              aria-label={hasDraft ? t("trade.draftBadge") : t("common.addTrade")}
              className="fab-button relative text-white -mt-7"
            >
              <Plus className="w-6 h-6" strokeWidth={2.5} />
              {hasDraft && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[var(--tv-bg)]" />
              )}
            </button>
          </div>
          {rightItems.map(renderItem)}
        </div>
      </div>
    </div>
  );
}
