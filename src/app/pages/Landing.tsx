import { PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { PlayCircle, Twitter, Linkedin, Instagram, Facebook, Youtube } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { FeaturesBento } from "./landing/FeaturesBento";
import { PlatformsStrip, TraderProof, TrustStrip } from "./landing/Showcase";
import MegaNav from "./landing/MegaNav";
import { CookieConsent } from "../components/CookieConsent";
import PricingPlans from "../components/pricing/PricingPlans";
import { LandingLangProvider, useLandingT } from "./landing/i18n";
import {
  BackgroundGrid,
  JourneyCurve,
  PillarCards,
  SectionHead,
  StepCards,
  type Milestone,
  type Pillar,
} from "./landing/Sections";
import "./landing.css";

/* ─────────────────────────── LOGO ────────────────────────── */
function Logo({ compact = false }: { compact?: boolean }) {
  const s = compact ? 28 : 34;
  return (
    <a
      href="#"
      className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)] rounded-sm"
    >
      <img
        src={logoSrc}
        alt="TradeVault"
        width={s}
        height={s}
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain`}
      />
      <span
        className={`font-display font-bold tracking-[-0.02em] text-white leading-none hidden sm:block ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}
      >
        TradeVault
      </span>
    </a>
  );
}

/* ─────────────────────────── CURSOR GLOW ─────────────────────────── */
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    let tx = window.innerWidth / 2,
      ty = window.innerHeight / 2,
      cx = tx,
      cy = ty,
      raf = 0,
      active = false;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!active) {
        active = true;
        el.style.opacity = "1";
      }
    };
    const onLeave = () => {
      active = false;
      el.style.opacity = "0";
    };
    const tick = () => {
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return <div ref={ref} className="landing-cursor-glow" aria-hidden="true" />;
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
function useReveal() {
  useEffect(() => {
    // Sous « réduire les animations », on ne masque rien et on n'observe rien :
    // le contenu reste tel qu'il est rendu.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Signale au CSS que le script est vivant : lui seul autorise l'état masqué,
    // donc un échec de chargement ne peut pas laisser la page vide.
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
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
function useCountdown() {
  const calc = () => {
    const n = new Date();
    const d = n.getDay();
    if (d === 0 || d === 6) return null;
    const o = new Date(n);
    o.setHours(9, 30, 0, 0);
    const df = o.getTime() - n.getTime();
    return df > 0 ? df : null;
  };
  const [ms, setMs] = useState<number | null>(calc);
  useEffect(() => {
    const id = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ─────────────────────────── SPARKLINE ─────────────────────────── */
function Sparkline({ points, up = true }: { points: string; up?: boolean }) {
  const gid = useRef(`sg${Math.random().toString(36).slice(2, 8)}`);
  return (
    <svg viewBox="0 0 96 32" className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid.current} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={up ? "var(--tv-highlight)" : "#f87171"} stopOpacity=".25" />
          <stop offset="1" stopColor={up ? "var(--tv-highlight)" : "#f87171"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 96,32 0,32`} fill={`url(#${gid.current})`} />
      <polyline
        points={points}
        fill="none"
        stroke={up ? "var(--tv-highlight)" : "#f87171"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="spark-line"
      />
    </svg>
  );
}

/**
 * La spline de la courbe héros — même famille que le `natural` de recharts.
 *
 * Catmull-Rom passe par TOUS les points et se convertit exactement en cubiques
 * de Bézier : c'est la façon standard d'obtenir, en SVG statique, la courbe que
 * la bibliothèque de graphes dessine dans l'application. Calculée une fois au
 * chargement du module, pas à chaque rendu.
 */
const HERO_PTS: [number, number][] = [
  [0, 112],
  [38, 96],
  [76, 102],
  [114, 74],
  [152, 88],
  [190, 56],
  [228, 70],
  [266, 36],
  [304, 50],
  [340, 20],
];

const HERO_D = (() => {
  const p = HERO_PTS;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    // Tension 1/6 : la conversion canonique Catmull-Rom → Bézier.
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
})();

/* ─────────────────────────── HERO PRODUCT VISUAL ─────────────────────────── */
function HeroProductVisual() {
  const { t } = useLandingT();
  return (
    <div className="relative">
      {/* ── LA CARTE HÉROS ──
          C'est la vitrine du produit : elle doit être la MÊME pièce que la
          courbe d'equity réelle, pas une illustration qui lui ressemble. Ce
          qui a changé, et pourquoi :
            • la surface passe du bleu marine (#0a1625, hérité de l'ancienne
              identité) à la plaque des cartes du produit. Quelqu'un qui
              s'inscrit après avoir vu la landing retrouve la même matière ;
            • la courbe était une POLYLIGNE anguleuse ; c'est une spline,
              comme dans l'application ;
            • le dégradé sous le trait reprend les trois paliers de la
              référence (30 % / 10 % / 0) au lieu de deux ;
            • la grille passe du pointillé bleu au trait horizontal sourd ;
            • le ZÉRO en tirets rouges apparaît — c'est lui qui dit qui gagne,
              et il manquait ;
            • la pastille cyan lumineuse au bout du tracé a sauté : la courbe
              du produit ne porte aucun point au repos. */}
      <div className="relative rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-5 shadow-[0_30px_80px_rgba(0,0,0,.6)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="tv-label text-slate-500">{t("hero.eq")}</p>
            <p className="tv-figure mt-1 text-2xl text-[var(--tv-chart-green)]">+4 218,50 €</p>
          </div>
          <span className="lp-float-card lp-float-card-tick tv-figure mt-1 py-1 pr-2.5 text-[11px] text-[var(--tv-chart-green)]">
            +16.9%
          </span>
        </div>
        <div className="h-24 w-full">
          <svg viewBox="0 0 345 125" className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hf" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="var(--tv-chart-green)" stopOpacity=".3" />
                <stop offset=".55" stopColor="var(--tv-chart-green)" stopOpacity=".1" />
                <stop offset="1" stopColor="var(--tv-chart-green)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[30, 65, 100].map((yy) => (
              <path key={yy} d={`M0 ${yy}H345`} stroke="rgba(148,163,184,.08)" />
            ))}
            <path d={`${HERO_D} L340,125 L0,125 Z`} fill="url(#hf)" />
            <path
              d="M0 119H345"
              stroke="var(--tv-chart-red)"
              strokeWidth="2"
              strokeDasharray="7 7"
            />
            <path
              d={HERO_D}
              fill="none"
              stroke="var(--tv-chart-green)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="chart-line"
            />
          </svg>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[.08] pt-4">
          {[
            [t("hero.winrate"), "64%"],
            [t("hero.pf"), "2.31"],
            [t("hero.sharpe"), "1.84"],
          ].map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="tv-label text-slate-500">{l}</p>
              <p className="mt-1 font-display text-base font-bold text-[var(--lp-accent-soft)]">
                {v}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="float-a absolute -bottom-10 -left-6 z-10 w-[230px] rounded-xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-1)] p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden sm:block">
        <div className="flex items-center gap-2 mb-2">
          {/* Le dégradé cyan→bleu était le dernier reste de l'ancienne identité
              sur la landing, et il était codé en dur : il restait bleu quel que
              soit le thème. C'est la surface d'action du produit. */}
          <div className="tv-accent-fill grid h-6 w-6 place-items-center rounded-md">
            <Icon n="brain" cls="h-3.5 w-3.5" />
          </div>
          <p className="text-[11px] font-bold text-white">{t("hero.coach")}</p>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        <p className="text-[11px] leading-4 text-slate-300">
          {t("hero.coach.tip")}{" "}
          <span className="text-[var(--lp-accent-soft)] font-semibold">
            {t("hero.coach.action")}
          </span>
        </p>
      </div>

      <div className="float-b absolute -top-8 -right-5 z-10 w-[190px] rounded-xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-1)] p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden md:block">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon n="radar" cls="h-3.5 w-3.5 text-[var(--lp-accent-soft)]" />
          <p className="text-[11px] font-bold text-white">{t("hero.pattern")}</p>
        </div>
        <p className="text-[11px] leading-4 text-slate-300">
          <span className="text-[var(--lp-accent-soft)] font-semibold">
            {t("hero.pattern.tip")}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── AI CONVERSATION ─────────────────────────── */
function AIConversation() {
  const { t } = useLandingT();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[.08] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="tv-accent-fill grid h-9 w-9 place-items-center rounded-lg">
            <Icon n="brain" cls="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="tv-prose font-bold text-white">{t("ai.c.title")}</p>
            <p className="text-[11px] text-emerald-400">{t("ai.c.sub")}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("ai.c.active")}
        </span>
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-white/[.08] bg-white/[.05] px-4 py-2.5">
            <p className="tv-prose text-slate-200">{t("ai.c.q")}</p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-[rgb(var(--lp-accent-rgb)/0.20)] bg-[var(--lp-accent)]/[.05] p-3.5">
          <p className="tv-prose text-slate-200">{t("ai.c.a")}</p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
            <span className="tv-label text-emerald-400">{t("ai.c.plan")}</span>
          </div>
          <p className="tv-prose text-slate-200">{t("ai.c.plan.d")}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── SPOTLIGHT HELPER ─────────────────────────── */
function useSpot() {
  return (e: RPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
}

/* ─────────────────────────── SECTION TITLE ─────────────────────────── */
/**
 * `tag` reste dans la signature : il nomme la section pour la navigation et les
 * lecteurs d'écran (`aria-label`), mais il ne s'affiche plus au-dessus du titre.
 * Un kicker n'ajoute aucune information que le titre ne porte pas déjà — il ne
 * fait que retarder la lecture de la seule ligne qui compte.
 */
const NAV: [string, string][] = [
  ["nav.problem", "problem"],
  ["nav.features", "features"],
  ["pricing.tag", "pricing"],
  ["faq.tag", "faq"],
];

/* ─────────────────────────── LE PARCOURS ───────────────────────────
   Les cinq étapes vivaient sur une rangée de pastilles alignées, reliées par un
   trait horizontal. Une rangée met les cinq à ÉGALITÉ — or elles ne le sont
   pas : journaliser un trade est le pied de la pente, corriger un biais est le
   haut. La courbe ascendante le dit sans une phrase, et c'est le geste le plus
   réutilisable des deux références. */
function JourneySection() {
  const { t } = useLandingT();
  const milestones: Milestone[] = [
    { icon: "document", title: t("journey.s1.t"), sub: t("journey.s1.d"), state: "done" },
    { icon: "chart", title: t("journey.s2.t"), sub: t("journey.s2.d"), state: "done" },
    { icon: "radar", title: t("journey.s3.t"), sub: t("journey.s3.d"), state: "now" },
    { icon: "brain", title: t("journey.s4.t"), sub: t("journey.s4.d"), state: "next" },
    { icon: "target", title: t("journey.s5.t"), sub: t("journey.s5.d"), state: "next" },
  ];
  return (
    <section className="relative section-divider overflow-hidden py-14 lg:py-20">
      <BackgroundGrid />
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <SectionHead
          eyebrow={t("journey.tag")}
          title={
            <>
              {t("journey.title.a")} <span className="text-accent">{t("journey.title.b")}</span>
            </>
          }
          sub={t("journey.sub")}
        />
        <JourneyCurve milestones={milestones} />
      </div>
    </section>
  );
}

/* ─────────────────────────── LANDING ─────────────────────────── */
function LandingPage() {
  const { t, lang } = useLandingT();
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [faq, setFaq] = useState<number | null>(0);
  const [activeSec, setActiveSec] = useState("");
  const { y, pct } = useScroll();
  const cd = useCountdown();
  const spot = useSpot();
  useReveal();

  const problems = [
    { n: "err" as IName, t: t("problem.p1.t"), d: t("problem.p1.d") },
    { n: "heart" as IName, t: t("problem.p2.t"), d: t("problem.p2.d") },
    { n: "compass" as IName, t: t("problem.p3.t"), d: t("problem.p3.d") },
  ];
  const pillars: [Pillar, Pillar, Pillar] = [
    { icon: "document", title: t("pillars.p1.t"), body: t("pillars.p1.d") },
    { icon: "chart", title: t("pillars.p2.t"), body: t("pillars.p2.d") },
    { icon: "brain", title: t("pillars.p3.t"), body: t("pillars.p3.d") },
  ];
  const startSteps: [Pillar, Pillar, Pillar] = [
    { icon: "upload", title: t("start.s1.t"), body: t("start.s1.d") },
    { icon: "shield", title: t("start.s2.t"), body: t("start.s2.d") },
    { icon: "sparkle", title: t("start.s3.t"), body: t("start.s3.d") },
  ];
  const ais = [
    {
      n: "brain" as IName,
      t: t("ai.f1.t"),
      d: t("ai.f1.d"),
      c: "text-[var(--lp-accent-soft)]",
      spark: "0,24 14,22 28,20 42,16 56,18 70,10 84,12 96,6",
    },
    {
      n: "radar" as IName,
      t: t("ai.f2.t"),
      d: t("ai.f2.d"),
      c: "text-[var(--lp-accent-soft)]",
      spark: "0,26 14,20 28,22 42,14 56,16 70,8 84,10 96,4",
    },
    {
      n: "err" as IName,
      t: t("ai.f3.t"),
      d: t("ai.f3.d"),
      c: "text-amber-300",
      spark: "0,8 14,12 28,10 42,16 56,14 70,20 84,18 96,12",
    },
  ];
  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
  ];
  const scrollLockRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onScroll = () => {
      if (scrollLockRef.current) return;
      const pos = window.scrollY + 120;
      let cur = "";
      for (const [, id] of NAV) {
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
  const onHeroMove = (e: RPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[var(--tv-bg)] text-white selection:bg-[var(--lp-accent)] selection:text-[var(--tv-bg)]">
      <CursorGlow />
      <MegaNav activeSec={activeSec} go={go} open={open} y={y} pct={pct} />

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section
          className="relative overflow-hidden pt-[88px] pb-14 lg:pt-[112px] lg:pb-20"
          onPointerMove={onHeroMove}
        >
          {/* LA GRILLE D'ABORD, LE HALO ENSUITE — et un seul halo.
              Le héros portait DEUX nappes floues de 500px, une cyan et une
              indigo, sur un produit dont l'accent n'est ni l'un ni l'autre.
              Deux nappes colorées derrière un titre, ce n'est plus une
              profondeur, c'est un fond d'écran. Reste la grille — qui donne au
              noir un plan de référence sans y peindre quoi que ce soit — et une
              seule nappe d'accent, posée derrière le visuel produit. */}
          <BackgroundGrid />
          <div
            className="lp-halo"
            style={{ top: "-14%", right: "-6%", width: "520px", height: "420px" }}
          />

          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-[1.02fr_.98fr] lg:gap-14 lg:px-8">
            <div className="text-center lg:text-left">
              <div className="tv-label fade-up inline-flex items-center gap-2 rounded-full border border-[rgb(var(--lp-accent-rgb)/0.30)] bg-[var(--lp-accent)]/[.08] px-4 py-1.5 text-[var(--lp-accent-soft)]">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-[var(--lp-accent)]" />{" "}
                {t("hero.eyebrow")}
              </div>
              <h1 className="fade-up d1 font-display mt-6 text-[clamp(2.5rem,4.8vw,4rem)] font-bold leading-[1.05] tracking-[-0.03em] text-white">
                {t("hero.h1a")}{" "}
                <span className="text-accent relative inline-block">
                  {t("hero.h1b")}
                  <svg
                    className="scribble"
                    viewBox="0 0 300 20"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 14C40 6 70 18 105 12S190 4 226 12S280 16 296 8"
                      fill="none"
                      stroke="var(--tv-highlight)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="fade-up d2 mt-5 text-lg leading-7 text-slate-400 max-w-[560px] mx-auto lg:mx-0">
                {t("hero.sub")}
              </p>
              <div className="fade-up d3 mt-7 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <button onClick={() => open("signup", t("nav.cta.plan"))} className="lp-btn">
                  {t("hero.cta")} <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <a href="/demo-site" className="lp-btn lp-btn-ghost">
                  <PlayCircle className="h-4 w-4" />
                  {t("hero.demo")}
                </a>
              </div>
              <div className="fade-up d4 mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
                {[t("hero.t1"), t("hero.t2"), t("hero.t3")].map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                    <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
                    {s}
                  </span>
                ))}
              </div>
              <p className="fade-up d4 mt-5 flex items-start gap-2.5 text-[13px] leading-5 text-slate-500 max-w-[540px] mx-auto lg:mx-0">
                <Icon n="lock" cls="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>{t("hero.google")}</span>
              </p>
            </div>
            <div className="fade-up d2 w-full max-w-[460px] mx-auto lg:mx-0 lg:ml-auto mt-4">
              <HeroProductVisual />
            </div>
          </div>

          <div className="relative mx-auto mt-14 max-w-[1200px] px-5 lg:mt-16 lg:px-8">
            <PlatformsStrip />
          </div>
        </section>

        {/* ── PROBLÈME ── */}
        <section id="problem" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              eyebrow={t("problem.tag")}
              title={
                <>
                  {t("problem.title.a")}{" "}
                  <span className="text-slate-500">{t("problem.title.b")}</span>
                </>
              }
              sub={t("problem.sub")}
            />
            {/* Trois cartes à plat, toutes identiques : rien ne disait par où
                commencer. La rangée devient 01 · 02 · 03, et celle du MILIEU
                est pleine d'accent — c'est elle qui porte le bouton. Une seule
                par section, sinon le contraste ne désigne plus rien. */}
            <div className="grid gap-4 sm:grid-cols-3">
              {problems.map((p, i) => (
                <article
                  key={p.t}
                  onPointerMove={spot}
                  className="reveal spot lp-plate lp-plate-hover p-6"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="lp-ring h-10 w-10">
                      <Icon n={p.n} cls="h-[18px] w-[18px]" />
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--lp-text)]">{p.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--lp-text-2)]">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── LES TROIS PILIERS ──
            La réponse à la douleur qu'on vient de nommer, sous la forme de la
            première référence : 01/02/03, la médiane pleine et porteuse du CTA. */}
        <section className="relative section-divider overflow-hidden py-14 lg:py-20">
          <BackgroundGrid />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              eyebrow={t("pillars.eyebrow")}
              title={
                <>
                  {t("pillars.title.a")} <span className="text-accent">{t("pillars.title.b")}</span>
                </>
              }
              sub={t("pillars.sub")}
            />
            <PillarCards
              pillars={pillars}
              ctaLabel={t("pillars.cta")}
              onCta={() => go("features")}
            />
          </div>
        </section>

        {/* ── JOURNEY ── */}
        <JourneySection />

        {/* ── SECTION IA ── */}
        <section id="ai" className="relative section-divider overflow-hidden py-14 lg:py-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 45% at 50% 30%,rgb(var(--lp-accent-rgb)/.07),transparent 60%)",
            }}
          />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              eyebrow={t("ai.tag")}
              title={
                <>
                  {t("ai.title.a")} <span className="text-accent">{t("ai.title.b")}</span>
                </>
              }
              sub={t("ai.sub")}
            />
            <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-14 mb-12">
              <AIConversation />
              <div>
                <h3 className="font-display text-2xl font-bold text-white leading-tight mb-4">
                  {t("ai.head.a")}
                  <br />
                  <span className="text-accent">{t("ai.head.b")}</span>
                </h3>
                <p className="text-slate-400 leading-7 mb-6">{t("ai.body")}</p>
                <div className="space-y-3">
                  {[t("ai.b1"), t("ai.b2"), t("ai.b3")].map((s) => (
                    <div key={s} className="flex items-center gap-3 text-[15px] text-slate-300">
                      <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-[rgb(var(--lp-accent-rgb)/0.12)] text-[var(--lp-accent-soft)]">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {ais.map((a, i) => (
                <article
                  key={a.t}
                  onPointerMove={spot}
                  className="ai-card spot reveal p-5"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-xl border border-white/[.1] bg-white/[.04] ${a.c} mb-4`}
                  >
                    <Icon n={a.n} cls="h-5.5 w-5.5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{a.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{a.d}</p>
                  <div className="mt-3">
                    <Sparkline points={a.spark} up />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              eyebrow={t("features.tag")}
              title={
                <>
                  {t("features.title.a")}{" "}
                  <span className="text-accent">{t("features.title.b")}</span>{" "}
                  {t("features.title.c")}
                </>
              }
              sub={t("features.sub")}
            />
            <div className="reveal">
              <FeaturesBento />
            </div>
            <div className="reveal mt-10 text-center">
              <button
                onClick={() => open("signup", t("nav.cta.plan"))}
                className="btn-primary px-7 py-2.5 text-base"
              >
                {t("features.cta")} <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <p className="mt-3 text-[13px] text-slate-600">{t("features.cta.sub")}</p>
            </div>
          </div>
        </section>

        {/* ── QUI FAIT ÇA ── */}
        <section className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <TraderProof onStart={() => open("signup", t("nav.cta.plan"))} />
            <div className="mt-8">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        {/* ── LES TROIS PREMIÈRES MINUTES ──
            Placée juste avant le prix : c'est là que le visiteur se demande ce
            que commencer va lui coûter en temps. Trois cartes, la médiane
            pleine, et son bouton ouvre l'inscription. */}
        <section className="relative section-divider overflow-hidden py-14 lg:py-20">
          <BackgroundGrid />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              eyebrow={t("start.eyebrow")}
              title={
                <>
                  {t("start.title.a")} <span className="text-accent">{t("start.title.b")}</span>
                </>
              }
            />
            <StepCards steps={startSteps} ctaLabel={t("hero.cta")} onCta={() => open("signup")} />
          </div>
        </section>

        <section id="pricing" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              eyebrow={t("pricing.tag")}
              title={t("pricing.title")}
              sub={t("pricing.sub")}
            />

            {/* La grille tarifaire — le MÊME composant que dans l'application.
                Ce que le visiteur compare ici est exactement ce qu'il retrouve
                dans sa page d'abonnement, aux mêmes prix : il n'y a plus qu'un
                seul endroit où une offre est décrite. */}
            <div className="reveal">
              <PricingPlans
                lang={lang}
                onChoose={(plan) => open("signup", `TradeVault — ${plan}`)}
                onFree={() => open("signup", "Free")}
              />
            </div>

            <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                ["shield", "pricing.trust1"],
                ["lock", "pricing.trust2"],
                ["check", "pricing.trust3"],
              ].map(([ic, s]) => (
                <span
                  key={s}
                  className="flex items-center gap-2 text-sm font-medium text-slate-500"
                >
                  <Icon n={ic as IName} cls="h-4 w-4 text-emerald-400" />
                  {t(s)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[760px] px-5 lg:px-8">
            <SectionHead eyebrow={t("faq.tag")} title={t("faq.title")} />
            <div className="reveal border-t border-white/[.08]">
              {faqs.map(({ q, a }, i) => {
                const o = faq === i;
                return (
                  <div key={q} className="border-b border-white/[.08]">
                    <button
                      onClick={() => setFaq(o ? null : i)}
                      aria-expanded={o}
                      className="flex w-full items-center justify-between gap-5 py-5 text-left"
                    >
                      <span
                        className={`text-base font-semibold transition-colors ${o ? "text-white" : "text-slate-300"}`}
                      >
                        {q}
                      </span>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${o ? "rotate-180 border-[rgb(var(--lp-accent-rgb)/0.40)] bg-[rgb(var(--lp-accent-rgb)/0.10)] text-[var(--lp-accent-soft)]" : "border-white/[.12] text-slate-500"}`}
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
        </section>

        {/* ── CTA FINAL ── */}
        <section className="relative overflow-hidden section-divider py-20 lg:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgb(var(--lp-accent-rgb)/.12),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[720px] px-5 text-center">
            {cd && (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-amber-400/[.1] px-5 py-2 text-[12px] font-bold text-amber-300 mb-7">
                <span className="ping-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                {t("cta.countdown")} {cd}
              </div>
            )}
            <h2 className="font-display text-[clamp(2rem,4.4vw,3.2rem)] font-bold tracking-[-0.03em] text-white leading-[1.08] mb-6">
              {t("cta.title.a")}
              <br />
              <span className="text-accent">{t("cta.title.b")}</span>
            </h2>
            <p className="text-lg text-slate-400 leading-7 max-w-[540px] mx-auto mb-9">
              {t("cta.sub")}
            </p>
            <button
              onClick={() => open("signup", t("nav.cta.plan"))}
              className="btn-primary px-8 py-3 text-lg"
            >
              {t("cta.btn")} <Icon n="arrow" cls="h-5 w-5" />
            </button>
            <p className="mt-5 text-sm text-slate-500">{t("cta.note")}</p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative section-divider py-12">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Logo />
                <p className="mt-4 text-sm leading-6 text-slate-500 max-w-[320px]">
                  {t("footer.tagline")}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  {[Twitter, Linkedin, Instagram, Facebook, Youtube].map((Icon, i) => (
                    <a
                      key={i}
                      href="#"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] text-slate-400 transition hover:text-[var(--lp-accent-soft)]"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-4">{t("footer.product")}</p>
                <ul className="space-y-2.5 text-sm">
                  {[t("footer.f1"), t("footer.f2"), t("footer.f3"), t("footer.f4")].map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="-my-1.5 inline-flex min-h-[36px] items-center text-slate-500 transition hover:text-[var(--lp-accent-soft)]"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-4">{t("footer.resources")}</p>
                <ul className="space-y-2.5 text-sm">
                  {[t("footer.r1"), t("footer.r2"), t("footer.r3"), t("footer.r4")].map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="-my-1.5 inline-flex min-h-[36px] items-center text-slate-500 transition hover:text-[var(--lp-accent-soft)]"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-10 pt-6 border-t border-white/[.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-600">{t("footer.rights")}</p>
              <div className="flex items-center gap-6 text-sm">
                {[t("footer.privacy"), t("footer.terms"), t("footer.cookies")].map((l) => (
                  <a
                    key={l}
                    href="#"
                    className="-my-2 inline-flex min-h-[36px] items-center text-slate-600 transition hover:text-slate-400"
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </main>

      {auth && <AuthModal initialMode={authMode} plan={authPlan} onClose={() => setAuth(false)} />}
      <CookieConsent />
    </div>
  );
}

export default function Landing() {
  return (
    <LandingLangProvider>
      <LandingPage />
    </LandingLangProvider>
  );
}
