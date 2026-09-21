import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import type { Lang } from "../i18n/translations";
import { SUPPORT_EMAIL } from "../types";
import { LEGAL_ROUTES, legalBlurb, legalChrome, legalLabel, type LegalDoc } from "./legal-content";
import { usePublicLang } from "./usePersistedLang";
import { breadcrumbJsonLd } from "@/shared/seo";
import "./landing.css";

/**
 * LE GABARIT DES PAGES LÉGALES.
 *
 * ── CE QU'ON NE SAVAIT PAS EN ARRIVANT ────────────────────────────────────
 *
 * Trois choses, et elles se répondaient :
 *
 *   1. SUR QUELLE PAGE ON ÉTAIT. L'en-tête portait le logo et rien d'autre ;
 *      le titre du document défilait hors de l'écran au bout de deux
 *      paragraphes, et il ne restait plus aucun repère.
 *   2. QUELLES AUTRES PAGES EXISTAIENT. Elles étaient listées TOUT EN BAS,
 *      donc on ne les découvrait qu'après avoir lu le document entier.
 *   3. LAQUELLE OUVRIR. « Conditions d'utilisation » et « CGU » sont deux
 *      documents différents et leurs noms ne disent pas en quoi. Devant
 *      quatre intitulés juridiques, on ne sait pas lequel porte la règle de
 *      résiliation, alors on les ouvre tous ou aucun.
 *
 * ── LA RÉPONSE : UNE COLONNE QUI NE BOUGE PAS ─────────────────────────────
 *
 * L'en-tête est collé en haut, et il NOMME le document ouvert. À sa gauche,
 * une colonne collée sous lui porte deux listes : les quatre documents, avec
 * une phrase disant ce qu'on trouve dans chacun et un rail émeraude sur
 * celui qu'on lit ; puis le sommaire du document, dont l'entrée courante
 * s'allume au défilement.
 *
 * On peut donc répondre aux trois questions sans jamais remonter, et le
 * texte est la seule chose qui bouge — ce qui est exactement le
 * comportement qu'on attend d'un document de référence.
 *
 * ── LA LARGEUR ────────────────────────────────────────────────────────────
 *
 * ~68 caractères. C'est la mesure au-delà de laquelle l'œil rate la ligne
 * suivante en revenant à la marge. Un document légal est déjà pénible à
 * lire ; lui donner 110 caractères de large le rend hostile.
 */

/** La hauteur de l'en-tête collé, en pixels. Sert aussi d'ancrage haut. */
const HAUTEUR_ENTETE = 64;

/**
 * LA SECTION QU'ON EST EN TRAIN DE LIRE.
 *
 * Un `IntersectionObserver` avec une fenêtre resserrée sur le haut de
 * l'écran : la section « active » est celle qui passe sous l'en-tête, pas
 * celle qui occupe le plus de place. C'est ce qui fait qu'un sommaire suit
 * la lecture au lieu de sauter deux entrées d'un coup.
 */
