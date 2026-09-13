/**
 * useAutoJournal — encoder un trade AU MOMENT où il se referme.
 *
 * C'est le geste que le rejeu rend enfin possible : un stop est touché, et
 * avant même que la bougie suivante s'ouvre, le formulaire du journal est là,
 * déjà rempli, avec l'image du graphe à l'instant de la sortie. Le trader
 * vérifie, ajoute ce que la machine ne peut pas savoir — son intention, son
 * erreur — et enregistre. Sans quitter le terminal.
 *
 * Trois décisions portent tout le reste :
 *
 *  • LA LECTURE SE MET EN PAUSE. Écrire une note pendant que le marché
 *    continue d'avancer, c'est écrire sur autre chose. La pause est la seule
 *    façon d'être encore devant le trade dont on parle.
 *  • LA CAPTURE EST PRISE ICI, PAS PLUS TARD. Trente secondes après, le graphe
 *    a défilé et l'image ne montre plus rien. C'est l'instant qui compte.
 *  • LES TRADES SE METTENT EN FILE. Un stop et un objectif peuvent tomber sur
 *    la même bougie ; la modale est unique. On encode le premier, et la
 *    fermeture de la modale appelle le suivant.
 *
 * Les trades déjà clos à la REPRISE d'une séance ne rouvrent rien : ils sont
 * marqués comme vus au premier passage. Rouvrir douze formulaires parce qu'on
 * a rechargé la page serait insupportable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ReplayTrade } from "@/modules/replay";
import { uploadScreenshot } from "../store";
import { ENCODE_DONE_EVENT, requestTradeEncoding } from "../store/replay";
import { captureChart } from "./captureChart";

export interface AutoJournalOptions {
  userId: string | null;
  /** L'encodage automatique est-il armé ? Le trader peut le couper. */
  enabled: boolean;
  /**
   * La séance est-elle réellement montée ?
   *
   * À la REPRISE, le terminal se rend une première fois AVANT que l'état de
   * séance existe : les trades clos y sont encore inconnus. S'amorcer sur ce
   * rendu-là reviendrait à déclarer « rien de clos jusqu'ici », puis à traiter
   * les douze trades de la séance reprise comme des nouveautés — douze
   * formulaires ouverts à la file pour avoir rechargé la page.
   */
  ready: boolean;
  /**
   * Les trades clos de la séance.
   *
   * ATTENTION : c'est un tableau MUTÉ EN PLACE par le moteur. Sa référence ne
   * change jamais, donc il ne peut pas servir de dépendance d'effet — c'est sa
   * LONGUEUR qui dit qu'un trade s'est refermé.
   */
  closedTrades: ReplayTrade[];
  /** Le graphe, la couche d'ordres et leur boîte — de quoi composer la capture. */
  chart: () => IChartApi | null;
  overlay: MutableRefObject<SVGSVGElement | null>;
  /**
   * La boîte qui contient les deux.
   *
   * Elle donne la largeur CSS du graphe, sans laquelle on ne peut pas savoir à
   * quelle échelle la capture a été rendue — et donc pas composer l'overlay
   * dessus sans le décaler.
   */
  container: MutableRefObject<HTMLElement | null>;
  /** Mettre la lecture en pause avant d'ouvrir le formulaire. */
  onPause: () => void;
  /** Un mot au trader — capture jointe, capture ratée. */
  notify?: (message: string, tone: "success" | "info" | "error") => void;
  /** Les libellés, déjà traduits par l'appelant. */
  labels: { shot: string; shotFailed: string };
}

export interface AutoJournalApi {
  /** Combien de trades attendent encore leur formulaire. */
  queued: number;
  /** Encoder un trade à la demande — depuis l'historique, par exemple. */
  logNow: (trade: ReplayTrade) => void;
}

export function useAutoJournal({
  userId,
  enabled,
  ready,
  closedTrades,
  chart,
  overlay,
  container,
  onPause,
  notify,
  labels,
}: AutoJournalOptions): AutoJournalApi {
  /** Les trades déjà passés par ici — jamais deux fois le même formulaire. */
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [queue, setQueue] = useState<ReplayTrade[]>([]);
  /** Un formulaire est-il ouvert ? On n'en empile pas deux. */
  const busy = useRef(false);

  // Les options changent à chaque rendu du terminal (closures neuves) : on les
  // lit dans une ref pour que les effets ci-dessous ne se relancent pas à
  // chaque battement de l'horloge.
  const deps = useRef({ userId, chart, overlay, container, onPause, notify, labels });
  deps.current = { userId, chart, overlay, container, onPause, notify, labels };
  /** Le tableau vivant du moteur, lu par l'effet qui se déclenche sur sa taille. */
  const tradesRef = useRef(closedTrades);
  tradesRef.current = closedTrades;

  const open = useCallback(async (trade: ReplayTrade) => {
    busy.current = true;
    const d = deps.current;
    d.onPause();
    let shots: string[] = [];
    const file = await captureChart(
      d.chart(),
      d.overlay.current,
      d.container.current,
      "replay-trade",
    );
    if (file && d.userId) {
      try {
        shots = [await uploadScreenshot(d.userId, file)];
        d.notify?.(d.labels.shot, "success");
      } catch {
        // Le stockage a refusé : on encode quand même. Un trade sans image
        // vaut infiniment mieux qu'un trade perdu.
        d.notify?.(d.labels.shotFailed, "info");
      }
    } else if (!file) {
      d.notify?.(d.labels.shotFailed, "info");
    }
    requestTradeEncoding(trade, shots);
  }, []);

  // ── Repérer les nouveautés ──────────────────────────────────────────────
  //
  // La dépendance est la LONGUEUR, pas le tableau : le moteur pousse dans le
  // même tableau à chaque clôture, donc sa référence est immuable et un effet
  // qui en dépendrait ne se rejouerait jamais.
  const closedCount = closedTrades.length;
  useEffect(() => {
    if (!ready) return;
    const trades = tradesRef.current;
    if (!primed.current) {
      // Première lecture d'une séance montée : tout ce qui est déjà clos
      // appartient au passé.
      for (const t of trades) seen.current.add(t.id);
      primed.current = true;
      return;
    }
    const fresh = trades.filter((t) => !seen.current.has(t.id));
    if (fresh.length === 0) return;
    for (const t of fresh) seen.current.add(t.id);
    // Même sans encodage automatique, les trades sont marqués vus : les
    // rallumer plus tard ne doit pas déverser toute la séance d'un coup.
    if (!enabled) return;
    setQueue((q) => [...q, ...fresh]);
  }, [closedCount, enabled, ready]);

  // ── Servir la file, un formulaire à la fois ─────────────────────────────
  useEffect(() => {
    if (busy.current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    void open(next);
  }, [queue, open]);

  // La modale s'est refermée : au suivant.
  useEffect(() => {
    const onDone = () => {
      busy.current = false;
      setQueue((q) => [...q]);
    };
    window.addEventListener(ENCODE_DONE_EVENT, onDone);
    return () => window.removeEventListener(ENCODE_DONE_EVENT, onDone);
  }, []);

  const logNow = useCallback((trade: ReplayTrade) => {
    seen.current.add(trade.id);
    setQueue((q) => [...q, trade]);
  }, []);

  return { queued: queue.length, logNow };
}
