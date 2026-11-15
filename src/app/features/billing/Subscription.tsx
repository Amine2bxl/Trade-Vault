import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  PauseCircle,
  RefreshCw,
  Sparkles,
} from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useSubscription, type Subscription as Sub } from "@/app/hooks/useSubscription";
import { cn } from "@/shared/ui/cn";
import {
  LIFETIME_COPY,
  LIFETIME_PLAN,
  TIER_BY_ID,
  eur,
  intervalOf,
  planPrice,
  type PaidPlan,
} from "@/app/utils/pricing";
import { FULL_ACCESS_POINTS, LIMITS, MONTHLY_COPY, MONTHLY_PLAN } from "@/domain/plans";
import { tradesThisMonth } from "@/app/utils/planLimits";
import { usePageLead } from "@/app/contexts/PageActionsContext";
import { Disclosure, PageContainer, ScrollArea } from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import SubscriptionSection from "./SubscriptionSection";
import { etatAbonnement, offerMode, type EtatId } from "./subscriptionState";
import type { Trade } from "@/app/types";

type TFn = (k: TKey) => string;
type Lg = "fr" | "en";

/**
 * ABONNEMENT — trois blocs, des chiffres, une décision.
 *
 * ══ LE RETOUR DU PROPRIÉTAIRE (2026-11-15) ══
 *
 * « Trop de cases, trop de blabla, pas de concret ni de valeur. » La version
 * précédente empilait sept sections : carte d'état, compteur, grille, neuf
 * cartes « ce que ça ouvre », un tableau comparatif de seize lignes, six
 * questions et une bande de garanties. On lisait des noms de fonctionnalités,
 * jamais ce qu'on y gagne.
 *
 * ══ CE QUI RESTE ══
 *
 *   1. L'ÉTAT, avec SES chiffres. Pour un compte gratuit : son compteur du
 *      mois et — quand il en a — le P&L net de ses trades marqués d'une
 *      erreur. Des TOTAUX tirés de ses trades, vrais à toute taille
 *      d'échantillon, affichés avec leur `n`, sans aucune formulation causale
 *      (`computeBehavioral().totalCost` n'est PAS un coût imputable).
 *   2. LES DEUX OFFRES et six résultats concrets (`PricingPlans`) — ou la
 *      seule licence pour qui paie déjà au mois.
 *   3. TROIS questions de facturation, repliées.
 *
 * L'état est décidé UNE fois par `subscriptionState.ts` (pur, testé).
 * `preview` ne sert qu'au banc `/dev/ui` (`&sub=…`).
 */
