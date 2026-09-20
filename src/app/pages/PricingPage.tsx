import { useState } from "react";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import PricingPlans from "../components/pricing/PricingPlans";
import { AuthModal } from "./landing/AuthModal";
import { PublicHeader } from "./landing/PublicHeader";
import { LangMenuPied } from "./landing/LangMenu";
import { usePublicSubscription } from "./landing/usePublicSubscription";
import { LandingLangProvider, useLandingT, type LandingKey } from "./landing/i18n";
import { TIER_BY_ID } from "@/domain/plans";
import { pathForPage } from "../utils/pageUrl";
import { breadcrumbJsonLd } from "@/shared/seo";
import "./landing.css";

/**
 * /pricing — la page des tarifs, à part.
 *
 * ── POURQUOI UNE PAGE, ALORS QUE LA GRILLE EST DÉJÀ SUR LA LANDING ────────
 *
 * Parce que ce ne sont pas deux fois le même moment. Sur la landing, le prix
 * arrive au bout d'un parcours : on a vu le produit, on se demande combien.
 * Ici, on arrive AVEC la question - depuis un lien, une comparaison, un
 * onglet gardé ouvert. La grille noyée en bas d'une page de vente ne se
 * démarque pas ; seule, avec sa propre adresse, elle se partage et s'indexe.
 *
 * La grille elle-même est le MÊME composant que la landing et que
 * l'application (`PricingPlans`) : trois surfaces, une source. Un tarif ne
 * peut donc pas diverger d'un endroit à l'autre.
 *
 * ── TROIS DÉFAUTS CORRIGÉS ────────────────────────────────────────────────
 *
 *  1. LA PAGE PARLAIT ANGLAIS À TOUT LE MONDE. `<PricingPlans lang="en">`
 *     était écrit en dur : un visiteur qui avait mis la vitrine en français
 *     cliquait « Tarifs » et recevait une grille anglaise. La langue vient
 *     maintenant du contexte, comme partout ailleurs.
 *  2. ELLE N'AVAIT PAS D'EN-TÊTE. Une flèche « retour » en haut à gauche, et
 *     rien d'autre - donc aucun moyen de se connecter ou de créer un compte
 *     depuis la page qui, précisément, demande de choisir une offre.
 *  3. ELLE IGNORAIT QUI LA REGARDAIT. Un abonné Pro y voyait « Passer à
 *     Pro », bouton actif, comme s'il ne l'était pas.
 *
 * ── CE QU'ON N'A PAS FAIT ─────────────────────────────────────────────────
 *
 * Pas de matrice de comparaison. Une grille de vingt lignes × trois colonnes
 * se PARCOURT, elle ne se lit pas : on y cherche une ligne qu'on ne trouve
 * pas, et on repart. Trois phrases disent la même chose et se lisent en
 * entier - c'est la section « ce qui change » ci-dessous.
 */

/* ── CE QUI CHANGE D'UNE OFFRE À L'AUTRE ─────────────────────────────────
 *
 * Trois lignes, et elles répondent à la seule question qu'on se pose devant
 * une grille : « qu'est-ce que je gagne en payant, et qu'est-ce que je
 * perds en ne payant pas ? »
 *
 * La troisième ligne est la plus importante et c'est celle qu'aucune grille
 * n'affiche jamais : ce qui reste gratuit POUR TOUJOURS. Sans elle, « offre
 * gratuite » se lit comme « version mutilée », et le gratuit ne convertit
 * personne parce que personne ne s'en sert. */
const DIFFERENCES: { de: LandingKey; a: LandingKey; k: LandingKey }[] = [
  { de: "price.diff1.from", a: "price.diff1.to", k: "price.diff1.d" },
  { de: "price.diff2.from", a: "price.diff2.to", k: "price.diff2.d" },
  { de: "price.diff3.from", a: "price.diff3.to", k: "price.diff3.d" },
];

const FAQ: [LandingKey, LandingKey][] = [
  ["price.faq1.q", "price.faq1.a"],
  ["price.faq2.q", "price.faq2.a"],
  ["price.faq3.q", "price.faq3.a"],
  ["price.faq4.q", "price.faq4.a"],
];

