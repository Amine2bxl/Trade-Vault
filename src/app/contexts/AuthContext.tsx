import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { User } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectTo } from "@/shared/site";
import { purgeLocalSessionData } from "../utils/session-purge";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * LE FOURNISSEUR D'AUTH, POSÉ SEULEMENT S'IL MANQUE.
 *
 * ── LE BUG QU'IL FERME ────────────────────────────────────────────────────
 *
 * `AuthModal` appelle `useAuth()`, qui LÈVE quand aucun fournisseur n'est
 * au-dessus. Sur `/`, l'application en monte un et tout va bien. Mais deux
 * surfaces publiques rendent cette même modale HORS de l'arbre applicatif :
 * `/fr` (la vitrine française, rendue au SSR sans `ClientOnly`) et
 * `/pricing`. Sur ces deux adresses, n'importe quel appel à l'action —
 * « Commencer », « Se connecter », le choix d'une offre — faisait remonter
 * l'exception jusqu'à la frontière d'erreur : écran 500, sur le clic le plus
 * important du site.
 *
 * Le défaut était invisible en anglais parce que `/` passe par
 * l'application ; il ne se manifestait qu'après un changement de langue, qui
 * emmène précisément sur `/fr`.
 *
 * ── POURQUOI « SEULEMENT S'IL MANQUE » ────────────────────────────────────
 *
 * Envelopper les deux routes d'un `AuthProvider` nu aurait marché, mais
 * aurait laissé le piège en place : la prochaine surface publique qui monte
 * la modale replanterait, et l'erreur ne se verrait qu'en production, au
 * clic. Et sur `/`, un fournisseur supplémentaire créerait un SECOND état
 * d'authentification, indépendant de celui de l'application : deux
 * abonnements `onAuthStateChange`, deux vérités sur qui est connecté.
 *
 * Ce composant ne pose donc rien quand un fournisseur existe déjà. Il rend
 * la modale montable partout, sans jamais dupliquer la session.
 */
export function EnsureAuthProvider({ children }: { children: ReactNode }) {
  const existant = useContext(AuthContext);
  if (existant) return <>{children}</>;
  return <AuthProvider>{children}</AuthProvider>;
}

function mapUser(u: SupabaseUser): User {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (meta.name as string) ||
    (meta.full_name as string) ||
    (u.email ? u.email.split("@")[0] : "") ||
    "Trader";
  return { id: u.id, email: u.email ?? "", name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? mapUser(data.session.user) : null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!email || !password) return "Please fill in all fields";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<string | null> => {
      if (!name || !email || !password) return "Please fill in all fields";
      if (password.length < 6) return "Password must be at least 6 characters";
      if (!email.includes("@")) return "Please enter a valid email";
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Same reasoning as the OAuth redirect: a confirmation link minted
          // from a preview domain points at that preview forever.
          emailRedirectTo: authRedirectTo("/"),
          data: { name },
        },
      });
      if (error) return error.message;
      return null;
    },
    [],
  );

  // Redirects back to the origin where the flow started (see authRedirectTo in
  // shared/site.ts): the PKCE verifier is per-origin, so ending on the same
  // origin is what lets the flow complete — on production AND on previews.
  // Scopes are left at the Supabase default (email + profile) on purpose —
  // both are non-sensitive, so Google requires no security review for them.
  const loginWithGoogle = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectTo("/"),
        /* TOUJOURS LE SÉLECTEUR DE COMPTE.
         *
         * Sans `prompt`, Google reconnecte SILENCIEUSEMENT la dernière
         * session active quand il n'y en a qu'une, et affiche le formulaire
         * d'adresse e-mail quand il n'en a aucune. Les deux sont des impasses
         * ici : la première enferme qui a plusieurs comptes Google (impossible
         * de choisir l'autre sans se déconnecter de Google entièrement), la
         * seconde fait ressaisir une adresse que le navigateur connaît déjà.
         *
         * `select_account` force l'écran « Choisir un compte » dans les deux
         * cas : un clic sur un avatar, et c'est fini. */
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return error.message ?? "Google sign-in failed";
    return null;
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    if (!email) return "Please enter your email";

    // Client-side rate limit: at most one reset per 60 seconds.
    const lastReset = Number(sessionStorage.getItem("tv.last-pwd-reset") ?? "0");
    if (Date.now() - lastReset < 60_000) {
      return "Too many requests. Please wait 1 minute before trying again.";
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectTo("/reset-password"),
    });
    if (error) return error.message;

    try {
      sessionStorage.setItem("tv.last-pwd-reset", String(Date.now()));
    } catch {
      /* sessionStorage not available */
    }
    return null;
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    if (!newPassword || newPassword.length < 6) return "Password must be at least 6 characters";
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return error.message;
    return null;
  }, []);

  // Permanent, irreversible: the edge function wipes storage, every row, and
  // the auth account itself. On success we sign the (now-deleted) session out.
  const deleteAccount = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) return error.message ?? "Account deletion failed";
    if (data && (data as { error?: string }).error) return (data as { error: string }).error;
    await supabase.auth.signOut().catch(() => {});
    // Le compte n'existe plus côté serveur : laisser ses conversations et ses
    // checklists sur le disque ferait de « supprimer mon compte » une promesse
    // à moitié tenue.
    purgeLocalSessionData();
    setUser(null);
    return null;
  }, []);

  // La déconnexion efface AUSSI les données locales de la session — historique
  // Jarvis, réponses de checklist, brouillons, calculatrice de position. Voir
  // `utils/session-purge.ts` pour la liste de ce qui survit et pourquoi.
  //
  // APRÈS `signOut()`, délibérément : la purge ne touche pas les clés `sb-*`,
  // mais la faire d'abord la ferait courir contre la révocation du jeton pour
  // aucun bénéfice. Avant `setUser(null)` : l'application se replie alors sur
  // la vitrine avec un disque déjà propre.
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    purgeLocalSessionData();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        signup,
        loginWithGoogle,
        requestPasswordReset,
        updatePassword,
        deleteAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
