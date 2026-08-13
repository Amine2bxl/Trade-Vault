import {
  Upload,
  CalendarCheck,
  Brain,
  PieChart,
  Target,
  ShieldCheck,
  KeyRound,
  Download,
  Check,
  Quote,
} from "lucide-react";

/**
 * Les bandes de la maquette : plateformes, capacités, preuve, confiance.
 *
 * Le DESSIN suit la maquette au pixel près — même bande de logos, même rangée
 * de cinq cartes à icône ronde, mêmes gros chiffres, même carte citation, même
 * bandeau de réassurance en pied.
 *
 * LE CONTENU, LUI, EST VÉRIFIABLE. La maquette portait « 4,9/5 », « +500
 * traders », « +12k trades analysés chaque jour » et un témoignage signé d'un
 * client qui n'existe pas. Ces quatre-là ne sont pas des détails de
 * remplissage : une note inventée est un faux avis, et un compteur inventé est
 * une allégation commerciale. Le dessin est donc repris tel quel et rempli avec
 * ce que le produit fait réellement — l'effet visuel est identique, la promesse
 * est tenable.
 *
 * Même règle pour les plateformes : TradeVault ne se CONNECTE à aucun courtier.
 * Il IMPORTE un CSV et reconnaît les colonnes de NinjaTrader, TradingView et
 * TopStep (`utils/csvImport.ts`). La bande dit donc « importe depuis », pas
 * « connecte » — un visiteur qui s'inscrit pour une connexion automatique
 * découvrirait le contraire en deux minutes.
 */

/** Ce que l'importeur reconnaît vraiment. Voir `utils/csvImport.ts`. */
const PLATFORMS = ["NinjaTrader", "TradingView", "TopStep", "CSV universel"] as const;

export function PlatformsStrip() {
  return (
    <div className="reveal rounded-2xl border border-white/[.07] bg-white/[.02] px-6 py-7 backdrop-blur-md">
      <p className="text-center text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
        Importe depuis tes plateformes
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {PLATFORMS.map((name) => (
          <span
            key={name}
            className="font-display text-base font-bold tracking-tight text-slate-300/90 sm:text-lg"
          >
            {name}
          </span>
        ))}
        <span className="text-sm text-slate-500">+ bientôt plus</span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Upload,
    title: "Journal en 2 clics",
    body: "Dépose ton export : les colonnes NinjaTrader, TradingView ou TopStep sont reconnues automatiquement.",
  },
  {
    icon: CalendarCheck,
    title: "Préparation optimale",
    body: "Checklist pré-market, calendrier économique et séance du jour avant la première entrée.",
  },
  {
    icon: Brain,
    title: "Coach IA personnel",
    body: "Il lit tes trades, te montre les motifs qu'il observe et te propose une correction à valider.",
  },
  {
    icon: PieChart,
    title: "Analytics avancées",
    body: "Plus de 20 métriques calculées, rapports mensuels et visualisations lisibles d'un coup d'œil.",
  },
  {
    icon: Target,
    title: "Progresse chaque jour",
    body: "Objectifs, règles tenues, séries de discipline — ce qui se mesure finit par se corriger.",
  },
] as const;

