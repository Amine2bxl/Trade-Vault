import { lazyPage } from "@/shared/lazy-page";
import { Suspense, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo-128.png";
import { Icon, type IName } from "./Icon";
import { ShotOuVisuel } from "./ProductShot";
import { shot } from "./shots";
/**
 * L'ÉCRAN D'AUTHENTIFICATION EST DIFFÉRÉ, et c'est lui qui porte Supabase.
 *
 * Il est le SEUL module de la vitrine à toucher `AuthContext`, donc le seul
 * à faire entrer le SDK Supabase dans le graphe de la page. Il ne s'affiche
 * qu'après un clic : un visiteur qui lit la page et repart ne l'ouvre jamais.
 * Aucun repli de `Suspense` : l'écran derrière ne bouge pas pendant les
 * quelques millisecondes du chargement.
 */
const AuthModal = lazyPage(() => import("./AuthModal").then((m) => ({ default: m.AuthModal })));
const DemoModal = lazyPage(() => import("./DemoModal").then((m) => ({ default: m.DemoModal })));
import { TrustStrip } from "./Showcase";
import { TRUSTPILOT_URL } from "@/shared/site";
import { TourProduit, type EcranBento } from "./Tour";
import { CursorOrb } from "@/shared/ui/CursorOrb";
import { LIENS_NAV } from "./nav";
import MegaNav from "./MegaNav";
import { LangMenuPied } from "./LangMenu";
import { CookieConsent } from "./CookieConsent";
import {
  DefilementDoux,
  allerVers,
  useApparitions,
  useDefilementSansRendu,
  usePrefereMoinsDeMouvement,
} from "./motion";
import { useLenis } from "lenis/react";
import { faqPageJsonLd } from "@/shared/seo";
import { RESEAUX_ACTIFS } from "@/shared/socials";
import { lireLePassage, positionDeReprise } from "./langSwap";
import { eur } from "@/app/utils/pricing";
import { LIFETIME_EUR, MONTHLY_EUR, breakEvenCopy } from "@/domain/plans";
import { LandingLangProvider, useLandingT, type LandingKey, type LandingLang } from "./i18n";
import { oauthErrorFromUrl } from "@/app/utils/authErrors";
import "./landing.css";

/* ═══════════════════════════════════════════════════════════════════════════
 * LA VITRINE, REFAITE À LA DA DE L'APP — langage Liquid (novembre 2026).
 *
 * Le problème qu'elle règle : la vitrine montrait l'ANCIEN produit (captures
 * d'avant Liquid, composition « site SaaS » texte-à-gauche) et vendait une
 * licence à 20 € qui n'existe plus. L'app, elle, est devenue une app native :
 * verre pour ce qui navigue, plaques opaques à grand rayon pour le contenu, un
 * chiffre héros, des actions rondes.
 *
 * La page reprend donc la grammaire de l'app, section par section :
 *
 *   Héros      centré comme l'accueil de l'app, le produit en scène dessous
 *   Confiance  les portes d'entrée + la vraie fiche Trustpilot
 *   Problème   trois symptômes, puis leur prix (capture Erreurs)
 *   Boucle     quatre gestes en disques — la rangée d'actions de l'app
 *   Produit    le bento des écrans réels (`Tour.tsx`)
 *   Jarvis     la preuve que le coach ne raconte pas d'histoires
 *   Confiance  trois engagements vérifiables
 *   Tarifs     le coût d'un reset face aux deux offres (catalogue)
 *   FAQ · CTA final · pied de page
 *
 * Ce qui ne change pas : aucun chiffre n'est écrit à la main (captures du
 * compte de démonstration, ou catalogue `domain/plans`), aucun avis n'est
 * inventé, le verre reste à la navigation (barre en capsule), rien ne rayonne
 * et rien ne boucle.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── LOGO ────────────────────────── */
function Logo() {
  return (
    // `href="/"` : le lien de retour à l'accueil le plus universellement
    // compris du web, et le seul qu'un robot s'attend à trouver partout.
    <a
      href="/"
      className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tv-accent)] rounded-sm"
    >
      <img
        src={logoSrc}
        alt="TradeVault"
        width={30}
        height={30}
        className="h-8 w-8 object-contain"
      />
      <span className="font-display font-bold tracking-[-0.02em] text-white leading-none hidden sm:block text-[1.15rem]">
        TradeVault
      </span>
    </a>
  );
}

/* ─────────────────────────── PIED DE PAGE ─────────────────────────── */

