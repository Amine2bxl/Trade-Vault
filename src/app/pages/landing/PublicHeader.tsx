import { ArrowRight } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { useLandingT } from "./i18n";
import { LangMenu } from "./LangMenu";

/**
 * L'EN-TÊTE DES PAGES PUBLIQUES SECONDAIRES (`/pricing`, et tout ce qui
 * suivra).
 *
 * Ce n'est PAS `MegaNav` : celui-ci porte un scrollspy, des ancres vers les
 * sections de la vitrine et une barre de progression, qui n'ont aucun sens
 * sur une page qui n'a ni ces sections ni cette longueur. Le monter ici
 * afficherait six liens dont cinq ne mènent nulle part depuis cette adresse.
 *
 * Il en garde en revanche la MATIÈRE (`.lp-nav-shell`), parce que changer
 * d'objet en changeant de page se lit comme changer de site. Même forme,
 * même densité, mêmes deux actions, au même endroit. Il ne réagit
 * simplement pas au défilement : il n'y a rien sous quoi glisser.
 */
export function PublicHeader({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const { t } = useLandingT();
  return (
    <header className="sticky top-0 z-[var(--tv-z-nav)] px-0 pt-0 sm:px-4 sm:pt-2">
      <div className="lp-nav-shell relative" data-collee="oui">
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-4 md:px-6">
          <a href="/" className="flex shrink-0 items-center gap-2.5">
            <img
              src={logoSrc}
              alt="TradeVault"
              width={30}
              height={30}
              className="h-8 w-8 object-contain"
            />
            <span className="hidden font-display text-[1.15rem] font-bold leading-none tracking-[-0.02em] text-white sm:block">
              TradeVault
            </span>
          </a>
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:block">
              <LangMenu />
            </div>
            <button onClick={onLogin} className="btn-secondaire px-4 py-2 text-[13px]">
              {t("nav.signin")}
            </button>
            <button onClick={onSignup} className="btn-primary px-4 py-2 text-[13px]">
              {t("nav.cta")} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
