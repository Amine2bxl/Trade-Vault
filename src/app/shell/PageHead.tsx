import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Page } from "../types";
import { cn } from "@/shared/ui/cn";
import MobileActions from "./MobileActions";
import SectionTabs from "./SectionTabs";
import { PAGE_META, SECTION_META, pagesOfSection, sectionForPage } from "./navigation";
import { useT } from "../i18n/LanguageContext";

/**
 * L'EN-TÊTE DE PAGE — LIQUID.
 *
 * Deux étages, dans le flux :
 *
 *   1. le GRAND TITRE (Large Title d'iOS), dérivé de la navigation — le nom de
 *      la section, ou de la page quand elle n'en a pas. Source unique :
 *      `SECTION_META` / `PAGE_META`, donc chaque page a un titre sans en
 *      écrire un, et il ne peut pas diverger du rail ;
 *   2. la rangée d'ORIGINE, inchangée : onglets de section (ou résumé d'une
 *      ligne) à gauche, actions de la page à droite. L'ordre que le trader
 *      connaît ne bouge pas, il gagne seulement un titre au-dessus.
 *
 * Au défilement, une BARRE COMPACTE de verre se pose en haut de la fenêtre
 * avec le titre en petit, dès que le grand titre est sorti : on sait toujours
 * où l'on est. Elle vit dans un conteneur collant de hauteur nulle — elle
 * n'occupe aucune place dans la page, rien ne saute à son apparition.
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
  const width = page === "calendar" ? "max-w-[1400px]" : "max-w-[1200px]";

  /* Le grand titre est-il encore visible dans la fenêtre de défilement ?
     Observé, pas calculé au scroll : aucun écouteur, aucun calcul par image. */
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      root: el.closest("main"),
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hasRow = hasTabs || lead || actions;

  return (
    <>
      <div className="page-compact" aria-hidden={!compact}>
        <div className={cn("page-compact-bar", compact && "page-compact-bar-on")}>
          <span className="truncate">{title}</span>
        </div>
      </div>
      <div className={cn("app-page-head mx-auto w-full px-4 pt-4 md:px-6 md:pt-6", width)}>
        <div className="flex items-center gap-2">
          <h1 ref={titleRef} className="tv-large-title min-w-0 flex-1 truncate">
            {title}
          </h1>
          <MobileActions page={page} setPage={setPage} />
        </div>
        {hasRow && (
          <div className="mt-3 flex items-center gap-2 md:mt-4 md:gap-3">
            <div
              className={cn(
                "min-w-0 flex-1",
                page === "dashboard" && "md:order-2 md:flex md:justify-end",
              )}
            >
              {hasTabs ? <SectionTabs section={section} page={page} setPage={setPage} /> : lead}
            </div>
            {actions && (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-2",
                  page === "dashboard" && "md:order-1",
                )}
              >
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
