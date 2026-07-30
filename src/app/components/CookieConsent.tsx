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
    } catch { /* ignore localStorage errors */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] border-t border-white/[.08] bg-[#060d16]/95 px-4 py-3 backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:px-6">
      <p className="text-xs leading-5 text-slate-400 sm:max-w-[640px]">
        TradeVault utilise des cookies et le stockage local pour assurer le fonctionnement de
        l'application. En continuant, tu acceptes notre{" "}
        <a href="/privacy" className="underline hover:text-slate-300">
          Politique de confidentialité
        </a>
        .
      </p>
      <button
        onClick={accept}
        className="btn-primary mt-3 w-full shrink-0 px-5 py-2 text-xs sm:mt-0 sm:w-auto"
      >
        Accepter
      </button>
    </div>
  );
}
