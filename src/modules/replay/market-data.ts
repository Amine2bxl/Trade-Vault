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
// Ajouter un vrai fournisseur : implémenter `MarketDataProvider` et l'inscrire
// ici dans l'ordre de préférence. `resolveProvider` rend le premier disponible.

const REGISTERED: MarketDataProvider[] = [new SyntheticProvider()];

export function resolveProvider(): MarketDataProvider {
  return REGISTERED.find((p) => p.isAvailable()) ?? REGISTERED[0];
}

/** Mémoire des journaux déjà chargés — une date coûte un fetch, jamais deux. */
const cache = new Map<string, OhlcBar[]>();

export async function loadSessionBars(date: string, spec: InstrumentSpec): Promise<OhlcBar[]> {
  const key = `${spec.id}:${date}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const provider = resolveProvider();
  const bars = await provider.fetchBars({ date, spec });
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
