import type { ReactNode } from "react";
import type { Page } from "../types";
import { cn } from "@/shared/ui/cn";
import { PAGE_WIDTH } from "@/shared/ui/tokens";
import MobileActions from "./MobileActions";
import SectionTabs from "./SectionTabs";
import { PAGE_META, SECTION_META, pagesOfSection, sectionForPage } from "./navigation";
import { useT } from "../i18n/LanguageContext";

/**
 * L'EN-TÊTE DE PAGE — une barre d'application, pas un titre de site.
 *
 * Le grand titre (« Analysis ») a disparu : il répétait l'onglet actif du
 * rail, le sélecteur de vue (« Analysis ▾ ») et parfois le titre de la carte
 * juste dessous — trois fois le même mot avant le premier chiffre. Le nom de
 * la page reste dans le document pour les lecteurs d'écran (`sr-only`).
 *
 *   • téléphone — une barre d'app : le compte actif à gauche, Jarvis, la
 *     cloche et les réglages à droite ; dessous, le sélecteur de vue et les
 *     actions de la page ;
 *   • bureau — une seule rangée : les onglets de la section (ou la ligne
 *     d'état de la page) à gauche, les actions à droite. Le rail porte déjà
 *     le compte, la cloche et les réglages.
 */
export default function PageHead({
  page,
  setPage,
  actions,
  lead,
}: {
  page: Page;
  setPage: (page: Page) => void;
  actions: ReactNode;
  lead: ReactNode;
}) {
  const { t } = useT();
  const section = sectionForPage(page);
  const hasTabs = section && pagesOfSection(section).length > 1;
  const title = t(section ? SECTION_META[section].labelKey : PAGE_META[page].labelKey);

  return (
    <div className={cn("app-page-head mx-auto w-full px-4 pt-3 md:px-6 md:pt-5", PAGE_WIDTH)}>
      <h1 className="sr-only">{title}</h1>
      <MobileActions page={page} setPage={setPage} />
      <div className="mt-2 flex min-h-9 items-center gap-2 md:mt-0 md:gap-3">
        <div className="min-w-0 flex-1">
          {hasTabs ? <SectionTabs section={section} page={page} setPage={setPage} /> : lead}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
