import { useEffect, useReducer } from "react";
import {
  cachedScreenshotUrl,
  nextRetryAt,
  pathsToSign,
  signPaths,
  subscribeScreenshots,
} from "../store/screenshotUrls";

/**
 * Les liens affichables des captures (chemins du stockage, ou anciennes images
 * `data:`) — `""` tant qu'un lien valide n'est pas prêt.
 *
 * Tout le cycle de vie est dans `store/screenshotUrls.ts` : signature groupée,
 * cache partagé entre les écrans, re-signature AVANT l'expiration, nouvelles
 * tentatives après un échec d'affichage. Ce hook ne fait que demander ce qui
 * manque, se réveiller au bon moment (prochaine expiration ou tentative,
 * retour sur l'onglet) et redessiner quand une capture change d'état.
 *
 * Pour afficher une capture, passer par `components/ScreenshotImage` : il
 * signale les échecs et ne montre jamais l'icône cassée du navigateur.
 */
export function useScreenshotUrls(paths: string[]): Record<string, string> {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeScreenshots(bump), []);

  const key = paths.join("|");
  useEffect(() => {
    const due = pathsToSign(paths);
    if (due.length > 0) void signPaths(due);

    const next = nextRetryAt(paths);
    const timer =
      next === null ? null : window.setTimeout(bump, Math.max(0, next - Date.now()) + 50);
    // Onglet laissé de côté des heures : les liens ont pu expirer entre-temps.
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const now = Date.now();
  const out: Record<string, string> = {};
  for (const p of paths) out[p] = cachedScreenshotUrl(p, now) ?? "";
  return out;
}
