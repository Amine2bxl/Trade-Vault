import { PointerEvent as RPointerEvent, lazy, Suspense, useEffect, useRef, useState } from "react";
import { Play, Compass, Twitter, Linkedin, Instagram, Facebook, Youtube } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

/**
 * Public landing page shown at "/" for signed-out visitors. Authenticated
 * users never see it — App.tsx routes them straight into the product.
 *
 * The sign-in / sign-up means (email · password · name · Google) opens as a
 * compact popup modal *over* the landing — not a full-page takeover. On
 * success `isAuthenticated` flips and App.tsx unmounts this whole tree.
 *
 * Copy is hardcoded French for now; we refine details step by step later.
 *
 * CE FICHIER S'ARRÊTE AU HÉROS (plus le pied de page). En-tête, héros, aperçu
 * du tableau de bord : ce qu'un visiteur voit d'abord. Les cinq sections
 * suivantes vivent dans `landing/BelowFold` et arrivent par `import()`, parce
 * que la route `/` importe cette page en STATIQUE — tout ce qui reste ici est
 * payé au premier octet.
 */

const BelowFold = lazy(() => import("./landing/BelowFold"));

/* ─────────────────────────── LOGO ─────────────────────────── */
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
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]`}
      />
      <span
        className={`font-display font-extrabold tracking-[-0.04em] text-[#ffffff] leading-none hidden sm:block ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}
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

/* ─────────────────────────── HERO DASHBOARD ─────────────────────────── */
function HeroDashboard() {
  const pts = "0,112 38,96 76,102 114,74 152,88 190,56 228,70 266,36 304,50 340,20";
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-cyan-500/[.07] blur-3xl glow-pulse" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a1625]/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,.5)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">
              Courbe de capital
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
                <stop stopColor="#22d3ee" stopOpacity=".22" />
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
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[.07] pt-4">
          {[
            ["Réussite", "64%"],
            ["Profit Factor", "2.31"],
            ["Sharpe", "1.84"],
          ].map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="text-[9px] font-medium uppercase tracking-[.08em] text-slate-500">
                {l}
              </p>
              <p className="mt-1 font-display text-base font-bold text-cyan-300">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="float-a absolute -bottom-10 -left-6 z-10 w-[230px] rounded-xl border border-cyan-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl hidden sm:block">
        <div className="flex items-center gap-2 mb-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-3.5 w-3.5 text-[#03131b]" />
          </div>
          <p className="text-[10px] font-bold text-white">Coach IA</p>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
        <p className="text-[10px] leading-4 text-slate-300">
          Tu surtrades après une perte.{" "}
          <span className="text-cyan-300 font-semibold">Limite à 3 setups demain.</span>
        </p>
      </div>

      <div className="float-b absolute -top-8 -right-5 z-10 w-[190px] rounded-xl border border-violet-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl hidden md:block">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon n="radar" cls="h-3.5 w-3.5 text-violet-300" />
          <p className="text-[10px] font-bold text-white">Pattern détecté</p>
        </div>
        <p className="text-[10px] leading-4 text-slate-300">
          Tes setups <span className="text-violet-300 font-semibold">VWAP</span> : 71% de réussite.
        </p>
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

/* Nav items — order MUST mirror the on-page scroll order of the anchors.
   Every landing section is reachable from the bar. */
const NAV: [string, string][] = [
  ["Problème", "problem"],
  ["Coach IA", "ai"],
  ["Fonctionnalités", "features"],
  ["Tarifs", "pricing"],
  ["FAQ", "faq"],
];

/* ─────────────────────────── LANDING ─────────────────────────── */
export default function Landing() {
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const [activeSec, setActiveSec] = useState("");
  const { y, pct } = useScroll();
  const cd = useCountdown();
  const spot = useSpot();
  useReveal();

  // Scrollspy: active nav = the last NAV section whose top has passed under the
  // header. Continuous (no dead zones between sections that aren't in the nav).
  // `scrollLockRef` est levé pendant le défilement déclenché par un clic : le
  // bouton cliqué reste actif immédiatement, sans sauter entre les boutons.
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
    setMenu(false);
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuth(true);
  };
  // Nav clicks scroll the section to the top of the viewport. Vertical
  // centring is handled in CSS (each section is a full-height flex box that
  // centres its own content), and `scroll-margin-top` clears the fixed header —
  // so this stays a plain, reliable scrollIntoView at every screen size.
  const go = (id: string) => {
    setMenu(false);
    // Actif IMMÉDIAT + verrouille le scrollspy pendant le défilement animé :
    // le bouton cliqué reste surligné, aucun saut entre les boutons.
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
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <CursorGlow />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 60% -10%,rgba(6,182,212,.09),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.07),transparent 55%)",
        }}
      />

      {/* ── NAV ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 10 ? "bg-[#060d16]/85 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/40"}`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}
      >
        <div
          className="scroll-bar absolute inset-x-0 top-0 h-[2px]"
          style={{ transform: `scaleX(${pct})` }}
        />
        <div className="relative mx-auto flex h-[60px] md:h-[66px] max-w-[1600px] items-center justify-between gap-3 px-4 md:px-5 lg:px-8">
          {/* Left zone — logo, natural width. */}
          <div className="flex items-center">
            <Logo />
          </div>
          {/* Center — every section, dead-centered on the header via absolute
              positioning (immune to the left/right zone widths). */}
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border border-white/[.08] bg-white/[.03] p-1 backdrop-blur-md xl:flex">
            {NAV.map(([l, id]) => {
              const on = activeSec === id;
              const isTp = id === "trustpilot";
              return (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${
                    on
                      ? "bg-cyan-400/[.14] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.28)]"
                      : isTp
                        ? "text-emerald-300 hover:bg-emerald-400/[.1]"
                        : "text-slate-400 hover:bg-cyan-400/[.07] hover:text-cyan-100"
                  }`}
                >
                  {isTp && (
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-[2px] bg-[#00b67a]">
                      <Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" />
                    </span>
                  )}
                  {l}
                </button>
              );
            })}
          </nav>
          {/* Right zone — actions. Deux CTA (Démo + Essai gratuit), visibles sur
              tous les écrans (compact sur mobile) ; hamburger en dessous de xl. */}
          <div className="flex items-center justify-end gap-2">
            <a href="/demo" className="btn-ghost hidden px-4 sm:inline-flex">
              <Play className="w-3.5 h-3.5" /> Démo
            </a>
            <button
              onClick={() => open("signup", "Essai Premium 14 jours")}
              className="btn-primary px-3.5 sm:px-4"
            >
              Essai gratuit <Icon n="arrow" cls="h-4 w-4 hidden sm:inline" />
            </button>
            <button
              onClick={() => setMenu(!menu)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-200 xl:hidden"
              aria-label="Menu"
            >
              <Icon n={menu ? "close" : "menu"} cls="h-5 w-5" />
            </button>
          </div>
        </div>
        {menu && (
          <div className="xl:hidden border-t border-white/[.07] bg-[#070f1a]/98 backdrop-blur-xl px-5 py-4">
            <div className="flex flex-col">
              {NAV.map(([l, id]) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`mobile-nav-link ${activeSec === id ? "text-cyan-300" : ""}`}
                >
                  {l}
                </button>
              ))}
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-primary mt-4 w-full"
              >
                Essai gratuit <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <a href="/demo" className="btn-ghost mt-2.5 w-full">
                <Play className="w-3.5 h-3.5" /> Démo
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section
          className="hero-mesh relative overflow-hidden pt-[92px] pb-20 lg:pt-[116px] lg:pb-28"
          onPointerMove={onHeroMove}
        >
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:px-8">
            <div className="text-center lg:text-left">
              {/* Eyebrow carries the exact product name, first thing in the
                  hero. Google's OAuth brand review checks that the homepage
                  names the app the same way as the consent screen; the visual
                  identity is untouched — same pill, same styling. */}
              <div className="fade-up inline-flex items-center gap-2.5 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />{" "}
                TradeVault · Ton coach IA de trading personnel
              </div>
              <h1 className="fade-up d1 font-display mt-6 text-[clamp(2.6rem,5.4vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-white">
                Deviens le trader{" "}
                <span className="text-gradient relative inline-block">
                  discipliné
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
                </span>{" "}
                que tu veux devenir.
              </h1>
              <p className="fade-up d2 mt-6 text-base leading-7 text-slate-400 sm:text-lg max-w-[540px] mx-auto lg:mx-0">
                <strong className="text-slate-200">TradeVault</strong> n'est pas un simple journal.
                C'est un <strong className="text-slate-200">coach IA disponible 24h/24</strong> qui
                réunit journal de trading, analytics quantitatives, calendrier économique et
                checklist pré-market pour analyser tes trades, détecter tes erreurs et t'accompagner
                vers une progression réelle.
              </p>
              <div className="fade-up d3 mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <button
                  onClick={() => open("signup", "Essai Premium 14 jours")}
                  className="btn-primary px-6 py-3.5 text-[.95rem]"
                >
                  Essai gratuit <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <a href="/demo-site" className="btn-ghost px-5 py-3.5 text-[.95rem]">
                  <Compass className="w-4 h-4" /> Voir le site
                </a>
              </div>
              <div className="fade-up d4 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {["Sans carte bancaire", "Annulation en 1 clic", "Setup en 2 min"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
              {/* States plainly why Google sign-in is offered — Google's OAuth
                  review wants the homepage to explain that the connection only
                  creates a secure account and syncs data, nothing more. */}
              <p className="fade-up d4 mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500 max-w-[520px] mx-auto lg:mx-0">
                <Icon n="lock" cls="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  La connexion Google sert uniquement à créer ton compte TradeVault en toute
                  sécurité et à synchroniser tes données sur tous tes appareils.
                </span>
              </p>
              {/* Trustpilot proof — visible on the very first screen, honest early-access framing */}
              <a
                href="https://www.trustpilot.com/review/tradevaultt.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="fade-up d4 mt-4 inline-flex items-center gap-2.5 rounded-full border border-white/[.08] bg-white/[.03] py-1.5 pl-2 pr-3.5 transition hover:border-[#00b67a]/40 hover:bg-white/[.05]"
              >
                <span className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="grid h-4 w-4 place-items-center rounded-[2px] bg-[#00b67a]"
                    >
                      <Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" />
                    </span>
                  ))}
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  Avis vérifiés sur <span className="text-white font-bold">Trustpilot</span>
                </span>
                <Icon n="arrow" cls="h-3 w-3 text-slate-500" />
              </a>
            </div>
            <div className="fade-up d2 w-full max-w-[440px] mx-auto lg:mx-0 lg:ml-auto lg:mt-0 mt-6">
              <HeroDashboard />
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-[900px] px-5 lg:mt-24">
            <div className="reveal grid grid-cols-2 gap-4 rounded-2xl border border-white/[.07] bg-white/[.02] p-6 backdrop-blur-md sm:grid-cols-4">
              {[
                ["<10s", "pour importer ton historique"],
                ["20+", "métriques calculées"],
                ["100%", "de tes données t'appartiennent"],
                ["24h/24", "assistant IA disponible"],
              ].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="font-display text-2xl font-extrabold text-white">{v}</p>
                  <p className="mt-1 text-xs text-slate-500">{l}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => go("ai")}
              className="reveal mx-auto mt-5 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-cyan-300 transition"
            >
              <Icon n="brain" cls="h-4 w-4 text-cyan-300" />
              Vois comment le Coach IA analyse tes trades <Icon n="arrow" cls="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* Les sections suivantes vivent dans leur propre chunk.
            
            ELLES SONT RENDUES SANS CONDITION. Une première version les montait
            sur `requestIdleCallback` : côté serveur, l'état initial restait
            `false` et les effets ne tournent pas — le HTML SSR n'aurait plus
            contenu que le héros. Or c'est précisément ce HTML que lisent les
            crawlers et les moteurs de réponse (voir le commentaire de
            `routes/index.tsx`). On échange donc un gain d'octets contre le
            référencement, ce qui n'est pas un échange acceptable ici.
            
            Ce qui reste acquis : le héros est peint depuis le HTML sans
            attendre ce module, et le module voyage dans un fichier séparé —
            donc en parallèle, sans retarder la première image. */}
        <Suspense fallback={<div className="min-h-[80vh]" aria-hidden />}>
          <BelowFold go={go} open={open} spot={spot} faq={faq} setFaq={setFaq} cd={cd} />
        </Suspense>
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <Logo compact />
              <p className="text-xs leading-5 text-slate-500 max-w-[220px]">
                Le coach IA de référence pour les traders qui veulent progresser avec méthode.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-cyan-300 transition mt-1"
              >
                <Icon n="mail" cls="h-3.5 w-3.5" /> {SUPPORT_EMAIL}
              </a>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">
                Navigation
              </p>
              <div className="flex flex-col gap-2">
                {[
                  ["features", "Fonctionnalités"],
                  ["pricing", "Tarifs"],
                  ["faq", "FAQ"],
                  ["problem", "Problème"],
                  ["ai", "Coach IA"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => go(id)}
                    className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition text-left"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">
                Légal
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="/terms"
                  className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition"
                >
                  Conditions d'utilisation
                </a>
                <a
                  href="/privacy"
                  className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition"
                >
                  Politique de confidentialité
                </a>
                <a
                  href="/contact"
                  className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition"
                >
                  Contact
                </a>
                <a
                  href="/demo"
                  className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition"
                >
                  Démo
                </a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">
                Suivez-nous
              </p>
              <div className="flex items-center gap-3">
                {(
                  [
                    { icon: Twitter, label: "X (Twitter)" },
                    { icon: Linkedin, label: "LinkedIn" },
                    { icon: Instagram, label: "Instagram" },
                    { icon: Facebook, label: "Facebook" },
                    { icon: Youtube, label: "YouTube" },
                  ] as const
                ).map((s) => (
                  <span
                    key={s.label}
                    aria-label={s.label}
                    title={`${s.label} — bientôt`}
                    className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-white/[.08] bg-white/[.02] text-slate-600 transition-colors"
                  >
                    <s.icon className="w-4 h-4" />
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-white/[.05] pt-6 text-center text-[11px] text-slate-700">
            © {new Date().getFullYear()} TradeVault. Le trading comporte des risques. Journalise
            d'abord, trade ensuite.
          </div>
        </div>
      </footer>

      <CookieConsent />
      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