function Contenu() {
  const { t, lang } = useLandingT();
  const [auth, setAuth] = useState<null | { mode: "login" | "signup"; plan?: string }>(null);
  const abo = usePublicSubscription();

  const nomPalier =
    abo.palier === "free" ? t("price.state.free") : TIER_BY_ID[abo.palier].name[lang];

  return (
    <div className="landing-root relative min-h-dvh overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(t("price.h1"), "/pricing") }}
      />

      <PublicHeader
        onLogin={() => setAuth({ mode: "login" })}
        onSignup={() => setAuth({ mode: "signup", plan: t("nav.cta.plan") })}
      />

      <main className="lp-container relative z-10 pb-20 pt-12 md:pt-16">
        <header className="mx-auto max-w-[680px] text-center">
          <p className="tv-label text-[var(--tv-highlight)]">{t("pricing.tag")}</p>
          <h1 className="mt-4 font-display text-[clamp(2.1rem,4.4vw,3.2rem)] font-semibold leading-[1.07] tracking-[-0.03em] text-white">
            {t("price.h1")}
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-7 text-slate-400">
            {t("price.sub")}
          </p>
        </header>

        {/* ── L'ÉTAT DE L'ABONNEMENT ──
            Affiché seulement une fois la session RÉSOLUE : montrer « offre
            gratuite » pendant le chargement, puis le corriger en « Pro »,
            serait pire que de ne rien montrer - on aurait annoncé à un
            abonné qu'il ne l'est pas. */}
        {!abo.charge && abo.connecte && (
          <div className="mx-auto mt-10 flex max-w-[560px] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-[rgb(var(--tv-accent-rgb)/0.28)] bg-[rgb(var(--tv-accent-rgb)/0.06)] px-5 py-4 text-center">
            <Sparkles aria-hidden className="h-4 w-4 text-[var(--tv-highlight)]" />
            <span className="text-[14px] text-slate-300">
              {t("price.state.on")} <span className="font-semibold text-white">{nomPalier}</span>.
            </span>
            <a
              /* L'adresse vient du routeur, pas d'une chaîne : `pathForPage`
                 est la seule chose qui sait qu'une page peut vivre à la
                 racine plutôt que sous son nom. */
              href={pathForPage("subscription")}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--tv-highlight)] transition-colors hover:text-white"
            >
              {t("price.state.manage")}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* L'ANCRAGE, juste avant le premier montant. Se comparer à un
            challenge raté plutôt qu'à un journal à 20 € : c'est la règle de
            `landing-copy`, et c'est la seule comparaison honnête - les deux
            dépenses servent la même chose. */}
        <p className="mx-auto mt-10 max-w-[600px] text-center text-[15px] leading-7 text-slate-400">
          {t("anchor.sub")}
        </p>

        <div className="mt-12">
          <PricingPlans
            lang={lang}
            currentPlan={abo.charge ? undefined : abo.plan}
            onChoose={(plan) => setAuth({ mode: "signup", plan: `TradeVault - ${plan}` })}
            onFree={() => setAuth({ mode: "signup", plan: "Free" })}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {[t("pricing.trust1"), t("pricing.trust2"), t("pricing.trust3")].map((s) => (
            <span
              key={s}
              className="flex items-center gap-2 text-[13px] font-medium text-slate-500"
            >
              <Check className="h-4 w-4 text-[var(--tv-chart-green)]" />
              {s}
            </span>
          ))}
        </div>

        {/* ── CE QUI CHANGE ── */}
        <section className="mx-auto mt-20 max-w-[720px]">
          <h2 className="text-center font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
            {t("price.diff.title")}
          </h2>
          <div className="mt-8 divide-y divide-white/[.07] border-y border-white/[.07]">
            {DIFFERENCES.map((d) => (
              <div
                key={d.k}
                className="flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <p className="tv-label shrink-0 text-slate-500 sm:w-[136px]">
                  {t(d.de)} <span className="text-slate-700">→</span> {t(d.a)}
                </p>
                <p className="text-[15px] leading-7 text-slate-300">{t(d.k)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── LA FAQ DE FACTURATION ──
            Quatre objections, et AUCUNE ne répète la FAQ de la vitrine : ici
            on ne demande plus « à quoi ça sert », on demande « qu'est-ce que
            je signe ». */}
        <section className="mx-auto mt-20 max-w-[720px]">
          <h2 className="text-center font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
            {t("price.faq.title")}
          </h2>
          <dl className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="text-[15px] font-semibold text-white">{t(q)}</dt>
                <dd className="mt-2 text-[14px] leading-7 text-slate-400">{t(a)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── PIED DE PAGE ALLÉGÉ ──
            Les liens légaux et la langue, rien d'autre. Reproduire le pied de
            la vitrine ici renverrait vers six ancres qui n'existent pas sur
            cette adresse. */}
        <footer className="mt-20 border-t border-white/[.06] pt-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
              {[
                ["/", "price.foot.home"],
                ["/contact", "footer.r4"],
                ["/privacy", "footer.privacy"],
                ["/terms", "footer.terms"],
                ["/cookies", "footer.cookies"],
              ].map(([href, k]) => (
                <a
                  key={href}
                  href={href}
                  className="-my-2 inline-flex min-h-[40px] items-center text-slate-500 transition-colors hover:text-white"
                >
                  {t(k as LandingKey)}
                </a>
              ))}
            </div>
            <LangMenuPied />
          </div>
        </footer>
      </main>

      {auth && (
        /* La modale gère elle-même la bascule connexion/création : on lui
           passe le mode d'ouverture, pas un contrôleur. */
        <AuthModal initialMode={auth.mode} plan={auth.plan} onClose={() => setAuth(null)} />
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <LandingLangProvider>
      <Contenu />
    </LandingLangProvider>
  );
}
