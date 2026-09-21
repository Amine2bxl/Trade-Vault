import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Database,
  Gift,
  Sparkles,
  Unlock,
  XCircle,
} from "lucide-react";
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

/* ── LES SIX OUTILS QU'AUCUNE OFFRE NE FERME ─────────────────────────────
 *
 * La section « ce qui change » disait en trois paragraphes ce que la grille
 * montre maintenant ligne par ligne : les pages qui s'ouvrent, les limites
 * qui sautent. Elle ne portait plus qu'une information à elle — et c'est la
 * plus importante de la page.
 *
 * Sans elle, « offre gratuite » se lit comme « version mutilée ». Un gratuit
 * dont on doute ne convertit personne, parce que personne ne s'en sert assez
 * longtemps pour avoir envie de payer. Six outils NOMMÉS se reconnaissent
 * d'un coup d'œil ; une phrase qui les énumère se lit, ou plus souvent, se
 * saute. */
const TOUJOURS_GRATUIT: LandingKey[] = [
  "price.free.1",
  "price.free.2",
  "price.free.3",
  "price.free.4",
  "price.free.5",
  "price.free.6",
];

const FAQ: [LandingKey, LandingKey, typeof Unlock][] = [
  ["price.faq1.q", "price.faq1.a", Gift],
  ["price.faq2.q", "price.faq2.a", Database],
  ["price.faq3.q", "price.faq3.a", XCircle],
  ["price.faq4.q", "price.faq4.a", CreditCard],
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

        {/* LE PARAGRAPHE D'ANCRAGE A ÉTÉ RETIRÉ D'ICI.
            Il faisait un TROISIÈME bloc de texte entre le titre et le
            premier montant. Au-dessus d'une grille tarifaire on ne lit pas,
            on cherche un chiffre : trois paragraphes empilés avant le
            premier prix repoussent la seule chose qu'on est venu voir. La
            comparaison au coût d'un reset vit maintenant sur la vitrine, en
            chiffres face à face, là où on la découvre au bon moment. */}
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

        {/* ── CE QUI NE SE FERME JAMAIS ── */}
        <section className="mx-auto mt-20 max-w-[880px]">
          <h2 className="text-center font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
            {t("price.free.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-[460px] text-center text-[14px] leading-6 text-slate-500">
            {t("price.free.sub")}
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {TOUJOURS_GRATUIT.map((k) => (
              <li
                key={k}
                className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.015] px-4 py-3.5 text-[14px] font-medium text-slate-200"
              >
                <Unlock aria-hidden className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
                {t(k)}
              </li>
            ))}
          </ul>
        </section>

        {/* ── LA FAQ DE FACTURATION ──
            Quatre objections, et AUCUNE ne répète la FAQ de la vitrine : ici
            on ne demande plus « à quoi ça sert », on demande « qu'est-ce que
            je signe ». */}
        <section className="mx-auto mt-20 max-w-[720px]">
          <h2 className="text-center font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
            {t("price.faq.title")}
          </h2>
          {/* Des cartes plutôt qu'une liste de définitions : quatre
              objections posées à plat se lisent comme un document légal,
              alors que ce sont quatre réponses courtes et rassurantes. La
              plaque les sépare, l'icône dit de quoi on parle avant la
              première ligne. */}
          <dl className="mt-8 grid gap-3 sm:grid-cols-2">
            {FAQ.map(([q, a, Icone]) => (
              <div key={q} className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
                <dt className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
                  <Icone aria-hidden className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
                  {t(q)}
                </dt>
                <dd className="mt-2.5 text-[14px] leading-6 text-slate-400">{t(a)}</dd>
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
