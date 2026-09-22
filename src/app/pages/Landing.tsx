import { useEffect, useRef, useState } from "react";
// Les cinq logos de réseaux sociaux ont quitté cet import avec les liens morts
// qu'ils portaient : voir le pied de page plus bas.
import { Check } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { ShotOuVisuel } from "./landing/ProductShot";
import { AuthModal } from "./landing/AuthModal";
import { TrustStrip } from "./landing/Showcase";
import { TRUSTPILOT_URL } from "@/shared/site";
import { TourProduit } from "./landing/Tour";
import { CursorOrb } from "./landing/CursorOrb";
import { LIENS_NAV } from "./landing/nav";
import MegaNav from "./landing/MegaNav";
import { LangMenuPied } from "./landing/LangMenu";
import { CookieConsent } from "./landing/CookieConsent";
import { faqPageJsonLd } from "@/shared/seo";
import { YEARLY_PER_MONTH, eur } from "../utils/pricing";
import {
  LandingLangProvider,
  useLandingT,
  type LandingKey,
  type LandingLang,
} from "./landing/i18n";
import "./landing.css";

/**
 * UN MONTANT, FACE À UN AUTRE.
 *
 * Les deux panneaux de l'ancrage tarifaire. Ils ne diffèrent que par leur
 * RAIL de gauche — rouge pour ce que coûte un reset, émeraude pour ce que
 * coûte l'abonnement. Le reste est identique, et c'est voulu : deux plaques
 * de valeurs différentes se compareraient mal, l'œil attribuerait l'écart à
 * la mise en forme plutôt qu'aux chiffres.
 *
 * Le rail suffit à porter le sens, et il ne remplit rien : l'accent reste
 * rare, la couleur dit « perte » ou « offre » sur trois pixels de large.
 */
