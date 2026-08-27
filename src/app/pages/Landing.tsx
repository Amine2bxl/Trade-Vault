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
import "./landing.css";

/* ─────────────────────────── LOGO ────────────────────────── */
function Logo({ compact = false }: { compact?: boolean }) {
  const s = compact ? 28 : 34;
  return (
    <a
      href="#"
      className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm"
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
          <stop stopColor={up ? "#22d3ee" : "#f87171"} stopOpacity=".25" />
          <stop offset="1" stopColor={up ? "#22d3ee" : "#f87171"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 96,32 0,32`} fill={`url(#${gid.current})`} />
      <polyline
        points={points}
        fill="none"
        stroke={up ? "#22d3ee" : "#f87171"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="spark-line"
      />
    </svg>
  );
}

/* ─────────────────────────── HERO PRODUCT VISUAL ─────────────────────────── */
function HeroProductVisual() {
  const { t } = useLandingT();
  const pts = "0,112 38,96 76,102 114,74 152,88 190,56 228,70 266,36 304,50 340,20";
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-cyan-500/[.08] blur-3xl glow-pulse" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a1625]/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,.6)] backdrop-blur-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">
              {t("hero.eq")}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-400 tracking-tight">
              +4 218,50 €
            </p>
          </div>
          <span className="mt-1 rounded-full bg-emerald-400/12 border border-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
            +16.9%
          </span>
        </div>
        <div className="h-24 w-full">
          <svg
            viewBox="0 0 345 125"
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="hf" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="#22d3ee" stopOpacity=".25" />
                <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[30, 65, 100].map((yy) => (
              <path
                key={yy}
                d={`M0 ${yy}H345`}
                stroke="rgba(148,163,184,.1)"
                strokeDasharray="3 5"
              />
            ))}
            <polygon points={`${pts} 340,125 0,125`} fill="url(#hf)" />
            <polyline
              points={pts}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              className="chart-line"
            />
            <circle
              cx="340"
              cy="20"
              r="4.5"
              fill="#0a1625"
              stroke="#67e8f9"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
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
              <p className="text-[11px] font-medium uppercase tracking-[.08em] text-slate-500">
                {l}
              </p>
              <p className="mt-1 font-display text-base font-bold text-cyan-300">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="float-a absolute -bottom-10 -left-6 z-10 w-[230px] rounded-xl border border-cyan-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden sm:block">
        <div className="flex items-center gap-2 mb-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-3.5 w-3.5 text-[#03131b]" />
          </div>
          <p className="text-[11px] font-bold text-white">{t("hero.coach")}</p>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        <p className="text-[11px] leading-4 text-slate-300">
          {t("hero.coach.tip")}{" "}
          <span className="text-cyan-300 font-semibold">{t("hero.coach.action")}</span>
        </p>
      </div>

      <div className="float-b absolute -top-8 -right-5 z-10 w-[190px] rounded-xl border border-violet-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden md:block">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon n="radar" cls="h-3.5 w-3.5 text-violet-300" />
          <p className="text-[11px] font-bold text-white">{t("hero.pattern")}</p>
        </div>
        <p className="text-[11px] leading-4 text-slate-300">
          <span className="text-violet-300 font-semibold">{t("hero.pattern.tip")}</span>
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── AI CONVERSATION ─────────────────────────── */
function AIConversation() {
  const { t } = useLandingT();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[#0b1727]/90 shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[.08] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-4.5 w-4.5 text-[#03131b]" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">{t("ai.c.title")}</p>
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
            <p className="text-xs leading-5 text-slate-200">{t("ai.c.q")}</p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-cyan-400/20 bg-cyan-400/[.05] p-3.5">
          <p className="text-xs leading-5 text-slate-200">{t("ai.c.a")}</p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              {t("ai.c.plan")}
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-200">{t("ai.c.plan.d")}</p>
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
function SectionHead({ tag, title, sub }: { tag: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="reveal text-center mx-auto max-w-2xl mb-10" aria-label={tag}>
      <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold tracking-[-0.03em] text-white leading-[1.12]">
        {title}
      </h2>
      {sub && <p className="mt-4 text-slate-400 leading-7">{sub}</p>}
    </div>
  );
}

const NAV: [string, string][] = [
  ["nav.problem", "problem"],
  ["nav.features", "features"],
  ["pricing.tag", "pricing"],
  ["faq.tag", "faq"],
];

/* ─────────────────────────── JOURNEY SECTION ─────────────────────────── */
function JourneySection() {
  const { t } = useLandingT();
  const steps = [
    { icon: "document" as IName, title: t("journey.s1.t"), sub: t("journey.s1.d") },
    { icon: "chart" as IName, title: t("journey.s2.t"), sub: t("journey.s2.d") },
    { icon: "radar" as IName, title: t("journey.s3.t"), sub: t("journey.s3.d") },
    { icon: "brain" as IName, title: t("journey.s4.t"), sub: t("journey.s4.d") },
    { icon: "target" as IName, title: t("journey.s5.t"), sub: t("journey.s5.d") },
  ];
  return (
    <section className="relative section-divider py-14 lg:py-20">
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <SectionHead
          tag={t("journey.tag")}
          title={
            <>
              {t("journey.title.a")} <span className="text-accent">{t("journey.title.b")}</span>
            </>
          }
          sub={t("journey.sub")}
        />
        <div className="reveal relative grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.title} className="journey-node relative px-2 text-center">
              {i < steps.length - 1 && <span className="journey-connector hidden lg:block" />}
              <span className="journey-dot" style={{ animationDelay: `${i * 0.35}s` }} />
              <div className="feat-icon h-12 w-12 rounded-xl">
                <Icon n={s.icon} cls="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-[15px] font-bold text-white">{s.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
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
  const ais = [
    {
      n: "brain" as IName,
      t: t("ai.f1.t"),
      d: t("ai.f1.d"),
      c: "text-cyan-300",
      spark: "0,24 14,22 28,20 42,16 56,18 70,10 84,12 96,6",
    },
    {
      n: "radar" as IName,
      t: t("ai.f2.t"),
      d: t("ai.f2.d"),
      c: "text-violet-300",
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
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-white selection:bg-cyan-400 selection:text-[#060d16]">
      <CursorGlow />
      <MegaNav activeSec={activeSec} go={go} open={open} y={y} pct={pct} />

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section
          className="relative overflow-hidden pt-[88px] pb-14 lg:pt-[112px] lg:pb-20"
          onPointerMove={onHeroMove}
        >
          <div
            className="glow-orb glow-orb-cyan"
            style={{ top: "-10%", right: "-5%", width: "520px", height: "520px" }}
          />
          <div
            className="glow-orb glow-orb-indigo"
            style={{ bottom: "-10%", left: "-5%", width: "440px", height: "440px" }}
          />

          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-[1.02fr_.98fr] lg:gap-14 lg:px-8">
            <div className="text-center lg:text-left">
              <div className="fade-up inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[.08] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />{" "}
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
                      stroke="#22d3ee"
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
                <button
                  onClick={() => open("signup", t("nav.cta.plan"))}
                  className="btn-primary px-7 py-3 text-base"
                >
                  {t("hero.cta")} <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <a
                  href="/demo-site"
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-300 transition-colors"
                >
                  <PlayCircle className="w-4 h-4" />
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
              tag={t("problem.tag")}
              title={
                <>
                  {t("problem.title.a")}{" "}
                  <span className="text-slate-500">{t("problem.title.b")}</span>
                </>
              }
              sub={t("problem.sub")}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {problems.map((p, i) => (
                <article
                  key={p.t}
                  onPointerMove={spot}
                  className="reveal spot card-premium p-6"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className="feat-icon h-11 w-11 mb-4">
                    <Icon n={p.n} cls="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{p.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>
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
                "radial-gradient(ellipse 55% 45% at 50% 30%,rgba(34,211,238,.08),transparent 60%)",
            }}
          />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag={t("ai.tag")}
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
                      <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300">
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
              tag={t("features.tag")}
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
        <section id="pricing" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag={t("pricing.tag")} title={t("pricing.title")} sub={t("pricing.sub")} />

            <div className="reveal mb-10 flex justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/30 bg-emerald-400/[.1] px-5 py-2 text-sm font-bold text-emerald-300">
                <Icon n="sparkle" cls="h-4 w-4" /> {t("pricing.save")}
              </div>
            </div>

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
                ["shield", t("pricing.trust1")],
                ["lock", t("pricing.trust2")],
                ["check", t("pricing.trust3")],
                ["download", t("pricing.trust4")],
              ].map(([ic, s]) => (
                <span
                  key={s}
                  className="flex items-center gap-2 text-sm font-medium text-slate-500"
                >
                  <Icon n={ic as IName} cls="h-4 w-4 text-emerald-400" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[760px] px-5 lg:px-8">
            <SectionHead tag={t("faq.tag")} title={t("faq.title")} />
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
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${o ? "rotate-180 border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-white/[.12] text-slate-500"}`}
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
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgba(34,211,238,.14),transparent_60%)]" />
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
                      className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] text-slate-400 transition hover:text-cyan-300"
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
                      <a href="#" className="text-slate-500 hover:text-cyan-300 transition">
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
                      <a href="#" className="text-slate-500 hover:text-cyan-300 transition">
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
                  <a key={l} href="#" className="text-slate-600 hover:text-slate-400 transition">
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
