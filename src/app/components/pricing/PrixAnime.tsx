import { useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn";

/**
 * UN PRIX QUI CHANGE SOUS LES YEUX.
 *
 * ── CE QUE ÇA RÈGLE ───────────────────────────────────────────────────────
 *
 * La bascule mensuel / annuel remplaçait « 15 € » par « 10 € » d'une frame à
 * l'autre. Le geste le plus commercial de la page — celui qui montre
 * l'économie — ne se voyait donc pas : on cliquait, et un chiffre différent
 * était déjà là. Rien ne disait qu'il avait BAISSÉ, ni de combien.
 *
 * Les deux valeurs se croisent maintenant dans la même fenêtre : l'ancienne
 * sort, la nouvelle entre, et le SENS du glissement porte l'information. Un
 * prix qui baisse roule vers le bas (le nouveau chiffre tombe d'en haut),
 * un prix qui monte roule vers le haut. C'est la mécanique d'un compteur, et
 * elle se lit sans légende.
 *
 * ── POURQUOI CE N'EST PAS UNE ANIMATION DE PLUS ───────────────────────────
 *
 * La loi de mouvement du produit tient à huit gestes, et n'en veut pas un
 * neuvième. Celui-ci n'en est pas un : c'est `fade-in-up`, le geste d'entrée
 * unique de la maison, paramétré en direction. Deux keyframes
 * (`prix-entre` / `prix-sort`) et une variable de décalage, rien d'autre —
 * `transform` et `opacity`, jamais une propriété de mise en page.
 *
 * La sortie dure 70 % de l'entrée, comme partout ailleurs : sans ça, la
 * valeur qui part pèse autant que celle qui arrive et le geste s'alourdit.
 *
 * Sous `prefers-reduced-motion`, le chiffre change sans transition — il n'y
 * a rien à comprendre en plus, seulement quelque chose en moins à voir.
 */

/** Le premier nombre d'un montant formaté, séparateurs et symbole compris. */
function valeurNumerique(texte: string): number {
  const nettoye = texte.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number.parseFloat(nettoye);
  return Number.isFinite(n) ? n : 0;
}

export default function PrixAnime({ valeur, className }: { valeur: string; className?: string }) {
  const [courant, setCourant] = useState(valeur);
  const [sortant, setSortant] = useState<string | null>(null);
  const [sens, setSens] = useState<"bas" | "haut">("bas");
  const precedent = useRef(valeur);

  useEffect(() => {
    if (valeur === precedent.current) return;
    setSens(valeurNumerique(valeur) < valeurNumerique(precedent.current) ? "bas" : "haut");
    setSortant(precedent.current);
    setCourant(valeur);
    precedent.current = valeur;
  }, [valeur]);

  /* La valeur sortante est retirée du DOM à la fin de SON animation, pas sur
     une minuterie : une minuterie et une durée CSS finissent toujours par
     diverger, et un chiffre fantôme resterait empilé derrière le bon. */
  return (
    <span className={cn("prix-anime", className)} data-sens={sens}>
      {/* Le mot lu par les lecteurs d'écran et par les tests : une seule
          valeur, celle qui compte. L'ancienne est décorative le temps du
          croisement. */}
      <span key={courant} className="prix-anime-entre">
        {courant}
      </span>
      {sortant !== null && (
        <span
          key={`sortant-${sortant}`}
          className="prix-anime-sort"
          aria-hidden
          onAnimationEnd={() => setSortant(null)}
        >
          {sortant}
        </span>
      )}
    </span>
  );
}
