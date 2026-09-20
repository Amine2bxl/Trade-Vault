import { useState } from "react";
import { ArrowRight } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { LANDING_LANGS, useLandingT } from "./i18n";
import { LIENS_NAV as LINKS } from "./nav";

/**
 * Navbar de la landing — stable, calme, traduite.
 *
 * ── LE MENU DÉROULANT « PRODUIT » A ÉTÉ RETIRÉ ────────────────────────────
 *
 * La barre affichait « Product ⌄ » (le déclencheur du menu) ET « Product »
 * (un lien plat) côte à côte : le MÊME libellé deux fois, à 60 px d'écart,
 * parce que les deux lisaient la clé `nav.product`.
 *
 * Le menu ne justifiait pas sa place : ses quatre entrées ne désignaient que
 * TROIS ancres — `product`, `edge`, `problem` — toutes déjà présentes comme
 * liens plats juste à côté. Un menu qui cache ce qui est visible à côté de
 * lui ajoute un clic et une ambiguïté, rien d'autre.
 *
 * Reste donc : les liens plats, le sélecteur de langue et deux actions. Le
 * brief demandait une barre « simple, intuitive, légère » — c'est ce qu'elle
 * devient en enlevant, pas en ajoutant.
 */

interface MegaNavProps {
  activeSec: string;
  go: (id: string) => void;
  open: (mode: "login" | "signup", plan?: string) => void;
  y: number;
  pct: number;
}

export default function MegaNav({ activeSec, go, open, y, pct }: MegaNavProps) {
  const { t, lang, setLang } = useLandingT();
  const [mobile, setMobile] = useState(false);

  const goTo = (id: string) => {
    setMobile(false);
    go(id);
  };

  return (
    /* La barre n'est plus un bandeau collé au bord : c'est une PILULE posée
       sur la page (voir `.lp-nav-shell` dans `landing.css`). Sous 640px elle
       reprend la pleine largeur - une pilule à marges sur un écran de 390px
       vole la place du logo et du menu. */
    <header
      className="fixed inset-x-0 top-0 z-[var(--tv-z-nav)] px-0 sm:px-4"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}
    >
      <div
        className={`lp-nav-shell relative ${
          y > 10
            ? "border-b border-[var(--tv-border)] bg-[var(--tv-bg)]/90 backdrop-blur-[12px] sm:border-b-0"
            : "border-b border-transparent bg-transparent sm:border-b-0"
        }`}
        data-collee={y > 10 ? "oui" : "non"}
      >
        <div
          className="scroll-bar absolute inset-x-0 top-0 h-[2px]"
          style={{ transform: `scaleX(${pct})` }}
        />

        {/* Plus de `ref` ici : il ne servait qu'à détecter le clic hors du menu
          déroulant, qui n'existe plus. */}
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-4 md:px-6">
          {/* Logo — `/`, pas `#`. Le logo est le lien de retour à l'accueil le plus
            universellement compris du web ; pointé sur `#`, il ne désignait
            rien. Le pied de page avait déjà été corrigé, pas la barre. */}
          <a href="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src={logoSrc}
              alt="TradeVault"
              width={30}
              height={30}
              className="h-8 w-8 object-contain"
            />
            <span className="font-display font-bold tracking-[-0.02em] text-white leading-none hidden sm:block text-[1.15rem]">
              TradeVault
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  activeSec === l.id ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {t(l.key)}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            {/* Language toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-[var(--tv-border)] p-0.5">
              {/* Dessiné depuis `LANDING_LANGS` : ajouter l'espagnol ou l'arabe
                est une ligne dans la table, pas une retouche ici. */}
              {LANDING_LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  aria-label={l.label}
                  aria-pressed={lang === l.id}
                  className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                    lang === l.id
                      ? "bg-[rgb(var(--tv-accent-rgb)/0.14)] text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {/* Le drapeau accélère la reconnaissance ; le code la garantit.
                    Un pavillon seul désigne un PAYS, pas une langue, et il ne
                    dit rien à un lecteur d'écran : `aria-hidden` sur l'émoji,
                    `aria-label` sur le bouton. */}
                  <span aria-hidden className="text-[13px] leading-none">
                    {l.drapeau}
                  </span>
                  {l.short}
                </button>
              ))}
            </div>

            <button
              onClick={() => open("login")}
              className="hidden sm:block text-[13px] font-medium text-slate-400 hover:text-white transition-colors px-3 py-1.5"
            >
              {t("nav.signin")}
            </button>
            {/* LE BOUTON DE LA NAV EST TOUJOURS LÀ.
              Il n'apparaissait qu'au-delà de 560px de défilement, pour éviter
              deux boutons identiques à 400px l'un de l'autre. L'argument
              tenait quand les deux disaient la même chose ; ils disent
              maintenant deux choses différentes - « Log in » ouvre une
              session, « Get Started » en crée une - et une barre dont les
              actions apparaissent en cours de route oblige à remonter pour
              les trouver. Une navigation ne se cache pas. */}
            <button
              onClick={() => open("signup", t("nav.cta.plan"))}
              className="btn-primary px-4 py-2 text-[13px]"
            >
              {t("nav.cta")} <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMobile((v) => !v)}
              /* 44 px : ce bouton n'existe QUE sous `lg`, donc toujours au
               doigt. À 36 il était sous la cible tactile minimale. */
              className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--tv-border)] text-slate-200 lg:hidden"
              aria-label="Menu"
            >
              {mobile ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm8.25 5.25a.75.75 0 01.75-.75h8.25a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobile && (
          <div className="lg:hidden border-t border-[var(--tv-border)] bg-[var(--tv-bg)] px-5 py-4">
            <div className="flex flex-col">
              {LINKS.map((l) => (
                <button key={l.id} onClick={() => goTo(l.id)} className="mobile-nav-link">
                  {t(l.key)}
                </button>
              ))}
              <div className="flex items-center gap-2 mt-3">
                {LANDING_LANGS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLang(l.id)}
                    aria-pressed={lang === l.id}
                    aria-label={l.label}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-[12px] font-semibold transition-colors ${
                      lang === l.id
                        ? "border-[rgb(var(--tv-accent-rgb)/0.4)] bg-[rgb(var(--tv-accent-rgb)/0.08)] text-[var(--tv-highlight)]"
                        : "border-[var(--tv-border)] text-slate-400"
                    }`}
                  >
                    <span aria-hidden className="text-[15px] leading-none">
                      {l.drapeau}
                    </span>
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setMobile(false);
                  open("signup", t("nav.cta.plan"));
                }}
                className="btn-primary mt-4 w-full"
              >
                {t("nav.cta")} <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setMobile(false);
                  open("login");
                }}
                className="w-full mt-2.5 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                {t("nav.signin")}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
