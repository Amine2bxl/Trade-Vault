import { cn } from "./cn";

/**
 * LA MARQUE DE JARVIS.
 *
 * ══ CE QU'ELLE REMPLACE ══
 *
 * `Bot` de lucide — un petit robot à antenne. C'est LA signature visuelle du
 * widget de chat greffé dans un coin : le même glyphe, chez tout le monde,
 * pour dire « il y a une IA ici ». Jarvis n'est pas un widget greffé, c'est
 * l'intelligence du produit — et il portait l'icône qui dit exactement le
 * contraire. Aucun réglage de plaque, de rayon ou de teinte ne rattrape ça :
 * tant que le glyphe est un robot de bibliothèque, la surface fait bon marché.
 *
 * ══ CE QU'ELLE DESSINE ══
 *
 * Un **V**, celui de *Vault*. Et il est construit exactement comme l'est le
 * mot de la marque dans `Brand.tsx` : « Trade » en graisse moyenne et sourd,
 * « Vault » en 800 et plein. Le bras gauche est fin et en retrait, le bras
 * droit est épais et plein — la même idée en deux traits au lieu de deux mots.
 * Le nom écrit et le sigle disent donc la même chose, dans la même grammaire,
 * et le sigle reste lisible à 16px là où un robot à antenne devient une tache.
 *
 * `currentColor` pour les deux bras : la marque prend la couleur de la surface
 * qui la porte — sourde sur une plaque au repos, blanche sur l'accent quand
 * Jarvis est ouvert. Aucune couleur n'est écrite ici.
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
      {/* Le bras « Trade » — fin, en retrait. */}
      <path
        d="M7 6.75 L12 17.25"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Le bras « Vault » — épais, plein. C'est lui qui reste dans l'œil. */}
      <path d="M12 17.25 L17 6.75" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />
    </svg>
  );
}
