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
 * LA BARRE DU BAS — Accueil · Préparation · [+] · Journal · Analyse.
 *
 * Pas de menu « Plus » : une section s'ouvre ici, et ses sous-pages se
 * parcourent par les onglets en haut de la page. Les sous-comptes et Jarvis
 * restent en bulles flottantes au-dessus de la barre.
 *
 * L'onglet actif est l'icône et le libellé en blanc, plus un trait d'accent
 * de 3 px sous le libellé — plus de pastille pleine découpée dans la barre.
 * L'ajout est un onglet comme les autres, marqué par une tuile d'accent.
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
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-[var(--tv-z-float)] md:hidden">
      <div className="bottom-nav-shell">
        {/* 2 + bouton d'ajout + 2 = cinq colonnes. */}
        <div className="grid grid-cols-5 items-center gap-1 px-2 py-1.5">
          {items.slice(0, 2).map(tab)}
          {/* L'AJOUT — un onglet parmi les autres, pas un bloc posé dessus.
              C'était un carré plein de 52px, surélevé de 18px, cerclé d'un
              anneau et d'une lueur : la pièce la plus lourde de l'écran, qui
              mordait sur le contenu. Il garde sa place au centre et la seule
              touche d'accent de la barre, mais à la même hauteur et avec la
              même anatomie (icône + libellé) que ses voisins. */}
          <button
            type="button"
            onClick={onAddTrade}
            aria-label={hasDraft ? t("trade.draftBadge") : t("common.addTrade")}
            className="bottom-nav-item text-[var(--tv-highlight)]"
          >
            <span className="bottom-nav-add relative">
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
              {hasDraft && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--tv-rail-bot)] bg-amber-400" />
              )}
            </span>
            <span className="text-[10px] font-semibold leading-none">{t("common.add")}</span>
            <span className="bottom-nav-dot" aria-hidden />
          </button>
          {items.slice(2).map(tab)}
        </div>
      </div>
    </nav>
  );
}
