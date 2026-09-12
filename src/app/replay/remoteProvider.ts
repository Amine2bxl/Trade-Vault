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

export function lastDataProvider(): string | null {
  return lastProvider;
}

const remote: MarketDataProvider = {
  name: "remote",
  // Toujours « disponible » : c'est le SERVEUR qui sait si une clé existe, et
  // le lui demander par un aller-retour supplémentaire à chaque test de
  // disponibilité coûterait plus que de tenter la requête. Une réponse vide
  // vaut « non configuré », et `loadSessionBars` retombe sur le générateur.
  isAvailable: () => true,
  async fetchBars({ date, spec }): Promise<OhlcBar[]> {
    const out = await fetchReplayBars({ data: { date, symbol: spec.id } });
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
