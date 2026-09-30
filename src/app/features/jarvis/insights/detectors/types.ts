import type { JarvisHomeData, JarvisInsight } from "../types";

/**
 * Contrat des détecteurs. Un détecteur est PUR et DÉTERMINISTE :
 *  - même données → même résultat ;
 *  - aucun accès UI, aucun storage, aucun réseau ;
 *  - retourne un insight candidat (confiance, sampleSize, preuve, impact,
 *    mission) ou `null` quand le pattern n'est pas présent.
 */
export type Detector = (data: JarvisHomeData) => JarvisInsight | null;