function useSectionActive(nb: number) {
  const [actif, setActif] = useState(0);

  useEffect(() => {
    if (nb === 0) return;
    const cibles = Array.from({ length: nb }, (_, i) => document.getElementById(`sec-${i}`)).filter(
      (n): n is HTMLElement => n !== null,
    );
    if (!cibles.length) return;

    const obs = new IntersectionObserver(
      (entrees) => {
        /* On prend la PREMIÈRE section visible dans la bande, pas la
           dernière entrée déclenchée : en défilement rapide, plusieurs
           franchissent la bande dans la même frame. */
        const visibles = entrees
          .filter((e) => e.isIntersecting)
          .map((e) => Number(e.target.id.slice(4)));
        if (visibles.length) setActif(Math.min(...visibles));
      },
      { rootMargin: `-${HAUTEUR_ENTETE + 8}px 0px -70% 0px`, threshold: 0 },
    );
    cibles.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [nb]);

  return actif;
}

export default function LegalPage({
  pick,
  path,
}: {
  pick: (lang: Lang) => LegalDoc;
  /** Le chemin de la route qui rend cette page — pour le fil d'Ariane. */
  path: string;
}) {
  const lang = usePublicLang();
  const doc = useMemo(() => pick(lang), [pick, lang]);
  const chrome = legalChrome(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const actif = useSectionActive(doc.blocks.length);

  return (
    <div
      dir={dir}
      className="landing-root relative min-h-dvh overflow-x-clip bg-[var(--tv-bg)] text-slate-300"
    >
      {/* FIL D'ARIANE lisible par une machine. Sans lui, un résultat de
          recherche affiche l'URL brute au lieu du chemin « TradeVault ›
          Politique de confidentialité », et le moteur n'a rien qui rattache
          la page à l'accueil. `doc.title` suit la langue affichée : le fil
          nomme donc la page comme elle s'appelle réellement à l'écran. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(doc.title, path) }}
      />

      {/* L'EN-TÊTE NE BOUGE PLUS, ET IL NOMME LE DOCUMENT.
          Il défilait hors de l'écran au bout de deux paragraphes : passé ce
          point, plus rien ne disait ni de quel produit ni de quel document
          il s'agissait. Le nom du document y est répété après le logo, comme
          un fil d'Ariane — c'est la réponse la moins coûteuse à « je suis
          où ? ». */}
      <header className="sticky top-0 z-[var(--tv-z-nav)] border-b border-white/[.06] bg-[rgb(10_12_11/0.82)] backdrop-blur-md">
        <div className="lp-container flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <a href="/" className="flex shrink-0 items-center gap-2.5">
              <img
                src={logoSrc}
                alt="TradeVault"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
              />
              <span className="font-display text-[1.05rem] font-bold leading-none tracking-[-0.02em] text-white">
                TradeVault
              </span>
            </a>
            <span className="hidden text-slate-700 sm:inline" aria-hidden>
              /
            </span>
            <span className="hidden truncate text-[13px] font-medium text-slate-400 sm:inline">
              {doc.title}
            </span>
          </div>
          <Link
            to="/"
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> {chrome.back}
          </Link>
        </div>
      </header>

      <div className="lp-container relative z-10 py-12 md:py-16">
        <div className="mx-auto max-w-[1040px] lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-14">
          {/* ── LA COLONNE QUI NE BOUGE PAS ──
              `top` dégage la hauteur de l'en-tête collé, sinon elle
              passerait dessous. Sous `lg` elle redevient un bloc en tête :
              une colonne collante sur un écran de 390px mangerait la page. */}
          <div
            className="mb-10 lg:sticky lg:mb-0 lg:self-start"
            style={{ top: HAUTEUR_ENTETE + 24 }}
          >
            <nav aria-label={chrome.docs}>
              <p className="tv-label mb-2.5 text-slate-600">{chrome.docs}</p>
              <ul className="space-y-0.5">
                {LEGAL_ROUTES.map((r) => {
                  const courant = r.path === path;
                  return (
                    <li key={r.path}>
                      <a
                        href={r.path}
                        aria-current={courant ? "page" : undefined}
                        className={`legal-lien ${courant ? "legal-lien--ici" : ""}`}
                      >
                        <span className="legal-lien-titre">{legalLabel(r.path, lang)}</span>
                        <span className="legal-lien-phrase">{legalBlurb(r.path, lang)}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Le sommaire du document ouvert, en dessous de la liste des
                documents : d'abord « où suis-je parmi les quatre », ensuite
                « où suis-je dans celui-ci ». */}
            <nav aria-label={chrome.toc} className="mt-8 hidden lg:block">
              <p className="tv-label mb-2.5 text-slate-600">{chrome.toc}</p>
              <ol className="border-l border-white/[.08]">
                {doc.blocks.map((b, i) => (
                  <li key={b.h}>
                    <a
                      href={`#sec-${i}`}
                      aria-current={i === actif ? "true" : undefined}
                      className={`legal-toc ${i === actif ? "legal-toc--ici" : ""}`}
                    >
                      {b.h}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          {/* ── LE DOCUMENT ── */}
          <article className="max-w-[68ch]">
            <p className="tv-label text-[var(--tv-highlight)]">{doc.updated}</p>
            <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              {doc.title}
            </h1>
            <p className="mt-5 text-[16px] leading-8 text-slate-400">{doc.intro}</p>

            <div className="mt-12 space-y-11">
              {doc.blocks.map((b, i) => (
                <section
                  key={b.h}
                  id={`sec-${i}`}
                  /* L'ancre doit s'arrêter SOUS l'en-tête collé, sinon un
                     clic dans le sommaire cache le titre qu'on visait. */
                  style={{ scrollMarginTop: HAUTEUR_ENTETE + 24 }}
                >
                  <h2 className="font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-white">
                    {b.h}
                  </h2>
                  {b.p && <p className="mt-3 text-[15px] leading-8 text-slate-400">{b.p}</p>}
                  {b.list && (
                    <ul className="mt-3 space-y-2.5">
                      {b.list.map((li) => (
                        <li key={li} className="flex items-start gap-3">
                          <span className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-[var(--tv-highlight)]" />
                          <span className="text-[15px] leading-8 text-slate-400">{li}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {/* La liste des autres documents a quitté ce pied de page : elle
                vit maintenant dans la colonne de gauche, visible dès
                l'arrivée plutôt qu'après la dernière ligne. Ne reste que ce
                qui a vraiment sa place à la fin d'un document légal : à qui
                écrire quand il ne répond pas à la question. */}
            <div className="mt-16 border-t border-white/[.08] pt-8">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="btn-primary inline-flex px-5 py-2.5 text-[13px]"
              >
                <Mail className="h-4 w-4" /> {chrome.contactCta}
              </a>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