/**
 * LES LIENS DU PIED DE PAGE — chaque entrée désigne une ancre RÉELLE de cette
 * page ou une route RÉELLE du produit (`tests/seo.test.ts` le vérifie). Un
 * pied de page est la sortie de secours de quelqu'un qui n'a pas trouvé ce
 * qu'il cherchait plus haut, pas un plan du site.
 */
type FooterLink = { k: LandingKey; href: string };

const FOOTER_PRODUCT: FooterLink[] = [
  { k: "footer.f3", href: "#product" },
  { k: "footer.f4", href: "/pricing" },
  { k: "footer.r1", href: "/demo-site" },
  { k: "footer.r3", href: "#faq" },
  { k: "footer.r4", href: "/contact" },
];

/* Les QUATRE documents, dans l'ordre de la navigation des pages légales. */
const FOOTER_LEGAL: FooterLink[] = [
  { k: "footer.terms", href: "/terms" },
  { k: "footer.cgu", href: "/cgu" },
  { k: "footer.privacy", href: "/privacy" },
  { k: "footer.cookies", href: "/cookies" },
];

/**
 * UNE RANGÉE DE LIENS derrière son intitulé. Deux enfants de grille, pas un
 * bloc : les deux intitulés se calent sur le plus long, quelle que soit la
 * langue, et les deux rangées de liens restent alignées.
 */
