import { useState } from "react";
import { Cookie, ShieldCheck } from "lucide-react";
import { Modal } from "@/shared/ui";

const COOKIE_CONSENT_KEY = "tv.cookie-consent";

/**
 * CookieConsent — bouton DISCRET en bas à gauche (plus de bannière).
 * Au clic : une modale cohérente avec le Design System (fond flouté,
 * animations, composants réutilisés). Comportement identique : le
 * consentement est mémorisé dans localStorage.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      /* ignore localStorage errors */
    }
    setOpen(false);
  };

  return (
    <>
      {/* Bouton discret — en bas à gauche, toujours visible */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Préférences de cookies"
        className="fixed bottom-4 left-4 z-[200] flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-[11px] font-semibold text-slate-500 backdrop-blur-md transition-all hover:border-cyan-500/30 hover:bg-white/[.06] hover:text-slate-200"
      >
        <Cookie className="w-3.5 h-3.5" /> Cookies
      </button>

      <Modal open={open} onClose={() => setOpen(false)} className="md:max-w-md">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="relative shrink-0">
              <span className="absolute -inset-0.5 rounded-lg bg-cyan-500/30 blur-sm" />
              <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
                <ShieldCheck className="w-4 h-4 text-white" />
              </span>
            </span>
            <h2 className="text-base font-bold text-white">Protection de tes données</h2>
          </div>
          <p className="text-sm leading-6 text-slate-300">
            TradeVault utilise des cookies et le stockage local pour assurer le fonctionnement de
            l'application. Aucune donnée personnelle n'est partagée avec des tiers.
          </p>
          <div className="mt-4 rounded-xl border border-white/[.06] bg-white/[.02] px-3.5 py-3 text-xs leading-5 text-slate-400">
            En acceptant, tu permets à TradeVault de mémoriser tes préférences et d'assurer une
            expérience fluide. Tu peux retirer ton consentement à tout moment en effaçant les
            données de navigation.
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-white/[.06]">
          <a
            href="/privacy"
            className="text-xs font-semibold text-cyan-300 underline decoration-cyan-400/30 underline-offset-2 hover:decoration-cyan-400 transition-all"
          >
            En savoir plus
          </a>
          <button
            onClick={accept}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110"
          >
            J'accepte
          </button>
        </div>
      </Modal>
    </>
  );
}
