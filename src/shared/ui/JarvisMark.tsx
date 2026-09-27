import { cn } from "./cn";

/**
 * LA MARQUE DE JARVIS — son logo à lui.
 *
 * ══ CE QU'ELLE REMPLACE ══
 *
 * D'abord `Bot` de lucide, le robot à antenne que tout widget de chat greffé
 * colle dans un coin. Puis un V de *Vault* — juste, mais c'était le sigle de
 * TRADEVAULT, pas celui de Jarvis : l'assistant n'avait pas de visage propre.
 *
 * ══ CE QU'ELLE DESSINE ══
 *
 * Un NOYAU, un ANNEAU ouvert, et une ÉTINCELLE en orbite dans l'ouverture.
 *
 *   • Le noyau plein, c'est l'intelligence — ce qui lit le journal.
 *   • L'anneau, c'est l'attention qui l'entoure ; il est OUVERT, parce que
 *     Jarvis écoute : un cercle fermé se lit comme un bouton, un cercle ouvert
 *     comme quelque chose qui reçoit.
 *   • L'étincelle, posée dans l'ouverture, c'est l'agent en mouvement. C'est
 *     elle qui tourne quand l'orbe s'anime (`JarvisOrb`) : le logo et l'orbe
 *     sont le même objet, au repos et vivant.
 *
 * Lisible à 16px (trois formes pleines, aucun détail fin), et `currentColor`
 * partout : la marque prend la couleur de la surface qui la porte. Aucune
 * couleur n'est écrite ici.
 */
export function JarvisMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      {/* L'anneau : 300°, ouvert en haut à droite. */}
      <path
        d="M19.75 9.18 A8.25 8.25 0 1 1 13.43 3.88"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Le noyau. */}
      <circle cx="12" cy="12" r="3.6" fill="currentColor" />
      {/* L'étincelle, dans l'ouverture de l'anneau. */}
      <circle cx="17.3" cy="5.68" r="1.7" fill="currentColor" />
    </svg>
  );
}
