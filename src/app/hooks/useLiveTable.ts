import { useEffect, useRef } from "react";
import { onResync, onTable, type LiveTable } from "../store/liveSync";

/**
 * Recharger un écran quand une table du compte change — ici ou ailleurs.
 *
 * Branché sur le moyeu (`store/liveSync.ts`) : aucun canal n'est ouvert ici.
 * Les rafales sont regroupées (150 ms par défaut) — une sauvegarde qui écrit
 * plusieurs lignes ne déclenche qu'un rechargement. `onChange` est aussi
 * appelé quand le moyeu demande un rattrapage (reconnexion, retour d'onglet) :
 * c'est ce qui récupère les changements manqués pendant une coupure.
 *
 * `onChange` peut changer à chaque rendu : il est lu par ref.
 */
export function useLiveTable(
  table: LiveTable,
  onChange: () => void,
  { debounceMs = 150, enabled = true }: { debounceMs?: number; enabled?: boolean } = {},
): void {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        cb.current();
      }, debounceMs);
    };
    const offTable = onTable(table, schedule);
    const offResync = onResync(schedule);
    return () => {
      if (timer) clearTimeout(timer);
      offTable();
      offResync();
    };
  }, [table, debounceMs, enabled]);
}