export function FeatureRow() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {FEATURES.map(({ icon: Ico, title, body }) => (
        <div key={title} className="glass-card px-5 py-7 text-center">
          <div className="feat-icon mx-auto h-12 w-12 rounded-2xl">
            <Ico className="h-5 w-5" />
          </div>
          <h3 className="font-display mt-4 text-[15px] font-bold text-white">{title}</h3>
          <p className="mt-2 text-[12.5px] leading-6 text-slate-400">{body}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Les trois chiffres de la maquette, remplacés par trois faits contrôlables.
 *
 * « +12k trades analysés chaque jour » et « +500 traders » demandaient une
 * base d'utilisateurs que personne ne peut confirmer ici. Ceux-ci se vérifient
 * en ouvrant le produit : le nombre de métriques, la durée d'un import, la
 * disponibilité du coach.
 */
const FACTS = [
  ["20+", "métriques calculées sur chaque trade"],
  ["<10s", "pour importer tout ton historique"],
  ["24/7", "coach IA disponible"],
] as const;

const CTA_POINTS = [
  "Essai gratuit 14 jours",
  "Accès complet à toutes les fonctionnalités",
  "Coach IA + analytics avancées",
  "Sans engagement, annulation en 1 clic",
] as const;

export function TraderProof({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_.85fr_.85fr]">
      {/* ── Le pourquoi, et les chiffres qui le soutiennent ── */}
      <div className="reveal">
        <h2 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold leading-[1.1] tracking-[-0.035em] text-white">
          Conçu par un trader,
          <br />
          pour les traders.
        </h2>
        <p className="mt-4 max-w-[420px] text-[14.5px] leading-7 text-slate-400">
          TradeVault n'est pas un tableur de plus. C'est l'outil que je voulais avoir quand je
          répétais les mêmes erreurs sans les voir.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {FACTS.map(([value, label]) => (
            <div key={label}>
              <p className="font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-cyan-300">
                {value}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── La carte citation. Même dessin que la maquette, sans faux client ── */}
      <div className="glass-card reveal flex flex-col justify-between px-6 py-7">
        <Quote className="h-7 w-7 text-cyan-400/40" aria-hidden="true" />
        <p className="mt-4 text-[14px] leading-7 text-slate-300">
          « J'ai construit TradeVault parce qu'aucun journal ne me disait{" "}
          <span className="text-white">pourquoi</span> je perdais. Il ne te promet pas de gains : il
          te montre ce que tes données disent, et te laisse décider. »
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 font-display text-sm font-extrabold text-cyan-300">
            TV
          </div>
          <div>
            <p className="text-[13px] font-bold text-white">Le créateur de TradeVault</p>
            <p className="text-[11.5px] text-slate-500">Trader, et premier utilisateur</p>
          </div>
        </div>
      </div>

      {/* ── La carte d'appel à l'action ── */}
      <div className="glass-card reveal flex flex-col px-6 py-7">
        <h3 className="font-display text-lg font-bold text-white">
          Prêt à transformer ton trading ?
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-slate-400">
          Ouvre ton journal, importe ton historique, et vois ce qu'il en sort.
        </p>
        <ul className="mt-5 space-y-2.5">
          {CTA_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2 text-[12.5px] text-slate-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {point}
            </li>
          ))}
        </ul>
        <button onClick={onStart} className="btn-primary mt-6 w-full px-5 py-3 text-[.9rem]">
          Commencer gratuitement
        </button>
      </div>
    </div>
  );
}

/**
 * Le bandeau de réassurance.
 *
 * La maquette annonçait « Hébergé en Europe · Conforme RGPD ». `docs/PRODUCT.md`
 * marque la conformité RGPD comme NON VÉRIFIÉE ; l'écrire sur une page de vente
 * serait une affirmation juridique que rien n'étaye. Les trois points ci-dessous
 * sont ceux que la FAQ de cette même page tient déjà.
 */
const TRUST = [
  {
    icon: ShieldCheck,
    title: "Chiffré, en transit et au repos",
    body: "Paiements par Stripe, sauvegardes cloud.",
  },
  {
    icon: KeyRound,
    title: "Aucun accès à ton courtier",
    body: "TradeVault lit un fichier, jamais ton compte.",
  },
  {
    icon: Download,
    title: "Tes données t'appartiennent",
    body: "Export complet, à tout moment.",
  },
] as const;

export function TrustStrip() {
  return (
    <div className="reveal grid grid-cols-1 gap-6 rounded-2xl border border-white/[.07] bg-white/[.02] px-6 py-7 backdrop-blur-md sm:grid-cols-3">
      {TRUST.map(({ icon: Ico, title, body }) => (
        <div key={title} className="flex items-start gap-3">
          <Ico className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-[13px] font-bold text-white">{title}</p>
            <p className="mt-0.5 text-[11.5px] leading-5 text-slate-500">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
