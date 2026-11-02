import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { Page, SectionId } from "../types";
import { Check, ChevronDown, Lock } from "@/shared/ui/icons";
import { PAGE_META, pagesOfSection } from "./navigation";
import { useSubscription } from "../hooks/useSubscription";
import { canAccessPage } from "../utils/pricing";
import { preloadPage } from "./pageModules";
import { pageFromPath, pathForPage } from "../utils/pageUrl";
import { cn } from "@/shared/ui/cn";
import { useT } from "../i18n/LanguageContext";
import { GlassTabBar, useSegmentWidth } from "@/shared/ui";

interface SectionTabsProps {
  section: SectionId;
  page: Page;
  setPage: (p: Page) => void;
}

/**
 * Les vues d'une section.
 *
 * ── ORDINATEUR : LA BARRE D'ONGLETS D'iOS 26 (Glisse) ─────────────────────
 * Une piste de verre et une sélection qui GLISSE d'une vue à l'autre, suit
 * la souris ou le doigt, et se soulève en lentille tant qu'on la tient.
 * Tous les onglets ont la même largeur (celle du libellé le plus long) : la
 * sélection avance d'un cran exact.
 *
 * ── DE VRAIS LIENS ─────────────────────────────────────────────────────────
 * Chaque onglet reste un `<a href>` vers l'URL canonique de la page : clic
 * milieu, « ouvrir dans un nouvel onglet » et copie du lien fonctionnent comme
 * sur n'importe quel site. Le clic simple navigue côté client.
 *
 * ── TÉLÉPHONE ──────────────────────────────────────────────────────────────
 * Un sélecteur qui dit où l'on est, en toutes lettres, et ouvre la liste
 * complète des vues.
 */
export default function SectionTabs({ section, page, setPage }: SectionTabsProps) {
  const { t } = useT();
  const pages = pagesOfSection(section);
  // Un petit cadenas sur l'onglet dit ce qui est payant AVANT le clic : on
  // n'apprend pas qu'une page est verrouillée en y arrivant.
  const { tier, loading: subLoading } = useSubscription();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  /* LE MENU EST PORTÉ AU NIVEAU DU DOCUMENT, en position fixe.
     Posé en absolu DANS la barre d'en-tête, il héritait de deux choses qui
     dépendent de la page : sa LARGEUR (celle du bouton, que les actions de la
     page — nombreuses sur le Journal — rétrécissaient) et sa COUCHE (le
     contexte d'empilement de <main>, sous lequel le contenu d'une page qui crée
     sa propre couche, comme le calculateur de lots, repassait par-dessus : le
     menu paraissait vide ou transparent). En portail, calé sur le bouton, avec
     une largeur fixe et la couche des feuilles : identique sur toutes les
     pages, et toujours au-dessus. */
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!pickerOpen) return;
    const place = () => {
      const r = pickerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(280, window.innerWidth - 24);
      const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
      setMenuPos({ left, top: r.bottom + 6, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [pickerOpen]);

  // Le menu se ferme au clic à côté, à Échap, et quand la vue change.
  useEffect(() => {
    if (!pickerOpen) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pickerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setPickerOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [pickerOpen]);
  useEffect(() => setPickerOpen(false), [page]);

  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p === page),
  );

  // La largeur commune des onglets, calée sur le libellé le plus long.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const width = useSegmentWidth(wrapRef, pages.length);

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
      {/* ── MOBILE : UN SÉLECTEUR ET SON MENU ──
          Le sélecteur dit où l'on est ; il ouvre un MENU ancré juste dessous
          (plus de fenêtre qui surgit du bas de l'écran) avec toutes les vues
          de la section, nommées. Échap, un appui à côté ou un choix le
          referment. */}
      <div ref={pickerRef} className="relative lg:hidden">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          aria-label={`${t("nav.sectionViews")} — ${t(activeLabelKey)}`}
          className={cn("section-picker", pickerOpen && "section-picker-open")}
        >
          <ActiveIcon className="h-4 w-4 shrink-0 text-[var(--tv-accent)]" strokeWidth={2.1} />
          <span className="min-w-0 flex-1 truncate text-left">{t(activeLabelKey)}</span>
          <span className="tv-num section-picker-count">
            {activeIndex + 1}/{pages.length}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
              pickerOpen && "rotate-180",
            )}
          />
        </button>

        {pickerOpen &&
          menuPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="section-menu"
              style={{ left: menuPos.left, top: menuPos.top, width: menuPos.width }}
            >
              {pages.map((p) => {
                const { labelKey, icon: Icon } = PAGE_META[p];
                const active = p === page;
                const locked = !subLoading && !canAccessPage(tier, p);
                return (
                  <button
                    key={p}
                    type="button"
                    role="menuitem"
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
            </div>,
            document.body,
          )}
      </div>

      {/* ── ORDINATEUR : la barre d'onglets d'iOS 26 (Glisse) ──
          La sélection glisse d'une vue à l'autre, suit le doigt ou la souris,
          et se soulève en lentille tant qu'on la tient. Chaque onglet reste
          un VRAI lien vers l'URL de la vue : clic du milieu et Cmd/Ctrl-clic
          ouvrent un nouvel onglet (Glisse les laisse passer) ; le clic simple
          navigue sans recharger (`SectionLink`). */}
      <div ref={wrapRef} className="section-tabs">
        <GlassTabBar
          aria-label={t("nav.sectionViews")}
          items={pages.map((p) => {
            const { labelKey, icon: Icon } = PAGE_META[p];
            const locked = !subLoading && !canAccessPage(tier, p);
            return {
              value: p,
              href: pathForPage(p),
              label: (
                <span className="tv-seg-label">
                  <Icon aria-hidden />
                  <span className="tv-seg-text">{t(labelKey)}</span>
                  {locked && <Lock className="tv-seg-lock" aria-hidden />}
                </span>
              ),
            };
          })}
          value={page}
          onValueChange={(next) => setPage(next as Page)}
          link={SectionLink}
          style={width ? ({ "--lg-tab-width": `${width}px` } as CSSProperties) : undefined}
        />
      </div>
    </>
  );
}

/**
 * Le lien d'un onglet : le clic SIMPLE ne recharge pas la page (la vue change
 * par `onValueChange`, côté client). Un clic avec modificateur garde son sens
 * — ouvrir ailleurs. Le code de la vue part dès le survol, 100 à 300 ms avant
 * le clic.
 */
const SectionLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function SectionLink({ href, onClick, ...rest }, ref) {
    const target = href ? pageFromPath(href) : null;
    return (
      <a
        ref={ref}
        href={href}
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
        }}
        onPointerEnter={() => target && preloadPage(target)}
        onFocus={() => target && preloadPage(target)}
        onTouchStart={() => target && preloadPage(target)}
      />
    );
  },
);
