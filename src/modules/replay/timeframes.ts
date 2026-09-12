/**
 * Timeframes — la grille des intervalles supportés.
 *
 * Le moteur de rejeu maintient UNE horloge canonique, indépendante du
 * timeframe de vue. La table des timeframes est le seul endroit qui définit
 * combien d'une bougie 1m compose chaque intervalle : ajouter un intervalle
 * (ex. une « 3m » supplémentaire) est une ligne ici.
 */

export const TIMEFRAMES = [
  { id: "1s", label: "1s", seconds: 1 },
  { id: "1m", label: "1m", seconds: 60 },
  { id: "2m", label: "2m", seconds: 120 },
  { id: "3m", label: "3m", seconds: 180 },
  { id: "5m", label: "5m", seconds: 300 },
  { id: "10m", label: "10m", seconds: 600 },
  { id: "15m", label: "15m", seconds: 900 },
  { id: "30m", label: "30m", seconds: 1800 },
  { id: "1h", label: "1H", seconds: 3600 },
  { id: "2h", label: "2H", seconds: 7200 },
  { id: "4h", label: "4H", seconds: 14400 },
  { id: "1d", label: "1D", seconds: 86400 },
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]["id"];

export const DEFAULT_TIMEFRAME: TimeframeId = "5m";

export function isTimeframeId(v: unknown): v is TimeframeId {
  return typeof v === "string" && TIMEFRAMES.some((t) => t.id === v);
}

export function timeframeSeconds(id: string): number {
  if (id === "1d") return 86400;
  const tf = TIMEFRAMES.find((t) => t.id === id);
  return tf ? tf.seconds : 300;
}

export function timeframeLabel(id: string): string {
  return TIMEFRAMES.find((t) => t.id === id)?.label ?? id;
}

/**
 * Le début de la bougie qui contient `ms`, dans un timeframe donné.
 *
 * Les minutes et heures s'alignent sur l'horloge NY (le marché ouvre/ferme sur
 * l'heure de New York, pas sur UTC) : la « 1H » commence à l'heure NY parfaite.
 * Le day regroupe par jour civil NY. `dayMs` est le minuit NY du jour qui
 * contient l'instant.
 */
export function candleStartOf(ms: number, tfSeconds: number, dayMs: number): number {
  if (tfSeconds >= 86400) return dayMs;
  const span = Math.max(60_000, tfSeconds * 1000);
  return dayMs + Math.floor((ms - dayMs) / span) * span;
}

/** La bougie SUIVANTE après `ms` (strictement après la fin de celle en cours). */
export function nextCandleStart(ms: number, tfSeconds: number, dayMs: number): number {
  const cur = candleStartOf(ms, tfSeconds, dayMs);
  const span = Math.max(60_000, tfSeconds * 1000);
  return cur + span > ms ? cur + span : cur + span + span;
}

/** La bougie PRÉCÉDENTE avant `ms` (strictement avant le début de celle en cours). */
export function prevCandleStart(ms: number, tfSeconds: number, dayMs: number): number {
  const cur = candleStartOf(ms, tfSeconds, dayMs);
  const span = Math.max(60_000, tfSeconds * 1000);
  return cur < ms ? cur : cur - span;
}
