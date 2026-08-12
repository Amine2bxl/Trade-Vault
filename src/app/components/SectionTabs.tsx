import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Page, SectionId } from "../types";
import { PAGE_META, pagesOfSection } from "../navigation";
import { preloadPage } from "../pageModules";
import { pathForPage } from "../utils/pageUrl";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";

interface SectionTabsProps {
  section: SectionId;
  page: Page;
  setPage: (p: Page) => void;
}

/**
 * La barre d'onglets d'une section.
 *
 * DE VRAIS LIENS. Chaque onglet est un `<a href>` vers l'URL canonique de la
 * page : clic milieu, « ouvrir dans un nouvel onglet » et copie du lien
 * fonctionnent comme sur n'importe quel site. Le clic simple est intercepté
 * pour naviguer côté client — sauf s'il porte un modificateur, auquel cas on
 * laisse le navigateur faire son travail.
 *
 * LE SOULIGNEMENT NE FAIT QUE DES `transform`. Il est posé en absolu, large
 * d'un pixel, puis déplacé et étiré (`translateX` + `scaleX`) jusqu'à la
 * position de l'onglet actif. Aucune propriété de mise en page n'est animée :
 * pas de `left`, pas de `width`, donc pas de recalcul de disposition à chaque
 * frame — la règle de `MOTION_AND_PERF.md` appliquée dès maintenant.
 *
 * MOBILE. La rangée défile horizontalement avec accrochage ; elle ne passe
 * JAMAIS sur deux lignes. Préparation a six onglets : à 380 px ils défilent.
 */
export default function SectionTabs({ section, page, setPage }: SectionTabsProps) {
  const { t } = useT();
  const pages = pagesOfSection(section);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [underline, setUnderline] = useState<{ x: number; w: number } | null>(null);

  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p === page),
  );

  // Mesure APRÈS peinture mais avant que le navigateur n'affiche la frame :
  // le soulignement est donc déjà au bon endroit au premier rendu, il ne
  // « glisse » pas depuis la gauche à l'arrivée sur la page.
  useLayoutEffect(() => {
    const el = tabRefs.current[activeIndex];
    const list = listRef.current;
    if (!el || !list) return;
    setUnderline({ x: el.offsetLeft, w: el.offsetWidth });
  }, [activeIndex, section, t]);

  // Le libellé actif peut changer de largeur (traduction, police chargée plus
  // tard) : on re-mesure quand la rangée elle-même change de taille.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const el = tabRefs.current[activeIndex];
      if (el) setUnderline({ x: el.offsetLeft, w: el.offsetWidth });
    });
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeIndex]);

  // L'onglet actif reste visible quand la rangée défile (mobile, 6 onglets).
  useEffect(() => {
    tabRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  const go = useCallback(
    (target: Page, e: React.MouseEvent) => {
      // Clic milieu, Cmd/Ctrl, Shift, Alt : c'est une demande d'ouverture
      // ailleurs. On ne la vole pas.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      setPage(target);
    },
    [setPage],
  );

  // Flèches : déplacement au clavier entre onglets, comme un vrai tablist.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? pages.length - 1
          : (activeIndex + delta + pages.length) % pages.length;
    tabRefs.current[next]?.focus();
    setPage(pages[next]);
  };

  return (
    <div
      className="section-tabs"
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
    >
      <div ref={listRef} className="section-tabs-row">
        {pages.map((p, i) => {
          const { labelKey, icon: Icon } = PAGE_META[p];
          const active = p === page;
          return (
            <a
              key={p}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              href={pathForPage(p)}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={(e) => go(p, e)}
              // Le chunk part au survol / focus / premier contact du doigt,
              // soit 100 à 300 ms avant le clic.
              onPointerEnter={() => preloadPage(p)}
              onFocus={() => preloadPage(p)}
              onTouchStart={() => preloadPage(p)}
              className={cn("section-tab", active ? "section-tab-active" : "section-tab-idle")}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t(labelKey)}</span>
            </a>
          );
        })}
        {underline && (
          <span
            aria-hidden
            className="section-tab-underline"
            style={{ transform: `translateX(${underline.x}px) scaleX(${underline.w})` }}
          />
        )}
      </div>
    </div>
  );
}
