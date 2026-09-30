import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANDING_LANGS, useLandingT } from "./i18n";

/**
 * LE SÉLECTEUR DE LANGUE — un bouton, pas une rangée.
 *
 * ── POURQUOI IL CHANGE DE FORME ───────────────────────────────────────────
 *
 * La rangée « EN | FR » avait un coût PROPORTIONNEL au nombre de langues :
 * elle tenait à deux, occupait un tiers de la barre à quatre, et ne tenait
 * plus du tout à six. Or la table `LANDING_LANGS` est faite pour grandir
 * (l'espagnol et l'arabe sont explicitement prévus). Un menu déroulant a un
 * coût CONSTANT : un drapeau, un code, un chevron, quelle que soit la suite.
 *
 * Et une rangée dit « voici toutes les options », ce qui est du bruit quand
 * on lit une page de vente : on n'y choisit pas sa langue, on la corrige,
 * une fois, si elle est fausse.
 *
 * ── CE QUI EST DESSINÉ DEPUIS LA TABLE, ET CE QUI NE L'EST PAS ────────────
 *
 * Tout. Ajouter l'espagnol est UNE LIGNE dans `LANDING_LANGS` : ce composant
 * n'en sait rien, et `tr()` retombe déjà sur l'anglais pour les clés non
 * traduites. Rien ici ne mentionne « en » ou « fr ».
 *
 * ── ACCESSIBILITÉ ─────────────────────────────────────────────────────────
 *
 * Le pavillon est `aria-hidden` : un drapeau désigne un PAYS, pas une
 * langue, et il ne se prononce pas. Le nom complet de la langue reste la
 * seule chose lue. Le déclencheur porte `aria-haspopup`/`aria-expanded`, les
 * entrées sont des `menuitemradio` avec leur état coché, Échap referme et
 * rend le focus au déclencheur — sans quoi on quitte le menu au clavier en
 * atterrissant en bas de page.
 */
export function LangMenu({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLandingT();
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const id = useId();

  const actuelle = LANDING_LANGS.find((l) => l.id === lang) ?? LANDING_LANGS[0];

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    const clavier = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOuvert(false);
      declencheur.current?.focus();
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", clavier);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", clavier);
    };
  }, [ouvert]);

  return (
    <div ref={boite} className="relative">
      <button
        ref={declencheur}
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? id : undefined}
        /* Le nom accessible dit la langue EN COURS, pas « changer de langue » :
           c'est l'information dont on a besoin avant d'ouvrir. */
        aria-label={actuelle.label}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors ${
          compact ? "h-9" : "h-9"
        } ${
          ouvert
            ? "border-[var(--tv-border-strong)] bg-white/[.05] text-white"
            : "border-[var(--tv-border)] text-slate-400 hover:border-[var(--tv-border-strong)] hover:text-white"
        }`}
      >
        <span aria-hidden className="text-[14px] leading-none">
          {actuelle.drapeau}
        </span>
        <span>{actuelle.short}</span>
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`}
        />
      </button>

      {ouvert && (
        <div id={id} role="menu" aria-label={actuelle.label} className="lang-menu p-1.5">
          {LANDING_LANGS.map((l) => {
            const choisie = l.id === lang;
            return (
              <button
                key={l.id}
                type="button"
                role="menuitemradio"
                aria-checked={choisie}
                onClick={() => {
                  setOuvert(false);
                  if (!choisie) setLang(l.id);
                }}
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                  choisie
                    ? "bg-[rgb(var(--tv-accent-rgb)/0.12)] text-white"
                    : "text-slate-400 hover:bg-white/[.05] hover:text-white"
                }`}
              >
                <span aria-hidden className="text-[15px] leading-none">
                  {l.drapeau}
                </span>
                <span className="flex-1">{l.label}</span>
                {choisie && (
                  <Check aria-hidden className="h-3.5 w-3.5 text-[var(--tv-highlight)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * La variante du pied de page : même menu, mais annoncé par un globe plutôt
 * que par un code. En bas de page on ne corrige pas une langue par réflexe,
 * on la CHERCHE - et un globe se cherche mieux qu'un « EN » perdu dans une
 * ligne de liens.
 */
export function LangMenuPied() {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <Globe aria-hidden className="h-4 w-4" />
      <LangMenu compact />
    </div>
  );
}
