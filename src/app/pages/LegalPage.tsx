import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import type { Lang } from "../i18n/translations";
import { SUPPORT_EMAIL } from "../types";
import { LEGAL_ROUTES, legalChrome, legalLabel, type LegalDoc } from "./legal-content";
import { usePublicLang } from "./usePersistedLang";
import { breadcrumbJsonLd } from "@/shared/seo";
import "./landing.css";

/**
 * LE GABARIT DES PAGES LÉGALES.
 *
 * ── CE QUI NE COLLAIT PLUS ────────────────────────────────────────────────
 *
 * Il portait la peau d'AVANT la refonte : des nappes cyan et indigo en fond,
 * des numéros de section en cyan, un bouton d'action cyan. La vitrine est
 * passée à l'émeraude ; ces pages étaient restées la seule surface publique
 * d'une autre marque. Un visiteur qui clique « Confidentialité » depuis le
 * pied de page changeait de site.
 *
 * Chaque section vivait par ailleurs dans sa PROPRE carte. Neuf plaques
 * empilées pour neuf paragraphes, c'est la mise en page d'un tableau de bord
 * appliquée à un texte suivi : le regard redémarre à chaque bord, et la
 * lecture continue devient impossible. Le fond est maintenant plat, les
 * sections sont séparées par un filet, et la seule plaque restante est le
 * sommaire - parce que lui, justement, n'est pas du texte suivi.
 *
 * ── LA LARGEUR ────────────────────────────────────────────────────────────
 *
 * ~68 caractères. C'est la mesure au-delà de laquelle l'œil rate la ligne
 * suivante en revenant à la marge. Un document légal est déjà pénible à
 * lire ; lui donner 110 caractères de large le rend hostile.
 *
 * ── LE SOMMAIRE ───────────────────────────────────────────────────────────
 *
 * Il passe en colonne collante à partir de `lg` : sur une page de dix
 * sections, savoir où l'on est vaut mieux qu'une liste qu'on a dépassée
 * depuis longtemps. Sous `lg` il redevient un bloc en tête, faute de place.
 */
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
  const autres = LEGAL_ROUTES.filter((r) => r.path !== path);

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

      {/* Un vrai en-tête, pas une flèche seule. Ces pages s'ouvrent souvent
          dans un onglet isolé, depuis un e-mail ou un lien partagé : sans
          logo, rien ne dit de quel produit on lit les conditions. */}
      <header className="border-b border-white/[.06]">
        <div className="lp-container flex h-16 items-center justify-between">
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
          <Link
            to="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> {chrome.back}
          </Link>
        </div>
      </header>

      <div className="lp-container relative z-10 py-12 md:py-16">
        <div className="mx-auto max-w-[1040px] lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14">
          {/* ── SOMMAIRE ── */}
          <nav
            aria-label={chrome.toc}
            className="mb-10 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-4 lg:sticky lg:top-8 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0"
          >
            <p className="tv-label mb-3 text-slate-500">{chrome.toc}</p>
            <ol className="space-y-1">
              {doc.blocks.map((b, i) => (
                <li key={b.h}>
                  <a
                    href={`#sec-${i}`}
                    className="-my-1 block py-1 text-[13px] leading-5 text-slate-500 transition-colors hover:text-white"
                  >
                    {b.h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* ── LE DOCUMENT ── */}
          <article className="max-w-[68ch]">
            <p className="tv-label text-[var(--tv-highlight)]">{doc.updated}</p>
            <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              {doc.title}
            </h1>
            <p className="mt-5 text-[16px] leading-8 text-slate-400">{doc.intro}</p>

            <div className="mt-12 space-y-11">
              {doc.blocks.map((b, i) => (
                <section key={b.h} id={`sec-${i}`} className="scroll-mt-8">
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

            {/* ── LES AUTRES DOCUMENTS ──
                Un document légal isolé oblige à revenir en arrière pour
                trouver son voisin, alors qu'on les consulte presque toujours
                en série. Les quatre se citent donc mutuellement. */}
            <div className="mt-16 border-t border-white/[.08] pt-8">
              <p className="tv-label mb-4 text-slate-500">{chrome.related}</p>
              <div className="flex flex-wrap gap-2.5">
                {autres.map((r) => (
                  <a
                    key={r.path}
                    href={r.path}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--tv-border)] px-4 text-[13px] font-medium text-slate-400 transition-colors hover:border-[var(--tv-border-strong)] hover:text-white"
                  >
                    {legalLabel(r.path, lang)}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>

              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="btn-primary mt-8 inline-flex px-5 py-2.5 text-[13px]"
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
