import { useCallback, useMemo, useState } from "react";
import {
  Crown,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Bitcoin,
  CalendarClock,
  RefreshCw,
  Receipt,
  Download,
  Lock,
  Loader2,
  PauseCircle,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { useSubscription } from "../hooks/useSubscription";
import { cn } from "../utils/cn";
import {
  eur,
  planPrice,
  intervalOf,
  tierOf,
  yearlyPerMonth,
  TIER_BY_ID,
  type PaidPlan,
} from "../utils/pricing";
import { usePageLead } from "../contexts/PageActionsContext";
import { Kpi, KpiGrid } from "@/shared/ui";
import SubscriptionSection from "../components/SubscriptionSection";
import PlanMatrix from "../components/pricing/PlanMatrix";

type TFn = (k: TKey) => string;

/**
 * ABONNEMENT — L'ÉTAT D'ABORD, L'OFFRE ENSUITE.
 *
 * ══ CE QUI N'ALLAIT PAS ══
 *
 *   1. LE MÊME FAIT, TROIS FOIS. « TradeVault Pro · annuel » était écrit dans
 *      la barre de tête, puis dans la bande de statut, puis dans la grille de
 *      faits, puis une quatrième fois dans le bloc de facturation — qui
 *      redéclarait AUSSI sa propre pastille de statut et sa propre date de
 *      renouvellement. Quatre rendus du même état, quatre endroits à corriger
 *      le jour où la logique change.
 *   2. L'ANNULATION NE SE VOYAIT PAS. Un abonnement annulé restait vert :
 *      seule une pastille changeait de mot (« s'arrête à la fin de la
 *      période »), au milieu d'une page identique à celle d'un abonnement qui
 *      se renouvelle. Le trader ne savait ni qu'il avait annulé, ni jusqu'à
 *      quand il gardait l'accès, ni comment revenir en arrière.
 *   3. RIEN NE DONNAIT ENVIE. La page ouvrait sur « 0 € / toujours » et une
 *      matrice de fonctionnalités. La grille tarifaire — celle qui porte les
 *      bénéfices et les boutons — arrivait en quatrième position, après la
 *      matrice.
 *
 * ══ CE QUE FAIT LA PAGE MAINTENANT ══
 *
 * `etatAbonnement()` répond UNE fois à « où en est cet abonnement ? » et rend
 * un des sept états nommés. Tout ce qui suit s'y accroche : la couleur, le
 * titre, la phrase, l'action principale. Les sept états ont donc la même UI
 * par construction — actif, annulé, en essai, impayé, expiré, offert, gratuit
 * — et un huitième état ne pourra pas être oublié quelque part.
 *
 * L'ORDRE DE LECTURE suit la décision : où j'en suis → ce que je peux faire
 * maintenant → ce que ça coûte → ce que ça contient → ce qui me rassure.
 */
export default function Subscription() {
  const { t, lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const { sub, loading, openPortal, cryptoCheckout } = useSubscription();
  const [busy, setBusy] = useState(false);

  const currentTier = tierOf(sub?.plan);
  const paid = currentTier !== "free";

  const planLabel =
    currentTier === "free"
      ? t("billing.planFree")
      : `TradeVault ${TIER_BY_ID[currentTier].name[fr ? "fr" : "en"]} · ${
          intervalOf(sub?.plan ?? "free") === "yearly"
            ? tr("annuel", "yearly")
            : tr("mensuel", "monthly")
        }`;

  const dateFmt = useCallback(
    (d: Date) => d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }),
    [lang],
  );

  const etat = useMemo(() => etatAbonnement(sub, paid), [sub, paid]);
  const meta = ETATS[etat];

  /* L'action principale de l'état. Elle passe par le portail Stripe quand il
     existe (c'est lui qui sait reprendre, changer de carte, changer d'offre) ;
     un abonnement crypto n'a pas de portail, il se reprend par une nouvelle
     charge. Aucune logique de facturation n'est réécrite ici. */
  const agir = useCallback(async () => {
    if (!sub || busy) return;
    setBusy(true);
    if (sub.hasStripeCustomer) await openPortal();
    else if (sub.source === "crypto" && sub.plan !== "free")
      await cryptoCheckout(sub.plan as PaidPlan);
    setBusy(false);
  }, [sub, busy, openPortal, cryptoCheckout]);

  const actionDisponible =
    !!sub && meta.action !== null && (sub.hasStripeCustomer || sub.source === "crypto");

  /* L'EN-TÊTE MONTE DANS LA BARRE DE TÊTE — comme Réglages et Profil. Le
     statut tient sur une ligne, comme la carte d'identité du profil. */
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
          {loading ? "TradeVault" : planLabel}
        </span>
        {!loading && sub && <Pastille etat={etat} tr={tr} t={t} />}
      </div>
    ),
    [etat, loading, planLabel, sub, t, tr],
  );
  usePageLead(lead);

  const fin = sub?.currentPeriodEnd ? dateFmt(sub.currentPeriodEnd) : null;

  return (
    <div className="mx-auto max-w-[1000px] space-y-3 p-4 md:p-5">
      {/* ══ 1 · OÙ J'EN SUIS ═══════════════════════════════════════════════
          Une bande d'état, teintée par l'état lui-même. C'est elle qui rend
          une annulation IMPOSSIBLE à manquer : elle change de couleur, de
          titre, de phrase et d'action d'un seul coup. */}
      <section
        className={cn("animate-fade-in-up rounded-3xl border px-4 py-4 sm:px-5", meta.surface)}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-1 basis-[280px] items-start gap-3">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                meta.badge,
              )}
            >
              <meta.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className={cn("tv-title", meta.titleClass)}>{meta.title(tr, planLabel)}</h2>
              <p className="tv-prose mt-1 text-slate-400">
                {loading
                  ? tr("Chargement de ton statut…", "Loading your status…")
                  : meta.body(tr, fin)}
              </p>
            </div>
          </div>

          {!loading && (
            <div className="flex shrink-0 items-end gap-4">
              <div className="text-right">
                <div
                  className={cn(
                    "tv-figure text-2xl leading-none",
                    etat === "active" || etat === "lifetime" ? "rp-pos" : "text-white",
                  )}
                >
                  {paid && sub ? eur(planPrice(sub.plan as PaidPlan)) : "0 €"}
                </div>
                <div className="tv-row-label mt-1">
                  {paid
                    ? intervalOf(sub?.plan ?? "free") === "yearly"
                      ? `${t("billing.perYear")} · ${eur(
                          Math.round(yearlyPerMonth(currentTier) * 100) / 100,
                        )}${t("billing.perMonth")}`
                      : t("billing.perMonth")
                    : tr("/ toujours", "/ forever")}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* L'ACTION DE L'ÉTAT — reprendre, mettre à jour, gérer. Un seul
            bouton, celui qui correspond à la situation. */}
        {!loading && actionDisponible && (
          <button
            onClick={() => void agir()}
            disabled={busy}
            className={cn(
              "mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition sm:w-auto",
              "h-10 disabled:opacity-60",
              meta.actionStrong
                ? "tv-accent-fill"
                : "border border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-200 hover:bg-[var(--tv-plate-3)]",
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <meta.actionIcon className="h-4 w-4" />
            )}
            {meta.action!(tr)}
            {!busy && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
          </button>
        )}
      </section>

      {/* ══ 2 · LES FAITS ══════════════════════════════════════════════════
          Quatre cases compactes, et seulement quand il y a un abonnement à
          décrire. Elles portaient le rembourrage d'une carte pour afficher un
          mot chacune. */}
      {!loading && sub && paid && (
        <KpiGrid cols={4} className="animate-fade-in-up stagger-1">
          <Kpi
            label={tr("Formule", "Plan")}
            value={planLabel}
            adornment={<Receipt className="h-3 w-3 shrink-0 text-slate-500" />}
          />
          <Kpi
            label={
              sub.cancelAtPeriodEnd
                ? tr("Accès jusqu'au", "Access until")
                : tr("Prochaine échéance", "Next billing")
            }
            value={fin ?? "—"}
            tone={sub.cancelAtPeriodEnd ? "warn" : "neutral"}
            adornment={<CalendarClock className="h-3 w-3 shrink-0 text-slate-500" />}
          />
          <Kpi
            label={tr("Paiement", "Payment")}
            value={
              sub.source === "crypto"
                ? tr("Crypto", "Crypto")
                : sub.source === "stripe"
                  ? tr("Carte", "Card")
                  : tr("Aucun", "None")
            }
            adornment={
              sub.source === "crypto" ? (
                <Bitcoin className="h-3 w-3 shrink-0 text-slate-500" />
              ) : (
                <CreditCard className="h-3 w-3 shrink-0 text-slate-500" />
              )
            }
          />
          <Kpi
            label={tr("Renouvellement", "Renewal")}
            value={
              sub.cancelAtPeriodEnd
                ? tr("Arrêté", "Stopped")
                : sub.source === "crypto"
                  ? tr("Manuel", "Manual")
                  : tr("Automatique", "Automatic")
            }
            tone={sub.cancelAtPeriodEnd ? "warn" : "neutral"}
            adornment={<RefreshCw className="h-3 w-3 shrink-0 text-slate-500" />}
          />
        </KpiGrid>
      )}

      {/* ══ 3 · CE QUE JE PEUX FAIRE MAINTENANT ════════════════════════════
          La grille tarifaire et le paiement. Elle arrivait en QUATRIÈME
          position, après la matrice de fonctionnalités : le visiteur qui
          voulait souscrire devait faire défiler une page de comparaison pour
          trouver un bouton. C'est le bloc de facturation existant, inchangé
          dans sa logique — seule sa place dans la lecture change. */}
      <div className="animate-fade-in-up stagger-2">
        <SubscriptionSection />
      </div>

      {/* ══ 4 · CE QUE ÇA CONTIENT ═════════════════════════════════════════
          Une matrice, pas une liste : chaque fonctionnalité n'apparaît qu'une
          fois, dans le palier qui l'ajoute, et sa coche se propage aux offres
          supérieures. */}
      <section className="glass animate-fade-in-up stagger-3 overflow-hidden rounded-3xl">
        <PlanMatrix />
      </section>

      {/* ══ 5 · CE QUI RASSURE ═════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 pb-2">
        {[
          [Lock, tr("Paiement sécurisé Stripe", "Secure Stripe payment")],
          [CheckCircle2, tr("Annulation en 1 clic", "Cancel in one click")],
          [Download, tr("Données exportables", "Your data stays exportable")],
        ].map(([Ico, label]) => {
          const I = Ico as typeof Lock;
          return (
            <span
              key={label as string}
              className="flex items-center gap-2 text-[11px] text-slate-500"
            >
              <I className="h-3.5 w-3.5 text-emerald-400/80" />
              {label as string}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LES SEPT ÉTATS
   ──────────────────────────────────────────────────────────────────────────*/

type Sub = NonNullable<ReturnType<typeof useSubscription>["sub"]>;

/** Les états nommés d'un abonnement. Rien d'autre ne décide de l'apparence. */
type EtatId = "free" | "trialing" | "active" | "cancelling" | "pastDue" | "expired" | "lifetime";

/**
 * L'ÉTAT, CALCULÉ UNE FOIS.
 *
 * L'ordre des tests compte, et c'est lui qui corrige le bug de lisibilité de
 * l'annulation : `cancelAtPeriodEnd` est éprouvé AVANT `active`, parce qu'un
 * abonnement annulé est bien encore actif — c'est précisément ce qui le
 * rendait invisible.
 */
function etatAbonnement(sub: Sub | null, paid: boolean): EtatId {
  if (!sub || !paid) return "free";
  if (sub.status === "past_due") return "pastDue";
  if (sub.cancelAtPeriodEnd && (sub.status === "active" || sub.status === "trialing"))
    return "cancelling";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "active") return sub.currentPeriodEnd ? "active" : "lifetime";
  return "expired";
}

interface EtatMeta {
  icon: typeof Crown;
  /** Plaque + liseré de la bande. */
  surface: string;
  /** Vignette d'icône. */
  badge: string;
  titleClass: string;
  title: (tr: (f: string, e: string) => string, planLabel: string) => string;
  body: (tr: (f: string, e: string) => string, fin: string | null) => string;
  /** Libellé de l'action principale — `null` quand l'état n'en propose pas. */
  action: ((tr: (f: string, e: string) => string) => string) | null;
  actionIcon: typeof Crown;
  /** L'action est-elle l'action PRINCIPALE de la page (vert plein) ? */
  actionStrong: boolean;
}

const ETATS: Record<EtatId, EtatMeta> = {
  free: {
    icon: Sparkles,
    surface: "glass border-[var(--tv-border)]",
    badge:
      "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.12)] text-[var(--tv-highlight)]",
    titleClass: "text-white",
    title: (tr) => tr("Tu es sur l'offre gratuite", "You're on the free plan"),
    body: (tr) =>
      tr(
        "Passe à Pro pour chiffrer tes erreurs en euros, projeter ton compte et débloquer le coach.",
        "Go Pro to price your mistakes in euros, project your account and unlock the coach.",
      ),
    action: null,
    actionIcon: Sparkles,
    actionStrong: true,
  },
  trialing: {
    icon: Sparkles,
    surface: "glass border-[var(--tv-border-accent)]",
    badge:
      "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.12)] text-[var(--tv-highlight)]",
    titleClass: "text-white",
    title: (tr) => tr("Essai en cours", "Trial running"),
    body: (tr, fin) =>
      fin
        ? tr(`Ton essai court jusqu'au ${fin}.`, `Your trial runs until ${fin}.`)
        : tr("Ton essai est en cours.", "Your trial is running."),
    action: (tr) => tr("Gérer mon abonnement", "Manage subscription"),
    actionIcon: CreditCard,
    actionStrong: false,
  },
  active: {
    icon: CheckCircle2,
    surface: "glass border-emerald-500/20",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    titleClass: "text-white",
    title: (tr, planLabel) => tr(`${planLabel} — actif`, `${planLabel} — active`),
    body: (tr, fin) =>
      fin
        ? tr(
            `Ton accès se renouvelle automatiquement le ${fin}. Rien à faire.`,
            `Your access renews automatically on ${fin}. Nothing to do.`,
          )
        : tr("Ton accès est actif.", "Your access is active."),
    action: (tr) => tr("Gérer mon abonnement", "Manage subscription"),
    actionIcon: CreditCard,
    actionStrong: false,
  },
  /* L'ÉTAT QUI MANQUAIT. Ambre, pas rouge : rien n'est cassé, l'accès court
     toujours — mais il a une fin, et cette fin est la première chose écrite. */
  cancelling: {
    icon: PauseCircle,
    surface: "border-amber-500/25 bg-amber-500/[0.06]",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    titleClass: "text-amber-200",
    title: (tr) => tr("Abonnement annulé", "Subscription cancelled"),
    body: (tr, fin) =>
      fin
        ? tr(
            `Ton accès reste complet jusqu'au ${fin}. Après cette date, tu repasses sur l'offre gratuite — ton journal et tes données restent intacts.`,
            `You keep full access until ${fin}. After that you move back to the free plan — your journal and data stay intact.`,
          )
        : tr(
            "Ton abonnement ne sera pas reconduit. Ton journal et tes données restent intacts.",
            "Your subscription won't renew. Your journal and data stay intact.",
          ),
    action: (tr) => tr("Réactiver mon abonnement", "Reactivate my subscription"),
    actionIcon: RefreshCw,
    actionStrong: true,
  },
  pastDue: {
    icon: AlertTriangle,
    surface: "border-red-500/25 bg-red-500/[0.06]",
    badge: "border-red-500/30 bg-red-500/10 text-red-400",
    titleClass: "text-red-200",
    title: (tr) => tr("Paiement en échec", "Payment failed"),
    body: (tr) =>
      tr(
        "Le dernier prélèvement n'est pas passé. Mets ta carte à jour pour garder ton accès.",
        "The last charge didn't go through. Update your card to keep your access.",
      ),
    action: (tr) => tr("Mettre à jour ma carte", "Update my card"),
    actionIcon: CreditCard,
    actionStrong: true,
  },
  expired: {
    icon: AlertTriangle,
    surface: "glass border-[var(--tv-border-strong)]",
    badge: "border-[var(--tv-border-strong)] bg-[var(--tv-plate-3)] text-slate-300",
    titleClass: "text-white",
    title: (tr) => tr("Abonnement terminé", "Subscription ended"),
    body: (tr) =>
      tr(
        "Ton accès Pro est arrivé à son terme. Reprends quand tu veux — tout ton historique t'attend.",
        "Your Pro access has ended. Come back whenever — your whole history is waiting.",
      ),
    action: (tr) => tr("Reprendre mon abonnement", "Restart my subscription"),
    actionIcon: RefreshCw,
    actionStrong: true,
  },
  lifetime: {
    icon: Crown,
    surface: "glass border-emerald-500/20",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    titleClass: "text-white",
    title: (tr) => tr("Accès permanent", "Permanent access"),
    body: (tr) =>
      tr(
        "Tout TradeVault t'est ouvert, sans échéance et sans renouvellement.",
        "All of TradeVault is open to you, with no end date and nothing to renew.",
      ),
    action: null,
    actionIcon: Crown,
    actionStrong: false,
  },
};

/** La pastille de la barre de tête — le même état, en un mot. */
function Pastille({ etat, tr, t }: { etat: EtatId; tr: (f: string, e: string) => string; t: TFn }) {
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
    expired: tr("Terminé", "Ended"),
    lifetime: tr("Offert", "Complimentary"),
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
