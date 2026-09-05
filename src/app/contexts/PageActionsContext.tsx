import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * L'en-tête de la page courante, remonté dans la barre de tête (App.tsx) pour
 * qu'il s'aligne sur l'axe Y de la navigation au lieu de créer un « trou »
 * supplémentaire entre la barre et le contenu.
 *
 * DEUX EMPLACEMENTS, parce que la barre en a deux :
 *   • `actions` — à DROITE. Les boutons de la page.
 *   • `lead` — à GAUCHE, à la place des onglets. Il ne sert que dans les
 *     sections qui n'ont qu'une vue : là, la moitié gauche de la barre est
 *     vide, et une page qui a un résumé d'une ligne à donner peut l'y poser
 *     plutôt que de laisser la bande nue.
 *
 * Chaque page mémoise ses nœuds (pour une référence stable) puis les déclare.
 * Le nettoyage remet `null` au démontage pour qu'un en-tête ne « fuie » jamais
 * sur la page suivante.
 */

type Slot = "actions" | "lead";
type PageActionsSetter = (slot: Slot, node: ReactNode | null) => void;

const PageActionsContext = createContext<PageActionsSetter>(() => {});

export function PageActionsProvider({
  children,
  setActions,
}: {
  children: ReactNode;
  setActions: PageActionsSetter;
}) {
  return <PageActionsContext.Provider value={setActions}>{children}</PageActionsContext.Provider>;
}

/** Déclare les BOUTONS d'en-tête de la page courante (emplacement droit). */
export function usePageActions(actions: ReactNode | null) {
  const set = useContext(PageActionsContext);
  useEffect(() => {
    set("actions", actions);
    return () => set("actions", null);
  }, [set, actions]);
}

/** Déclare le RÉSUMÉ d'en-tête de la page courante (emplacement gauche). */
export function usePageLead(lead: ReactNode | null) {
  const set = useContext(PageActionsContext);
  useEffect(() => {
    set("lead", lead);
    return () => set("lead", null);
  }, [set, lead]);
}