function FooterRow({
  title,
  links,
  t,
}: {
  title: string;
  links: FooterLink[];
  t: (k: LandingKey) => string;
}) {
  const id = `pied-${links[0]?.k ?? "x"}`;
  return (
    <>
      <p id={id} className="tv-label self-baseline text-slate-600">
        {title}
      </p>
      <ul
        aria-labelledby={id}
        className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-[13px]"
      >
        {links.map(({ k, href }) => (
          <li key={k}>
            <a
              href={href}
              /* 44 px au doigt, 28 à la souris : la cible tactile minimale. */
              className="-my-2 inline-flex min-h-[44px] items-center text-slate-400 transition-colors hover:text-white sm:-my-0.5 sm:min-h-[28px]"
            >
              {t(k)}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * LES RÉSEAUX — ceux qui existent, et eux seuls (`shared/socials.ts`). Un logo
 * de réseau est une affirmation — « nous sommes là ». `rel="me"` déclare que
 * le profil est bien le nôtre, pendant visible du `sameAs` structuré.
 */
function ReseauxSociaux() {
  if (!RESEAUX_ACTIFS.length) return null;
  return (
    <ul className="-ml-2.5 mt-5 flex items-center gap-0.5">
      {RESEAUX_ACTIFS.map((r) => (
        <li key={r.nom}>
          <a
            href={r.url}
            target="_blank"
            rel="me noopener noreferrer"
            aria-label={`${r.nom}, ${r.handle}`}
            title={`${r.nom} · ${r.handle}`}
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 transition-colors hover:text-white focus-visible:text-white"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[17px] w-[17px]">
              <path d={r.chemin} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * L'ÉTOILE TRUSTPILOT — reproduite, pas inventée. Le carré `#00b67a` est la
 * marque déposée de Trustpilot, ZONE GELÉE (`AGENTS.md`) : elle ne suit aucun
 * thème. AUCUNE NOTE, AUCUN NOMBRE D'AVIS : les cinq carrés sont le LOGO, et
 * le lien mène à la vraie fiche.
 */
function TrustpilotStar() {
  return (
    <span
      className="grid h-4 w-4 place-items-center rounded-[2px]"
      style={{ background: "#00b67a" }}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="#fff" aria-hidden>
        <path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.5 1.6 6.6L12 17l-5.9 3.5 1.6-6.6L2.5 9.4l6.8-.6z" />
      </svg>
    </span>
  );
}

/**
 * LA BANDE DE CONFIANCE — une seule plaque : comment les trades entrent à
 * gauche, la preuve que d'autres l'utilisent à droite.
 */
function BandeConfiance({ t }: { t: (k: LandingKey) => string }) {
  const portes: LandingKey[] = ["platforms.i1", "platforms.i2", "platforms.i3", "platforms.i4"];
  return (
    <div className="reveal lq-card flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-8">
      <div className="min-w-0">
        <p className="tv-label text-slate-500">{t("platforms.label")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-7 gap-y-2">
          {portes.map((k) => (
            <span key={k} className="text-[15px] font-semibold text-slate-300">
              {t(k)}
            </span>
          ))}
        </div>
      </div>
      <span className="hidden h-12 w-px shrink-0 bg-white/[.08] lg:block" />
      <a
        href={TRUSTPILOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-2.5 text-[13px] text-slate-400 transition-colors hover:text-white"
      >
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <TrustpilotStar key={i} />
          ))}
        </span>
        {t("v2.trust.reviews")} <span className="font-semibold text-white">Trustpilot</span>
      </a>
    </div>
  );
}

/* ─────────────────────────── TÊTE DE SECTION ─────────────────────────── */
/**
 * Deux temps, le second en gris (`.lq-h2-soft`) : un titre n'est jamais peint
 * en vert, le vert appartient aux actions et aux résultats.
 */
function SectionHead({ a, b, sub, tag }: { a: string; b?: string; sub?: string; tag?: string }) {
  return (
    <div className="reveal lq-head">
      {tag && <p className="lq-tag">{tag}</p>}
      <h2 className="lq-h2">
        {a}
        {b && (
          <>
            {" "}
            <span className="lq-h2-soft">{b}</span>
          </>
        )}
      </h2>
      {sub && <p className="lq-sub">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────── LES DEUX OFFRES ─────────────────────────── */
/**
 * UNE TUILE DE PRIX — le chiffre héros de l'offre, son rythme, une phrase.
 *
 * Les montants sortent du catalogue (`MONTHLY_EUR`, `LIFETIME_EUR`) et passent
 * par `eur()` : ils ne peuvent diverger ni de `/pricing`, ni de Stripe. La
 * licence porte le liseré d'accent et la phrase calculée qui la relie au
 * mensuel (`breakEvenCopy`).
 */
function TuilePrix({
  titre,
  montant,
  rythme,
  phrase,
  note,
  vedette = false,
}: {
  titre: string;
  montant: string;
  rythme: string;
  phrase: string;
  note?: string;
  vedette?: boolean;
}) {
  return (
    <div className={`lq-price-tile${vedette ? " lq-price-tile--featured" : ""}`}>
      <p className="lq-price-name">{titre}</p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="lq-price-figure tv-figure">{montant}</span>
        <span className="text-[13px] font-medium text-slate-400">{rythme}</span>
      </p>
      <p className="mt-3 text-[13px] leading-6 text-slate-300">{phrase}</p>
      {note && <p className="mt-1 text-[12.5px] leading-5 text-slate-500">{note}</p>}
    </div>
  );
}

/* ─────────────────────────── INTENTION D'AUTHENTIFICATION ─────────────── */
/**
 * L'intention portée par l'adresse (`?auth=…`, ou l'erreur d'un retour OAuth).
 * Lue une seule fois par document, puis retirée de l'adresse : recharger
 * après avoir fermé le formulaire ne le rouvre pas.
 */
type IntentionAuth = { mode: "login" | "signup"; error?: string };
let intentionAuth: IntentionAuth | null | undefined;

function lireIntentionAuth(): IntentionAuth | null {
  if (intentionAuth !== undefined) return intentionAuth;
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const voulu = url.searchParams.get("auth");
  const erreur = oauthErrorFromUrl(url.search, url.hash);
  if (!voulu && !erreur) {
    intentionAuth = null;
    return null;
  }
  intentionAuth = { mode: voulu === "signup" ? "signup" : "login", error: erreur ?? undefined };
  for (const k of ["auth", "error", "error_code", "error_description"]) url.searchParams.delete(k);
  const propre = erreur ? "" : url.hash;
  window.history.replaceState(window.history.state, "", url.pathname + url.search + propre);
  return intentionAuth;
}

function oublierIntentionAuth() {
  intentionAuth = null;
}

/* ─────────────────────────── LA VISITE (bento) ─────────────────────────── */
/* L'ORDRE EST UN TRAJET : le trade entre (Journal), le mois se lit
   (Calendrier), on mesure (Analyses), puis le geste qui agit AVANT le clic
   (Checklist). Largeurs sur six colonnes : 4 + 2, puis 3 + 3. */
const ECRANS_BENTO: EcranBento[] = [
  { nom: "journal", titre: "v2.s5.t", texte: "v2.s5.d", alt: "shot.journal.alt", largeur: 4 },
  { nom: "calendar", titre: "lq.cal.t", texte: "lq.cal.d", alt: "shot.calendar.alt", largeur: 2 },
  {
    nom: "analytics",
    titre: "v2.s3.t",
    texte: "v2.s3.d",
    alt: "shot.analytics.alt",
    largeur: 3,
  },
  {
    nom: "checklist",
    titre: "v2.s6.t",
    texte: "v2.s6.d",
    alt: "shot.checklist.alt",
    largeur: 3,
  },
];

/* La boucle en quatre gestes : la rangée d'actions rondes de l'app, transposée.
   Le premier disque est plein (l'action d'entrée), les autres en plaque. */
const GESTES: { icone: IName; titre: LandingKey; texte: LandingKey }[] = [
  { icone: "plus", titre: "lq.how.1.t", texte: "lq.how.1.d" },
  { icone: "chart", titre: "lq.how.2.t", texte: "lq.how.2.d" },
  { icone: "brain", titre: "lq.how.3.t", texte: "lq.how.3.d" },
  { icone: "target", titre: "lq.how.4.t", texte: "lq.how.4.d" },
];

/* ─────────────────────────── LANDING ─────────────────────────── */
function LandingPage() {
  const { t, lang } = useLandingT();
  const [auth, setAuth] = useState(false);
  const [demo, setDemo] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [authError, setAuthError] = useState<string | undefined>();
  const [faq, setFaq] = useState<number | null>(0);
  const [activeSec, setActiveSec] = useState("");
  /* `collee` est le SEUL état que le défilement fait remonter à React, et il
     ne change que deux fois par visite. La jauge et la parallaxe sont écrites
     directement dans le DOM par `useDefilementSansRendu`. */
  const [collee, setCollee] = useState(false);
  const jaugeRef = useRef<HTMLDivElement>(null);
  const parallaxeRef = useRef<HTMLDivElement>(null);
  const racineRef = useRef<HTMLDivElement>(null);
  /* Lu une seule fois par document : la même valeur sert au fondu d'ensemble,
     à la reprise de position et à la suppression de la cascade. */
  const repriseLangue = useRef(typeof window === "undefined" ? null : lireLePassage()).current;
  useApparitions(racineRef, Boolean(repriseLangue));
  const lenis = useLenis();
  const reduitLeMouvement = usePrefereMoinsDeMouvement();
  useDefilementSansRendu({
    jauge: jaugeRef,
    parallaxe: parallaxeRef,
    surCollee: setCollee,
    reduit: reduitLeMouvement,
  });

  const problems = [
    { n: "err" as IName, t: t("problem.p1.t"), d: t("problem.p1.d") },
    { n: "heart" as IName, t: t("problem.p2.t"), d: t("problem.p2.d") },
    { n: "compass" as IName, t: t("problem.p3.t"), d: t("problem.p3.d") },
  ];
  // Les objections, dans l'ordre où elles viennent. Ce tableau alimente À LA
  // FOIS l'accordéon et le balisage `FAQPage` : les deux ne peuvent pas
  // diverger. « Le gratuit est-il vraiment gratuit ? » vit sur `/pricing`,
  // où on se la pose vraiment.
  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("price.faq3.q"), a: t("price.faq3.a") },
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
  ];
  const mensuel = eur(MONTHLY_EUR, lang);
  const licence = eur(LIFETIME_EUR, lang);
  const telephone = shot("dashboard-m");

  /**
   * LA REPRISE APRÈS UN CHANGEMENT DE LANGUE : on retombe sur l'ancre
   * franchie, pas sur un nombre de pixels (les deux langues n'ont pas la même
   * hauteur). Deux passes — au montage, puis après `load` — abandonnées si le
   * visiteur a déjà touché au défilement.
   */
  useEffect(() => {
    if (!repriseLangue) return;
    let intact = true;
    const touche = () => {
      intact = false;
    };
    const poser = () => {
      if (!intact) return;
      const y = positionDeReprise(repriseLangue);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    };
    poser();
    window.addEventListener("wheel", touche, { passive: true, once: true });
    window.addEventListener("touchstart", touche, { passive: true, once: true });
    window.addEventListener("keydown", touche, { once: true });
    const apres = () => requestAnimationFrame(poser);
    if (document.readyState === "complete") apres();
    else window.addEventListener("load", apres, { once: true });
    return () => {
      window.removeEventListener("wheel", touche);
      window.removeEventListener("touchstart", touche);
      window.removeEventListener("keydown", touche);
      window.removeEventListener("load", apres);
    };
  }, [repriseLangue, lenis]);

  const scrollLockRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let demande = 0;
    const mesurer = () => {
      demande = 0;
      if (scrollLockRef.current) return;
      const pos = window.scrollY + 120;
      let cur = "";
      for (const { id } of LIENS_NAV) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= pos) cur = id;
      }
      // Une mesure par image, pas par évènement : quatre lectures de
      // géométrie après une invalidation forcent la remise en page.
      setActiveSec(cur);
    };
    const auDefilement = () => {
      if (!demande) demande = requestAnimationFrame(mesurer);
    };
    mesurer();
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => {
      window.removeEventListener("scroll", auDefilement);
      cancelAnimationFrame(demande);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const open = (mode: "login" | "signup", plan?: string) => {
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuthError(undefined);
    setAuth(true);
  };

  /* LES ADRESSES QUI OUVRENT LE FORMULAIRE (`/login`, `/signup`… redirigées
     ici avec `?auth=`), et le retour d'un Google raté (`error=…`). Lue UNE
     fois et gardée jusqu'à la fermeture : c'est la DERNIÈRE instance montée
     qui doit l'ouvrir. */
  useEffect(() => {
    const intention = lireIntentionAuth();
    if (!intention) return;
    setAuthMode(intention.mode);
    setAuthPlan(undefined);
    setAuthError(intention.error);
    setAuth(true);
  }, []);

  const go = (id: string) => {
    setActiveSec(id);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollLockRef.current = true;
    const cible = document.getElementById(id);
    /* Sous Lenis, c'est lui qui fait le trajet ; `allerVers` rend la durée
       réelle du voyage, et le verrou du scrollspy se relâche à l'arrivée. */
    const duree =
      cible && lenis?.options.smoothWheel
        ? allerVers(lenis, cible)
        : (cible?.scrollIntoView({ behavior: "smooth", block: "start" }), 1000);
    scrollTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, duree + 80);
  };

  return (
    <div
      ref={racineRef}
      className="landing-root min-h-screen overflow-x-clip bg-[var(--tv-bg)] text-white"
    >
      {/* La même orbe que dans l'app, sous le contenu (`z-index: 0`). */}
      <CursorOrb />
      <MegaNav activeSec={activeSec} go={go} open={open} collee={collee} jauge={jaugeRef} />

      <main className="relative z-10">
        {/* ── HÉROS ──
            CENTRÉ, COMME L'ACCUEIL DE L'APP. Le tableau de bord de l'app
            ouvre sur un bloc centré — le chiffre, son libellé, les actions —
            et c'est cette composition que la vitrine reprend : la promesse au
            centre, le produit en scène juste dessous, qui affleure dès le
            premier écran sur un portable de 900 px.

            Le texte est resserré (titre plafonné, sous-titre court) pour que
            le haut de la capture reste dans le premier écran : une promesse
            sans le produit sous les yeux reste une affirmation. */}
        <section className="lq-hero">
          <div className="lp-container">
            <div className="lq-hero-copy">
              <p className="fade-up lq-tag">{t("v2.hero.eyebrow")}</p>
              {/* Deux temps : la capacité, puis la faille — et l'accent sur
                  « quand ça compte », le MOMENT, seul endroit où il ajoute du
                  sens. Le passage à la ligne est la respiration voulue. */}
              <h1 className="fade-up lq-h1">
                {t("hero.h1a")}
                <br />
                <span className="lq-h2-soft">{t("hero.h1b1")}</span>
                <span className="mark-accent">{t("hero.h1b2")}</span>
              </h1>
              <p className="fade-up d2 lq-hero-sub">
                {t("v2.hero.sub.a")}
                <span className="font-semibold text-white">{t("v2.hero.sub.b")}</span>
                {t("v2.hero.sub.c")}
              </p>
              {/* UN bouton plein (créer un compte), et un lien qui répond à la
                  question qui suit toute accroche — « combien ? » — avec le
                  prix d'entrée, tiré du catalogue. */}
              <div className="fade-up d3 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => open("signup", t("nav.cta.plan"))}
                  className="btn-primary w-full sm:w-auto"
                >
                  {t("hero.cta")} <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <a
                  href="#pricing"
                  className="btn-secondaire min-h-[44px] w-full px-5 text-sm sm:w-auto"
                >
                  {t("lq.hero.from")} <span className="tv-figure">{mensuel}</span>
                  {t("lq.perMonth")}
                </a>
              </div>
              <div className="fade-up d4 mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {[t("hero.t1"), t("hero.t2"), t("hero.t3")].map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-[13px] text-slate-400">
                    <Check className="h-3.5 w-3.5 text-[var(--tv-chart-green)]" />
                    {s}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setDemo(true)}
                className="fade-up d4 group mt-3 inline-flex min-h-[44px] items-center gap-2.5 whitespace-nowrap text-sm text-slate-400 transition-colors hover:text-white"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--tv-plate-3)] text-[var(--tv-accent)]">
                  <Icon n="play" cls="h-3 w-3 translate-x-[1px] fill-current" />
                </span>
                {t("hero.demo")}
                <span className="text-slate-600">· {t("hero.demo.len")}</span>
              </button>
            </div>

            {/* LA SCÈNE : l'écran de bureau, et le même tableau de bord sur
                téléphone posé devant, en bas à droite (bureau seulement). La
                parallaxe (6 % du défilement, plafonnée) vit sur un élément
                INTÉRIEUR : une animation CSS en `fill: both` sur l'extérieur
                battrait le style en ligne. */}
            <div className="fade-up d4 lq-hero-stage">
              <div ref={parallaxeRef}>
                <ShotOuVisuel
                  nom="dashboard"
                  alt={t("shot.dashboard.alt")}
                  priorite
                  hero
                  repli={null}
                />
              </div>
              {telephone && (
                <div className="lq-phone" aria-hidden>
                  <img src={telephone} alt="" loading="lazy" decoding="async" />
                </div>
              )}
            </div>
            <p className="lq-demo-note">{t("lq.shot.demo")}</p>
          </div>
        </section>

        {/* ── CONFIANCE : comment ça rentre, et la vraie fiche d'avis ── */}
        <section className="relative pb-6">
          <div className="lp-container">
            <BandeConfiance t={t} />
          </div>
        </section>

        {/* ── LE PROBLÈME, PUIS SON PRIX ──
            Trois symptômes qu'on reconnaît en une seconde, puis un écran
            réel qui met un montant dessus : on passe du « c'est moi » au « et
            ça me coûte ça » en un défilement. Le liseré rouge des cartes est
            sémantique (`--tv-chart-red` = ce qui coûte). */}
        <section id="problem" className="lq-section">
          <div className="lp-container">
            <SectionHead a={t("problem.title.a")} b={t("problem.title.b")} sub={t("problem.sub")} />
            <div className="grid gap-4 sm:grid-cols-3">
              {problems.map((p) => (
                <article key={p.t} className="reveal lq-card lq-symptom">
                  <span className="lq-disc lq-disc--red">
                    <Icon n={p.n} cls="h-5 w-5" />
                  </span>
                  <h3 className="lq-card-title mt-5">{p.t}</h3>
                  <p className="lq-card-body">{p.d}</p>
                </article>
              ))}
            </div>

            <div className="reveal mt-16 text-center lg:mt-20">
              <p className="lq-tag text-[var(--tv-chart-red)]">{t("cout.tag")}</p>
              <h3 className="lq-h3 mx-auto mt-4 max-w-[680px]">
                {t("cout.title.a")} <span className="mark-accent">{t("cout.title.b")}</span>
              </h3>
              <p className="lq-sub mx-auto mt-4 max-w-[560px]">{t("cout.sub")}</p>
            </div>
            <div className="reveal mt-9">
              <ShotOuVisuel
                nom="mistakes"
                alt={t("shot.mistakes.alt")}
                repli={null}
                className="tour-shot"
              />
            </div>
          </div>
        </section>

        {/* ── LA BOUCLE, EN QUATRE GESTES ──
            La rangée d'actions rondes du tableau de bord (Trade · Importer ·
            Checklist · Jarvis) devient la mécanique du produit : un disque,
            un verbe, une phrase. Le premier est plein — c'est l'action
            d'entrée —, les autres en plaque, comme dans l'app. */}
        <section className="lq-section">
          <div className="lp-container">
            <SectionHead
              tag={t("lq.how.tag")}
              a={t("lq.how.title.a")}
              b={t("lq.how.title.b")}
              sub={t("lq.how.sub")}
            />
            <ol className="lq-steps">
              {GESTES.map((g, i) => (
                <li key={g.titre} className="reveal lq-step">
                  <span className={`lq-action${i === 0 ? " lq-action--primary" : ""}`}>
                    <Icon n={g.icone} cls="h-5 w-5" />
                  </span>
                  <span className="lq-step-num tv-figure">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="lq-card-title mt-1">{t(g.titre)}</h3>
                  <p className="lq-card-body max-w-[240px]">{t(g.texte)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <TourProduit ecrans={ECRANS_BENTO} />

        {/* ── JARVIS : LE COACH QUI MONTRE SES CHIFFRES ──
            La preuve que l'IA ne raconte pas d'histoires : une vraie réponse,
            et à côté les trois règles qui la tiennent — chiffres et
            échantillon, lecture seule du passé, rien sans accord. */}
        <section className="lq-section">
          <div className="lp-container">
            <div className="lq-duo">
              <div className="reveal lq-duo-text">
                <p className="lq-tag">{t("lq.jarvis.tag")}</p>
                <h2 className="lq-h2 mt-4 text-left">{t("v2.s2.t")}</h2>
                <p className="lq-sub mt-4 text-left">{t("v2.s2.d")}</p>
                <ul className="mt-7 space-y-3">
                  {(["lq.jarvis.p1", "lq.jarvis.p2", "lq.jarvis.p3"] as LandingKey[]).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-3 text-[14px] leading-6 text-slate-300"
                    >
                      <span className="lq-disc lq-disc--sm">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {t(k)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal lq-duo-scene">
                <ShotOuVisuel
                  nom="jarvis"
                  alt={t("shot.jarvis.alt")}
                  className="lq-jarvis-shot"
                  repli={null}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── CE QU'ON NE FERA JAMAIS ── trois engagements vérifiables, pas
            de note ni de nombre d'avis : nous n'en inventons pas. */}
        <section id="trust" className="lq-section">
          <div className="lp-container">
            <SectionHead a={t("v2.trust.title")} sub={t("v2.trust.sub")} />
            <TrustStrip />
          </div>
        </section>

        {/* ── LES TARIFS ──
            L'ancrage est ARITHMÉTIQUE : on ne se compare pas à un journal
            moins cher, on se compare à ce que coûte un challenge qu'on se
            saborde. À gauche le prix du marché d'un reset (la fourchette du
            secteur), à droite les deux offres, au mois ou une fois — montants
            du catalogue, donc identiques à `/pricing` et à Stripe. */}
        <section id="pricing" className="lq-section">
          <div className="lp-container">
            <SectionHead tag={t("pricing.tag")} a={t("pricing.title")} sub={t("anchor.sub")} />

            <div className="reveal lq-pricing">
              <div className="lq-card lq-cost">
                <span className="lq-rail" aria-hidden />
                <p className="tv-label text-slate-500">{t("anchor.a.l")}</p>
                <p className="lq-price-figure tv-figure mt-3 text-[var(--tv-chart-red)]">
                  {t("anchor.a.v")}
                </p>
                <p className="mt-3 text-[13px] leading-6 text-slate-400">{t("anchor.a.d")}</p>
                <p className="mt-auto pt-6 text-[15px] font-semibold text-white">
                  {t("anchor.punch")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TuilePrix
                  titre={t("lq.price.monthly")}
                  montant={mensuel}
                  rythme={t("lq.perMonth")}
                  phrase={t("lq.price.monthly.d")}
                />
                <TuilePrix
                  vedette
                  titre={t("lq.price.lifetime")}
                  montant={licence}
                  rythme={t("lq.price.once")}
                  phrase={t("lq.price.lifetime.d")}
                  note={breakEvenCopy(lang)}
                />
                <p className="text-center text-[12.5px] text-slate-500 sm:col-span-2">
                  {t("lq.price.same")}
                </p>
              </div>
            </div>

            <div className="reveal mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => open("signup", t("nav.cta.plan"))}
                className="btn-primary w-full sm:w-auto"
              >
                {t("hero.cta")} <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <a
                href="/pricing"
                className="btn-secondaire min-h-[44px] w-full px-5 text-sm sm:w-auto"
              >
                {t("lq.price.compare")}
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {(
                [
                  ["shield", "pricing.trust1"],
                  ["lock", "pricing.trust2"],
                  ["check", "pricing.trust3"],
                ] as [IName, LandingKey][]
              ).map(([ic, k]) => (
                <span
                  key={k}
                  className="flex items-center gap-2 text-[13px] font-medium text-slate-500"
                >
                  <Icon n={ic} cls="h-4 w-4 text-[var(--tv-chart-green)]" />
                  {t(k)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ, EN DEUX COLONNES ── le titre à gauche (avec le seul
            recours utile : quelqu'un à qui écrire), l'accordéon à droite. */}
        <section id="faq" className="lq-section">
          <div className="lp-container">
            {/* `FAQPage` — construit à partir du MÊME tableau `faqs` que
                l'accordéon : incapable d'en diverger, et il suit la langue
                rendue (`/fr` publie la FAQ française). */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: faqPageJsonLd(faqs) }}
            />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
              <div className="reveal lg:sticky lg:top-28 lg:self-start">
                <h2 className="lq-h2 text-left">{t("faq.title")}</h2>
                <p className="mt-4 text-[14px] leading-6 text-slate-500">{t("faq.aside")}</p>
                <a
                  href="/contact"
                  className="group mt-4 inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-[var(--tv-highlight)] transition-colors hover:text-white"
                >
                  {t("faq.aside.cta")}
                  <Icon
                    n="arrow"
                    cls="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </div>

              <div className="reveal lq-card lq-faq">
                {faqs.map(({ q, a }, i) => {
                  const o = faq === i;
                  return (
                    <div key={q} className="faq-ligne" data-ouverte={o ? "oui" : "non"}>
                      <button
                        onClick={() => setFaq(o ? null : i)}
                        aria-expanded={o}
                        className="group flex w-full items-center justify-between gap-5 py-5 text-left"
                      >
                        <span
                          className={`text-base font-semibold transition-colors group-hover:text-white ${o ? "text-white" : "text-slate-300"}`}
                        >
                          {q}
                        </span>
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-transform duration-300 ${o ? "rotate-180 bg-[var(--tv-plate-3)] text-white" : "bg-[var(--tv-plate-2)] text-slate-400"}`}
                        >
                          <Icon n="chevron" cls="h-4 w-4" />
                        </span>
                      </button>
                      <div className={`faq-body ${o ? "faq-open" : ""}`}>
                        <div>
                          <p className="pb-5 pr-8 text-[15px] leading-7 text-slate-400">{a}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── une plaque qui se referme : elle se lit comme une
            conclusion. Plus de lueur derrière le titre — rien ne rayonne. */}
        <section className="lq-section">
          <div className="lp-container">
            <div className="reveal lq-card lq-final">
              <h2 className="lq-h2">
                {t("cta.title.a")}
                <br />
                <span className="lq-h2-soft">{t("cta.title.b")}</span>
              </h2>
              <button
                onClick={() => open("signup", t("nav.cta.plan"))}
                className="btn-primary mt-9 px-8 py-3 text-lg"
              >
                {t("hero.cta")} <Icon n="arrow" cls="h-5 w-5" />
              </button>
              <p className="mt-5 text-sm text-slate-500">{t("cta.note")}</p>
            </div>
          </div>
        </section>

        {/* ── PIED DE PAGE ── deux bandes : l'identité et les liens, puis les
            droits et la langue. Pas de second bouton d'inscription à 200 px
            du premier : il partagerait le clic au lieu de l'additionner. */}
        <footer className="relative section-divider pb-8 pt-10">
          <div className="lp-container">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
              <div className="shrink-0">
                <Logo />
                <p className="mt-3 max-w-[260px] text-[13px] leading-6 text-slate-500">
                  {t("footer.tagline")}
                </p>
                <ReseauxSociaux />
              </div>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr] sm:gap-y-4 lg:min-w-0 lg:flex-1 lg:max-w-[640px]">
                <FooterRow title={t("footer.product")} links={FOOTER_PRODUCT} t={t} />
                {/* Le filet commence à la colonne des liens (style, pas
                    classe : `col-start-2` n'était pas généré ici). */}
                <div
                  aria-hidden
                  style={{ gridColumnStart: 2 }}
                  className="hidden h-px bg-white/[.06] sm:block"
                />
                <FooterRow title={t("footer.legal")} links={FOOTER_LEGAL} t={t} />
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/[.06] pt-5">
              <p className="text-[12px] text-slate-600">{t("footer.rights")}</p>
              <LangMenuPied />
            </div>
          </div>
        </footer>
      </main>

      {auth && (
        <Suspense fallback={null}>
          <AuthModal
            initialMode={authMode}
            plan={authPlan}
            initialError={authError}
            onClose={() => {
              oublierIntentionAuth();
              setAuth(false);
            }}
          />
        </Suspense>
      )}
      {demo && (
        <Suspense fallback={null}>
          <DemoModal onClose={() => setDemo(false)} />
        </Suspense>
      )}
      <CookieConsent />
    </div>
  );
}

/**
 * `lang` — la langue portée par l'URL, quand l'URL en porte une. `/` sert
 * l'anglais (`SSR_LANG`) et laisse la préférence du visiteur reprendre la main
 * après hydratation ; `/fr` sert le français dès le rendu serveur, et l'impose.
 */
export default function Landing({ lang }: { lang?: LandingLang } = {}) {
  return (
    <LandingLangProvider pinned={lang}>
      {/* Le défilement doux vit ICI : il disparaît avec la landing, avant que
          l'application ne s'affiche. */}
      <DefilementDoux>
        <LandingPage />
      </DefilementDoux>
    </LandingLangProvider>
  );
}
