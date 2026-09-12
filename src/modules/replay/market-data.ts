/**
 * Fournisseur de données de marché — l'interface à brancher pour remplacer la
 * synthèse par de la vraie histoire.
 *
 * Le moteur de rejeu ne consomme QUE cette interface. Aujourd'hui le seul
 * fournisseur embarqué est `synthetic` (déterministe, sans clé). Un fournisseur
 * réel (Databento, Polygon…) s'ajoute en implémentant `fetchBars` et en se
 * déclarant dans le registre ; il est servi préférentiellement, sans que le
 * moteur ni l'interface n'aient à changer.
 */

import { OhlcBar } from "./types";
import { InstrumentSpec } from "./instruments";
import { generateSyntheticSession } from "./synthetic-data";

export interface FetchBarsOpts {
  /** Jour de cotation `YYYY-MM-DD` NY dont on veut la fenêtre ETH. */
  date: string;
  spec: InstrumentSpec;
}

export interface MarketDataProvider {
  name: string;
  /** True si le fournisseur est réellement configuré (clé, service…). */
  isAvailable(): boolean;
  fetchBars(opts: FetchBarsOpts): Promise<OhlcBar[]>;
}

class SyntheticProvider implements MarketDataProvider {
  name = "synthetic";
  isAvailable(): boolean {
    return true;
  }
  async fetchBars(opts: FetchBarsOpts): Promise<OhlcBar[]> {
    return generateSyntheticSession(opts.date, opts.spec);
  }
}

// ── Registre ────────────────────────────────────────────────────────────────
// Le module reste PUR : il ne connaît ni React, ni Supabase, ni la couche
// réseau de l'application. Un vrai fournisseur s'inscrit donc de l'extérieur,
// au démarrage, plutôt que d'être importé ici — sinon le moteur traînerait
// derrière lui tout le serveur, et les tests avec.

const SYNTHETIC = new SyntheticProvider();
const REGISTERED: MarketDataProvider[] = [];

/**
 * Inscrit un fournisseur, prioritaire sur le générateur.
 *
 * Le dernier inscrit passe devant : l'application en branche un au démarrage,
 * un test peut le remplacer sans laisser de trace pour le suivant.
 */
export function registerProvider(provider: MarketDataProvider): void {
  const at = REGISTERED.findIndex((p) => p.name === provider.name);
  if (at >= 0) REGISTERED.splice(at, 1);
  REGISTERED.unshift(provider);
  clearBarsCache();
}

/** Retire un fournisseur inscrit — le générateur reprend la main. */
export function unregisterProvider(name: string): void {
  const at = REGISTERED.findIndex((p) => p.name === name);
  if (at >= 0) REGISTERED.splice(at, 1);
  clearBarsCache();
}

export function resolveProvider(): MarketDataProvider {
  return REGISTERED.find((p) => p.isAvailable()) ?? SYNTHETIC;
}

/** Mémoire des journaux déjà chargés — une date coûte un fetch, jamais deux. */
const cache = new Map<string, OhlcBar[]>();

export async function loadSessionBars(date: string, spec: InstrumentSpec): Promise<OhlcBar[]> {
  const key = `${spec.id}:${date}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const provider = resolveProvider();
  // Un fournisseur réel qui ne rend RIEN (clé absente, journée manquante,
  // service en panne) ne doit pas vider le terminal : le générateur reprend la
  // main. Backtester ne dépend d'aucun abonnement.
  let bars = await provider.fetchBars({ date, spec }).catch((e) => {
    console.warn(`[replay] fournisseur ${provider.name} en échec — repli synthétique`, e);
    return [] as OhlcBar[];
  });
  if (bars.length === 0 && provider !== SYNTHETIC) {
    bars = await SYNTHETIC.fetchBars({ date, spec });
  }
  // Tri + déduplication défensifs : la cohérence du rejeu exige une série dont
  // chaque minute est unique et ordonnée.
  const sorted = bars
    .filter((b) => Number.isFinite(b.time))
    .sort((a, b) => a.time - b.time)
    .filter((b, i, arr) => i === 0 || b.time !== arr[i - 1].time);
  cache.set(key, sorted);
  return sorted;
}

export function clearBarsCache(): void {
  cache.clear();
}

export const DATA_PROVIDER_NAME = () => resolveProvider().name;
