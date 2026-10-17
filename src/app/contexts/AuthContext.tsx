import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { User } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectTo } from "@/shared/site";
import { purgeLocalSessionData } from "../utils/session-purge";
import { classifyAuthError } from "../utils/authErrors";

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

/** `true` quand le fournisseur a été posé par `EnsureAuthProvider`, HORS de
 *  l'application (`/fr`, `/pricing`). Voir `useIsStandaloneAuth`. */
const StandaloneAuthContext = createContext(false);

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
  return (
    <StandaloneAuthContext.Provider value={true}>
      <AuthProvider>{children}</AuthProvider>
    </StandaloneAuthContext.Provider>
  );
}

/**
 * LA MODALE EST-ELLE HORS DE L'APPLICATION ?
 *
 * Sur `/fr` et `/pricing`, une connexion réussie ne menait NULLE PART : la
 * session était bien ouverte, mais aucune application n'était montée pour la
 * recevoir. Le bouton restait sur « Un instant… », indéfiniment — sur la page
 * où arrive tout le marché francophone. La modale lit ce drapeau et, une fois
 * le trader connecté, l'emmène dans l'application.
 */
export function useIsStandaloneAuth(): boolean {
  return useContext(StandaloneAuthContext);
}

/**
 * Une session Supabase est-elle (probablement) déjà là — lu SANS réseau.
 *
 * Supabase garde la session dans `localStorage` sous `sb-<projet>-auth-token`.
 * Un retour d'OAuth n'en a pas encore : il porte `?code=` (PKCE) ou
 * `#access_token=` dans l'adresse, et l'échange est en cours. Les deux veulent
 * dire « un trader arrive » : on attend l'auth au lieu de peindre la vitrine.
 * Stockage bloqué (navigation privée stricte) : `false`, jamais une exception.
 */
export function hasLikelySession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (/[?&#](code|access_token)=/.test(window.location.search + window.location.hash)) {
      return true;
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) return true;
    }
  } catch {
    /* stockage inaccessible */
  }
  return false;
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

  /* L'AUTH NE PEUT NI PLANTER NI PENDRE.
   *
   * `getSession()` n'avait pas de `.catch` : un stockage refusé (Safari en
   * navigation privée stricte, cookies bloqués) fait lever le client dès sa
   * création, dans un effet — l'exception remontait jusqu'à la frontière
   * d'erreur, écran 500 au premier lancement. Et une promesse qui ne se
   * résout jamais (verrou de rafraîchissement bloqué, réseau mort) laissait
   * « Vérification du compte… » à l'écran pour toujours.
   *
   * Toute panne retombe maintenant sur « non connecté » (la vitrine, d'où l'on
   * peut se reconnecter), et un filet de 8 s rend la main quoi qu'il arrive. */
  useEffect(() => {
    let active = true;
    const settle = (u: SupabaseUser | null | undefined) => {
      if (!active) return;
      setUser(u ? mapUser(u) : null);
      setLoading(false);
    };
    let unsubscribe = () => {};
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        settle(session?.user);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      supabase.auth
        .getSession()
        .then(({ data }) => settle(data.session?.user))
        .catch((e) => {
          console.error("[auth] getSession failed", e);
          settle(null);
        });
    } catch (e) {
      console.error("[auth] client unavailable", e);
      settle(null);
    }
    const filet = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 8_000);

    return () => {
      active = false;
      window.clearTimeout(filet);
      unsubscribe();
    };
  }, []);

  /* LES FONCTIONS D'AUTH RENDENT UN CODE (`AuthErrorCode`), PAS UNE PHRASE.
   * Chaque surface le traduit dans sa langue — voir `utils/authErrors.ts`. Un
   * appel réseau qui LÈVE (hors ligne) est rattrapé ici : il rend « network »
   * au lieu de laisser le bouton bloqué sur « Un instant… ». */
  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!email.trim() || !password) return "missing_fields";
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return error ? classifyAuthError(error) : null;
    } catch (e) {
      return classifyAuthError(e);
    }
  }, []);

  /* L'inscription ne se reconnecte plus derrière.
   *
   * La modale enchaînait `signUp` puis `signInWithPassword`. Quand la
   * confirmation d'e-mail est active, `signUp` ne rend AUCUNE session, et la
   * reconnexion échouait avec « Email not confirmed » — affiché en rouge à
   * quelqu'un qui venait de réussir son inscription. Quand elle ne l'est pas,
   * `signUp` rend déjà la session : la seconde requête ne servait à rien.
   *
   * `confirm_email` n'est donc pas une erreur : la modale l'affiche comme une
   * information. Une adresse déjà inscrite revient, avec la confirmation
   * active, sous la forme d'un utilisateur SANS identité (Supabase masque
   * l'existence du compte) : on la reconnaît et on propose de se connecter. */
  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<string | null> => {
      if (!name.trim() || !email.trim() || !password) return "missing_fields";
      if (password.length < 6) return "weak_password";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "invalid_email";
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Same reasoning as the OAuth redirect: a confirmation link minted
            // from a preview domain points at that preview forever.
            emailRedirectTo: authRedirectTo("/"),
            data: { name: name.trim() },
          },
        });
        if (error) return classifyAuthError(error);
        if (data.session) return null;
        if (data.user && (data.user.identities?.length ?? 0) === 0) return "user_exists";
        return "confirm_email";
      } catch (e) {
        return classifyAuthError(e);
      }
    },
    [],
  );

  // Redirects back to the origin where the flow started (see authRedirectTo in
  // shared/site.ts): the PKCE verifier is per-origin, so ending on the same
  // origin is what lets the flow complete — on production AND on previews.
  // Scopes are left at the Supabase default (email + profile) on purpose —
  // both are non-sensitive, so Google requires no security review for them.
  const loginWithGoogle = useCallback(async (): Promise<string | null> => {
    try {
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
      return error ? "oauth_failed" : null;
    } catch (e) {
      return classifyAuthError(e);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    if (!email.trim()) return "missing_fields";

    // Client-side rate limit: at most one reset per 60 seconds.
    let lastReset = 0;
    try {
      lastReset = Number(sessionStorage.getItem("tv.last-pwd-reset") ?? "0");
    } catch {
      /* sessionStorage not available */
    }
    if (Date.now() - lastReset < 60_000) return "rate_limited";

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectTo("/reset-password"),
      });
      if (error) return classifyAuthError(error);
    } catch (e) {
      return classifyAuthError(e);
    }

    try {
      sessionStorage.setItem("tv.last-pwd-reset", String(Date.now()));
    } catch {
      /* sessionStorage not available */
    }
    return null;
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    if (!newPassword || newPassword.length < 6) return "weak_password";
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return error ? classifyAuthError(error) : null;
    } catch (e) {
      return classifyAuthError(e);
    }
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
