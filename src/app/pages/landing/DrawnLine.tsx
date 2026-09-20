/**
 * LA LIGNE QUI SE TRACE — le seul ornement animé de la page.
 *
 * ── CE QU'ELLE EST AUTORISÉE À DIRE, ET CE QU'ELLE NE DIT PAS ─────────────
 *
 * Le brief autorise des éléments visuels originaux (lignes d'equity, courbes
 * de progression) « s'ils restent purement visuels ou pédagogiques », et
 * interdit de présenter comme réel ce qui ne l'est pas.
 *
 * Cette courbe n'a donc NI axe, NI graduation, NI chiffre, NI légende, et
 * elle ne monte pas vers un résultat : elle sépare deux sections. Ajoutez-lui
 * un seul nombre et elle devient une performance inventée — exactement ce que
 * `shots.ts` et `landing-copy` interdisent, et la raison pour laquelle les
 * trois dessins chiffrés de l'ancienne page ont été remplacés par des
 * captures réelles.
 *
 * ── POURQUOI CE N'EST PAS UN TROISIÈME EFFET D'AMBIANCE ───────────────────
 *
 * Le skill `motion` plafonne la vitrine à deux effets d'ambiance, et `draw`
 * fait partie des huit keyframes autorisées. Ce tracé n'est pas un effet de
 * plus : c'est le REVEAL AU SCROLL, déjà en place, appliqué à un tracé plutôt
 * qu'à un bloc. Même déclencheur (`.reveal` → `.reveal-visible`), même
 * grammaire d'entrée, une seule fois dans la page — la rareté est ce qui la
 * fait remarquer.
 *
 * `prefers-reduced-motion` la laisse simplement tracée, sans animation.
 */

/* Une seule montée franche, deux respirations : assez pour évoquer une courbe
   d'equity, trop peu pour prétendre en être une. */
const D = "M0,86 C120,84 190,70 280,58 C380,45 470,52 580,34 C700,15 780,22 900,6";

export function DrawnLine({ className }: { className?: string }) {
  return (
    <div className={`reveal tv-draw-wrap ${className ?? ""}`} aria-hidden>
      <svg
        viewBox="0 0 900 96"
        fill="none"
        preserveAspectRatio="none"
        className="tv-draw-svg"
        focusable="false"
      >
        <path
          d={D}
          stroke="var(--tv-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="tv-draw-path"
        />
      </svg>
    </div>
  );
}
