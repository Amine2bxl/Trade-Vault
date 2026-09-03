import { cn } from "./cn";

/**
 * La marque TradeVault — le sigle et le mot, en un seul endroit.
 *
 * Le sigle était un fichier WebP : un dégradé bleu→violet, figé, qui ne
 * pouvait ni suivre le thème ni changer de couleur selon le fond. Il jurait
 * franchement depuis que le produit est vert, et il fallait le remplacer par
 * un autre fichier pour le corriger.
 *
 * C'est maintenant un tracé vectoriel qui peint en `currentColor` : il devient
 * blanc sur le rail vert, vert foncé sur un disque blanc, accentué sur un fond
 * sombre — sans qu'aucun appel n'ait à le savoir.
 *
 * Le dessin garde l'idée de l'original — le monogramme TV où la hampe du T
 * devient la branche gauche du V — et retire ce qui ne tenait pas à petite
 * taille : les trois barres d'histogramme se refermaient en pâté sous 24px.
 * Ce qui reste dit la même chose : un V qui descend puis remonte, c'est-à-dire
 * un trade.
 */
export function BrandMark({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* La barre du T — plus longue et plus basse que dans la première
          version, où elle se lisait comme un accent posé sur un « v »
          minuscule au lieu d'une lettre. */}
      <path d="M3.2 5.6h9.4" strokeWidth={3} />
      {/* Le V, et la hampe du T qui en est la branche gauche. La branche
          droite monte PLUS HAUT que le départ : le tracé descend puis remonte
          au-dessus de son point d'entrée — c'est un trade gagnant, et c'est la
          seule idée que le sigle a besoin de porter. */}
      <path d="M7.9 5.6 12.1 18.6 20.8 3.9" strokeWidth={3.4} />
    </svg>
  );
}

/**
 * Le mot. « Trade » en graisse moyenne et sourd, « Vault » en 800 et plein :
 * le nom se lit en deux temps au lieu d'un bloc uniforme, et c'est la moitié
 * qui compte — le coffre — qui reste dans l'œil.
 */
export function BrandWord({ className }: { className?: string }) {
  return (
    <span className={cn("leading-none tracking-[-0.035em] whitespace-nowrap", className)}>
      <span className="font-medium opacity-65">Trade</span>
      <span className="font-extrabold">Vault</span>
    </span>
  );
}

/** Sigle + mot, l'assemblage courant. */
export function Brand({
  className,
  markClassName,
  size = 20,
  wordClassName,
}: {
  className?: string;
  markClassName?: string;
  size?: number;
  wordClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={size} className={markClassName} />
      <BrandWord className={wordClassName} />
    </span>
  );
}
