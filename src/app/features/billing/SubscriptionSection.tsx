import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  Dices,
  FileText,
  Infinity as InfinityIcon,
  Loader2,
  TriangleAlert,
  X,
} from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { useSubscription, type Subscription } from "@/app/hooks/useSubscription";
import { Input } from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import PrixAnime from "./PrixAnime";
import {
  FULL_ACCESS_POINTS,
  LIFETIME_COPY,
  LIFETIME_EUR,
  LIFETIME_PLAN,
  MONTHLY_COPY,
  MONTHLY_EUR,
  MONTHLY_PLAN,
  breakEvenShort,
  type SalePlan,
} from "@/domain/plans";
import { computeBehavioral } from "@/domain/behavioral";
import { formatPnl } from "@/domain/tradeCalcs";
import { eur } from "@/app/utils/pricing";
import { checkoutErrorKey, etatAbonnement, offerMode } from "./subscriptionState";
import type { Trade } from "@/app/types";

/**
 * LA CARTE D'ACHAT — un seul objet, une seule décision.
 *
 * ── POURQUOI ELLE A ÉTÉ REFAITE (2026-11-15, retour du propriétaire) ──────
 *
 * « La page ne donne pas du tout envie. » Deux cartes de prix côte à côte se
 * lisent comme un tableau à comparer ; on pèse, on hésite, on repart. Les
 * écrans d'achat qui convertissent (Revolut, les apps d'Apple) posent UNE
 * carte : une promesse, ce que TOI tu y gagnes, un choix de formule en deux
 * lignes, UN bouton dont le prix suit le choix.
 *
 *   1. La promesse, en une phrase, et SES chiffres : le P&L net de ses
 *      trades marqués d'une erreur, avec leur nombre — un total réel, jamais
 *      présenté comme une cause (`computeBehavioral().totalCost`).
 *   2. Le choix : deux lignes sélectionnables (des vrais boutons radio),
 *      la licence choisie par défaut. Pour qui paie déjà au mois : la
 *      licence seule.
 *   3. UN bouton plein, dont le montant roule quand on change de ligne
 *      (`PrixAnime`), puis la garantie qui va avec la formule choisie.
 *   4. Les six résultats (`FULL_ACCESS_POINTS`), sous un filet.
 *
 * Utilisée par la page Abonnement ET la fenêtre d'achat (`UpgradeModal`) :
 * un trader retrouve exactement le même objet partout où il paie.
 *
 * `preview` (banc `/dev/ui` seulement) impose un abonnement fictif : aucun
 * paiement ne part de là.
 */

/** L'icône de chaque résultat — même ordre que `FULL_ACCESS_POINTS`. */
const ICONES: ComponentType<{ className?: string }>[] = [
  InfinityIcon,
  TriangleAlert,
  Clock,
  Bot,
  Dices,
  FileText,
];

