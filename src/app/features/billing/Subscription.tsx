import { useCallback, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bitcoin,
  Bot,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Dices,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Lock,
  Minus,
  Newspaper,
  PauseCircle,
  RefreshCw,
  Sparkles,
  Target,
} from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useSubscription, type Subscription as Sub } from "@/app/hooks/useSubscription";
import { cn } from "@/shared/ui/cn";
import {
  LIFETIME_COPY,
  LIFETIME_PLAN,
  PAGE_VALUE,
  TIER_BY_ID,
  eur,
  intervalOf,
  planPrice,
  type PaidPlan,
} from "@/app/utils/pricing";
import { LIMITS, MONTHLY_COPY, MONTHLY_PLAN, breakEvenCopy } from "@/domain/plans";
import { tradesThisMonth } from "@/app/utils/planLimits";
import { usePageLead } from "@/app/contexts/PageActionsContext";
import {
  Disclosure,
  Kpi,
  KpiGrid,
  PageContainer,
  ScrollArea,
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import SubscriptionSection from "./SubscriptionSection";
import { etatAbonnement, offerMode, type EtatId } from "./subscriptionState";
import type { Page, Trade } from "@/app/types";

type TFn = (k: TKey) => string;
type Lg = "fr" | "en";

/**
 * ABONNEMENT — refaite en novembre 2026, avec les deux offres.
 *
 * ══ LE PROBLÈME ══
 *
 * La page disait l'état de l'abonnement, puis posait la grille de prix — et
 * s'arrêtait là. Un trader sur l'offre gratuite voyait deux prix sans savoir
 * ce qu'ils ouvraient ; un abonné mensuel ne savait pas qu'il pouvait passer
 * à la licence ; un titulaire de licence lisait « 49 € / mois ». Et l'état
 * était recalculé à deux endroits (ici et dans le bloc d'achat).
 *
 * ══ L'ORDRE DE LECTURE SUIT LA DÉCISION ══
 *
 *   1. Où j'en suis         la carte d'adhésion (état, prix, faits, action)
 *   2. Ce que je consomme   le compteur du mois — gratuit seulement, chiffres
 *                           RÉELS tirés de ses trades, jamais estimés
 *   3. Ce que je peux faire choisir une offre, ou passer à la licence
 *   4. Ce que ça ouvre      les pages payantes, chacune avec ce qu'elle apporte
 *   5. Ce qui change        le comparatif gratuit / accès complet
 *   6. Ce qui rassure       les questions de facturation, les garanties
 *
 * L'état est décidé UNE fois par `subscriptionState.ts` (pur, testé) ; la
 * page et le bloc d'achat lisent la même réponse.
 *
 * `preview` ne sert qu'au banc `/dev/ui` : il montre la page dans un état
 * donné (mensuel, licence, annulé…) sans session Stripe.
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

  const nomOffre = paid
    ? lifetime
      ? LIFETIME_COPY.title[lg]
      : sub?.plan === MONTHLY_PLAN
        ? MONTHLY_COPY.title[lg]
        : TIER_BY_ID[sub?.plan.split("_")[0] === "pro" ? "pro" : "elite"].name[lg]
    : TIER_BY_ID.free.name[lg];

  const dateFmt = useCallback(
    (d: Date) => d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }),
    [lang],
  );
  const fin = sub?.currentPeriodEnd ? dateFmt(sub.currentPeriodEnd) : null;

  /* L'action de l'état passe par le portail Stripe quand il existe (c'est
     lui qui sait reprendre, changer de carte, résilier) ; un ancien accès
     crypto se reprend par une nouvelle charge. */
  const agir = useCallback(async () => {
    if (!sub || busy || preview !== undefined) return;
    setBusy(true);
    if (sub.hasStripeCustomer) await live.openPortal();
    else if (sub.source === "crypto" && sub.plan !== "free" && !lifetime)
      await live.cryptoCheckout(sub.plan as PaidPlan);
    setBusy(false);
  }, [sub, busy, preview, live, lifetime]);

  /* Une licence n'a que ses factures à consulter, et seulement quand un
     client Stripe existe : relancer une charge crypto lui revendrait ce
     qu'elle possède déjà. */
  const actionDisponible =
    !!sub &&
    meta.action !== null &&
    (sub.hasStripeCustomer || (sub.source === "crypto" && !lifetime));

  const aUnAbonnement = !!sub;
  /* L'en-tête monte dans la barre de tête — comme Réglages et Profil. */
  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-lg",
            etat === "active" || etat === "lifetime"
              ? "bg-emerald-500 text-white"
              : "tv-accent-fill",
          )}
        >
          <Crown className="h-3.5 w-3.5" />
        </span>
        <span className="font-display shrink-0 text-sm font-bold tracking-tight text-white">
          {loading ? "TradeVault" : `TradeVault · ${nomOffre}`}
        </span>
        {!loading && aUnAbonnement && <Pastille etat={etat} t={t} />}
      </div>
    ),
    // Des valeurs, pas l'objet `sub` : son identité change à chaque lecture,
    // et la barre de tête se reposerait en boucle.
    [etat, loading, nomOffre, aUnAbonnement, t],
  );
  usePageLead(lead);

  /* Le prix affiché sur la carte : celui que le trader paie, avec son rythme.
     Une licence n'a pas de rythme — elle se lit « une fois · à vie ». */
  const prix = paid && sub ? eur(planPrice(sub.plan as PaidPlan), lang) : eur(0, lang);
  const rythme = !paid
    ? t("sub.forever")
    : lifetime
      ? LIFETIME_COPY.priceNote[lg]
      : intervalOf(sub?.plan ?? "free") === "yearly"
        ? t("billing.perYear")
        : t("billing.perMonth");

  return (
    <PageContainer ref={boxRef} measure="settings" fit height={height}>
      <ScrollArea className="tv-grow space-y-6 pb-4">
        {/* ══ 1 · LA CARTE D'ADHÉSION ══════════════════════════════════════
            Une carte de membre lue de haut en bas : l'offre et son état, le
            prix, les faits sur une ligne, l'action. La couleur de l'état reste
            celle qui ne se rate pas — une annulation se voit au premier
            regard. */}
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {sub && <Pastille etat={etat} t={t} />}
                </div>
              )}
              <p className="tv-prose mt-3 max-w-xl text-slate-400">
                {loading ? t("sub.loading") : meta.body(t, fin)}
              </p>
            </div>

            {!loading && (
              <div className="sub-hero-price">
                <div className="tv-figure text-3xl leading-none text-white md:text-4xl">{prix}</div>
                <div className="tv-row-label mt-1.5">{rythme}</div>
              </div>
            )}
          </div>

          {/* LES FAITS — seulement quand il y en a. Une licence n'a ni
              échéance ni renouvellement : trois cases « — » ne disent rien. */}
          {!loading && sub && paid && !lifetime && (
            <KpiGrid className="sub-hero-facts">
              <Kpi
                inset
                label={sub.cancelAtPeriodEnd ? t("billing.accessUntil") : t("sub.nextBilling")}
                value={fin ?? "—"}
                tone={sub.cancelAtPeriodEnd ? "warn" : "neutral"}
                adornment={<CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
              />
              <Kpi
                inset
                label={t("sub.payment")}
                value={
                  sub.source === "crypto"
                    ? t("sub.payCrypto")
                    : sub.source === "stripe"
                      ? t("sub.payCard")
                      : t("sub.payComp")
                }
                adornment={
                  sub.source === "crypto" ? (
                    <Bitcoin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  ) : (
                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )
                }
              />
              <Kpi
                inset
                label={t("sub.renewal")}
                value={
                  sub.cancelAtPeriodEnd
                    ? t("sub.renewStopped")
                    : sub.source === "crypto"
                      ? t("sub.renewManual")
                      : sub.source === "stripe"
                        ? t("sub.renewAuto")
                        : "—"
                }
                tone={sub.cancelAtPeriodEnd ? "warn" : "neutral"}
                adornment={<RefreshCw className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
              />
            </KpiGrid>
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
              {sub?.hasStripeCustomer && !lifetime && (
                <p className="tv-row-label max-w-md">{t("billing.portalHint")}</p>
              )}
            </div>
          )}
        </section>

        {/* ══ 2 · LE COMPTEUR DU MOIS (gratuit) ═════════════════════════════
            Le levier le plus honnête qui soit : ses propres chiffres. Les
            trades sont comptés par `tradesThisMonth`, la même fonction que
            celle qui bloque la saisie au-delà de la limite. */}
        {!loading && etat === "free" && <Compteur trades={trades} t={t} />}

        {/* ══ 3 · CHOISIR / PASSER À LA LICENCE ═════════════════════════════ */}
        {!loading && mode !== "none" && (
          <section className="space-y-3" aria-labelledby="sub-offer-title">
            <div className="subp-head">
              <h2 id="sub-offer-title" className="subp-title">
                {mode === "upgrade" ? t("subpage.upsell.title") : t("subpage.offer.title")}
              </h2>
              <p className="subp-sub">
                {mode === "upgrade"
                  ? `${breakEvenCopy(lg)} ${t("subpage.upsell.sub")}`
                  : t("subpage.offer.sub")}
              </p>
            </div>
            <SubscriptionSection showPortal={!actionDisponible} preview={preview} />
          </section>
        )}

        {/* ══ 4 · CE QUE ÇA OUVRE ═══════════════════════════════════════════
            Pas des noms de fonctionnalités : ce que chaque page APPORTE, en
            une phrase (`PAGE_VALUE`). Cadenas pour le gratuit, coche pour qui
            l'a déjà — la même grille rappelle à un abonné ce qu'il paie. */}
        {!loading && <Ouvertures paid={paid} lg={lg} t={t} />}

        {/* ══ 5 · LE COMPARATIF ═══════════════════════════════════════════
            Les chiffres sortent de `LIMITS` : le jour où une limite change,
            le comparatif change avec elle. */}
        {!loading && etat !== "lifetime" && <Comparatif lg={lg} t={t} />}

        {/* ══ 6 · CE QUI RASSURE ═══════════════════════════════════════════ */}
        {!loading && <Faq t={t} />}

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 pb-2">
          {(
            [
              [Lock, t("subscription.secureStripePayment")],
              [CheckCircle2, t("subscription.cancelInOneClick")],
              [Download, t("subscription.yourDataStaysExportable")],
            ] as [ComponentType<{ className?: string }>, string][]
          ).map(([Ico, label]) => (
            <span key={label} className="flex items-center gap-2 text-[11px] text-slate-500">
              <Ico className="h-3.5 w-3.5 text-emerald-400/80" />
              {label}
            </span>
          ))}
        </div>
      </ScrollArea>
    </PageContainer>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   2 · LE COMPTEUR DU MOIS
   ──────────────────────────────────────────────────────────────────────────*/

function Compteur({ trades, t }: { trades: Trade[]; t: TFn }) {
  const limite = LIMITS.free.tradesPerMonth;
  const notes = tradesThisMonth(trades);
  const restants = Math.max(0, limite - notes);
  const part = Math.min(1, notes / limite);
  const plein = restants === 0;
  return (
    <section className="subp-card" aria-labelledby="sub-usage-title">
      <h2 id="sub-usage-title" className="subp-card-title">
        {t("subpage.usage.title")}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="tv-label text-slate-500">{t("subpage.usage.trades")}</p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className={cn("tv-figure text-2xl", plein ? "text-amber-300" : "text-white")}>
              {notes}
            </span>
            <span className="tv-figure text-sm text-slate-500">/ {limite}</span>
          </p>
          <div
            className="subp-meter mt-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limite}
            aria-valuenow={notes}
          >
            <span
              className={cn("subp-meter-fill", plein && "subp-meter-fill--full")}
              style={{ transform: `scaleX(${part})` }}
            />
          </div>
        </div>
        <div>
          <p className="tv-label text-slate-500">{t("subpage.usage.accounts")}</p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className="tv-figure text-2xl text-white">{LIMITS.free.accounts}</span>
            <span className="tv-figure text-sm text-slate-500">/ {LIMITS.free.accounts}</span>
          </p>
        </div>
        <div>
          <p className="tv-label text-slate-500">{t("subpage.usage.jarvis")}</p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="tv-figure text-2xl text-white">{LIMITS.free.jarvisPerDay}</span>
            <span className="text-sm text-slate-500">{t("subpage.usage.perDay")}</span>
          </p>
        </div>
      </div>
      <p className={cn("mt-4 text-[13px]", plein ? "text-amber-200" : "text-slate-400")}>
        {plein ? t("subpage.usage.full") : t("subpage.usage.left").replace("{n}", String(restants))}
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   4 · CE QUE L'ACCÈS COMPLET OUVRE
   ──────────────────────────────────────────────────────────────────────────*/

/** L'icône de chaque page payante — les mêmes pictogrammes que la navigation. */
const ICONES: Partial<Record<Page, ComponentType<{ className?: string }>>> = {
  analytics: BarChart3,
  mistakes: AlertTriangle,
  insights: Bot,
  reports: FileText,
  goals: Target,
  missed: Eye,
  news: Newspaper,
  montecarlo: Dices,
  seasonality: CalendarDays,
};

function Ouvertures({ paid, lg, t }: { paid: boolean; lg: Lg; t: TFn }) {
  const pages = Object.entries(PAGE_VALUE) as [Page, (typeof PAGE_VALUE)[Page]][];
  return (
    <section className="space-y-3" aria-labelledby="sub-unlock-title">
      <div className="subp-head">
        <h2 id="sub-unlock-title" className="subp-title">
          {paid ? t("subpage.unlock.titlePaid") : t("subpage.unlock.titleFree")}
        </h2>
        <p className="subp-sub">{t("subpage.unlock.sub")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map(([page, v]) => {
          if (!v) return null;
          const Ico = ICONES[page] ?? Sparkles;
          return (
            <li key={page} className="subp-unlock">
              <span className="subp-unlock-icon">
                <Ico className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 text-[13.5px] font-semibold text-white">
                  {v.title[lg]}
                  {paid ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--tv-chart-green)]" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-400">{v.benefit[lg]}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   5 · LE COMPARATIF
   ──────────────────────────────────────────────────────────────────────────*/

function Comparatif({ lg, t }: { lg: Lg; t: TFn }) {
  const chiffre = (n: number) => (Number.isFinite(n) ? String(n) : t("subpage.cmp.unlimited"));
  const lignes: { label: string; free: string | boolean; full: string | boolean }[] = [
    {
      label: t("subpage.cmp.trades"),
      free: chiffre(LIMITS.free.tradesPerMonth),
      full: chiffre(LIMITS.elite.tradesPerMonth),
    },
    {
      label: t("subpage.cmp.accounts"),
      free: chiffre(LIMITS.free.accounts),
      full: chiffre(LIMITS.elite.accounts),
    },
    {
      label: t("subpage.cmp.jarvis"),
      free: t("subpage.cmp.jarvisFree").replace("{n}", String(LIMITS.free.jarvisPerDay)),
      full: t("subpage.cmp.included"),
    },
    { label: t("subpage.cmp.core"), free: true, full: true },
    ...Object.values(PAGE_VALUE).map((v) => ({
      label: v!.title[lg],
      free: false,
      full: true,
    })),
    { label: t("subpage.cmp.broker"), free: false, full: true },
    { label: t("subpage.cmp.transfer"), free: false, full: true },
    { label: t("subpage.cmp.push"), free: false, full: true },
  ];
  const cellule = (v: string | boolean) =>
    typeof v === "string" ? (
      <span className="tv-figure text-[13px] text-slate-200">{v}</span>
    ) : v ? (
      <Check className="mx-auto h-4 w-4 text-[var(--tv-chart-green)]" aria-label="✓" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-slate-600" aria-label="—" />
    );
  return (
    <section className="space-y-3" aria-labelledby="sub-cmp-title">
      <div className="subp-head">
        <h2 id="sub-cmp-title" className="subp-title">
          {t("subpage.cmp.title")}
        </h2>
      </div>
      <div className="subp-card !p-0">
        <TableScroll>
          <Table>
            <THead>
              <TR>
                <TH>{t("subpage.cmp.feature")}</TH>
                <TH align="center">{t("subpage.cmp.free")}</TH>
                <TH align="center">{t("subpage.cmp.full")}</TH>
              </TR>
            </THead>
            <TBody>
              {lignes.map((l) => (
                <TR key={l.label}>
                  <TD className="text-[13px] text-slate-300">{l.label}</TD>
                  <TD className="text-center">{cellule(l.free)}</TD>
                  <TD className="text-center">{cellule(l.full)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   6 · LES QUESTIONS DE FACTURATION
   ──────────────────────────────────────────────────────────────────────────*/

const FAQ: [TKey, TKey][] = [
  ["subpage.faq.q1", "subpage.faq.a1"],
  ["subpage.faq.q2", "subpage.faq.a2"],
  ["subpage.faq.q3", "subpage.faq.a3"],
  ["subpage.faq.q4", "subpage.faq.a4"],
  ["subpage.faq.q5", "subpage.faq.a5"],
  ["subpage.faq.q6", "subpage.faq.a6"],
];

function Faq({ t }: { t: TFn }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  return (
    <section className="space-y-3" aria-labelledby="sub-faq-title">
      <div className="subp-head">
        <h2 id="sub-faq-title" className="subp-title">
          {t("subpage.faq.title")}
        </h2>
      </div>
      <div className="subp-card space-y-1 !py-2">
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
      </div>
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
    body: (t, fin) =>
      fin
        ? t("subscription.yourAccessRenewsAutomatically").replace("{a}", String(fin))
        : t("subscription.yourAccessIsActive"),
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
    // Une licence n'a rien à gérer… sauf ses factures, quand il y a un client
    // Stripe : le portail les garde.
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
