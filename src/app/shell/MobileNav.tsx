import { Plus } from "@/shared/ui/icons";
import { Button, GlassTabBar } from "@/shared/ui";
import type { Page } from "../types";
import { preloadPage } from "./pageModules";
import { MOBILE_SECTIONS, SECTION_META, defaultPageOfSection, sectionForPage } from "./navigation";
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

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-[var(--tv-z-float)] md:hidden">
      {/* LA BARRE D'ONGLETS D'iOS 26 (Glisse) : une capsule de verre qui
          flotte, la sélection qui glisse d'une section à l'autre, suit le
          pouce et se soulève en lentille ; à côté, l'ajout d'un trade, un
          cercle plein à l'accent. Le code d'une section part dès le premier
          contact du doigt. */}
      <div
        className="bottom-nav-row"
        onTouchStart={() => items.forEach((it) => preloadPage(it.target))}
      >
        <GlassTabBar
          aria-label={t("nav.mainNavigation")}
          items={items.map(({ id, label, icon: Icon }) => ({
            value: id,
            label,
            icon: <Icon aria-hidden />,
          }))}
          value={
            activeSection && items.some((it) => it.id === activeSection) ? activeSection : null
          }
          onValueChange={(id) => {
            const it = items.find((x) => x.id === id);
            if (it) setPage(it.target);
          }}
          className="bottom-nav-tabs"
        />
        <div className="bottom-nav-add-wrap">
          <Button
            variant="primary"
            icon={<Plus strokeWidth={2.4} aria-hidden />}
            onClick={() => {
              tap();
              onAddTrade();
            }}
            aria-label={hasDraft ? t("trade.draftBadge") : t("common.addTrade")}
            className="bottom-nav-add"
          />
          {hasDraft && <span className="bottom-nav-draft" aria-hidden />}
        </div>
      </div>
    </nav>
  );
}
