import { useState } from "react";
import { Check, Sparkles, Zap, Lock, ArrowRight, X } from "lucide-react";
import { Modal } from "@/shared/ui";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useSubscription } from "../hooks/useSubscription";
import {
  TIER_BY_ID,
  eur,
  monthsFree,
  planId,
  yearlyPerMonth,
  PAGE_VALUE,
  pagesOfTier,
  type Interval,
  type PaidPlan,
  type PaidTier,
  type TierDef,
} from "../utils/pricing";

/**
 * Passer Pro — la modale unique qui s'ouvre sur chaque « Go Pro ».
 *
 * L'utilisateur a DÉJÀ décidé de payer : pas de pitch, pas de bénéfices à
 * répéter. Deux offres (Pro, Elite), mensuel ou annuel, un prix, un bouton.
 * Le code promo (100 % / réduction) reste disponible en une ligne, pour que
 * les clients venus d'une URL `?promo=` ou avec leur code puissent le poser.
 */

const ICONS = { pro: Sparkles, elite: Zap } as const;

export default function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useT();
  const fr = lang === "fr";
  const { checkout } = useSubscription();
  const [interval, setInterval] = useState<Interval>("yearly");
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

  const planFor = (tier: PaidTier): PaidPlan => planId(tier, interval);
  const perMonth = (tier: PaidTier) =>
    eur(
      Math.round((interval === "yearly" ? yearlyPerMonth(tier) : TIER_BY_ID[tier].monthly) * 100) /
        100,
    );

  return (
    <Modal open={open} onClose={onClose} wrapperClassName="z-[110]" className="md:max-w-2xl">
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              {fr ? "Débloque TradeVault" : "Unlock TradeVault"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              {fr
                ? "Toutes les analyses, tes erreurs chiffrées, Monte-Carlo."
                : "Full analytics, your mistakes priced, Monte Carlo."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={fr ? "Fermer" : "Close"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mensuel / Annuel — une seule décision avant l'offre. */}
        <div className="mt-4 flex justify-start">
          <div
            role="tablist"
            aria-label={fr ? "Période de facturation" : "Billing period"}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
          >
            {(["monthly", "yearly"] as const).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={interval === value}
                onClick={() => setInterval(value)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
                  interval === value
                    ? "bg-white text-[#04101a] shadow-lg shadow-black/30"
                    : "text-slate-500 hover:text-slate-200",
                )}
              >
                {value === "monthly" ? (fr ? "Mensuel" : "Monthly") : fr ? "Annuel" : "Yearly"}
                {value === "yearly" && (
                  <span className="ml-1.5 text-[11px] font-bold text-emerald-500">
                    −{monthsFree("pro")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Deux offres, une ligne de prix chacune — Léger, pas de blabla. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["pro", "elite"] as const).map((tier) => {
            const def = TIER_BY_ID[tier] as TierDef & { featured?: boolean };
            const Icon = ICONS[tier];
            const plan = planFor(tier);
            return (
              <div
                key={tier}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-4",
                  tier === "pro"
                    ? "border-cyan-400/30 bg-[linear-gradient(160deg,rgba(14,58,82,.5),rgba(7,14,24,.92)_60%)]"
                    : "border-white/[0.08] bg-white/[0.02]",
                )}
              >
                {tier === "pro" && (
                  <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#041018]">
                    {fr ? "Recommandé" : "Recommended"}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg",
                      tier === "pro"
                        ? "bg-cyan-400/15 text-cyan-300"
                        : "bg-white/[0.06] text-slate-400",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-[.15em]",
                      tier === "pro" ? "text-cyan-300" : "text-slate-400",
                    )}
                  >
                    {def.name[fr ? "fr" : "en"]}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-extrabold tabular-nums tracking-tight text-white">
                    {perMonth(tier)}
                  </span>
                  <span className="text-sm text-slate-400">{fr ? "/mois" : "/mo"}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-slate-500">
                  {interval === "yearly"
                    ? fr
                      ? `Facturé ${eur(def.yearly)}/an · ${monthsFree(tier)} mois offerts`
                      : `Billed ${eur(def.yearly)}/yr · ${monthsFree(tier)} months free`
                    : fr
                      ? "Sans engagement"
                      : "No commitment"}
                </p>

                <div className="mt-3 space-y-1.5">
                  {tier === "pro"
                    ? pagesOfTier("pro")
                        .slice(0, 3)
                        .map((page) => {
                          const v = PAGE_VALUE[page];
                          if (!v) return null;
                          return (
                            <p
                              key={page}
                              className="flex items-start gap-2 text-[12px] leading-snug text-slate-300"
                            >
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                              {v.title[fr ? "fr" : "en"]}
                            </p>
                          );
                        })
                    : def.features.slice(0, 3).map((f) => (
                        <p
                          key={f.en}
                          className="flex items-start gap-2 text-[12px] leading-snug text-slate-300"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                          {f[fr ? "fr" : "en"]}
                        </p>
                      ))}
                  {tier === "pro" && (
                    <p className="pt-0.5 text-[11px] font-semibold text-cyan-300/80">
                      + {pagesOfTier("pro").length - 3}{" "}
                      {fr ? "autres pages Premium" : "more Premium pages"}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => pay(plan)}
                  disabled={busy != null}
                  className={cn(
                    "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60",
                    tier === "pro"
                      ? "bg-gradient-to-r from-cyan-400 to-teal-400 text-[#04101a] shadow-lg shadow-cyan-500/20 hover:brightness-110"
                      : "border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08]",
                  )}
                >
                  {busy === plan ? (
                    fr ? (
                      "Ouverture…"
                    ) : (
                      "Opening…"
                    )
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      {fr ? `Passer à ${def.name.fr}` : `Go ${def.name.en}`}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Code promo — une ligne, pas plus. */}
        <div className="mt-4">
          {promo ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-300">
              <span>{fr ? `Code ${promo} appliqué` : `Code ${promo} applied`}</span>
              <button
                onClick={() => setPromo(undefined)}
                aria-label={fr ? "Retirer le code" : "Remove code"}
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
                placeholder={fr ? "Code promo (facultatif)" : "Promo code (optional)"}
                aria-label={fr ? "Code promo" : "Promo code"}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/40 h-9"
              />
              <button
                onClick={applyCode}
                disabled={!typed.trim()}
                className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50"
              >
                {fr ? "Appliquer" : "Apply"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
            {error}
          </div>
        )}

        <p className="mt-3 text-center text-[10.5px] text-slate-600">
          {fr
            ? "Sans engagement · Annulation en 1 clic · Ton journal reste gratuit"
            : "No commitment · Cancel in one click · Your journal stays free"}
        </p>
      </div>
    </Modal>
  );
}
