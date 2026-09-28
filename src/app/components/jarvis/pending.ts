/**
 * LES QUESTIONS EN COURS — elles survivent à la fenêtre.
 *
 * Jarvis répondait dans le composant de conversation : fermer la fenêtre
 * pendant qu'il réfléchissait démontait le composant, et la réponse, arrivée
 * trois secondes plus tard, n'avait plus nulle part où aller. Le trader
 * revenait sur une question sans réponse.
 *
 * La requête vit maintenant ICI, hors de React. À son retour :
 *   • si une conversation affichée écoute ce fil, elle reçoit la réponse
 *     (et l'écrit, s'anime, la lit à voix haute…) ;
 *   • sinon la réponse est écrite directement dans la conversation stockée,
 *     et elle est là quand le trader rouvre Jarvis.
 * Une conversation qui s'ouvre pendant qu'une question tourne le sait
 * (`pendingQuestion`) et affiche l'analyse en cours au lieu d'un fil muet.
 */

export type JarvisResult =
  | { ok: true; question: string; answer: string; degraded: boolean; fromAi: boolean }
  | { ok: false; question: string; error: unknown };

interface Pending {
  question: string;
  startedAt: number;
}

const pending = new Map<string, Pending>();
const listeners = new Map<string, (r: JarvisResult) => void>();

/** Lance une question. `persist` n'est appelé que si personne n'écoute au retour. */
export function startJarvisRequest(
  threadId: string,
  question: string,
  run: () => Promise<JarvisResult>,
  persist: (r: JarvisResult) => Promise<void>,
): void {
  pending.set(threadId, { question, startedAt: Date.now() });
  void run()
    .catch((error: unknown): JarvisResult => ({ ok: false, question, error }))
    .then(async (result) => {
      pending.delete(threadId);
      const listener = listeners.get(threadId);
      if (listener) listener(result);
      else await persist(result).catch(() => {});
    });
}

/** La question en cours sur ce fil, s'il y en a une. */
export function pendingQuestion(threadId: string): string | null {
  return pending.get(threadId)?.question ?? null;
}

/** Une conversation affichée s'abonne à son fil ; le retour lui est remis. */
export function listenJarvisThread(threadId: string, fn: (r: JarvisResult) => void): () => void {
  listeners.set(threadId, fn);
  return () => {
    if (listeners.get(threadId) === fn) listeners.delete(threadId);
  };
}
