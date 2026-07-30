import { useState, useEffect } from "react";

const COOKIE_CONSENT_KEY = "tv.cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      /* ignore localStorage errors */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] animate-[slideUp_0.3s_ease-out] border-t border-white/[.06] bg-[#060d16]/90 px-6 py-4 shadow-[0_-8px_32px_rgba(0,0,0,.4)] backdrop-blur-2xl sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-8">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-medium text-white">Protection de tes données</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            TradeVault utilise des cookies et le stockage local pour assurer le fonctionnement de
            l'application. Aucune donnée personnelle n'est partagée avec des tiers.{" "}
            <a
              href="/privacy"
              className="font-medium text-cyan-300 underline decoration-cyan-400/30 underline-offset-2 hover:decoration-cyan-400 transition-all"
            >
              En savoir plus
            </a>
          </p>
        </div>
      </div>
      <button
        onClick={accept}
        className="btn-primary mt-3 w-full shrink-0 px-6 py-2.5 text-sm font-semibold tracking-wide sm:mt-0 sm:w-auto"
      >
        J'accepte
      </button>
    </div>
  );
}