export default function SubscriptionSection({
  trades = [],
  preview,
  compact = false,
  aside,
}: {
  /** Les trades du compte — pour LES chiffres de la promesse. */
  trades?: Trade[];
  preview?: Subscription | null;
  /** Dans une fenêtre : pas d'accroche, la fenêtre porte déjà son titre. */
  compact?: boolean;
  /** Sous le bouton, dans la colonne d'achat (page Abonnement : la FAQ). */
  aside?: ReactNode;
} = {}) {
  const { t, lang } = useT();
  const lg = lang === "fr" ? "fr" : "en";
  const live = useSubscription();
  const sub = preview !== undefined ? preview : live.sub;
  const loading = preview !== undefined ? false : live.loading;
  const mode = offerMode(sub, etatAbonnement(sub));
  const upgrade = mode === "upgrade";

  const [choix, setChoix] = useState<SalePlan>(LIFETIME_PLAN);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [promoOuvert, setPromoOuvert] = useState(false);
  const [promo, setPromo] = useState<string | undefined>(() =>
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("promo") ?? undefined)
      : undefined,
  );

  // Un abonné mensuel ne peut plus choisir le mensuel : seule la licence.
  useEffect(() => {
    if (upgrade) setChoix(LIFETIME_PLAN);
  }, [upgrade]);

  const erreurs = useMemo(() => computeBehavioral(trades), [trades]);

  if (loading) {
    // Pas de squelette : la place est tenue, la carte arrive d'un geste.
    return <div className="min-h-[420px]" aria-busy="true" />;
  }
  if (mode === "none") return null;

  const lifetime = choix === LIFETIME_PLAN;
  const prix = eur(lifetime ? LIFETIME_EUR : MONTHLY_EUR, lang);

  const payer = async () => {
    if (preview !== undefined || busy) return;
    setBusy(choix);
    setError(null);
    const err = await live.checkout(choix, promo);
    if (err) {
      setError(t(checkoutErrorKey(err)));
      setBusy(null);
    }
    // En cas de succès le navigateur part chez Stripe : le bouton reste occupé.
  };
  const appliquer = () => {
    const clean = typed.trim().toUpperCase();
    if (clean) {
      setPromo(clean);
      setTyped("");
      setPromoOuvert(false);
    }
  };

  const options: { plan: SalePlan; nom: string; montant: string; rythme: string; aide: string }[] =
    [
      ...(upgrade
        ? []
        : [
            {
              plan: MONTHLY_PLAN as SalePlan,
              nom: MONTHLY_COPY.title[lg],
              montant: eur(MONTHLY_EUR, lang),
              rythme: MONTHLY_COPY.priceNote[lg],
              aide: MONTHLY_COPY.badge[lg],
            },
          ]),
      {
        plan: LIFETIME_PLAN,
        nom: LIFETIME_COPY.title[lg],
        montant: eur(LIFETIME_EUR, lang),
        rythme: LIFETIME_COPY.priceNote[lg],
        aide: breakEvenShort(lg),
      },
    ];

  /* LE CHOIX ET L'ACHAT — colonne de droite sur ordinateur. */
  const achat = (
    <div className="pw-buy">
      <fieldset className="pw-options">
        <legend className="sr-only">{t("subpage.pw.choose")}</legend>
        {options.map((o) => {
          const actif = choix === o.plan;
          return (
            <label key={o.plan} className="pw-option" data-actif={actif ? "oui" : "non"}>
              <input
                type="radio"
                name="tv-plan"
                value={o.plan}
                checked={actif}
                onChange={() => setChoix(o.plan)}
                className="sr-only"
              />
              <span className="pw-radio" aria-hidden>
                <Check className="pw-radio-check h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">{o.nom}</span>
                <span className="block text-[12.5px] text-slate-400">{o.aide}</span>
              </span>
              <span className="text-right">
                <span className="tv-figure block text-[17px] font-bold text-white">
                  {o.montant}
                </span>
                <span className="block text-[11.5px] text-slate-500">{o.rythme}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {error && (
        <p role="alert" className="pw-error">
          {error}
        </p>
      )}

      {promo && (
        <p className="pw-promo">
          <span className="min-w-0 flex-1 truncate">
            {t("billing.promoApplied").replace("{code}", promo)}
          </span>
          <button
            type="button"
            onClick={() => setPromo(undefined)}
            aria-label={t("billing.promoRemove")}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-emerald-300/70 transition hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}

      {/* UN bouton. Son montant roule au changement de formule. */}
      <button
        type="button"
        onClick={() => void payer()}
        disabled={busy !== null}
        className="btn-primary pw-cta"
      >
        {busy === choix ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <>
            <span>{lifetime ? t("subpage.pw.ctaLifetime") : t("subpage.pw.ctaMonthly")}</span>
            <PrixAnime valeur={prix} className="tv-figure" />
            {!lifetime && <span>{t("subpage.pw.perMonthShort")}</span>}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
      <p className="pw-trust">
        {lifetime ? LIFETIME_COPY.trust[lg] : t("subpage.pw.trustMonthly")}
      </p>

      {/* Le paiement en crypto a quitté l'interface (décision du
          propriétaire, 2026-11-15) : la carte bancaire via Stripe suffit. */}
      {!promo && !promoOuvert && (
        <div className="pw-links">
          <button type="button" onClick={() => setPromoOuvert(true)} className="pw-link">
            {t("subpage.promoLink")}
          </button>
        </div>
      )}
      {!promo && promoOuvert && (
        <div className="mt-3 flex gap-2">
          <Input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && appliquer()}
            placeholder={t("billing.promoPlaceholder")}
            aria-label={t("billing.promoLabel")}
            className="uppercase"
          />
          <button
            type="button"
            onClick={appliquer}
            disabled={!typed.trim()}
            className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {t("billing.promoApply")}
          </button>
        </div>
      )}
      {aside && <div className="pw-aside">{aside}</div>}
    </div>
  );

  /* LA PROMESSE ET CE QU'ELLE CONTIENT — colonne de gauche sur ordinateur. */
  const promesse = (
    <div className="pw-pitch">
      {!compact && (
        <header>
          <p className="pw-eyebrow">{t("subpage.pw.eyebrow")}</p>
          <h2 id="pw-title" className="pw-title">
            {upgrade ? t("subpage.upsell.title") : t("subpage.pw.title")}
          </h2>
          <p className="pw-sub">{upgrade ? t("subpage.upsell.sub") : t("subpage.pw.sub")}</p>
        </header>
      )}

      {/* SES CHIFFRES. Un total réel, avec son nombre de trades — rien
          d'inventé, rien de causal. Absent tant qu'aucun trade n'est marqué. */}
      {!upgrade && erreurs.tradesWithMistakes > 0 && (
        <p className={cn("pw-teaser", compact && "mt-0")}>
          <span
            className={cn(
              "tv-figure pw-teaser-figure",
              erreurs.totalCost < 0 ? "text-[var(--tv-chart-red)]" : "text-[var(--tv-chart-green)]",
            )}
          >
            {formatPnl(erreurs.totalCost)}
          </span>
          <span>{t("subpage.pw.teaser").replace("{n}", String(erreurs.tradesWithMistakes))}</span>
        </p>
      )}

      {/* LES SIX RÉSULTATS — pour les deux formules. */}
      <ul className="pw-points">
        {FULL_ACCESS_POINTS.map((p, i) => {
          const Ico = ICONES[i] ?? Check;
          return (
            <li key={p.en} className="offer-point">
              <span className="offer-point-icon" aria-hidden>
                <Ico className="h-4 w-4" />
              </span>
              {p[lg]}
            </li>
          );
        })}
      </ul>
    </div>
  );

  /* SUR ORDINATEUR, DEUX COLONNES : tout tient dans l'écran, sans défiler —
     la promesse à gauche, le choix et le bouton à droite. Dans une fenêtre
     ou sur téléphone, une seule colonne, le choix d'abord. */
  return (
    <article
      className={cn("pw-card", compact ? "pw-card--bare pw-card--stack" : "pw-card--split")}
      aria-labelledby={compact ? undefined : "pw-title"}
    >
      {compact ? (
        <>
          {achat}
          {promesse}
        </>
      ) : (
        <>
          {promesse}
          {achat}
        </>
      )}
    </article>
  );
}
