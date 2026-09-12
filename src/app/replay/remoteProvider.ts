/**
 * Le pont entre le moteur de rejeu et les données réelles.
 *
 * Le module `modules/replay` est pur : il ne sait pas qu'un serveur existe.
 * C'est ici, dans la couche applicative, que le fournisseur distant s'inscrit
 * — et ce fichier est le seul à connaître les deux mondes.
 *
 * Aucune clé ne passe par ici. La server function interroge Databento ou
 * Polygon avec un secret qui ne quitte pas le serveur ; si rien n'est
 * configuré, elle rend une liste vide et le générateur déterministe reprend la
 * main. Le terminal fonctionne donc identiquement avec ou sans abonnement,
 * seule la donnée change.
 */

import { registerProvider, type MarketDataProvider, type OhlcBar } from "@/modules/replay";
import { fetchReplayBars } from "@/backend/replay-data.functions";

/** Le nom du fournisseur ayant réellement servi la dernière séance. */
let lastProvider: string | null = null;

/**
 * Le serveur a-t-il une clé ? `null` tant qu'on ne le sait pas.
 *
 * Sans cette mémoire, CHAQUE journée demandée déclenchait son propre
 * aller-retour — sept pour la semaine d'exemple, cinq de plus pour un rejeu
 * long — qui devaient tous échouer avant de retomber sur le générateur. Le
 * terminal mettait des secondes à s'ouvrir, sans rien afficher entre-temps.
 * Une seule question suffit : la réponse vaut pour toute la durée de l'onglet.
 */
let configured: boolean | null = null;

export function lastDataProvider(): string | null {
  return lastProvider;
}

const remote: MarketDataProvider = {
  name: "remote",
  // Disponible tant qu'on n'a pas appris le contraire : c'est le SERVEUR qui
  // sait si une clé existe. Une fois la réponse connue, on cesse de demander.
  isAvailable: () => configured !== false,
  async fetchBars({ date, spec }): Promise<OhlcBar[]> {
    if (configured === false) return [];
    const out = await fetchReplayBars({ data: { date, symbol: spec.id } });
    // Une réponse sans fournisseur vaut « aucune clé » : on le retient, et
    // `loadSessionBars` passera directement au générateur pour la suite.
    configured = out.provider != null;
    lastProvider = out.provider;
    if (!out.provider || out.bars.length === 0) return [];
    return out.bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  },
};

let installed = false;

/**
 * Branche le fournisseur distant, une fois pour la durée de vie de l'onglet.
 *
 * Appelé à l'entrée du terminal plutôt qu'au chargement du module : tant que
 * personne ne backteste, rien n'est inscrit et rien n'est interrogé.
 */
export function installRemoteProvider(): void {
  if (installed) return;
  installed = true;
  registerProvider(remote);
}
