import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoSrc from "@/assets/tradevault-logo-128.png";
import { LandingLangProvider, useLandingT, type LandingKey } from "@/app/public/landing/i18n";
import { classifyAuthError, oauthErrorFromUrl } from "@/app/utils/authErrors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: ResetPasswordRoute,
});

/**
 * La page vit hors de l'application : elle porte le dictionnaire de la
 * VITRINE (celui de l'e-mail qui y mène), pas celui de l'app. Elle était
 * intégralement en anglais, en dur.
 */
function ResetPasswordRoute() {
  return (
    <LandingLangProvider>
      <ResetPasswordPage />
    </LandingLangProvider>
  );
}

type Phase = "verifying" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const { t } = useLandingT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("verifying");
  const [loading, setLoading] = useState(false);

  /* TROIS ISSUES, ET PLUS UNE ATTENTE SANS FIN.
   *
   * Supabase échange le jeton de l'adresse tout seul (`detectSessionInUrl`).
   * L'ancienne page passait en « prêt » sur `INITIAL_SESSION` — qui arrive
   * AUSSI quand il n'y a aucune session : un lien expiré affichait donc le
   * formulaire, et la validation échouait sur « Auth session missing! ». Et
   * un lien déjà utilisé (`#error_code=otp_expired`) laissait « Verifying
   * recovery link… » à l'écran.
   *
   * On décide maintenant sur la SESSION réelle : présente → formulaire ;
   * erreur dans l'adresse, ou toujours rien après l'échange → lien invalide,
   * avec le chemin pour en redemander un. */
  useEffect(() => {
    if (oauthErrorFromUrl(window.location.search, window.location.hash)) {
      setPhase("invalid");
      return;
    }
    let settled = false;
    const ready = () => {
      settled = true;
      setPhase((p) => (p === "verifying" ? "ready" : p));
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) ready();
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) ready();
      })
      .catch(() => {});
    // L'échange du code prend au plus quelques centaines de millisecondes ;
    // au-delà de 6 s sans session, le lien ne mènera nulle part.
    const timer = window.setTimeout(() => {
      if (!settled) setPhase((p) => (p === "verifying" ? "invalid" : p));
    }, 6_000);
    return () => {
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError(t("auth.err.weak_password"));
    if (password !== confirm) return setError(t("reset.mismatch"));
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        const code = classifyAuthError(err);
        if (code === "link_expired") setPhase("invalid");
        setError(t(`auth.err.${code}` as LandingKey));
        return;
      }
    } catch (e) {
      setError(t(`auth.err.${classifyAuthError(e)}` as LandingKey));
      return;
    } finally {
      setLoading(false);
    }
    setPhase("done");
    window.setTimeout(() => {
      window.location.replace("/");
    }, 1200);
  };

  const inputClass =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[rgb(var(--tv-accent-rgb)/0.5)] focus:ring-1 focus:ring-[rgb(var(--tv-accent-rgb)/0.2)] transition";

  return (
    <div
      /* `tv-public` : les jetons émeraude de la vitrine. Le bouton était un
         dégradé bleu → indigo, dernière trace de l'ancienne identité. */
      className="tv-public fixed inset-0 flex items-center justify-center min-h-screen overflow-hidden"
      style={{ background: "var(--tv-bg)" }}
    >
      <div className="err-grille" aria-hidden />
      <div className="err-nappe" aria-hidden />
      <div className="err-nappe-2" aria-hidden />
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-strong rounded-3xl p-8">
          <div className="text-center mb-8">
            <div className="relative w-14 h-14 mx-auto mb-4">
              <img
                src={logoSrc}
                alt="TradeVault"
                width={56}
                height={56}
                className="relative w-14 h-14 rounded-2xl"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">{t("reset.title")}</h1>
            <p className="text-sm text-slate-400 mt-1">{t("reset.sub")}</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          {phase === "verifying" && (
            <p className="text-sm text-slate-400 text-center" role="status">
              {t("reset.verifying")}
            </p>
          )}

          {phase === "invalid" && (
            <div className="space-y-4 text-center">
              {!error && <p className="text-sm text-slate-300">{t("auth.err.link_expired")}</p>}
              <a href="/?auth=login" className="err-cta inline-flex w-full justify-center">
                {t("reset.back")}
              </a>
            </div>
          )}

          {phase === "done" && (
            <div
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-400"
              role="status"
            >
              {t("reset.done")}
            </div>
          )}

          {phase === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("reset.new")}
                  aria-label={t("reset.new")}
                  autoComplete="new-password"
                  minLength={6}
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("reset.confirm")}
                  aria-label={t("reset.confirm")}
                  autoComplete="new-password"
                  minLength={6}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="err-cta w-full disabled:opacity-60"
              >
                {loading ? t("auth.submitting") : t("reset.submit")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
