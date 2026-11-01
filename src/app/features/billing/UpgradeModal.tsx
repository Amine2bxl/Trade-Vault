import { useState } from "react";
import { X } from "@/shared/ui/icons";
import { Modal } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import type { PaidPlan } from "@/app/utils/pricing";
import LifetimeOffer from "./LifetimeOffer";

/**
 * Passer Pro — la modale unique qui s'ouvre sur chaque « Go Pro ».
 *
 * L'utilisateur a DÉJÀ décidé de payer : pas de pitch, pas de bénéfices à
 * répéter. Deux offres (Pro, Elite), mensuel ou annuel, un prix, un bouton.
 * Le code promo (100 % / réduction) reste disponible en une ligne, pour que
 * les clients venus d'une URL `?promo=` ou avec leur code puissent le poser.
 */

export default function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const fr = lang === "fr";
  const { checkout } = useSubscription();
  const [typed, setTyped] = useState("");
  const [promo, setPromo] = useState<string | undefined>(
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("promo") ?? undefined)
      : undefined,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pay = async (plan: PaidPlan) => {
    if (busy) return;
    setBusy(plan);
    setError(null);
    const err = await checkout(plan, promo);
    if (err) {
      setError(err);
      setBusy(null);
    }
  };

  const applyCode = () => {
    const clean = typed.trim().toUpperCase();
    if (clean) {
      setPromo(clean);
      setTyped("");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wrapperClassName="z-[var(--tv-z-modal-top)]"
      className="md:max-w-2xl"
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-bold tracking-tight text-white">
              {t("upgrade.unlockTradevault")}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {t("upgrade.fullAnalyticsYourMistakes")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("upgrade.close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* L'OFFRE UNIQUE : la licence à vie. Plus de bascule mensuel/annuel ni
            de paliers à comparer — un prix, payé une fois. */}
        <LifetimeOffer
          lang={fr ? "fr" : "en"}
          busy={busy != null}
          onChoose={(plan) => void pay(plan)}
          className="mt-4"
        />

        {/* Code promo — une ligne, pas plus. */}
        <div className="mt-4">
          {promo ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-300">
              <span>{t("upgrade.codeAApplied").replace("{a}", String(promo))}</span>
              <button
                onClick={() => setPromo(undefined)}
                aria-label={t("upgrade.removeCode")}
                className="grid h-6 w-6 place-items-center rounded-md text-emerald-300/70 hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyCode()}
                placeholder={t("upgrade.promoCodeOptional")}
                aria-label={t("upgrade.promoCode")}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/40 h-9"
              />
              <button
                onClick={applyCode}
                disabled={!typed.trim()}
                className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50"
              >
                {t("upgrade.apply")}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
            {error}
          </div>
        )}

        <p className="mt-3 text-center text-[11px] text-slate-600">
          {t("upgrade.noCommitmentCancelIn")}
        </p>
      </div>
    </Modal>
  );
}
