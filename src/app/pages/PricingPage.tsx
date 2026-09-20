import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import PricingPlans from "../components/pricing/PricingPlans";
import { AuthModal } from "./landing/AuthModal";
import { LandingLangProvider, useLandingT } from "./landing/i18n";
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
 * démarque pas ; seule, avec sa propre adresse, elle se partage et elle
 * s'indexe.
 *
 * La grille elle-même est le MÊME composant que la landing et que
 * l'application (`PricingPlans`) : trois surfaces, une source. Un tarif ne
 * peut donc pas diverger d'un endroit à l'autre - c'est la seule façon
 * d'être sûr qu'on n'affiche jamais deux prix pour la même offre.
 *
 * ── L'ANCRAGE, AVANT LA GRILLE ────────────────────────────────────────────
 *
 * `landing-copy` est explicite : on ne se compare pas aux journaux à 20 $,
 * on se compare au coût d'un challenge raté. Cet ancrage est ce qu'on lit
 * juste avant le premier montant, ici comme sur la landing.
 */

function Contenu() {
  const { t } = useLandingT();
  const [auth, setAuth] = useState<null | { mode: "login" | "signup"; plan?: string }>(null);

  return (
    <div className="landing-root relative min-h-dvh overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(t("pricing.title"), "/pricing") }}
      />

      <div className="lp-container relative z-10 py-10 md:py-16">
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          TradeVault
        </Link>

        <header className="mt-8 text-center">
          <h1 className="mx-auto max-w-3xl font-display text-[clamp(2rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-7 text-slate-400">
            {t("pricing.sub")}
          </p>
        </header>

        {/* L'ANCRAGE, juste avant le premier montant. Se comparer à un
            challenge raté plutôt qu'à un journal à 20 $ : c'est la règle de
            `landing-copy`, et c'est la seule comparaison honnête - les deux
            dépenses servent la même chose. */}
        <p className="mx-auto mt-8 max-w-[640px] rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-6 py-5 text-center text-[15px] leading-7 text-slate-300">
          {t("anchor.sub")}
        </p>

        <div className="mt-12">
          <PricingPlans
            lang="en"
            onChoose={(plan) => setAuth({ mode: "signup", plan: `TradeVault - ${plan}` })}
            onFree={() => setAuth({ mode: "signup", plan: "Free" })}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {[t("pricing.trust1"), t("pricing.trust2"), t("pricing.trust3")].map((s) => (
            <span key={s} className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Check className="h-4 w-4 text-[var(--tv-chart-green)]" />
              {s}
            </span>
          ))}
        </div>
      </div>

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
