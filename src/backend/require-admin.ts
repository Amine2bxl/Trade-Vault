import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "./admin-access";

/**
 * Garde d'ADMINISTRATION pour les server functions.
 *
 * POURQUOI ELLE EXISTE. La page de diagnostic `/dev/ai` n'était protégée que
 * par l'absence de lien vers elle et une balise `noindex`. Ses deux server
 * functions — `aiRuntimeStatus` et `aiRuntimeProbe` — n'avaient AUCUN
 * middleware : n'importe qui, sans même être authentifié, pouvait les appeler
 * directement. `aiRuntimeStatus` révélait quels fournisseurs d'IA sont
 * configurés et l'état de leurs disjoncteurs ; `aiRuntimeProbe` déclenchait un
 * VRAI appel modèle, sur le fournisseur de son choix, autant de fois qu'il
 * voulait.
 *
 * Une server function est un point d'entrée HTTP comme un autre. Cacher la
 * page qui l'appelle ne la protège pas — seule cette garde le fait.
 *
 * Chaîne après `requireSupabaseAuth` : la requête est donc déjà authentifiée
 * (jeton vérifié auprès de Supabase, pas seulement décodé) quand on compare
 * l'adresse à `ADMIN_EMAILS`.
 */

/** Levée quand l'appelant n'est pas administrateur. Le message ne distingue pas
 *  « pas administrateur » de « aucun administrateur configuré » : les deux se
 *  répondent pareil, sinon l'erreur devient un oracle sur la configuration. */
export class AdminRequiredError extends Error {
  constructor() {
    super("FORBIDDEN: this endpoint is restricted to administrators.");
    this.name = "AdminRequiredError";
  }
}

export const requireAdminAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = (context.user as { email?: string } | undefined)?.email;
    if (!isAdminEmail(email)) throw new AdminRequiredError();
    return next();
  });
