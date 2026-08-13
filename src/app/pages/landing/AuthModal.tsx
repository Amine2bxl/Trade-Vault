/* Modale d'authentification (login/signup) affichée par-dessus la landing.
 * Layout split-screen : marque + confiance à gauche, formulaire à droite. */
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import logoSrc from "@/assets/tradevault-logo.webp";
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
  const { login, signup, loginWithGoogle, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
        const le = await login(email, password);
        if (le) {
          setError(le);
          setLoading(false);
        }
      }
    }
  };

  const oauth = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    const err = await loginWithGoogle();
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
    "w-full h-11 rounded-xl border border-white/[.1] bg-white/[.03] px-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/55 focus:bg-white/[.05] focus:ring-2 focus:ring-cyan-400/15";
  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setInfo("");
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md overflow-y-auto"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <div className="modal-in relative my-auto w-full max-w-[880px] overflow-hidden rounded-2xl border border-white/[.09] bg-[#0a1220] shadow-[0_40px_110px_rgba(0,0,0,.7)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3.5 top-3.5 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[.06] hover:text-white transition"
        >
          <Icon n="close" cls="h-4 w-4" />
        </button>

        <div className="grid md:grid-cols-2">
          {/* ── Colonne gauche : marque + confiance (masquée sur mobile) ── */}
          <div className="relative hidden md:flex flex-col justify-between p-8 overflow-hidden bg-[linear-gradient(160deg,rgba(14,58,82,.5),rgba(7,14,24,.95)_70%)]">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-cyan-500/[.15] blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2.5">
                <img src={logoSrc} alt="" width={32} height={32} className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,.45)]" />
                <span className="font-display text-[1.1rem] font-extrabold leading-none tracking-[-0.04em] text-white">TradeVault</span>
              </div>

              <h2 className="mt-8 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-white">
                {mode === "login" ? "Ravi de te revoir." : "Commence à comprendre ton trading."}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Ton coach IA analyse tes trades, détecte tes erreurs et t'aide à devenir le trader discipliné que tu veux être.
              </p>

              <div className="mt-7 space-y-2.5">
                {[
                  "Analyse de tes trades dès le premier jour",
                  "Aucune carte demandée, rien à annuler",
                  "Tes données restent exportables à tout moment",
                ].map((line) => (
                  <p key={line} className="flex items-start gap-2 text-[13px] leading-5 text-slate-300">
                    <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">
                      <Icon n="check" cls="h-2.5 w-2.5" />
                    </span>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Trustpilot — preuve sociale */}
            <div className="relative mt-8">
              <a
                href="https://www.trustpilot.com/review/tradevaultt.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/[.08] bg-white/[.03] py-1.5 pl-2 pr-3.5 transition hover:border-[#00b67a]/40 hover:bg-white/[.05]"
              >
                <span className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="grid h-4 w-4 place-items-center rounded-[2px] bg-[#00b67a]">
                      <Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" />
                    </span>
                  ))}
                </span>
                <span className="text-xs font-semibold text-slate-300">Avis vérifiés sur <span className="text-white font-bold">Trustpilot</span></span>
              </a>
              <div className="mt-4 flex items-center gap-x-4 gap-y-1.5 flex-wrap">
                {[
                  ["shield", "Sans engagement"],
                  ["lock", "Données chiffrées"],
                  ["check", "Annulation en 1 clic"],
                ].map(([ic, label]) => (
                  <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Icon n={ic as "shield"} cls="h-3.5 w-3.5 text-emerald-400/80" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Colonne droite : formulaire ── */}
          <div className="relative p-7 sm:p-8">
            {/* Logo mobile */}
            <div className="flex items-center gap-2.5 md:hidden mb-6">
              <img src={logoSrc} alt="" width={28} height={28} className="h-7 w-7 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,.45)]" />
              <span className="font-display text-[1.05rem] font-extrabold leading-none tracking-[-0.04em] text-white">TradeVault</span>
            </div>

            {plan && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/[.08] px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
                <Icon n="sparkle" cls="h-3 w-3" />
                {plan}
              </div>
            )}
            <h2 className="mt-3 font-display text-[1.4rem] font-bold tracking-[-0.02em] text-white">
              {mode === "login" ? "Se connecter" : "Créer ton compte"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "login" ? "Reprends où tu t'es arrêté." : "14 jours de Premium, sans carte bancaire."}
            </p>

            {/* SSO Google */}
            <div className="mt-6">
              <button
                onClick={oauth}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[.1] bg-white/[.05] py-3 text-sm font-semibold text-slate-100 transition hover:border-white/25 hover:bg-white/[.09] disabled:opacity-60"
              >
                <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[.07]" />
              <span className="text-[11px] uppercase tracking-wider text-slate-600">ou par e-mail</span>
              <div className="h-px flex-1 bg-white/[.07]" />
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">{error}</div>
            )}
            {info && (
              <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-400">{info}</div>
            )}

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom d'utilisateur</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alex Martin" className={field} />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">E-mail</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nom@exemple.com" className={field} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                  {mode === "login" && (
                    <button type="button" onClick={forgot} className="text-[11px] text-slate-500 hover:text-cyan-300 transition">Oublié ?</button>
                  )}
                </div>
                <div className="relative">
                  <input required type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} placeholder="6+ caractères" className={`${field} pr-10`} />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer" : "Afficher"} className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:text-slate-300 transition">
                    <Icon n="eye" cls="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button disabled={loading} className="btn-primary w-full h-11! mt-1 disabled:opacity-60 disabled:cursor-wait">
                {loading ? "Un instant…" : mode === "login" ? "Se connecter" : "Démarrer mes 14 jours"}
                {!loading && <Icon n="arrow" cls="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-5 text-center text-[13px] text-slate-500">
              {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button onClick={toggleMode} className="font-semibold text-cyan-300 hover:text-cyan-200 transition">
                {mode === "login" ? "Créer un compte" : "Se connecter"}
              </button>
            </p>

            <p className="mt-4 text-center text-[10.5px] leading-4 text-slate-600">
              En continuant, tu acceptes nos{" "}
              <a href="/terms" className="underline hover:text-slate-400">Conditions</a>{" "}
              et notre{" "}
              <a href="/privacy" className="underline hover:text-slate-400">Politique de confidentialité</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