function PanneauAncrage({
  variante,
  label,
  valeur,
  suffixe,
  detail,
}: {
  variante: "cout" | "offre";
  label: string;
  valeur: string;
  suffixe?: string;
  detail: string;
}) {
  const offre = variante === "offre";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 sm:p-7 ${
        offre
          ? "border-[rgb(var(--tv-accent-rgb)/0.3)] bg-[var(--tv-plate-1)]"
          : "border-white/[0.07] bg-white/[0.015]"
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${
          offre ? "bg-[var(--tv-accent)]" : "bg-[var(--tv-chart-red)]"
        }`}
        aria-hidden
      />
      <p className="tv-label text-slate-500">{label}</p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span
          className={`tv-figure text-[clamp(1.9rem,4vw,2.6rem)] leading-none ${
            offre ? "text-white" : "text-[var(--tv-chart-red)]"
          }`}
        >
          {valeur}
        </span>
        {suffixe && <span className="text-[13px] text-slate-500">{suffixe}</span>}
      </p>
      <p className="mt-3 text-[13px] leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

/* ─────────────────────────── LOGO ────────────────────────── */
function Logo() {
  return (
    // `href="/"`, pas `href="#"`. Le logo est le lien de retour à l'accueil le
    // plus universellement compris du web, et c'est le seul lien qu'un robot
    // d'indexation s'attend à trouver sur chaque page. Pointé sur `#`, il ne
    // désignait rien.
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
 * LES LIENS DU PIED DE PAGE — deux colonnes, huit liens.
 *
 * Il y en avait TREIZE, répartis sur « Produit » (5), « Ressources » (4) et
 * une barre basse de liens légaux (4), soit trois blocs pour une seule
 * fonction. Un pied de page n'est pas un plan du site : c'est la sortie de
 * secours de quelqu'un qui n'a pas trouvé ce qu'il cherchait plus haut.
 *
 * Ce qui a disparu, et pourquoi :
 * - « Le problème », « Edge Score », « Confiance » : trois ancres vers des
 *   sections que le visiteur vient de traverser pour arriver ici. Les
 *   reproposer en bas, c'est lui demander de remonter lire ce qu'il a déjà lu.
 * - « Démo guidée » + « Démo en vidéo » : deux entrées pour une même
 *   intention. Celle qui reste est la démo du site, qui montre le produit.
 * - La barre basse : ses quatre liens légaux étaient une TROISIÈME colonne
 *   déguisée en ligne. Ils rejoignent la colonne « Légal », où ils ont
 *   toujours eu leur place.
 *
 * Chaque entrée désigne une ancre RÉELLE de cette page ou une route RÉELLE du
 * produit — `tests/seo.test.ts` le vérifie. Le lien vers `/demo-site` est
 * délibéré bien que la route soit en `noindex` : elle est utile au visiteur,
 * et un lien vers une page non indexée reste un lien parfaitement valide.
 */
type FooterLink = { k: LandingKey; href: string };

const FOOTER_PRODUCT: FooterLink[] = [
  { k: "footer.f3", href: "#product" },
  { k: "footer.f4", href: "/pricing" },
  { k: "footer.r1", href: "/demo-site" },
  { k: "footer.r3", href: "#faq" },
  /* « Contact » vivait sous l'intitulé LÉGAL. Écrire à quelqu'un n'est pas
     un acte juridique, et sa présence dans cette colonne faisait passer les
     quatre documents pour cinq. */
  { k: "footer.r4", href: "/contact" },
];

/* Les QUATRE documents, dans le même ordre que la navigation des pages
   légales (`LEGAL_ROUTES`) : on retrouve la liste telle qu'on l'a quittée. */
const FOOTER_LEGAL: FooterLink[] = [
  { k: "footer.terms", href: "/terms" },
  { k: "footer.cgu", href: "/cgu" },
  { k: "footer.privacy", href: "/privacy" },
  { k: "footer.cookies", href: "/cookies" },
];

/**
 * UNE RANGÉE DE LIENS, PAS UNE COLONNE.
 *
 * Les deux colonnes empilaient quatre et cinq liens, soit près de 160px de
 * hauteur pour neuf mots. Un pied de page n'est pas un sommaire : on n'y
 * descend pas pour lire, on y descend pour attraper UN lien précis. Mis en
 * ligne derrière leur intitulé, les mêmes neuf liens tiennent sur deux
 * lignes, et le regard les balaie au lieu de les parcourir.
 *
 * Rien n'a été retiré : c'est la FORME qui se simplifie, pas le fond.
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
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-5">
      <p className="tv-label w-[72px] shrink-0 text-slate-600">{title}</p>
      <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-[13px]">
        {links.map(({ k, href }) => (
          <li key={k}>
            <a
              href={href}
              /* 44 px au doigt, 28 à la souris. C'est la cible tactile
                 minimale recommandée ; sous elle, on vise le lien d'à côté. */
              className="-my-2 inline-flex min-h-[44px] items-center text-slate-400 transition-colors hover:text-white sm:-my-0.5 sm:min-h-[28px]"
            >
              {t(k)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * L'ÉTOILE TRUSTPILOT — reproduite, pas inventée.
 *
 * Le carré vert `#00b67a` est la marque déposée de Trustpilot, et `AGENTS.md`
 * la déclare ZONE GELÉE : elle ne suit aucun thème, elle ne s'accorde à rien.
 * La repeindre à l'accent du produit serait une contrefaçon de badge de
 * confiance — exactement ce qu'un visiteur ne peut pas vérifier d'un coup
 * d'œil, donc exactement ce qu'on ne fait pas.
 *
 * AUCUNE NOTE, AUCUN NOMBRE D'AVIS. Les cinq carrés sont le LOGO de
 * Trustpilot, pas une note de 5/5 : le lien mène au vrai profil, où le
 * visiteur lit ce qui s'y trouve réellement.
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
 * LA BANDE DE CONFIANCE — une seule plaque, deux informations.
 *
 * Il y en avait DEUX, empilées : les quatre portes d'entrée dans une carte,
 * puis le lien Trustpilot dans une autre, 32px plus bas. Deux plaques
 * centrées l'une sur l'autre pour dire la même chose — « ça rentre vite, et
 * d'autres l'utilisent » — c'est 190px de page pour une idée, et deux fois
 * le même geste de lecture.
 *
 * Fusionnées : comment les trades entrent à gauche, la preuve à droite. On
 * lit la bande d'un coup au lieu de la parcourir deux fois.
 *
 * AUCUNE NOTE, AUCUN NOMBRE D'AVIS. Les cinq carrés sont le LOGO de
 * Trustpilot, pas un 5/5 : le lien mène à la vraie fiche, où le visiteur lit
 * ce qui s'y trouve réellement. C'est la seule preuve sociale honnête dont
 * on dispose, et l'inventer est la première ligne que `landing-copy`
 * interdit.
 *
 * Le carré vert `#00b67a` est la marque déposée de Trustpilot, et
 * `AGENTS.md` la déclare ZONE GELÉE : elle ne suit aucun thème.
 */
function BandeConfiance({ t }: { t: (k: LandingKey) => string }) {
  const portes: LandingKey[] = ["platforms.i1", "platforms.i2", "platforms.i3", "platforms.i4"];
  return (
    <div className="reveal flex flex-col gap-6 rounded-2xl border border-white/[.07] bg-white/[.02] px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-8">
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

      {/* Le filet vertical ne sépare qu'à partir de `lg` : empilées, les deux
          moitiés n'ont pas besoin d'être séparées, elles le sont déjà. */}
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

/* ─────────────────────────── HOOKS ─────────────────────────── */
function useScroll() {
  const [y, setY] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const h = () => {
      const sy = window.scrollY;
      setY(sy);
      const m = document.documentElement.scrollHeight - window.innerHeight;
      setPct(m > 0 ? Math.min(sy / m, 1) : 0);
    };
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return { y, pct };
}
/**
 * « Moins de mouvement », lu une seule fois.
 *
 * Au rendu serveur `matchMedia` n'existe pas : on part donc de `false` et on
 * corrige au montage. Partir de `true` serait plus prudent en apparence, mais
 * produirait un saut visible chez la majorité des visiteurs, qui n'ont rien
 * demandé - et la parallaxe qu'on neutralise ici ne coûte rien à personne le
 * temps d'une image.
 */
function usePrefereMoinsDeMouvement() {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduit(mq.matches);
    const on = () => setReduit(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduit;
}

function useReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────────────── SPLINE · COURBE ─────────────────────────── */
/* ─────────────────────────── SECTION HEAD ─────────────────────────── */
function SectionHead({ title, sub }: { title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold tracking-[-0.03em] text-white leading-[1.1]">
        {title}
      </h2>
      {sub && <p className="mt-4 leading-7 text-slate-400">{sub}</p>}
    </div>
  );
}

/* LE GÉNÉRATEUR DE COURBES A SUIVI LES MAQUETTES QU'IL DESSINAIT.
 *
 * `buildSpline` et ses deux jeux de points ne servaient qu'aux replis
 * supprimés juste en dessous. Une spline Catmull-Rom qui ne trace plus rien
 * est exactement le genre de code qu'on retrouve dans six mois en se
 * demandant quelle courbe elle alimente.
 */

/* LA TROISIÈME MAQUETTE DE REPLI EST PARTIE AVEC LES DEUX AUTRES.
 *
 * `AnalyticsSection` servait de repli à l'étape « analyses » de la visite,
 * et portait elle-même un second repli pour les rapports mensuels : une
 * courbe d'equity dessinée à la main, « +$4,218.50 · 6m », « Win rate
 * 64 % », « Profit factor 2.31 », « Sharpe 1.96 ». Quatre métriques de
 * performance inventées, présentées comme un aperçu du produit.
 *
 * Celle-là était la plus dangereuse des trois : `monthly-reports.webp`
 * n'est PAS publié — le compte vitrine n'a jamais généré de rapport, la
 * page tombe sur son état vide, et le harnais refuse donc d'encoder cette
 * capture (voir le commentaire dans `scripts/capture-product.mjs`). Le
 * repli était le SEUL rendu possible de ce bloc. Il n'attendait pas une
 * panne pour publier des chiffres faux : il le faisait déjà, dès que
 * `analytics.webp` venait à manquer.
 *
 * Repli `null`. Une capture absente ne montre rien.
 */

/* LA QUATRIÈME ET DERNIÈRE MAQUETTE DE REPLI.
 *
 * `MistakesSection` dessinait trois « fuites » avec leur coût : Revenge
 * trading −$1,240, FOMO entry −$890, Overtrading −$670. Aucun de ces
 * montants ne vient d'un compte ; ils ont été choisis pour être crédibles,
 * ce qui est précisément le problème.
 *
 * Avec les trois autres, c'était le dernier endroit de la vitrine où un
 * chiffre fabriqué pouvait atteindre l'écran. Il n'en reste aucun : toute
 * valeur affichée vient soit d'une capture du produit, soit du catalogue
 * d'offres. `tests/productShots.test.ts` en fait une règle.
 */

/* ─────────────────────────── USE CASES ─────────────────────────── */

/* ─────────────────────────── EXCEL / NOTION ─────────────────────────── */

/* ─────────────────────────── NAV ─────────────────────────── */
/**
 * LES SECTIONS SUIVIES PAR LE SCROLLSPY.
 *
 * Elles doivent correspondre EXACTEMENT aux liens de `MegaNav` : une section
 * suivie ici mais absente de la barre rendrait `activeSec` égal à un identifiant
 * qu'aucun lien ne porte — donc aucun lien actif pendant toute la traversée de
 * cette section, ce qui se lit comme un bug de navigation.
 */

/* ─────────────────────────── LANDING ─────────────────────────── */
function LandingPage() {
  const { t, lang } = useLandingT();
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [faq, setFaq] = useState<number | null>(0);
  const [activeSec, setActiveSec] = useState("");
  const { y, pct } = useScroll();
  useReveal();
  /* Lu UNE fois, pas à chaque rendu : `matchMedia` n'existe pas au rendu
     serveur, et l'interroger soixante fois par seconde pendant un défilement
     serait du gâchis pour une valeur qui ne change quasiment jamais. */
  const reduitLeMouvement = usePrefereMoinsDeMouvement();
  // Plafonnée à 60px : au-delà, la capture se décroche du texte qu'elle
  // illustre et on lit deux blocs qui glissent l'un contre l'autre.
  const parallaxe = Math.min(y * 0.06, 60);

  const problems = [
    { n: "err" as IName, t: t("problem.p1.t"), d: t("problem.p1.d") },
    { n: "heart" as IName, t: t("problem.p2.t"), d: t("problem.p2.d") },
    { n: "compass" as IName, t: t("problem.p3.t"), d: t("problem.p3.d") },
  ];
  // Six objections, dans l'ordre où elles viennent. Ce tableau alimente À LA
  // FOIS l'accordéon et le balisage `FAQPage` : les deux ne peuvent pas
  // diverger.
  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    /* « Le gratuit est-il vraiment gratuit ? » a quitté cette liste : c'est
       maintenant la première question de `/pricing`, où elle arrive au
       moment où on se la pose vraiment. La garder ici la faisait poser deux
       fois, à deux endroits, avec le risque que les deux réponses divergent
       le jour où l'offre change. */
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
  ];
  const scrollLockRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onScroll = () => {
      if (scrollLockRef.current) return;
      const pos = window.scrollY + 120;
      let cur = "";
      for (const { id } of LIENS_NAV) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= pos) cur = id;
      }
      setActiveSec(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const open = (mode: "login" | "signup", plan?: string) => {
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuth(true);
  };
  const go = (id: string) => {
    setActiveSec(id);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollLockRef.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    scrollTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, 1000);
  };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[var(--tv-bg)] text-white">
      {/* La lueur qui suit le pointeur. Montée AVANT tout le reste : elle vit
          sous le contenu (`z-index: 0`) et ne doit jamais passer devant. */}
      <CursorOrb />
      <MegaNav activeSec={activeSec} go={go} open={open} y={y} pct={pct} />

      <main className="relative z-10">
        {/* ── HERO ──
            TEXTE À GAUCHE, PRODUIT À DROITE. LES DEUX DANS LE PREMIER ÉCRAN.

            La capture a d'abord vécu dans une colonne étroite (vignette
            illisible), puis en pleine largeur SOUS le texte. La pleine largeur
            réglait la lisibilité et créait un autre problème : sur un portable
            de 900px de haut, l'écran d'ouverture ne montrait que du texte. Le
            produit commençait sous la ligne de flottaison, et la promesse du
            titre restait une affirmation jusqu'au premier défilement.

            Côte à côte, les deux sont là d'emblée : on lit la promesse ET on
            voit ce qu'on achète, sans un geste. La capture déborde
            volontairement à droite (`hero-shot-bleed`) — un écran coupé par le
            bord se lit comme une fenêtre sur quelque chose de plus grand,
            là où une image entière et centrée se lit comme une illustration.

            Sous 1024px la pile reprend : à cette largeur, deux colonnes
            donneraient deux vignettes au lieu d'une lecture. */}
        <section className="relative overflow-hidden pt-[104px] pb-10 lg:pt-[132px] lg:pb-16">
          <div className="lp-container">
            <div className="hero-grid">
              <div className="hero-copy">
                {/* Le titre se lit en DEUX TEMPS : la capacité, puis la faille.
                    Le passage à la ligne n'est pas une mise en page, c'est la
                    respiration qui fait porter le second membre — mis bout à
                    bout, les deux propositions se lisaient comme une seule
                    phrase et le contre-temps disparaissait. */}
                {/* La taille plafonne à 3.2rem, pas 4.2 : la colonne de texte
                    fait ~600px, et à 67px la première proposition passait
                    elle-même à la ligne — le titre montait à quatre lignes et
                    le passage à la ligne VOULU ne se distinguait plus des
                    passages subis. À 51px, chaque proposition tient sa place. */}
                {/* Le titre monte à 4.4rem : centré sur 3xl, chaque proposition
                  tient sa ligne, et l'accroche pèse enfin ce qu'elle doit
                  peser en haut d'une page de vente. */}
                {/* À QUI ON PARLE — la ligne qui manquait.
                  Le héros disait ce que le produit fait et à quelle douleur il
                  répond, jamais POUR QUI. Un trader en challenge prop-firm ne
                  se reconnaissait qu'au bout de trois sections ; un
                  investisseur long terme, lui, descendait toute la page avant
                  de comprendre qu'elle ne lui était pas destinée. Une ligne
                  sourde au-dessus du titre suffit à faire les deux tris, et
                  elle ne coûte rien à la lecture de l'accroche. */}
                <p className="fade-up tv-label mb-4 text-[var(--tv-text-secondary)]">
                  {t("v2.hero.eyebrow")}
                </p>
                {/* LA TAILLE SUIT LA COLONNE, PAS L'ENVIE.
                    4.4rem était calibré pour une accroche CENTRÉE sur toute
                    la largeur. Dans une colonne de ~520px, la même valeur
                    mettait le titre sur quatre lignes et repoussait le bouton
                    sous la ligne de flottaison : on avait rendu le produit
                    visible et perdu l'action. À 3.1rem chaque proposition
                    tient sur deux lignes au plus, et le bloc entier reste
                    dans le premier écran. */}
                {/* TROIS TEMPS, ET L'ACCENT SUR LE TROISIÈME.
                    Le second membre était gris, au motif qu'il énonce le
                    problème et qu'on ne peint pas un problème de la couleur
                    du succès. L'argument tient pour la phrase - pas pour ses
                    trois derniers mots : « quand ça compte » n'est pas le
                    problème, c'est le MOMENT, et c'est le seul endroit de
                    l'accroche où l'accent ajoute du sens. */}
                <h1 className="fade-up font-display text-[clamp(2.05rem,3.3vw,2.8rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-balance text-white">
                  {t("hero.h1a")}
                  <br />
                  <span className="text-[var(--tv-text-secondary)]">{t("hero.h1b1")}</span>
                  <span className="mark-accent">{t("hero.h1b2")}</span>
                </h1>
                {/* LA VERSION COURTE DU SOUS-TITRE.
                  L'ancienne énumérait les trois symptômes — dérive de taille,
                  overtrading, entrées hors plan. C'est exactement le travail
                  de la section « Le problème », 400px plus bas : deux blocs
                  répondaient à la même objection, et le héros payait la
                  redite en 37 mots. Ici on garde la mécanique (lit, chiffre,
                  donne une règle) ; les symptômes se lisent juste après. */}
                <p className="fade-up d2 mt-5 max-w-[560px] text-[17px] leading-7 text-slate-400">
                  {t("v2.hero.sub.a")}
                  {/* LE SEUL SURLIGNEUR DE LA PAGE.
                      Un groupe de mots porté par l'accent, pas une phrase :
                      surligner une phrase entière ne souligne rien, ça
                      repeint. Et c'est la PROMESSE qu'on surligne, jamais le
                      nom du produit - si on ne lit que trois mots, ce sont
                      ceux-là qu'il faut avoir lus. */}
                  <span className="mark-accent font-semibold">{t("v2.hero.sub.b")}</span>
                  {t("v2.hero.sub.c")}
                </p>
                {/* DEUX ACTIONS, ET LA SECONDE N'EST PAS UNE DÉMO.
                    Le lien secondaire menait à la visite guidée. Or la
                    question qui suit immédiatement une accroche n'est pas
                    « montre-moi », c'est « combien ». Il mène donc aux
                    tarifs.

                    La hiérarchie reste franche : un bouton plein, un lien
                    bordé. Deux boutons pleins côte à côte partagent le clic
                    au lieu de l'additionner. */}
                <div className="fade-up d3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
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
                    {t("hero.pricing")}
                  </a>
                </div>
                <div className="fade-up d4 mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {[t("hero.t1"), t("hero.t2"), t("hero.t3")].map((s) => (
                    <span key={s} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                      <Check className="h-3.5 w-3.5 text-[var(--tv-chart-green)]" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* LA CAPTURE PASSE DEVANT LE DESSIN.
                  `DESIGN.md` : « lead EVERY section with a product screenshot ».
                  Tant qu'aucun `dashboard.*` n'est déposé dans
                  `src/assets/product/`, le dessin ci-dessous tient la place ;
                  le fichier posé, il s'efface. */}
              {/* LA PARALLAXE DU HÉROS.
                  La capture remonte de 6 % de la distance défilée, plafonnée
                  à 60px. C'est peu, et c'est voulu : au-delà, l'image se
                  décroche du texte qu'elle illustre et on lit deux blocs qui
                  bougent l'un par rapport à l'autre. À cette amplitude on ne
                  voit pas un effet, on sent que la page a de l'épaisseur.

                  `transform` seul, donc composité par le GPU : aucune remise
                  en page, aucun repeint. Neutralisée si le visiteur a demandé
                  moins de mouvement - `y` est alors simplement ignoré. */}
              <div
                className="fade-up d4 hero-shot-col"
                style={
                  reduitLeMouvement ? undefined : { transform: `translate3d(0,${-parallaxe}px,0)` }
                }
              >
                <ShotOuVisuel
                  nom="dashboard"
                  alt={t("shot.dashboard.alt")}
                  /* Pas de légende dans le héros : le titre juste à gauche dit
                     déjà ce qu'on regarde, et une ligne de texte sous l'image
                     casserait le débordement qui fait tout l'effet. */
                  priorite
                  hero
                  repli={null}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── UNE SEULE BANDE DE CONFIANCE ──
            Il y en avait DEUX, empilées : les quatre portes d'entrée dans
            une carte, puis le lien Trustpilot dans une autre, 32px plus bas.
            Deux plaques centrées l'une sur l'autre pour dire la même chose —
            « ça rentre vite, et d'autres l'utilisent » — c'est 190px de page
            pour une seule idée, et deux fois le même geste de lecture.

            Fusionnées, elles se lisent d'un coup : ce qui te fait entrer à
            gauche, la preuve que tu n'es pas le premier à droite. */}
        <section className="relative pb-12 lg:pb-16">
          <div className="lp-container">
            <BandeConfiance t={t} />
          </div>
        </section>

        {/* ── LE PROBLÈME, PUIS SON PRIX ──
            La section nommait trois symptômes et s'arrêtait là. Nommer une
            douleur sans la CHIFFRER, c'est de la psychologie de comptoir :
            le visiteur acquiesce et passe à autre chose, parce que rien ne
            lui a montré que ça lui coûte quelque chose.

            La capture des erreurs monte donc ICI, juste sous les trois
            cartes, au lieu d'attendre le milieu de la visite. C'est le
            contraste sur lequel toute la page repose : trois phrases qui
            font mal, puis un écran réel qui met un montant dessus. On passe
            du « oui, c'est moi » au « et ça me coûte ça » en un défilement.

            Effet de bord voulu : la première grande capture après le héros
            arrive 2 000px plus tôt qu'avant. */}
        <section id="problem" className="relative section-divider py-12 sm:py-16 lg:py-24">
          <div className="lp-container">
            <SectionHead
              title={
                <>
                  {t("problem.title.a")}{" "}
                  <span className="text-[var(--tv-text-secondary)]">{t("problem.title.b")}</span>
                </>
              }
              sub={t("problem.sub")}
            />
            {/* Les trois symptômes portent un liseré ROUGE à gauche. C'est la
                seule place du rouge sur la vitrine, et elle est sémantique :
                le produit garde le vert pour ce qui va, le rouge pour ce qui
                coûte (`--tv-chart-red`). Trois cartes grises se lisaient
                comme trois fonctionnalités. */}
            <div className="grid gap-4 sm:grid-cols-3">
              {problems.map((p) => (
                <article key={p.t} className="reveal carte-symptome p-6">
                  <div className="feat-icon feat-icon--rouge mb-4 h-11 w-11">
                    <Icon n={p.n} cls="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{p.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>

            {/* LA BASCULE. Une seule phrase entre la douleur et sa preuve,
                et c'est elle qui fait tout le travail émotionnel : elle
                annonce un montant, et l'écran juste dessous le donne. */}
            <div className="reveal mt-16 text-center lg:mt-20">
              <p className="tv-label text-[var(--tv-chart-red)]">{t("cout.tag")}</p>
              <h3 className="mx-auto mt-4 max-w-[680px] font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
                {t("cout.title.a")} <span className="mark-accent">{t("cout.title.b")}</span>
              </h3>
              <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-7 text-slate-400">
                {t("cout.sub")}
              </p>
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

        <TourProduit
          /* L'ORDRE EST UN TRAJET, PAS UN CATALOGUE.
             Le trade entre (Journal), on le mesure (Analytics), on voit ce
             qu'il coûte (Erreurs), on voit ce qu'on n'a pas pris et ce qui
             arrive (la grille), et Jarvis lit l'ensemble. Chaque temps a sa
             propre composition ; c'est `Tour.tsx` qui les porte. */
          journal={{
            nom: "journal",
            titre: "v2.s5.t",
            texte: "v2.s5.d",
            alt: "shot.journal.alt",
            repli: null,
          }}
          analytics={{
            nom: "analytics",
            titre: "v2.s3.t",
            texte: "v2.s3.d",
            alt: "shot.analytics.alt",
            repli: null,
          }}
          /* Quatre écrans qui portent chacun un argument que rien d'autre ne
             porte, et qui ne méritent pas une rangée entière chacun : ce
             serait quatre écrans de page en plus pour quatre phrases. */
          /* L'ORDRE SUIT LA SÉANCE, pas l'importance : ce qu'on regarde avant
             d'ouvrir, puis ce qui arrive pendant, puis ce qu'on relit après.
             C'est ce que dit l'étiquette de MOMENT en tête de chaque carte,
             et c'est ce qui manquait le plus - « Où ton compte peut
             atterrir » ne dit pas tout seul qu'il s'agit de projection. */
          secondaires={[
            {
              nom: "checklist",
              moment: "moment.avant",
              titre: "v2.s6.t",
              texte: "v2.s6.d",
              alt: "shot.checklist.alt",
            },
            {
              nom: "news",
              moment: "moment.jour",
              titre: "v2.s9.t",
              texte: "v2.s9.d",
              alt: "shot.news.alt",
            },
            {
              nom: "missed",
              moment: "moment.apres",
              titre: "v2.s8.t",
              texte: "v2.s8.d",
              alt: "shot.missed.alt",
            },
            {
              nom: "montecarlo",
              moment: "moment.suite",
              titre: "v2.s7.t",
              texte: "v2.s7.d",
              alt: "shot.montecarlo.alt",
            },
          ]}
          jarvis={{
            nom: "jarvis",
            titre: "v2.s2.t",
            texte: "v2.s2.d",
            alt: "shot.jarvis.alt",
            repli: null,
          }}
        />

        {/* ── CONFIANCE ──
            Ce qui reste est vérifiable : les trois engagements de sécurité.
            Pas de note, pas de nombre d'avis, pas d'étoiles - nous n'en
            avons pas, et les inventer est la ligne que `landing-copy`
            interdit en premier. Le lien vers la vraie fiche est remonté dans
            la bande sous le héros, là où il sert encore à décider. */}
        <section id="trust" className="relative section-divider py-10 sm:py-14 lg:py-20">
          <div className="lp-container">
            <SectionHead title={t("v2.trust.title")} sub={t("v2.trust.sub")} />
            <div className="mt-10">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* ── LE PRIX, EN UN BLOC, QUI MÈNE À /pricing ──
            La grille complète vivait ICI, et elle vit maintenant sur sa
            propre adresse. La garder aux deux endroits, c'était présenter
            deux fois la même décision : une fois au bout d'un parcours, une
            fois sur une page qu'on ouvre AVEC la question. Et c'était 900px
            de landing pour un composant qui se partage mieux seul.

            Ce qui reste est ce qu'il faut pour décider de CLIQUER : l'ancrage
            (on se compare à un challenge raté, jamais à un journal moins
            cher), le montant d'entrée, et le fait que le gratuit n'expire
            pas. Le reste est à un clic. */}
        <section id="pricing" className="relative section-divider py-12 sm:py-16 lg:py-24">
          <div className="lp-container">
            <div className="reveal mx-auto max-w-[760px] text-center">
              <p className="tv-label text-[var(--tv-highlight)]">{t("pricing.tag")}</p>
              <h2 className="mt-4 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
                {t("pricing.title")}
              </h2>
              <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-7 text-slate-400">
                {t("anchor.sub")}
              </p>
            </div>

            {/* ── L'ANCRAGE, MONTRÉ AU LIEU D'ÊTRE RACONTÉ ──
                L'argument de cette section est ARITHMÉTIQUE : on ne se
                compare pas à un journal moins cher, on se compare à ce que
                coûte un challenge qu'on se saborde. Il était écrit en
                paragraphe, au milieu d'une colonne de texte centré — donc
                lu comme une opinion, alors que c'est une soustraction.

                Deux montants face à face, et l'écart se voit sans être
                calculé. Celui de gauche est le prix du marché d'un reset
                (la fourchette du secteur, pas un chiffre inventé) ; celui
                de droite vient du catalogue `@/domain/plans`, donc il ne
                peut pas diverger de `/pricing` ni de Stripe. */}
            <div className="reveal mx-auto mt-11 grid max-w-[880px] gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-0">
              <PanneauAncrage
                variante="cout"
                label={t("anchor.a.l")}
                valeur={t("anchor.a.v")}
                detail={t("anchor.a.d")}
              />
              <div className="flex items-center justify-center py-1 sm:px-6">
                <span className="tv-label text-slate-600">{t("anchor.vs")}</span>
              </div>
              <PanneauAncrage
                variante="offre"
                label={t("anchor.b.l")}
                valeur={eur(Math.round(YEARLY_PER_MONTH * 100) / 100, lang)}
                suffixe={t("anchor.b.per")}
                detail={t("anchor.b.d")}
              />
            </div>
            <p className="reveal mt-6 text-center text-[15px] font-semibold text-white">
              {t("anchor.punch")}
            </p>

            <div className="reveal mx-auto max-w-[760px] text-center">
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-3">
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
                  {t("hero.pricing")}
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {[
                  ["shield", "pricing.trust1"],
                  ["lock", "pricing.trust2"],
                  ["check", "pricing.trust3"],
                ].map(([ic, s2]) => (
                  <span
                    key={s2}
                    className="flex items-center gap-2 text-[13px] font-medium text-slate-500"
                  >
                    <Icon n={ic as IName} cls="h-4 w-4 text-[var(--tv-chart-green)]" />
                    {t(s2 as LandingKey)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ, EN DEUX COLONNES ──
            Elle était une colonne de 760px centrée sous son titre : le titre
            prenait sa propre bande de hauteur, l'accordéon commençait
            300px plus bas, et les deux tiers de la largeur restaient vides
            de chaque côté. Le titre passe à gauche, en vis-à-vis, et la
            page cesse de descendre pour rien. Il y tient compagnie au seul
            recours utile ici : quelqu'un à qui écrire quand la réponse
            n'est pas dans la liste. */}
        <section id="faq" className="relative section-divider py-12 sm:py-16 lg:py-20">
          <div className="lp-container">
            {/* `FAQPage` — construit à partir du MÊME tableau `faqs` que
                l'accordéon rendu juste en dessous, donc incapable d'en
                diverger. C'est le contenu le plus directement extractible du
                site, par un moteur de recherche comme par un moteur de
                réponse, et il n'était balisé nulle part.

                Émis dans le corps plutôt que dans `head()` : le JSON doit
                sortir VERBATIM (`head()` sérialise des balises, pas un corps de
                script), et schema.org accepte le JSON-LD partout dans le
                document. Autre bénéfice : le balisage suit automatiquement la
                langue rendue, donc `/fr` publie la FAQ française. */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: faqPageJsonLd(faqs) }}
            />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
              <div className="reveal lg:sticky lg:top-28 lg:self-start">
                <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
                  {t("faq.title")}
                </h2>
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

              <div className="reveal border-t border-white/[.08]">
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
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${o ? "rotate-180 border-[rgb(var(--tv-accent-rgb)/0.4)] bg-[rgb(var(--tv-accent-rgb)/0.1)] text-[var(--tv-highlight)]" : "border-white/[.12] text-slate-500"}`}
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

        {/* ── CTA FINAL ──
            Il flottait au milieu de 200px de vide haut et bas, sur le fond
            de la page : rien ne disait que c'était la fin, seulement que la
            page continuait. Il devient une PLAQUE — la même grammaire de
            surface que les cartes du reste de la vitrine — posée entre la
            FAQ et le pied de page. Un bloc qui se referme se lit comme une
            conclusion, et il n'a plus besoin de deux cents pixels de marge
            pour exister. */}
        <section className="relative section-divider py-14 lg:py-20">
          <div className="lp-container">
            <div className="reveal relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[var(--tv-plate-1)] px-6 py-14 text-center sm:px-10 lg:py-16">
              {/* La seule lueur de la section, très basse, posée derrière le
                  titre : elle sépare la plaque du fond sans rien éclairer. */}
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--tv-accent-rgb)/0.1),transparent_70%)]"
                aria-hidden
              />
              <div className="relative mx-auto max-w-[680px]">
                <h2 className="font-display text-[clamp(2rem,4.4vw,3.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                  {t("cta.title.a")}
                  <br />
                  <span className="text-accent">{t("cta.title.b")}</span>
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
          </div>
        </section>

        {/* ── PIED DE PAGE ──
            Deux bandes, et c'est tout.

            Il en faisait près de 400px. La cause n'était pas le nombre de
            liens mais leur DISPOSITION : trois colonnes empilées, un CTA, un
            sélecteur de langue et une mention de droits, chacun sur sa
            propre ligne. Un pied de page n'est pas une page : on y descend
            pour attraper un lien, pas pour lire.

            Bande haute : l'identité à gauche, les neuf liens à droite sur
            deux rangées derrière leur intitulé. Bande basse : les droits et
            la langue, épaule contre épaule.

            Le bouton « Get Started » du pied de page a disparu. Il vivait à
            200px du bouton plein de la section précédente — deux appels
            identiques aussi près ne doublent pas le clic, ils le partagent,
            et le second se lit comme une insistance. */}
        <footer className="relative section-divider pb-8 pt-10">
          <div className="lp-container">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
              <div className="shrink-0">
                <Logo />
                <p className="mt-3 max-w-[260px] text-[13px] leading-6 text-slate-500">
                  {t("footer.tagline")}
                </p>
              </div>
              <div className="flex flex-col gap-3.5 lg:min-w-0 lg:flex-1 lg:max-w-[640px]">
                <FooterRow title={t("footer.product")} links={FOOTER_PRODUCT} t={t} />
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

      {auth && <AuthModal initialMode={authMode} plan={authPlan} onClose={() => setAuth(false)} />}
      <CookieConsent />
    </div>
  );
}

/**
 * `lang` — la langue portée par l'URL, quand l'URL en porte une.
 *
 * `/` sert l'anglais (`SSR_LANG`) et laisse la préférence enregistrée du
 * visiteur reprendre la main après hydratation. `/fr` sert le français dès le
 * rendu serveur, et l'impose : c'est l'adresse qui fait foi. Voir
 * `shared/lang.ts` pour la raison — jusqu'ici la vitrine française n'avait
 * aucune adresse, donc aucune existence pour un moteur de recherche.
 */
export default function Landing({ lang }: { lang?: LandingLang } = {}) {
  return (
    <LandingLangProvider pinned={lang}>
      <LandingPage />
    </LandingLangProvider>
  );
}
