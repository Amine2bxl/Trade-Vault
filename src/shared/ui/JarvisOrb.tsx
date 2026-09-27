import { cn } from "./cn";

export type JarvisOrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * L'ORBE DE JARVIS — le logo (`JarvisMark`) quand il est vivant.
 *
 * Le même objet que la marque : un noyau, un anneau ouvert, une étincelle en
 * orbite. Au repos, elle est IMMOBILE — la loi de mouvement du produit
 * interdit toute animation qui boucle sans raison, et une orbe qui respire en
 * permanence dans un coin est exactement ce bruit. Elle ne bouge que quand
 * Jarvis FAIT quelque chose, et chaque état a son geste :
 *
 *   • listening — le micro est ouvert : des ondes montent, lentes ;
 *   • thinking  — la question est partie : l'anneau tourne, le noyau respire ;
 *   • speaking  — Jarvis lit sa réponse : le noyau bat, les ondes partent.
 *
 * C'est la seule exception décorative de l'application (comme l'orbe du
 * curseur l'est pour la vitrine), demandée pour qu'on SENTE un agent au
 * travail. Elle respecte donc tout le reste : `transform` et `opacity`
 * seulement, et plus rien ne bouge sous `prefers-reduced-motion`.
 *
 * Les couleurs sont l'émeraude de la marque, fixées par `.tv-orb` : Jarvis
 * garde la même identité quel que soit le thème choisi.
 */
export function JarvisOrb({
  state = "idle",
  size = 40,
  className,
  label,
}: {
  state?: JarvisOrbState;
  size?: number;
  className?: string;
  /** Nom accessible — sinon l'orbe est décorative. */
  label?: string;
}) {
  return (
    <span
      className={cn("tv-orb", `tv-orb-${state}`, className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="tv-orb-halo" />
      <span className="tv-orb-wave" />
      <span className="tv-orb-wave tv-orb-wave-2" />
      <svg className="tv-orb-ring" viewBox="0 0 24 24" fill="none" focusable="false">
        <path d="M19.75 9.18 A8.25 8.25 0 1 1 13.43 3.88" />
        <circle cx="17.3" cy="5.68" r="1.7" />
      </svg>
      <span className="tv-orb-core" />
    </span>
  );
}
