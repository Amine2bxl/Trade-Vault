/* Modale d'authentification (login/signup) affichée par-dessus la landing.
 * Extrait de Landing.tsx (Phase D) — aucun changement de comportement. */
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import logoSrc from "@/assets/tradevault-logo.png";
import { Icon } from "./Icon";

export function AuthModal({
  onClose,
  initialMode = "signup",
  plan,
}: {
  onClose: () => void;
  initialMode?: "login" | "signup";
  plan?: string;
}) {
  const { login, signup, loginWithGoogle, loginWithDiscord, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Lock the real scroller (<html>) so the landing behind doesn't scroll,
    // and restore its exact prior value on close — never clobber body styles.
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => {
      el.style.overflow = prev;
      window.removeEventListener("keydown", k);
    };
  }, [onClose]);

  // On success `isAuthenticated` flips and App.tsx unmounts this whole tree, so
  // we intentionally keep `loading` true rather than clearing state that vanishes.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    if (mode === "login") {
      const err = await login(email, password);
      if (err) {
        setError(err);
        setLoading(false);
      }
    } else {
      const err = await signup(name, email, password);
      if (err) {
        setError(err);
        setLoading(false);
      } else {
        // Email verification disabled — sign in immediately after signup.
        const le = await login(email, password);
        if (le) {
          setError(le);
          setLoading(false);
        }
      }
    }
  };

  const oauth = async (provider: "google" | "discord") => {
    setError("");
    setInfo("");
    setLoading(true);
    const err = provider === "google" ? await loginWithGoogle() : await loginWithDiscord();
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  const forgot = async () => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Entre ton e-mail pour recevoir le lien de réinitialisation.");
      return;
    }
    const err = await requestPasswordReset(email);
    if (err) setError(err);
    else setInfo("Lien de réinitialisation envoyé. Vérifie ta boîte mail.");
  };

  const field =
    "w-full rounded-lg border border-white/[.1] bg-white/[.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/55 focus:bg-white/[.04] focus:ring-2 focus:ring-cyan-400/12";
  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setInfo("");
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md overflow-y-auto"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <div className="modal-in relative my-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c1421] shadow-[0_30px_90px_rgba(0,0,0,.6)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3.5 top-3.5 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[.06] hover:text-white transition"
        >
          <Icon n="close" cls="h-4 w-4" />
        </button>

        <div className="p-7 sm:p-8">
          <img
            src={logoSrc}
            alt="TradeVault"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />

          {plan && (
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.06] px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
              <Icon n="sparkle" cls="h-3 w-3" />
              {plan}
            </div>
          )}
          <h2 className="mt-4 font-display text-[1.4rem] font-bold tracking-[-0.01em] text-white">
            {mode === "login" ? "Ravi de te revoir" : "Créer ton compte"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === "login"
              ? "Connecte-toi pour reprendre où tu t'es arrêté."
              : "14 jours pour transformer ton trading."}
          </p>

          {/* SSO — fastest paths */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <button
              onClick={() => oauth("google")}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 rounded-lg border border-white/[.1] bg-white/[.04] py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[.07] disabled:opacity-60"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
            <button
              onClick={() => oauth("discord")}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 rounded-lg border border-white/[.1] bg-white/[.04] py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[.07] disabled:opacity-60"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Discord
            </button>
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[.07]" />
            <span className="text-[11px] text-slate-600">ou</span>
            <div className="h-px flex-1 bg-white/[.07]" />
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-400">
              {info}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Nom d'utilisateur
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Alex Martin"
                  className={field}
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">E-mail</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="nom@exemple.com"
                className={field}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={forgot}
                    className="text-[11px] text-slate-500 hover:text-cyan-300 transition"
                  >
                    Oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  required
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  placeholder="6+ caractères"
                  className={`${field} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Masquer" : "Afficher"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:text-slate-300 transition"
                >
                  <Icon n="eye" cls="h-4 w-4" />
                </button>
              </div>
            </div>
            <button
              disabled={loading}
              className="btn-primary w-full h-11! mt-1 disabled:opacity-60 disabled:cursor-wait"
            >
              {loading ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
              {!loading && <Icon n="arrow" cls="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-slate-500">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              onClick={toggleMode}
              className="font-semibold text-cyan-300 hover:text-cyan-200 transition"
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
          <p className="mt-3 text-center text-[10.5px] leading-4 text-slate-600">
            En continuant, tu acceptes nos{" "}
            <a href="/terms" className="underline hover:text-slate-400">
              Conditions
            </a>{" "}
            et notre{" "}
            <a href="/privacy" className="underline hover:text-slate-400">
              Politique de confidentialité
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
