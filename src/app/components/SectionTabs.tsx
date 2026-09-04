import { useCallback, useEffect, useRef, useState } from "react";
import type { Page, SectionId } from "../types";
import { Check, ChevronDown, Lock } from "lucide-react";
import { PAGE_META, pagesOfSection } from "../navigation";
import { useSubscription } from "../hooks/useSubscription";
import { canAccessPage } from "../utils/pricing";
import { preloadPage } from "../pageModules";
import { pathForPage } from "../utils/pageUrl";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { Modal } from "@/shared/ui";

interface SectionTabsProps {
  section: SectionId;
  page: Page;
  setPage: (p: Page) => void;
}

/**
 * Les vues d'une section — un CONTRÔLE SEGMENTÉ.
 *
 * ── POURQUOI PLUS DE SOULIGNEMENT ──────────────────────────────────────────
 * La version précédente était une rangée soulignée. Sur le même écran, la
 * barre latérale marque déjà l'endroit actif par un liseré : deux grammaires
 * d'« actif », et l'œil doit apprendre les deux. Un segment — un cadre, des
 * pastilles, une seule posée sur une surface pleine — dit d'un coup d'œil
 * qu'on choisit UNE vue parmi N, sans rien à apprendre.
 *
 * Ça supprime aussi toute la mécanique de mesure (`useLayoutEffect`,
 * `ResizeObserver`, `translateX`/`scaleX`) : l'état actif est une classe, pas
 * une position calculée. Moins de code, rien à re-mesurer quand la police ou
 * la traduction change de largeur.
 *
 * ── DE VRAIS LIENS ─────────────────────────────────────────────────────────
 * Chaque onglet reste un `<a href>` vers l'URL canonique de la page : clic
 * milieu, « ouvrir dans un nouvel onglet » et copie du lien fonctionnent comme
 * sur n'importe quel site. Le clic simple est intercepté pour naviguer côté
 * client — sauf s'il porte un modificateur.
 *
 * ── MOBILE ─────────────────────────────────────────────────────────────────
 * La rangée défile horizontalement avec accrochage ; elle ne passe JAMAIS sur
 * deux lignes. Préparation a six vues : à 380 px elles défilent.
 */
export default function SectionTabs({ section, page, setPage }: SectionTabsProps) {
  const { t } = useT();
  const pages = pagesOfSection(section);
  // Un petit cadenas sur l'onglet dit ce qui est payant AVANT le clic : on
  // n'apprend pas qu'une page est verrouillée en y arrivant.
  const { tier, loading: subLoading } = useSubscription();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p === page),
  );

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

  const { icon: ActiveIcon, labelKey: activeLabelKey } = PAGE_META[pages[activeIndex]];

  // Une seule vue dans la section : il n'y a rien à choisir, donc rien à
  // afficher. La rangée occupait quand même sa ligne, vide de sens.
  if (pages.length < 2) return null;

  return (
    <>
      {/* ── MOBILE : UN SÉLECTEUR, PAS UNE RANGÉE ──
          Six pastilles icône-seule qui défilent horizontalement, c'est six
          cibles ambiguës dont la moitié sort de l'écran : pour atteindre
          Monte-Carlo depuis Analytics il fallait deviner un pictogramme, puis
          faire défiler jusqu'à lui. Le sélecteur dit OÙ L'ON EST, en toutes
          lettres, et ouvre la liste complète — noms compris — d'un seul appui
          sur une cible de 44px. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-haspopup="dialog"
        aria-label={t(activeLabelKey)}
        className="section-picker"
      >
        <ActiveIcon className="h-4 w-4 shrink-0 text-[var(--tv-accent)]" strokeWidth={2.1} />
        <span className="min-w-0 flex-1 truncate text-left">{t(activeLabelKey)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        wrapperClassName="z-[80] md:hidden"
        className="md:max-w-sm"
      >
        <div className="px-5 pb-2 pt-4">
          <h2 className="tv-title">{t("nav.sectionViews")}</h2>
        </div>
        <div className="space-y-1 p-3 pt-1">
          {pages.map((p) => {
            const { labelKey, icon: Icon } = PAGE_META[p];
            const active = p === page;
            const locked = !subLoading && !canAccessPage(tier, p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setPage(p);
                }}
                onTouchStart={() => preloadPage(p)}
                className={cn("section-picker-row", active && "section-picker-row-active")}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-[var(--tv-accent)]" : "text-slate-500",
                  )}
                  strokeWidth={active ? 2.1 : 1.9}
                />
                <span className="min-w-0 flex-1 truncate text-left">{t(labelKey)}</span>
                {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />}
                {active && <Check className="h-4 w-4 shrink-0 text-[var(--tv-accent)]" />}
              </button>
            );
          })}
        </div>
      </Modal>

      {/* ── DESKTOP : le contrôle segmenté, inchangé ── */}
      <div
        className="section-tabs"
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        <div className="section-tabs-row">
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
                aria-label={t(labelKey)}
                title={t(labelKey)}
                tabIndex={active ? 0 : -1}
                onClick={(e) => go(p, e)}
                // Le chunk part au survol / focus / premier contact du doigt,
                // soit 100 à 300 ms avant le clic.
                onPointerEnter={() => preloadPage(p)}
                onFocus={() => preloadPage(p)}
                onTouchStart={() => preloadPage(p)}
                className={cn("section-tab", active ? "section-tab-active" : "section-tab-idle")}
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", active ? "text-cyan-300" : "text-slate-500")}
                  strokeWidth={active ? 2.2 : 1.9}
                />
                {/* Mobile : icônes seules (le texte revient dès md) — un label sur
                  une rangée de 6 onglets devenait illisible et dur à toucher. */}
                <span className="hidden whitespace-nowrap md:inline">{t(labelKey)}</span>
                {!subLoading && !canAccessPage(tier, p) && (
                  <Lock className="hidden h-3 w-3 shrink-0 text-slate-500 md:block" aria-hidden />
                )}
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
