import { useEffect, useRef, useState } from "react";
import { Check, Cookie } from "lucide-react";
import { Modal } from "@/shared/ui";
import { useLandingT } from "./i18n";

const CLE_CONSENTEMENT = "tv.cookie-consent";

/**
 * L'AVIS COOKIES — une pastille, une modale, et un état qu'on lit vraiment.
 *
 * ── CE QUI N'ALLAIT PAS ───────────────────────────────────────────────────
 *
 * 1. LE CONSENTEMENT S'ÉCRIVAIT SANS JAMAIS SE RELIRE. `localStorage` était
 *    posé à l'acceptation et plus personne ne le consultait : la pastille
 *    affichait « Cookies » à vie, identique avant et après. On ne pouvait
 *    donc pas savoir si on avait accepté, et le seul geste proposé était de
 *    réaccepter — ce qui est exactement ce qu'un avis de cookies ne doit pas
 *    faire.
 * 2. ELLE PARLAIT FRANÇAIS À TOUT LE MONDE. Cinq chaînes en dur sur une
 *    vitrine dont la langue par défaut est l'anglais.
 * 3. ELLE ÉTAIT CYAN. `cyan-500`, `cyan-300`, `cyan-400` et un `blur-sm`
 *    derrière l'icône : le dernier vestige de l'identité d'avant, plus un
 *    halo que la charte interdit.
 *
 * ── L'ÉTAT, EN TROIS TEMPS ────────────────────────────────────────────────
 *
 *   `null`    on n'a pas encore lu le stockage — on n'affiche RIEN. Rendre
 *             « Cookies » puis le corriger en coche ferait clignoter la
 *             pastille à chaque chargement pour ceux qui ont déjà accepté.
 *   `false`   à demander : pastille large, icône de cookie, libellé.
 *   `true`    accepté : la pastille se replie sur une coche.
 *
 * `vientAccepter` distingue l'acceptation QUI VIENT D'AVOIR LIEU d'un
 * consentement relu au chargement. C'est lui qui autorise l'animation : au
 * rechargement d'une page, une pastille qui se replie toute seule serait du
 * théâtre pour une décision prise la semaine dernière.
 *
 * ── LE REPLI N'ANIME PAS UNE LARGEUR ──────────────────────────────────────
 *
 * La loi de mouvement interdit d'animer une propriété de mise en page. Le
 * libellé disparaît donc par `grid-template-columns: 1fr → 0fr`, le même
 * tour que `.faq-body` emploie pour les hauteurs : c'est la grille qui se
 * referme, pas une largeur qu'on recalcule à chaque frame.
 */
export function CookieConsent() {
  const { t } = useLandingT();
  const [accepte, setAccepte] = useState<boolean | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const vientAccepter = useRef(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setAccepte(localStorage.getItem(CLE_CONSENTEMENT) === "accepted");
    } catch {
      /* Navigation privée, stockage bloqué : on demande, c'est le défaut sûr. */
      setAccepte(false);
    }
  }, []);

  /* La minuterie de confirmation est annulée au démontage : sans ça, un
     changement de page pendant la confirmation appellerait `setState` sur un
     composant parti. */
  useEffect(() => () => void (minuterie.current && clearTimeout(minuterie.current)), []);

  const accepter = () => {
    try {
      localStorage.setItem(CLE_CONSENTEMENT, "accepted");
    } catch {
      /* Le refus du stockage ne doit pas bloquer l'interface : on ferme quand
         même, quitte à redemander à la prochaine visite. */
    }
    vientAccepter.current = true;
    setConfirme(true);
    /* La modale reste ouverte le temps que la coche se trace. En dessous de
       ~900 ms on ne la voit pas ; au-dessus, on attend. */
    minuterie.current = setTimeout(() => {
      setAccepte(true);
      setOuvert(false);
      setConfirme(false);
    }, 1000);
  };

  const fermer = () => {
    if (confirme) return; // On ne coupe pas une confirmation en cours.
    setOuvert(false);
  };

  if (accepte === null) return null;

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label={accepte ? t("cookie.done.aria") : t("cookie.aria")}
        data-accepte={accepte ? "oui" : "non"}
        data-anime={accepte && vientAccepter.current ? "oui" : "non"}
        className="cookie-pastille"
      >
        <span className="cookie-icone" aria-hidden>
          {accepte ? <Check className="h-3.5 w-3.5" /> : <Cookie className="h-3.5 w-3.5" />}
        </span>
        {/* La grille qui se referme : voir l'en-tête. */}
        <span className="cookie-libelle" aria-hidden={accepte}>
          <span>{t("cookie.pill")}</span>
        </span>
      </button>

      <Modal open={ouvert} onClose={fermer} className="tv-public md:max-w-md">
        {confirme ? (
          <div className="cookie-confirme px-6 py-12 text-center">
            <span className="cookie-medaille" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none">
                <path
                  d="M9 16.5 L14 21.5 L23 11"
                  stroke="currentColor"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="mt-5 text-[15px] font-semibold text-white" role="status">
              {t("cookie.done")}
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-5">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl tv-accent-fill">
                  <Cookie className="h-4 w-4" />
                </span>
                <h2 className="tv-title">{t("cookie.title")}</h2>
              </div>
              <p className="text-sm leading-6 text-slate-300">{t("cookie.body")}</p>
              <div className="mt-4 rounded-xl border border-white/[.06] bg-white/[.02] px-3.5 py-3 text-xs leading-5 text-slate-400">
                {t("cookie.note")}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/[.06] px-6 py-4">
              <a
                href="/cookies"
                className="text-xs font-semibold text-[var(--tv-highlight)] underline decoration-[rgb(var(--tv-accent-rgb)/0.35)] underline-offset-2 transition hover:decoration-[var(--tv-accent)]"
              >
                {t("cookie.more")}
              </a>
              <button
                onClick={accepter}
                className="inline-flex items-center gap-1.5 rounded-xl tv-accent-fill px-5 py-2.5 text-sm font-bold transition"
              >
                {t("cookie.accept")}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
