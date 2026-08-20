import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Actions d'en-tête de la page courante, remontées dans la barre d'onglets
 * (App.tsx) pour qu'elles s'alignent sur l'axe Y de la navbar au lieu de créer
 * un « trou » supplémentaire entre la barre et le contenu.
 *
 * Chaque page mémoise ses actions (pour un nœud stable) puis les déclare via
 * `usePageActions`. Le nettoyage remet `null` au démontage pour que les actions
 * d'une page ne « fuient » jamais sur la suivante.
 */

type PageActionsSetter = (node: ReactNode | null) => void;

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

/** Déclare les actions d'en-tête de la page courante. */
export function usePageActions(actions: ReactNode | null) {
  const setActions = useContext(PageActionsContext);
  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [setActions, actions]);
}
