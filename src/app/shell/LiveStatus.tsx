import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui";
import { useT } from "../i18n/LanguageContext";
import { getLiveStatus, subscribeLiveStatus } from "../store/liveSync";
import { LIVE_STATUS_GRACE_MS, liveStatusMessage } from "./liveStatusMessage";

/**
 * L'INDICATEUR DU DIRECT — muet tant que tout va bien.
 *
 * Il ne paraît que si le navigateur est hors ligne, ou si la synchro en
 * direct se reconnecte depuis plus de deux secondes après avoir fonctionné :
 * le trader sait alors pourquoi l'autre appareil ne suit pas. Une pastille
 * qui pulse (le seul geste « en direct » du produit), aucune ombre, aucun
 * halo. Pas de minuterie permanente : un seul réveil, au bout du délai.
 */
export default function LiveStatus() {
  const { t } = useT();
  const [state, setState] = useState(() => ({ status: getLiveStatus(), since: Date.now() }));
  const [everOnline, setEverOnline] = useState(() => getLiveStatus() === "online");
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    () =>
      subscribeLiveStatus((status) => {
        setState({ status, since: Date.now() });
        if (status === "online") setEverOnline(true);
      }),
    [],
  );

  useEffect(() => {
    if (state.status === "online") return;
    const id = window.setTimeout(() => setNow(Date.now()), LIVE_STATUS_GRACE_MS + 50);
    return () => window.clearTimeout(id);
  }, [state]);

  const browserOnline = typeof navigator === "undefined" || navigator.onLine !== false;
  const key = liveStatusMessage(state.status, state.since, now, { everOnline, browserOnline });
  if (!key) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[var(--tv-z-fab)] -translate-x-1/2 px-4 md:bottom-6 md:top-auto">
      <div role="status" aria-live="polite" className="animate-fade-in-up">
        <Badge variant={key === "liveStatus.offline" ? "warning" : "neutral"}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          {t(key)}
        </Badge>
      </div>
    </div>
  );
}
