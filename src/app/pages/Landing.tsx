import { PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { PlayCircle, Twitter, Linkedin, Instagram, Facebook, Youtube } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { FeaturesBento } from "./landing/FeaturesBento";
import { PlatformsStrip, TraderProof, TrustStrip } from "./landing/Showcase";
import MegaNav from "./landing/MegaNav";
import {
  eur,
  MONTHLY_EUR,
  YEARLY_EUR,
  YEARLY_FULL_PRICE,
  YEARLY_PER_MONTH,
  YEARLY_SAVING,
} from "../utils/pricing";
import { CookieConsent } from "../components/CookieConsent";
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
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.22)]`}
      />
      <span
        className={`font-display font-bold tracking-[-0.04em] text-[#ffffff] leading-none hidden sm:block ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}
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

/* ─────────────────────────── SPARKLINE ─────────────────────────── */
/** Mini courbe de tendance — donne de la « vie » aux chiffres. */
function Sparkline({
  points,
  up = true,
  color = "#22d3ee",
}: {
  points: string;
  up?: boolean;
  color?: string;
}) {
  const gid = useRef(`sg${Math.random().toString(36).slice(2, 8)}`);
  return (
    <svg viewBox="0 0 96 32" className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid.current} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={up ? "#22d3ee" : "#f87171"} stopOpacity=".25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
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
  const pts = "0,112 38,96 76,102 114,74 152,88 190,56 228,70 266,36 304,50 340,20";
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-cyan-500/[.09] blur-3xl glow-pulse" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a1625]/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,.6)] backdrop-blur-xl">
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

      <div className="float-a absolute -bottom-10 -left-6 z-10 w-[230px] rounded-xl border border-cyan-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden sm:block">
        <div className="flex items-center gap-2 mb-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-3.5 w-3.5 text-[#03131b]" />
          </div>
          <p className="text-[10px] font-bold text-white">Coach IA</p>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        <p className="text-[10px] leading-4 text-slate-300">
          Tu surtrades après une perte.{" "}
          <span className="text-cyan-300 font-semibold">Limite à 3 setups demain.</span>
        </p>
      </div>

      <div className="float-b absolute -top-8 -right-5 z-10 w-[190px] rounded-xl border border-violet-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden md:block">
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

/* ─────────────────────────── AI CONVERSATION ─────────────────────────── */
function AIConversation() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[#0b1727]/90 shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[.08] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-4.5 w-4.5 text-[#03131b]" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">TradeVault Coach IA</p>
            <p className="text-[10px] text-emerald-400">Analyse de 248 trades · en direct</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Actif
        </span>
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-white/[.08] bg-white/[.05] px-4 py-2.5">
            <p className="text-xs leading-5 text-slate-200">
              Pourquoi je perds de l'argent le vendredi ?
            </p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-cyan-400/20 bg-cyan-400/[.05] p-3.5">
          <p className="text-xs leading-5 text-slate-200">
            Ton win rate chute à <strong className="text-red-300">38%</strong> le vendredi (vs 64%
            en semaine) : tu augmentes ta taille de position de{" "}
            <strong className="text-cyan-300">+42%</strong> après un début de semaine perdant.
          </p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              Plan recommandé
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-200">
            Vendredi : taille fixe, max 2 trades, stop après 1 perte.
          </p>
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

/* ─────────────────────────── DATA ─────────────────────────── */
type Feat = { n: IName; t: string; d: string };

const PROBLEMS: Feat[] = [
  {
    n: "err",
    t: "Tu répètes les mêmes erreurs",
    d: "Sans mémoire structurée, la même erreur revient — et coûte cher.",
  },
  {
    n: "heart",
    t: "Tu trades sous émotion",
    d: "FOMO, revenge trading, sizing au feeling. L'émotion détruit plus de comptes que les mauvais setups.",
  },
  {
    n: "compass",
    t: "Tu ne sais pas pourquoi tu perds",
    d: "Pas de data, pas de diagnostic. Tu changes de stratégie au hasard.",
  },
];

const AIS = [
  {
    n: "brain" as IName,
    t: "Des réponses sur TES trades",
    d: "Pose ta question. Le coach répond à partir de ton historique réel.",
    c: "text-cyan-300",
    spark: "0,24 14,22 28,20 42,16 56,18 70,10 84,12 96,6",
  },
  {
    n: "radar" as IName,
    t: "Tes schémas, détectés seuls",
    d: "Heures, setups, erreurs récurrentes : l'IA les repère et t'alerte.",
    c: "text-violet-300",
    spark: "0,26 14,20 28,22 42,14 56,16 70,8 84,10 96,4",
  },
  {
    n: "err" as IName,
    t: "Tes biais, mis à nu",
    d: "Overtrading, sizing qui dérape… le coach nomme ce qui te coûte.",
    c: "text-amber-300",
    spark: "0,8 14,12 28,10 42,16 56,14 70,20 84,18 96,12",
  },
];

const FAQS: [string, string][] = [
  [
    "En quoi c'est mieux qu'un simple journal ?",
    "Un journal enregistre. TradeVault comprend : il analyse tes données, détecte tes schémas et te dit quoi corriger.",
  ],
  [
    "L'essai gratuit est-il vraiment sans engagement ?",
    "Oui. 14 jours d'accès Premium complet, sans carte bancaire. Annulation en 1 clic.",
  ],
  [
    "Mes données de trading sont-elles sécurisées ?",
    "Chiffrées en transit et au repos. Paiements Stripe. On ne touche jamais à ton compte de courtage.",
  ],
  [
    "Puis-je importer mon historique existant ?",
    "Oui. Importe un CSV depuis ton courtier, TradeVault structure tout automatiquement.",
  ],
];

const FREE_INCLUDED = [
  "Journal de trading — 30 trades / mois",
  "Dashboard & courbe d'equity",
  "Checklist pré-market",
  "Statistiques de base (P&L, win rate, R)",
] as const;
const FREE_MISSING = [
  "Coach IA Jarvis",
  "Import CSV automatique",
  "Analytics quantitatives avancées",
  "Rapports mensuels automatiques",
] as const;

const PREMIUM_FEATURES = [
  ["Coach IA Jarvis, illimité 24h/24", "Il lit TES trades et te dit quoi corriger."],
  ["Trades illimités + comptes illimités", "Prop firm, démo, réel — chacun séparé."],
  ["Analytics quantitatives (20+ métriques)", "Drawdown, expectancy, saisonnalité."],
  ["Suivi des erreurs & setups manqués", "Le coût réel de chaque mauvaise habitude."],
  ["Import CSV automatique illimité", "Ton historique complet en quelques secondes."],
  ["Rapports mensuels automatiques", "Ton bilan écrit, sans rien faire."],
  ["Calculateur de position & palette ⌘K", "Le quotidien, sans friction."],
  ["Support prioritaire", "Une vraie réponse, vite."],
] as const;

/* ─────────────────────────── SECTION TITLE ─────────────────────────── */
function SectionHead({
  tag,
  title,
  sub,
  center = true,
}: {
  tag: string;
  title: React.ReactNode;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={`reveal ${center ? "text-center mx-auto" : ""} max-w-2xl mb-10`}>
      <div className="tag-label inline-flex mb-4">{tag}</div>
      <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold tracking-[-0.03em] text-white leading-[1.12]">
        {title}
      </h2>
      {sub && <p className="mt-4 text-slate-400 leading-7">{sub}</p>}
    </div>
  );
}

const NAV: [string, string][] = [
  ["Problème", "problem"],
  ["Coach IA", "ai"],
  ["Fonctionnalités", "features"],
  ["Tarifs", "pricing"],
  ["FAQ", "faq"],
];

/* ─────────────────────────── JOURNEY SECTION ─────────────────────────── */
/** Le parcours : trades bruts → décisions. Remplace trois sections redondantes. */
function JourneySection() {
  const steps = [
    { icon: "document" as IName, title: "Trades", sub: "Tu journalises en 45 s" },
    { icon: "chart" as IName, title: "Data", sub: "20+ métriques calculées" },
    { icon: "radar" as IName, title: "Patterns", sub: "Schémas récurrents détectés" },
    { icon: "brain" as IName, title: "Insights", sub: "Le coach nomme tes biais" },
    { icon: "target" as IName, title: "Décisions", sub: "Tu corriges, tu progresses" },
  ];
  return (
    <section className="relative section-divider py-14 lg:py-20">
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <SectionHead
          tag="Le parcours"
          title={
            <>
              De tes trades bruts à de <span className="text-accent">meilleures décisions</span>.
            </>
          }
          sub="TradeVault transforme ton historique en intelligence actionnable — pas seulement des chiffres."
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

/* ─────────────────────────── STATS SECTION ─────────────────────────── */
function StatsSection() {
  const stats = [
    {
      value: "+27%",
      label: "Amélioration du R:R",
      spark: "0,26 16,22 32,24 48,16 64,18 80,8 96,6",
      up: true,
    },
    {
      value: "-34%",
      label: "Erreurs répétées",
      spark: "0,6 16,10 32,8 48,16 64,14 80,20 96,22",
      up: true,
    },
    {
      value: "68%",
      label: "Win rate meilleur setup",
      spark: "0,22 16,20 32,24 48,14 64,16 80,8 96,4",
      up: true,
    },
    {
      value: "2.3x",
      label: "Profit factor moyen",
      spark: "0,20 16,18 32,22 48,12 64,14 80,6 96,4",
      up: true,
    },
  ];
  return (
    <section className="relative section-divider py-14 lg:py-20">
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <SectionHead
          tag="Résultats"
          title={
            <>
              Ce que tu <span className="text-accent">comprends</span> enfin.
            </>
          }
          sub="Exemples UI — les chiffres varient selon l'historique de chaque trader."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="reveal card-premium p-5"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <p className="font-display text-3xl font-bold text-gradient">{s.value}</p>
              <p className="mt-1.5 text-[13px] font-semibold text-white">{s.label}</p>
              <div className="mt-3">
                <Sparkline points={s.spark} up={s.up} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
  const go = (id: string) => {
    setMenu(false);
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
    <div className="landing-root min-h-screen overflow-x-clip bg-[#050505] text-white selection:bg-cyan-400 selection:text-[#050505]">
      <CursorGlow />

      {/* ── NAV ── */}
      <MegaNav activeSec={activeSec} go={go} open={open} y={y} pct={pct} />

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section
          className="relative overflow-hidden pt-[88px] pb-14 lg:pt-[112px] lg:pb-20"
          onPointerMove={onHeroMove}
        >
          <div className="grid-bg" />
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
                TradeVault · Ton coach IA de trading
              </div>
              <h1 className="fade-up d1 font-display mt-6 text-[clamp(2.5rem,4.8vw,4rem)] font-bold leading-[1.05] tracking-[-0.03em] text-white">
                Trade better.{" "}
                <span className="text-accent relative inline-block">
                  Understand why.
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
                <strong className="text-white">TradeVault</strong> analyse tes trades, détecte tes
                erreurs et te dit quoi corriger — comme un coach qui connaît chacun de tes trades.
              </p>
              <div className="fade-up d3 mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <button
                  onClick={() => open("signup", "Essai Premium 14 jours")}
                  className="btn-accent px-7 py-3.5 text-base"
                >
                  Commencer gratuitement <Icon n="arrow" cls="h-4.5 w-4.5" />
                </button>
                <a href="/demo-site" className="btn-ghost px-6 py-3.5 text-base font-semibold">
                  <PlayCircle className="w-4.5 h-4.5" /> Voir la démo
                </a>
              </div>
              <div className="fade-up d4 mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
                {["Sans carte bancaire", "Annulation en 1 clic", "Setup en 2 min"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                    <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
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
              tag="Le vrai problème"
              title={
                <>
                  Ce n'est pas ta stratégie{" "}
                  <span className="text-slate-500">qui te fait perdre.</span>
                </>
              }
              sub="C'est l'absence de mémoire et de feedback. Trois symptômes que tu connais :"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {PROBLEMS.map((p, i) => (
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
                "radial-gradient(ellipse 55% 45% at 50% 30%,rgba(34,211,238,.1),transparent 60%)",
            }}
          />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="La solution"
              title={
                <>
                  Un coach IA qui connaît <span className="text-accent">chacun de tes trades.</span>
                </>
              }
              sub="Il lit ton historique réel, détecte ce qui te coûte et te dit exactement quoi corriger."
            />
            <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-14 mb-12">
              <AIConversation />
              <div>
                <h3 className="font-display text-2xl font-bold text-white leading-tight mb-4">
                  Un mentor qui connaît
                  <br />
                  <span className="text-accent">chacun de tes trades.</span>
                </h3>
                <p className="text-slate-400 leading-7 mb-6">
                  Pose une question. Le coach puise dans ton historique — pas de généralités, que du
                  concret.
                </p>
                <div className="space-y-3">
                  {[
                    "Réponses basées sur tes vraies données",
                    "Diagnostic en quelques secondes",
                    "Plans d'action, pas de théorie",
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-3 text-[15px] text-slate-300">
                      <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {AIS.map((a, i) => (
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
                    <Sparkline points={a.spark} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <StatsSection />

        {/* ── FEATURES ── */}
        <section id="features" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Fonctionnalités"
              title={
                <>
                  Tout pour <span className="text-accent">progresser</span>. Rien d'inutile.
                </>
              }
              sub="Chaque outil sert une seule chose : de meilleures décisions, trade après trade."
            />
            <div className="reveal">
              <FeaturesBento />
            </div>
            <div className="reveal mt-10 text-center">
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-accent px-8 py-3.5 text-base"
              >
                Tout débloquer gratuitement <Icon n="arrow" cls="h-4.5 w-4.5" />
              </button>
              <p className="mt-3 text-[13px] text-slate-600">
                14 jours Premium · sans carte bancaire
              </p>
            </div>
          </div>
        </section>

        {/* ── QUI FAIT ÇA ── */}
        <section className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <TraderProof onStart={() => open("signup", "Essai Premium 14 jours")} />
            <div className="mt-8">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Tarifs"
              title="Un investissement qui se rembourse en un trade"
              sub="Commence gratuitement. Passe Premium quand tu es prêt."
            />

            <div className="reveal mb-10 flex justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/30 bg-emerald-400/[.1] px-5 py-2 text-sm font-bold text-emerald-300">
                <Icon n="sparkle" cls="h-4 w-4" /> 2 mois offerts à l'année, soit 40 € d'économie
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
              {/* FREE */}
              <div onPointerMove={spot} className="reveal spot card-premium p-6">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400 mb-4">
                  Free
                </p>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className="font-display text-4xl font-bold text-white">0 €</span>
                  <span className="mb-1 text-sm text-slate-500">/ toujours</span>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                  Pour noter tes trades et poser les bases.
                </p>
                <button
                  onClick={() => open("signup", "Plan Gratuit")}
                  className="btn-ghost w-full py-3"
                >
                  Commencer gratuitement
                </button>
                <div className="mt-6 space-y-2.5 text-sm">
                  {FREE_INCLUDED.map((f) => (
                    <p key={f} className="flex items-start gap-2.5 text-slate-300">
                      <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-400">
                        <Icon n="check" cls="h-3 w-3" />
                      </span>
                      {f}
                    </p>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-white/[.06] bg-white/[.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 mb-2.5">
                    Pas inclus
                  </p>
                  <div className="space-y-2 text-[13px]">
                    {FREE_MISSING.map((f) => (
                      <p key={f} className="flex items-start gap-2.5 text-slate-600">
                        <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.03]">
                          <Icon n="x" cls="h-3 w-3" />
                        </span>
                        {f}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* PRO ANNUEL */}
              <div
                onPointerMove={spot}
                className="reveal spot card-featured p-6 lg:-my-3 lg:py-9"
                style={{ transitionDelay: "80ms" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">
                    Pro · Annuel
                  </p>
                  <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase text-[#050505] flex items-center gap-1">
                    <Icon n="flame" cls="h-3 w-3 fill-current" />2 mois offerts
                  </span>
                </div>
                <div className="flex items-end gap-1.5 mb-2">
                  <span className="font-display text-5xl font-bold text-white">
                    {eur(Math.round(YEARLY_PER_MONTH * 100) / 100)}
                  </span>
                  <span className="mb-1.5 text-sm text-slate-400">/ mois</span>
                </div>
                <p className="text-sm text-slate-300 mb-3">
                  <span className="font-semibold text-white">{eur(YEARLY_EUR)}</span> facturés une
                  fois par an
                  <span className="ml-2 text-slate-500 line-through">{eur(YEARLY_FULL_PRICE)}</span>
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-2.5 py-1 text-[12px] font-bold text-emerald-300 mb-5">
                  <Icon n="check" cls="h-3.5 w-3.5" /> {eur(YEARLY_SAVING)} / an économisés
                </div>
                <button
                  onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")}
                  className="btn-accent w-full py-3.5 mb-2"
                >
                  Démarrer — 14 jours gratuits <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <p className="text-center text-[11px] text-slate-500 mb-6">
                  Sans engagement · Sans carte requise
                </p>
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80 mb-3">
                  Tout le plan Free, sans limite — et :
                </p>
                <div className="space-y-3 text-sm">
                  {PREMIUM_FEATURES.map(([f, why]) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-cyan-400/20 text-cyan-300">
                        <Icon n="check" cls="h-3 w-3" />
                      </span>
                      <span>
                        <span className="block text-white font-semibold">{f}</span>
                        <span className="block text-[12px] leading-5 text-slate-400 mt-0.5">
                          {why}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRO MENSUEL */}
              <div
                onPointerMove={spot}
                className="reveal spot card-premium p-6 opacity-[.92]"
                style={{ transitionDelay: "160ms" }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400 mb-4">
                  Pro · Mensuel
                </p>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className="font-display text-4xl font-bold text-slate-200">
                    {eur(MONTHLY_EUR)}
                  </span>
                  <span className="mb-1 text-sm text-slate-500">/ mois</span>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                  Mêmes fonctionnalités que l'annuel — seule la facturation change.
                </p>
                <button
                  onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")}
                  className="btn-ghost w-full py-3"
                >
                  Prendre au mois
                </button>
                <div className="mt-6 space-y-2.5 text-sm">
                  {PREMIUM_FEATURES.map(([f]) => (
                    <p key={f} className="flex items-start gap-2.5 text-slate-400">
                      <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-500">
                        <Icon n="check" cls="h-3 w-3" />
                      </span>
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                ["shield", "14 jours gratuits"],
                ["lock", "Paiement Stripe sécurisé"],
                ["check", "Annulation en 1 clic"],
                ["download", "Données exportables"],
              ].map(([ic, t]) => (
                <span
                  key={t}
                  className="flex items-center gap-2 text-sm font-medium text-slate-500"
                >
                  <Icon n={ic as IName} cls="h-4 w-4 text-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative section-divider py-14 lg:py-20">
          <div className="relative mx-auto max-w-[760px] px-5 lg:px-8">
            <SectionHead tag="FAQ" title="Tout ce que tu dois savoir" />
            <div className="reveal border-t border-white/[.08]">
              {FAQS.map(([q, a], i) => {
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
          <div className="grid-bg" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgba(34,211,238,.16),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[720px] px-5 text-center">
            {cd && (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-amber-400/[.1] px-5 py-2 text-[12px] font-bold text-amber-300 mb-7">
                <span className="ping-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                Ouverture des marchés dans {cd}
              </div>
            )}
            <h2 className="font-display text-[clamp(2rem,4.4vw,3.2rem)] font-bold tracking-[-0.03em] text-white leading-[1.08] mb-6">
              Ton prochain trade mérite
              <br />
              <span className="h-shine">un vrai coach.</span>
            </h2>
            <p className="text-lg text-slate-400 leading-7 max-w-[540px] mx-auto mb-9">
              TradeVault ne se contente pas d'enregistrer tes trades. Il les comprend, détecte tes
              schémas et te dit quoi corriger.
            </p>
            <button
              onClick={() => open("signup", "Essai Premium 14 jours")}
              className="btn-accent px-9 py-4 text-lg"
            >
              Commencer gratuitement <Icon n="arrow" cls="h-5 w-5" />
            </button>
            <p className="mt-5 text-sm text-slate-500">
              14 jours Premium · Sans carte bancaire · Annulation en 1 clic
            </p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative section-divider py-12">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Logo />
                <p className="mt-4 text-sm leading-6 text-slate-500 max-w-[320px]">
                  Le cockpit intelligent du trader. Journal, analytics, Coach IA.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  {[Twitter, Linkedin, Instagram, Facebook, Youtube].map((Icon, i) => (
                    <a
                      key={i}
                      href="#"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.02] text-slate-400 transition hover:border-cyan-400/20 hover:text-cyan-300"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-4">Produit</p>
                <ul className="space-y-2.5 text-sm">
                  {["Fonctionnalités", "Tarifs", "Intégrations", "Changelog"].map((l) => (
                    <li key={l}>
                      <a href="#" className="text-slate-500 hover:text-cyan-300 transition">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-4">Ressources</p>
                <ul className="space-y-2.5 text-sm">
                  {["Documentation", "Blog", "Support", "Contact"].map((l) => (
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
              <p className="text-sm text-slate-600">© 2026 TradeVault. Tous droits réservés.</p>
              <div className="flex items-center gap-6 text-sm">
                {["Confidentialité", "CGU", "Cookies"].map((l) => (
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
