import { useLayoutEffect, useState, type ReactNode } from "react";

/**
 * Monte ses enfants seulement une fois l'arbre RÉELLEMENT AFFICHÉ.
 *
 * Les contrôles à geste de Glisse (`SegmentedControl`, `TabBar`, `Switch`,
 * `Slider`) branchent leur moteur dans un effet qui lit leurs nœuds sans les
 * vérifier. Monté dans une zone `Suspense` encore cachée (une page dont un
 * graphique se charge en différé), le mode strict de React 19 relance cet
 * effet avant que les nœuds ne soient rattachés : `null.querySelectorAll`, et
 * la page tombe sur l'écran d'erreur.
 *
 * Un effet de mise en page ne tourne JAMAIS dans un arbre caché : il ne passe
 * qu'au moment où la zone s'affiche. On attend donc ce moment pour monter le
 * contrôle. Dans un arbre visible, la bascule a lieu avant la première
 * peinture : on ne voit jamais `fallback`.
 */
export function WhenShown({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => setShown(true), []);
  return <>{shown ? children : fallback}</>;
}
