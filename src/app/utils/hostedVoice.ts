import { ttsCapabilities, ttsSpeak } from "@/backend/tts.functions";

/* LA VOIX HÉBERGÉE, PARTAGÉE PAR TOUT CE QUI PARLE.
 *
 * Jarvis parlait avec trois voix selon l'écran : les clips clonés hors ligne
 * dans la checklist, la voix neuronale hébergée pour « Welcome, Amine », et la
 * voix robot du navigateur dès que l'hébergée échouait. Un même personnage
 * qui change de timbre d'un écran à l'autre ne se lit plus comme un
 * personnage. La voix hébergée devient donc L'identité de Jarvis, partout ;
 * les clips et la voix du navigateur ne sont plus que des secours.
 *
 * Chaque réplique n'est synthétisée qu'UNE fois par session : la checklist
 * répète les mêmes phrases, et chaque appel est facturé. */

let probe: Promise<boolean> | null = null;

/** Sondée une fois par chargement de page, partagée par tous les écrans. */
export function hostedAvailable(): Promise<boolean> {
  if (!probe) {
    probe = ttsCapabilities()
      .then((r) => !!r.hosted)
      .catch(() => false);
  }
  return probe;
}

/** La voix hébergée a refusé (quota, réseau) : on n'insiste plus cette session. */
export function markHostedDown(): void {
  probe = Promise.resolve(false);
}

const cache = new Map<string, Promise<string | null>>();

/** L'audio (data URL) d'une réplique, ou `null` si la voix hébergée ne répond pas. */
export function hostedAudio(text: string): Promise<string | null> {
  const key = text.trim().slice(0, 600);
  let pending = cache.get(key);
  if (!pending) {
    pending = ttsSpeak({ data: { text: key } })
      .then((r) => (r.available && "audio" in r && r.audio ? r.audio : null))
      .catch(() => null);
    cache.set(key, pending);
    // Un échec n'est pas mémorisé : la réplique pourra être retentée.
    void pending.then((a) => {
      if (!a) cache.delete(key);
    });
  }
  return pending;
}
