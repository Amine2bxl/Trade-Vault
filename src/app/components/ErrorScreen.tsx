import { Link } from "@tanstack/react-router";
import { Home, RotateCw } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo-128.png";

/**
 * L'IDENTITÉ D'ERREUR, PARTAGÉE PAR LES FRONTIÈRES 404 ET 500.
 *
 * Volontairement pauvre en dépendances (ni i18n, ni contexte, ni primitive
 * de formulaire) : elle doit rendre alors même que l'arbre applicatif est
 * cassé. C'est la jumelle de `src/shared/error-page.ts`, qui fait la même
 * chose en HTML nu quand le SSR lui-même échoue — les deux doivent se
 * ressembler, sinon la même panne n'a pas le même visage selon l'endroit où
 * elle survient.
 *
 * ── CE QUI A CHANGÉ ───────────────────────────────────────────────────────
 *
 * Le « 500 » faisait 9rem — la moitié de l'écran pour une information qui
 * n'aide personne. Ce qu'on veut lire quand une page casse, c'est ce qui
 * s'est passé et quoi faire ; le code n'est utile que pour le rapporter. Il
 * devient une étiquette en émeraude au-dessus du titre, et la place rendue
 * va au message et aux actions.
 *
 * L'action principale reprend exactement le bouton de la vitrine : aplat
 * `--tv-accent`, texte blanc, ombre courte qui ancre les lettres sur un vert
 * clair. Elle utilisait `Button` (donc `tv-accent-fill`, l'accent à
 * luminosité verrouillée de l'application) : correct dans un tableau de
 * bord dense, terne sur un écran vide où il est le seul objet coloré.
 */
export default function ErrorScreen({
  code,
  title,
  subtitle,
  onRetry,
}: {
  code: string;
  title: string;
  subtitle: string;
  onRetry?: () => void;
}) {
  return (
    <div className="err-ecran">
      {/* Le fond de la vitrine : une grille fine, une nappe d'accent en haut à
          droite, une autre en bas à gauche. Fixe — rien ne dérive derrière un
          message d'échec. */}
      <div className="err-grille" aria-hidden />
      <div className="err-nappe" aria-hidden />
      <div className="err-nappe-2" aria-hidden />

      <div className="err-bloc">
        <div className="mb-9 flex items-center justify-center gap-2.5">
          <img src={logoSrc} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-[1rem] font-bold tracking-tight text-white">TradeVault</span>
        </div>

        <div className="err-carte">
          <span className="err-etiquette">Error {code}</span>

          <svg className="err-spark" viewBox="0 0 200 44" fill="none" aria-hidden="true">
            <path
              d="M2 34 L28 30 L46 36 L70 14 L96 22 L120 8 L150 26 L176 12 L198 20"
              stroke="url(#errlg)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="errlg" x1="0" y1="0" x2="200" y2="0">
                <stop stopColor="var(--tv-accent)" stopOpacity="0.25" />
                <stop offset="1" stopColor="var(--tv-accent)" />
              </linearGradient>
            </defs>
          </svg>

          <h1 className="text-[1.45rem] font-semibold tracking-[-0.025em] text-white">{title}</h1>
          <p className="mx-auto mt-2.5 max-w-[24rem] text-[0.9rem] leading-7 text-[var(--tv-text-secondary)]">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {onRetry && (
              <button onClick={onRetry} className="err-cta">
                <RotateCw className="h-4 w-4" /> Try again
              </button>
            )}
            {/* « Back to dashboard » supposait un compte. Cette page s'atteint
              aussi depuis la vitrine et les pages publiques, où la personne
              n'en a pas encore. */}
            <Link to="/" className="err-cta-2">
              <Home className="h-4 w-4" /> Back to TradeVault
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
