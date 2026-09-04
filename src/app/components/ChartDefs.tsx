/**
 * LES DÉGRADÉS DE BARRE, déclarés UNE FOIS pour toute l'application.
 *
 * Un `<defs>` posé dans chaque graphe, c'est douze copies du même dégradé et
 * douze identifiants à ne pas laisser diverger. Un `url(#id)` se résout à
 * l'échelle du DOCUMENT, pas du `<svg>` qui le porte : un seul jeu de
 * dégradés, monté une fois dans la coque, sert donc tous les graphes de
 * toutes les pages.
 *
 * Le dégradé lui-même reprend le principe de la courbe d'equity — dense à
 * l'extrémité de la barre, effacé vers la ligne du zéro. En coordonnées
 * relatives (le défaut SVG), chaque rectangle reçoit sa propre rampe, quelle
 * que soit sa hauteur.
 */
export default function ChartDefs() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="tvBarGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--tv-chart-green)" stopOpacity={0.85} />
          <stop offset="100%" stopColor="var(--tv-chart-green)" stopOpacity={0.3} />
        </linearGradient>
        <linearGradient id="tvBarRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--tv-chart-red)" stopOpacity={0.85} />
          <stop offset="100%" stopColor="var(--tv-chart-red)" stopOpacity={0.3} />
        </linearGradient>
      </defs>
    </svg>
  );
}