export default function Subscription({
  trades = [],
  preview,
}: {
  trades?: Trade[];
  preview?: Sub | null;
} = {}) {
  const { t, lang } = useT();
  const lg: Lg = lang === "fr" ? "fr" : "en";
  const live = useSubscription();
  const sub = preview !== undefined ? preview : live.sub;
  const loading = preview !== undefined ? false : live.loading;
  const { boxRef, height } = useAvailableHeight();
  const [busy, setBusy] = useState(false);

  const etat = useMemo(() => etatAbonnement(sub), [sub]);
  const mode = offerMode(sub, etat);
  const paid = etat !== "free";
  const lifetime = sub?.plan === LIFETIME_PLAN;
  const meta = ETATS[etat];

  const nomOffre = !paid
    ? TIER_BY_ID.free.name[lg]
    : lifetime
      ? LIFETIME_COPY.title[lg]
      : sub?.plan === MONTHLY_PLAN
        ? MONTHLY_COPY.title[lg]
        : TIER_BY_ID[sub?.plan.startsWith("pro") ? "pro" : "elite"].name[lg];

  const dateFmt = useCallback(
    (d: Date) => d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }),
    [lang],
  );
  const fin = sub?.currentPeriodEnd ? dateFmt(sub.currentPeriodEnd) : null;

  /* Portail Stripe quand il existe (reprendre, changer de carte, résilier,
     factures) ; un ancien accès crypto se reprend par une nouvelle charge —
     jamais pour une licence, qui possède déjà tout. */
  const agir = useCallback(async () => {
    if (!sub || busy || preview !== undefined) return;
    setBusy(true);
    if (sub.hasStripeCustomer) await live.openPortal();
    else if (sub.source === "crypto" && sub.plan !== "free" && !lifetime)
      await live.cryptoCheckout(sub.plan as PaidPlan);
    setBusy(false);
  }, [sub, busy, preview, live, lifetime]);

  const actionDisponible =
    !!sub &&
    meta.action !== null &&
    (sub.hasStripeCustomer || (sub.source === "crypto" && !lifetime));

  const aUnAbonnement = !!sub;
  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg tv-accent-fill">
          <Crown className="h-3.5 w-3.5" />
        </span>
        <span className="font-display shrink-0 text-sm font-bold tracking-tight text-white">
          {loading ? "TradeVault" : `TradeVault · ${nomOffre}`}
        </span>
        {!loading && aUnAbonnement && <Pastille etat={etat} t={t} />}
      </div>
    ),
    // Des valeurs, pas l'objet `sub` : son identité change à chaque lecture.
    [etat, loading, nomOffre, aUnAbonnement, t],
  );
  usePageLead(lead);

  const prix = paid && sub ? eur(planPrice(sub.plan as PaidPlan), lang) : eur(0, lang);
  const rythme = !paid
    ? t("sub.forever")
    : lifetime
      ? LIFETIME_COPY.priceNote[lg]
      : intervalOf(sub?.plan ?? "free") === "yearly"
        ? t("billing.perYear")
        : t("billing.perMonth");

  /* Les faits d'un abonnement, sur UNE ligne de texte — plus trois cases. */
  const faits =
    sub && paid && !lifetime
      ? [
          fin
            ? `${sub.cancelAtPeriodEnd ? t("billing.accessUntil") : t("sub.nextBilling")} ${fin}`
            : null,
          sub.source === "crypto"
            ? t("sub.payCrypto")
            : sub.source === "stripe"
              ? t("sub.payCard")
              : t("sub.payComp"),
          sub.cancelAtPeriodEnd
            ? t("sub.renewStopped")
            : sub.source === "stripe"
              ? t("sub.renewAuto")
              : sub.source === "crypto"
                ? t("sub.renewManual")
                : null,
        ].filter(Boolean)
      : [];

  // Pleine largeur de page, contenu CENTRÉ : la page d'achat n'est pas une
  // colonne de réglages alignée à gauche.
  return (
    <PageContainer ref={boxRef} fit height={height}>
      <ScrollArea className="tv-grow space-y-6 pb-4">
        {/* ══ 1 · L'ÉTAT ═══════════════════════════════════════════════════
            Au gratuit, un BANDEAU compact (l'offre, le compteur du mois) :
            une grande carte « Gratuit · 0 € » en tête de page disait surtout
            ce qu'on n'a pas. La carte d'achat prend la place du héros.
            Pour un abonné, la carte d'adhésion garde son rôle. */}
        {!loading && etat === "free" ? (
          <Bandeau trades={trades} t={t} nom={nomOffre} prix={prix} />
        ) : (
          <section
            className={cn(
              "sub-hero",
              etat === "cancelling" && "sub-hero-cancelling",
              etat === "pastDue" && "sub-hero-pastDue",
            )}
            aria-busy={loading}
          >
            <div className="sub-hero-top">
              <div className="min-w-0 flex-1">
                <p className="tv-label text-slate-500">{t("subpage.yourPlan")}</p>
                <h1 className={cn("sub-hero-title", meta.titleClass)}>
                  {loading ? (
                    <span className="inline-block h-7 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
                  ) : (
                    <>
                      {paid && "TradeVault "}
                      <span className={paid ? "sub-hero-tier" : undefined}>{nomOffre}</span>
                    </>
                  )}
                </h1>
                {!loading && (
                  <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-400">
                    {meta.body(t, fin)}
                  </p>
                )}
              </div>
              {!loading && (
                <div className="sub-hero-price">
                  <div className="tv-figure text-3xl leading-none text-white md:text-4xl">
                    {prix}
                  </div>
                  <div className="tv-row-label mt-1.5">{rythme}</div>
                </div>
              )}
            </div>

            {!loading && faits.length > 0 && (
              <p className="mt-4 text-[13px] text-slate-300">{faits.join(" · ")}</p>
            )}

            {!loading && actionDisponible && (
              <div className="sub-hero-foot">
                <button
                  onClick={() => void agir()}
                  disabled={busy}
                  className={cn(
                    "flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 sm:w-auto",
                    meta.actionStrong
                      ? "tv-accent-fill"
                      : "border border-[var(--tv-border-strong)] bg-[var(--tv-plate-3)] text-slate-100 hover:border-[var(--tv-border-accent)]",
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <meta.actionIcon className="h-4 w-4" />
                  )}
                  {meta.action!(t)}
                  {!busy && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ══ 2 · LA CARTE D'ACHAT — ou, pour une licence, ce qu'elle contient ══ */}
        {!loading && mode !== "none" && (
          <div className="tv-glow">
            {/* La FAQ loge sous le bouton : toute la page tient dans l'écran. */}
            <SubscriptionSection trades={trades} preview={preview} aside={<Faq t={t} />} />
          </div>
        )}

        {!loading && mode === "none" && (
          <section
            className="mx-auto max-w-[1040px] space-y-4"
            aria-labelledby="sub-included-title"
          >
            <h2 id="sub-included-title" className="subp-title">
              {t("subpage.included")}
            </h2>
            <ul className="offer-points">
              {FULL_ACCESS_POINTS.map((p) => (
                <li key={p.en} className="offer-point">
                  <span className="offer-point-icon" aria-hidden>
                    <Check className="h-4 w-4" />
                  </span>
                  {p[lg]}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ══ 3 · TROIS QUESTIONS, REPLIÉES ════════════════════════════════ */}
        {!loading && mode === "none" && (
          <>
            <div className="mx-auto max-w-[1040px]">
              <Faq t={t} />
            </div>
            <p className="flex items-center justify-center gap-2 pb-2 text-[11.5px] text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              {t("subpage.trust")}
            </p>
          </>
        )}
      </ScrollArea>
    </PageContainer>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LE BANDEAU DU GRATUIT — l'offre et le compteur, sur une ligne
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * Le compteur vient de `tradesThisMonth`, la même fonction que celle qui
 * bloque la saisie au-delà de la limite : ce qu'on lit ici est exactement ce
 * qui bloquera.
 */
function Bandeau({ trades, t, nom, prix }: { trades: Trade[]; t: TFn; nom: string; prix: string }) {
  const limite = LIMITS.free.tradesPerMonth;
  const notes = Math.min(tradesThisMonth(trades), limite);
  const plein = notes >= limite;
  return (
    <section className="sub-strip" aria-label={t("subpage.yourPlan")}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="tv-label text-slate-500">{t("subpage.yourPlan")}</span>
        <span className="text-[14px] font-semibold text-white">{nom}</span>
        <span className="tv-figure text-[13px] text-slate-400">{prix}</span>
      </div>
      <div className="flex min-w-0 basis-full items-center gap-3 sm:max-w-[320px] sm:flex-1 sm:basis-auto">
        <div
          className="subp-meter flex-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuenow={notes}
        >
          <span
            className={cn("subp-meter-fill", plein && "subp-meter-fill--full")}
            style={{ transform: `scaleX(${notes / limite})` }}
          />
        </div>
        <span className={cn("shrink-0 text-[12.5px]", plein ? "text-amber-300" : "text-slate-400")}>
          <span className="tv-figure font-semibold">
            {notes}/{limite}
          </span>{" "}
          {t("subpage.num.trades")}
        </span>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   TROIS QUESTIONS
   ──────────────────────────────────────────────────────────────────────────*/

const FAQ: [TKey, TKey][] = [
  ["subpage.faq.q1", "subpage.faq.a1"],
  ["subpage.faq.q2", "subpage.faq.a2"],
  ["subpage.faq.q3", "subpage.faq.a3"],
];

function Faq({ t }: { t: TFn }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  return (
    <section className="space-y-1" aria-label={t("subpage.faq.title")}>
      {FAQ.map(([q, a], i) => (
        <Disclosure
          key={q}
          title={t(q)}
          open={ouverte === i}
          onChange={(o) => setOuverte(o ? i : null)}
        >
          <p className="pb-2 text-[13px] leading-6 text-slate-400">{t(a)}</p>
        </Disclosure>
      ))}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LES SEPT ÉTATS — l'apparence de chacun
   ──────────────────────────────────────────────────────────────────────────*/

interface EtatMeta {
  icon: typeof Crown;
  titleClass: string;
  body: (t: TFn, fin: string | null) => string;
  /** Libellé de l'action principale — `null` quand l'état n'en propose pas. */
  action: ((t: TFn) => string) | null;
  actionIcon: typeof Crown;
  /** L'action est-elle l'action PRINCIPALE de la page (plein) ? */
  actionStrong: boolean;
}

const ETATS: Record<EtatId, EtatMeta> = {
  free: {
    icon: Sparkles,
    titleClass: "text-white",
    body: (t) => t("subscription.goProToPrice"),
    action: null,
    actionIcon: Sparkles,
    actionStrong: true,
  },
  trialing: {
    icon: Sparkles,
    titleClass: "text-white",
    body: (t, fin) =>
      fin
        ? t("subscription.yourTrialRunsUntil").replace("{a}", String(fin))
        : t("subscription.yourTrialIsRunning"),
    action: (t) => t("subscription.manageSubscription"),
    actionIcon: CreditCard,
    actionStrong: false,
  },
  active: {
    icon: CheckCircle2,
    titleClass: "text-white",
    body: (t) => t("subscription.yourAccessIsActive"),
    action: (t) => t("subscription.manageSubscription"),
    actionIcon: CreditCard,
    actionStrong: false,
  },
  /* Ambre, pas rouge : rien n'est cassé, l'accès court toujours — mais il a
     une fin, et cette fin est la première chose écrite. */
  cancelling: {
    icon: PauseCircle,
    titleClass: "text-amber-200",
    body: (t, fin) =>
      fin
        ? t("subscription.youKeepFullAccess").replace("{a}", String(fin))
        : t("subscription.yourSubscriptionWonT"),
    action: (t) => t("subscription.reactivateMySubscription"),
    actionIcon: RefreshCw,
    actionStrong: true,
  },
  pastDue: {
    icon: AlertTriangle,
    titleClass: "text-red-200",
    body: (t) => t("subscription.theLastChargeDidn"),
    action: (t) => t("subscription.updateMyCard"),
    actionIcon: CreditCard,
    actionStrong: true,
  },
  expired: {
    icon: AlertTriangle,
    titleClass: "text-white",
    body: (t) => t("subscription.yourProAccessHas"),
    action: (t) => t("subscription.restartMySubscription"),
    actionIcon: RefreshCw,
    actionStrong: true,
  },
  lifetime: {
    icon: Crown,
    titleClass: "text-white",
    body: (t) => t("subscription.allOfTradevaultIs"),
    // Une licence n'a rien à gérer… sauf ses factures, quand un client Stripe
    // existe : le portail les garde.
    action: (t) => t("subpage.invoices"),
    actionIcon: FileText,
    actionStrong: false,
  },
};

/** La pastille de la barre de tête — le même état, en un mot. */
function Pastille({ etat, t }: { etat: EtatId; t: TFn }) {
  const style: Record<EtatId, string> = {
    free: "bg-white/[0.05] border-white/[0.08] text-slate-400",
    trialing:
      "bg-[rgb(var(--tv-accent-rgb)/0.12)] border-[var(--tv-border-accent)] text-[var(--tv-highlight)]",
    active: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
    cancelling: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    pastDue: "bg-red-500/10 border-red-500/25 text-red-300",
    expired: "bg-white/[0.05] border-white/[0.08] text-slate-400",
    lifetime: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  };
  const mot: Record<EtatId, string> = {
    free: t("billing.freePlan"),
    trialing: t("billing.active"),
    active: t("billing.active"),
    cancelling: t("billing.cancelsAtPeriodEnd"),
    pastDue: t("billing.pastDue"),
    expired: t("subscription.ended"),
    lifetime: t("subscription.complimentary"),
  };
  const Icone = ETATS[etat].icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        style[etat],
      )}
    >
      <Icone className="h-3 w-3" />
      <span className="truncate">{mot[etat]}</span>
    </span>
  );
}
