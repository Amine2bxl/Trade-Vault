import { useEffect, useRef } from "react";
import { writeJSON, removeKey } from "../utils/persistence";

/**
 * Filet de sécurité universel pour tout texte en cours de saisie.
 *
 * Le scénario que ça règle : on écrit une note à l'instinct dans une popup,
 * un clic à côté / une coupure réseau / un onglet fermé, et TOUT est perdu.
 * Ce qu'on écrit ne se réécrit jamais pareil, donc le brouillon est écrit en
 * continu (débounce court) ET immédiatement quand la page part en arrière-plan
 * ou se ferme — les deux moments où un `setTimeout` en attente ne s'exécuterait
 * jamais.
 *
 * `dirty` arme en plus l'avertissement natif « quitter le site ? » : fermer
 * l'onglet avec du texte non enregistré demande confirmation.
 *
 * Le brouillon est du texte uniquement : les captures d'écran sont exclues via
 * `omit` (leur cycle de vie côté Storage ne peut pas survivre à la popup).
 */
export function useDraftAutosave<T extends object>(
  key: string | null,
  form: T,
  {
    dirty,
    omit = [],
    guard,
  }: {
    dirty: boolean;
    omit?: (keyof T)[];
    /** Renvoie false pour bloquer toute écriture (ex. : après enregistrement,
     *  où réécrire le brouillon au démontage le ferait « ressusciter »). */
    guard?: () => boolean;
  },
): void {
  // Refs : le listener d'arrière-plan doit toujours voir le DERNIER état sans
  // se ré-abonner à chaque frappe.
  const latest = useRef(form);
  latest.current = form;
  const omitRef = useRef(omit);
  omitRef.current = omit;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const guardRef = useRef(guard);
  guardRef.current = guard;

  const keyRef = useRef(key);
  keyRef.current = key;

  const save = useRef(() => {
    const k = keyRef.current;
    if (!k || !dirtyRef.current) return;
    if (guardRef.current && !guardRef.current()) return;
    const copy = { ...(latest.current as Record<string, unknown>) };
    for (const field of omitRef.current) delete copy[field as string];
    writeJSON(k, copy);
  });

  // Écriture débouncée pendant la frappe.
  useEffect(() => {
    if (!key || !dirty) return;
    const id = setTimeout(() => save.current(), 400);
    return () => clearTimeout(id);
  }, [key, form, dirty]);

  // Sauvegarde immédiate quand la page disparaît (onglet caché, navigation,
  // fermeture, app mobile en arrière-plan) + garde-fou avant déchargement.
  useEffect(() => {
    if (!key) return;
    const flush = () => save.current();
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Démontage (popup fermée d'un clic à côté) : dernière écriture.
      flush();
    };
  }, [key]);
}

/** Efface un brouillon — à appeler après un enregistrement réussi. */
export function clearDraft(key: string | null): void {
  if (key) removeKey(key);
}
