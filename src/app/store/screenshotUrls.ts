import { getScreenshotUrls } from "./storage";

/**
 * LES LIENS DES CAPTURES — une capture mise sur le site doit toujours se voir.
 *
 * Les captures vivent dans un bucket privé : pour les afficher, on demande au
 * stockage un lien SIGNÉ, valable un temps donné. Le défaut d'origine tenait en
 * deux lignes : les liens signés par lot valaient une heure, le cache les
 * resservait vingt-trois heures. Passé la première heure, l'aperçu d'un trade
 * affichait l'icône cassée du navigateur et le texte « Chart 1 ». Et quand
 * l'image échouait, rien ne la re-signait.
 *
 * Ce module tient le cycle de vie complet, sans React :
 *   • le cache expire AVANT le lien (`REFRESH_MARGIN_MS`) ;
 *   • une image qui échoue quand même est re-signée automatiquement
 *     (`MAX_AUTO_RETRIES` fois, avec un court délai pour ne pas boucler) ;
 *   • après ces essais seulement, la capture est déclarée indisponible et
 *     l'écran propose « Réessayer » — jamais une icône cassée ;
 *   • une coupure réseau pendant la signature ne déclare rien d'indisponible :
 *     on réessaie un peu plus tard ;
 *   • une signature en cours n'est jamais demandée deux fois.
 */

/** Validité d'un lien signé. */
export const SIGNED_URL_TTL_S = 60 * 60 * 24;
/** On re-signe dix minutes avant l'expiration : un lien servi est toujours valide. */
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;
/** Nouvelles signatures automatiques après un échec d'affichage. */
export const MAX_AUTO_RETRIES = 2;
/** Délai avant une nouvelle tentative, selon le nombre d'échecs déjà vus. */
const RETRY_DELAY_MS = [0, 0, 3_000, 8_000];
/** Après une coupure réseau pendant la signature. */
const NETWORK_RETRY_MS = 5_000;

interface Entry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
const inflight = new Set<string>();
const failures = new Map<string, number>();
const retryAt = new Map<string, number>();
const unavailable = new Set<string>();
const listeners = new Set<() => void>();

function isInline(path: string): boolean {
  return path.startsWith("data:");
}

function notify(): void {
  for (const l of [...listeners]) {
    try {
      l();
    } catch (e) {
      console.error("[screenshots] listener failed", e);
    }
  }
}

/** Le lien à afficher, s'il est valide (marge comprise) ; sinon `null`. */
export function cachedScreenshotUrl(path: string, now = Date.now()): string | null {
  if (isInline(path)) return path;
  const e = cache.get(path);
  if (!e || e.expiresAt - REFRESH_MARGIN_MS <= now) return null;
  return e.url;
}

/** Les chemins à (re)signer maintenant. */
export function pathsToSign(paths: string[], now = Date.now()): string[] {
  const out: string[] = [];
  for (const p of new Set(paths)) {
    if (!p || isInline(p) || inflight.has(p) || unavailable.has(p)) continue;
    if ((retryAt.get(p) ?? 0) > now) continue;
    if (cachedScreenshotUrl(p, now)) continue;
    out.push(p);
  }
  return out;
}

function recordFailure(path: string, now: number): void {
  const n = (failures.get(path) ?? 0) + 1;
  failures.set(path, n);
  cache.delete(path);
  if (n > MAX_AUTO_RETRIES) {
    unavailable.add(path);
    retryAt.delete(path);
    return;
  }
  retryAt.set(path, now + (RETRY_DELAY_MS[n] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1]));
}

/** Signe un lot de chemins (une seule requête). */
export async function signPaths(paths: string[]): Promise<void> {
  const todo = paths.filter((p) => p && !isInline(p) && !inflight.has(p));
  if (todo.length === 0) return;
  for (const p of todo) inflight.add(p);
  try {
    const signed = await getScreenshotUrls(todo, SIGNED_URL_TTL_S);
    const now = Date.now();
    for (const p of todo) {
      const url = signed[p];
      if (url) {
        cache.set(p, { url, expiresAt: now + SIGNED_URL_TTL_S * 1000 });
        retryAt.delete(p);
      } else {
        // Le stockage ne connaît pas ce fichier : même chemin qu'une image cassée.
        recordFailure(p, now);
      }
    }
    notify();
  } catch {
    // Coupure réseau : rien n'est déclaré indisponible, on réessaiera.
    const later = Date.now() + NETWORK_RETRY_MS;
    for (const p of todo) retryAt.set(p, later);
  } finally {
    for (const p of todo) inflight.delete(p);
  }
}

/** L'image n'a pas pu s'afficher avec ce lien : on le jette et on re-signera. */
export function reportBrokenScreenshot(path: string): void {
  if (!path || isInline(path)) return;
  recordFailure(path, Date.now());
  notify();
}

/** « Réessayer » : la capture repart pour une série de tentatives. */
export function retryScreenshot(path: string): void {
  unavailable.delete(path);
  failures.delete(path);
  retryAt.delete(path);
  cache.delete(path);
  notify();
}

export function isScreenshotUnavailable(path: string): boolean {
  return unavailable.has(path);
}

/** Le prochain instant où l'un de ces chemins devra être (re)signé, ou `null`. */
export function nextRetryAt(paths: string[]): number | null {
  let next: number | null = null;
  const consider = (t: number) => {
    if (next === null || t < next) next = t;
  };
  for (const p of paths) {
    if (!p || isInline(p) || unavailable.has(p)) continue;
    const r = retryAt.get(p);
    if (r !== undefined) consider(r);
    const e = cache.get(p);
    if (e) consider(e.expiresAt - REFRESH_MARGIN_MS);
  }
  return next;
}

export function subscribeScreenshots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Une capture qui vient d'être envoyée : son lien est déjà connu. */
export function seedScreenshot(path: string, url: string): void {
  cache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_TTL_S * 1000 });
  notify();
}

/** Tout oublier (déconnexion, tests). */
export function resetScreenshotCache(): void {
  cache.clear();
  inflight.clear();
  failures.clear();
  retryAt.clear();
  unavailable.clear();
}
