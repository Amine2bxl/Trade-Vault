import { LayoutDashboard, Plus } from "@/shared/ui/icons";
import type { Page } from "../types";
import { preloadPage } from "./pageModules";
import { MOBILE_SECTIONS, SECTION_META, defaultPageOfSection, sectionForPage } from "./navigation";
import { cn } from "@/shared/ui/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useHasTradeDraft } from "../utils/persistence";
import { tap } from "@/shared/haptics";

interface MobileNavProps {
  page: Page;
  setPage: (p: Page) => void;
  onAddTrade: () => void;
}

/**
 * LA BARRE DU BAS — Accueil · Préparation · [+] · Journal · Analyse.
 *
 * Pas de menu « Plus » : une section s'ouvre ici, et ses sous-pages se
 * parcourent par les onglets en haut de la page. Les sous-comptes et Jarvis
 * restent en bulles flottantes au-dessus de la barre.
 *
 * LIQUID — une barre SOLIDE (verre presque opaque) : l'onglet actif est une
 * tuile sombre, icône à l'accent ; l'ajout est un carré adouci plein, au
 * centre exact, icône blanche. Styles : `.bottom-nav*` dans styles.css.
 */
export default function MobileNav({ page, setPage, onAddTrade }: MobileNavProps) {
  const { t } = useT();
  const { user } = useAuth();
  const hasDraft = useHasTradeDraft(user?.id);

  const activeSection = sectionForPage(page);

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

  const tab = ({
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
      type="button"
      onClick={() => setPage(target)}
      // Le doigt touche l'écran avant que le clic ne se déclenche : le chunk
      // part dès ce premier contact.
      onTouchStart={() => preloadPage(target)}
      aria-current={active ? "page" : undefined}
      className={cn("bottom-nav-item", active && "bottom-nav-item-on")}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </button>
  );

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-[var(--tv-z-float)] md:hidden">
      <div className="bottom-nav-shell">
        {/* 2 + bouton d'ajout + 2 = cinq colonnes. */}
        <div className="grid grid-cols-5 items-center gap-1 px-1.5 py-1.5">
          {items.slice(0, 2).map(tab)}
          {/* L'AJOUT — le seul aplat d'accent de la barre, à la même hauteur
              que les onglets (pas surélevé, pas d'anneau ni de lueur). Sans
              libellé visible : le « + » plein se suffit, et `aria-label` le
              nomme pour les lecteurs d'écran. */}
          <button
            type="button"
            onClick={() => {
              tap();
              onAddTrade();
            }}
            aria-label={hasDraft ? t("trade.draftBadge") : t("common.addTrade")}
            className="flex min-h-[54px] items-center justify-center rounded-2xl"
          >
            <span className="bottom-nav-add relative">
              <Plus className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden />
              {hasDraft && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--tv-plate-1)] bg-amber-400" />
              )}
            </span>
          </button>
          {items.slice(2).map(tab)}
        </div>
      </div>
    </nav>
  );
}
