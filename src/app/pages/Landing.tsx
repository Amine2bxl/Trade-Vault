import { PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { PlayCircle, Twitter, Linkedin, Instagram, Facebook, Youtube } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { FeaturesBento } from "./landing/FeaturesBento";
import { FeatureRow, PlatformsStrip, TraderProof, TrustStrip } from "./landing/Showcase";
import MegaNav from "./landing/MegaNav";
import {
  eur,
  MONTHLY_EUR,
  YEARLY_EUR,
  YEARLY_FULL_PRICE,
  YEARLY_PER_MONTH,
  YEARLY_SAVING,
} from "../utils/pricing";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

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
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]`}
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

/* ─────────────────────────── HERO PRODUCT VISUAL ─────────────────────────── */
function HeroProductVisual() {
  const pts = "0,112 38,96 76,102 114,74 152,88 190,56 228,70 266,36 304,50 340,20";
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-cyan-500/[.08] blur-3xl glow-pulse" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a1625]/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,.6)] backdrop-blur-xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">
              Courbe de capital
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-emerald-400 tracking-tight">
              +4 218,50 €
            </p>
          </div>
          <span className="mt-1 rounded-full bg-emerald-400/12 border border-emerald-400/20 px-3 py-1.5 text-[11px] font-bold text-emerald-400">
            +16.9%
          </span>
        </div>
        <div className="h-28 w-full">
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
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[.08] pt-5">
          {[
            ["Réussite", "64%"],
            ["Profit Factor", "2.31"],
            ["Sharpe", "1.84"],
          ].map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="text-[9px] font-medium uppercase tracking-[.08em] text-slate-500">
                {l}
              </p>
              <p className="mt-1.5 font-display text-lg font-bold text-cyan-300">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="float-a absolute -bottom-12 -left-8 z-10 w-[240px] rounded-xl border border-cyan-400/25 bg-[#0b1a2b]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden sm:block">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-4 w-4 text-[#03131b]" />
          </div>
          <p className="text-[11px] font-bold text-white">Coach IA</p>
          <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
        <p className="text-[11px] leading-4.5 text-slate-300">
          Tu surtrades après une perte.{" "}
          <span className="text-cyan-300 font-semibold">Limite à 3 setups demain.</span>
        </p>
      </div>

      <div className="float-b absolute -top-10 -right-6 z-10 w-[200px] rounded-xl border border-violet-400/25 bg-[#0b1a2b]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur-xl hidden md:block">
        <div className="flex items-center gap-2 mb-2">
          <Icon n="radar" cls="h-4 w-4 text-violet-300" />
          <p className="text-[11px] font-bold text-white">Pattern détecté</p>
        </div>
        <p className="text-[11px] leading-4.5 text-slate-300">
          Tes setups <span className="text-violet-300 font-semibold">VWAP</span> : 71% de réussite.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── AI CONVERSATION ────────────────────────── */
function AIConversation() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[#0b1727]/90 shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[.08] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
            <Icon n="brain" cls="h-5 w-5 text-[#03131b]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">TradeVault Coach IA</p>
            <p className="text-[11px] text-emerald-400">Analyse de 248 trades · en direct</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Actif
        </span>
      </div>
      <div className="space-y-4 px-6 py-6">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-white/[.08] bg-white/[.05] px-4 py-3">
            <p className="text-sm leading-5 text-slate-200">
              Pourquoi je perds de l'argent le vendredi ?
            </p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-cyan-400/20 bg-cyan-400/[.05] p-4">
          <p className="text-sm leading-5 text-slate-200">
            J'ai analysé tes 6 derniers vendredis. Ton win rate chute à{" "}
            <strong className="text-red-300">38%</strong> (vs 64% en semaine). Cause principale : tu
            augmentes ta taille de position de <strong className="text-cyan-300">+42%</strong> après
            un début de semaine perdant.
          </p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon n="check" cls="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Plan recommandé
            </span>
          </div>
          <p className="text-sm leading-5 text-slate-200">
            Vendredi : taille fixe, max 2 trades, stop après 1 perte. J'ajoute cette règle à ta
            checklist pré-market ?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl rounded-tl-sm border border-white/[.06] bg-white/[.03] px-4 py-3">
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          </div>
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
    d: "Sans mémoire structurée, la même erreur revient — et coûte cher à chaque fois.",
  },
  {
    n: "heart",
    t: "Tu trades sous émotion",
    d: "FOMO, revenge trading, sizing au feeling. L'émotion détruit plus de comptes que les mauvais setups.",
  },
  {
    n: "compass",
    t: "Tu ne sais pas pourquoi tu perds",
    d: "Pas de data, pas de diagnostic. Tu changes de stratégie au hasard au lieu de corriger le vrai problème.",
  },
];

const AIS = [
  {
    n: "brain" as IName,
    t: "Des réponses sur TES trades",
    d: "Pose ta question en français. Le coach répond à partir de ton historique réel — jamais des généralités.",
    c: "text-cyan-300",
  },
  {
    n: "radar" as IName,
    t: "Tes schémas, détectés seuls",
    d: "Heures, setups, erreurs récurrentes : l'IA les repère et t'alerte avant que tu les répètes.",
    c: "text-violet-300",
  },
  {
    n: "err" as IName,
    t: "Tes biais, mis à nu",
    d: "Overtrading après une perte, sizing qui dérape… le coach nomme ce qui te coûte de l'argent.",
    c: "text-amber-300",
  },
];

const FAQS: [string, string][] = [
  [
    "En quoi c'est mieux qu'un simple journal ?",
    "Un journal enregistre. TradeVault comprend : il analyse tes données, détecte tes schémas et te dit quoi corriger — comme un mentor privé disponible 24h/24.",
  ],
  [
    "L'essai gratuit est-il vraiment sans engagement ?",
    "Oui. 14 jours d'accès Premium complet, sans carte bancaire. Annulation en 1 clic à tout moment. Zéro risque, zéro prélèvement surprise.",
  ],
  [
    "Mes données de trading sont-elles sécurisées ?",
    "Totalement. Chiffrées en transit et au repos, sauvegardes cloud, paiements sécurisés par Stripe. On ne touche jamais à ton compte de courtage.",
  ],
  [
    "Puis-je importer mon historique existant ?",
    "Oui, en quelques secondes. Importe un CSV depuis ton courtier ou ton ancien journal, TradeVault structure tout automatiquement avant sauvegarde.",
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
    <div className={`reveal ${center ? "text-center mx-auto" : ""} max-w-2xl mb-14`}>
      <div className="tag-label inline-flex mb-5">{tag}</div>
      <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.08]">
        {title}
      </h2>
      {sub && <p className="mt-5 text-slate-400 leading-7 text-lg">{sub}</p>}
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

/* ─────────────────────────── STATS SECTION ─────────────────────────── */
function StatsSection() {
  const stats = [
    { value: "+27%", label: "Amélioration du R:R moyen", sub: "Après 3 mois d'utilisation" },
    { value: "-34%", label: "Erreurs répétées", sub: "Détection et correction" },
    { value: "68%", label: "Win rate meilleur setup", sub: "Pattern detection" },
    { value: "2.3x", label: "Profit factor moyen", sub: "Users Premium" },
  ];
  return (
    <section className="relative border-t border-white/[.06] py-20 lg:py-24">
      <div className="grid-bg" />
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <SectionHead
          tag="Résultats"
          title={
            <>
              Ce que les traders <span className="text-gradient">comprennent</span> avec TradeVault
            </>
          }
          sub="Exemples UI — les chiffres varient selon l'historique de chaque trader."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="reveal stats-card p-6 text-center"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="font-display text-4xl font-extrabold text-gradient">{s.value}</p>
              <p className="mt-3 text-sm font-semibold text-white">{s.label}</p>
              <p className="mt-1.5 text-xs text-slate-500">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── PROCESS SECTION ─────────────────────────── */
function ProcessSection() {
  const steps = [
    {
      num: "01",
      title: "Tu journalises",
      desc: "Chaque trade enregistré : symbole, direction, risque, R-multiple, setup, erreurs. 45 secondes par trade.",
      featured: false,
    },
    {
      num: "02",
      title: "L'IA analyse",
      desc: "TradeVault lit ton historique réel, détecte tes schémas récurrents et identifie ce qui te coûte de l'argent.",
      featured: true,
    },
    {
      num: "03",
      title: "Tu progresses",
      desc: "Insights concrets, plans d'action, alertes avant les erreurs. Tu prends de meilleures décisions, trade après trade.",
      featured: false,
    },
  ];
  return (
    <section className="relative border-t border-white/[.06] py-20 lg:py-24">
      <div className="grid-bg" />
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <SectionHead
          tag="Comment ça marche"
          title={
            <>
              Ton trading, <span className="text-gradient">compris.</span>
            </>
          }
          sub="TradeVault transforme tes trades bruts en intelligence actionnable."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className={`reveal process-card p-8 ${s.featured ? "featured" : ""}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <p className="font-display text-5xl font-extrabold text-gradient mb-4">{s.num}</p>
              <h3 className="font-display text-xl font-bold text-white mb-3">{s.title}</h3>
              <p className="text-sm leading-6 text-slate-400">{s.desc}</p>
              {s.featured && (
                <button className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition">
                  En savoir plus <Icon n="arrow" cls="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── LANDING ────────────────────────── */
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
    <div className="landing-root min-h-screen overflow-x-clip bg-[#030712] text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <CursorGlow />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 60% -10%,rgba(34,211,238,.1),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.08),transparent 55%)",
        }}
      />

      {/* ── NAV ── */}
      <MegaNav activeSec={activeSec} go={go} open={open} y={y} pct={pct} />

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section
          className="hero-mesh relative overflow-hidden pt-[92px] pb-20 lg:pt-[120px] lg:pb-28"
          onPointerMove={onHeroMove}
        >
          <div className="grid-bg" />
          <div className="relative mx-auto grid max-w-[1280px] items-center gap-16 px-5 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:px-8">
            <div className="text-center lg:text-left">
              <div className="fade-up inline-flex items-center gap-2.5 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />{" "}
                TradeVault · Ton coach IA de trading personnel
              </div>
              <h1 className="fade-up d1 font-display mt-7 text-[clamp(2.8rem,5.8vw,4.8rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-white">
                Trade better.{" "}
                <span className="text-gradient relative inline-block">
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
              <p className="fade-up d2 mt-7 text-lg leading-7 text-slate-400 sm:text-xl max-w-[560px] mx-auto lg:mx-0">
                <strong className="text-slate-200">TradeVault</strong> réunit journal de trading,
                analytics avancées et <strong className="text-slate-200">Coach IA</strong> pour
                analyser tes trades, détecter tes erreurs et t'accompagner vers une progression
                réelle.
              </p>
              <div className="fade-up d3 mt-9 flex flex-col gap-3.5 sm:flex-row sm:justify-center lg:justify-start">
                <button
                  onClick={() => open("signup", "Essai Premium 14 jours")}
                  className="btn-primary px-7 py-4 text-[1rem] font-semibold"
                >
                  Commencer gratuitement <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <a href="/demo-site" className="btn-ghost px-6 py-4 text-[1rem] font-semibold">
                  <PlayCircle className="w-4 h-4" /> Voir la démo
                </a>
              </div>
              <div className="fade-up d4 mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 lg:justify-start">
                {["Sans carte bancaire", "Annulation en 1 clic", "Setup en 2 min"].map((t) => (
                  <span key={t} className="flex items-center gap-2 text-sm text-slate-500">
                    <Icon n="check" cls="h-4 w-4 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
              <p className="fade-up d4 mt-5 flex items-start gap-2.5 text-sm leading-5 text-slate-500 max-w-[540px] mx-auto lg:mx-0">
                <Icon n="lock" cls="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  La connexion Google sert uniquement à créer ton compte TradeVault en toute
                  sécurité et à synchroniser tes données sur tous tes appareils.
                </span>
              </p>
              <a
                href="https://www.trustpilot.com/review/tradevaultt.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="fade-up d4 mt-5 inline-flex items-center gap-3 rounded-full border border-white/[.08] bg-white/[.03] py-2 pl-2.5 pr-4 transition hover:border-[#00b67a]/40 hover:bg-white/[.05]"
              >
                <span className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="grid h-4.5 w-4.5 place-items-center rounded-[2px] bg-[#00b67a]"
                    >
                      <Icon n="star" cls="h-3 w-3 text-white fill-white" />
                    </span>
                  ))}
                </span>
                <span className="text-sm font-semibold text-slate-300">
                  Avis vérifiés sur <span className="text-white font-bold">Trustpilot</span>
                </span>
                <Icon n="arrow" cls="h-3.5 w-3.5 text-slate-500" />
              </a>
            </div>
            <div className="fade-up d2 w-full max-w-[460px] mx-auto lg:mx-0 lg:ml-auto lg:mt-0 mt-8">
              <HeroProductVisual />
            </div>
          </div>

          <div className="relative mx-auto mt-20 max-w-[1280px] px-5 lg:mt-24 lg:px-8">
            <PlatformsStrip />
            <div className="mt-6">
              <FeatureRow />
            </div>
            <button
              onClick={() => go("ai")}
              className="reveal mx-auto mt-6 flex items-center gap-2.5 text-sm font-semibold text-slate-500 hover:text-cyan-300 transition"
            >
              <Icon n="brain" cls="h-4.5 w-4.5 text-cyan-300" />
              Vois comment le Coach IA analyse tes trades <Icon n="arrow" cls="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* ── PROBLÈME ── */}
        <section id="problem" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="grid-bg" />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Le vrai problème"
              title={
                <>
                  Ce n'est pas ta stratégie
                  <br />
                  <span className="text-slate-500">qui te fait perdre.</span>
                </>
              }
              sub="Le vrai tueur de comptes, c'est l'absence de système, de mémoire et de feedback. Trois symptômes que tu connais sûrement :"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROBLEMS.map((p, i) => (
                <article
                  key={p.t}
                  onPointerMove={spot}
                  className="reveal spot rounded-2xl border border-red-400/12 bg-red-400/[.03] p-7 transition-colors hover:border-red-400/25"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-red-400/20 bg-red-400/[.07] text-red-400 mb-6">
                    <Icon n={p.n} cls="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">{p.t}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROCESS ── */}
        <ProcessSection />

        {/* ── SECTION IA ── */}
        <section
          id="ai"
          className="relative border-t border-white/[.06] overflow-hidden py-20 lg:py-28"
        >
          <div className="grid-bg" />
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
                  Un coach IA qui connaît{" "}
                  <span className="text-gradient">chacun de tes trades.</span>
                </>
              }
              sub="TradeVault lit ton historique réel — pas des généralités de marché. Il détecte ce qui te coûte de l'argent et te dit exactement quoi corriger."
            />

            <div className="reveal grid items-center gap-12 lg:grid-cols-2 lg:gap-16 mb-18">
              <AIConversation />
              <div>
                <h3 className="font-display text-3xl font-bold text-white leading-tight">
                  Un mentor qui connaît
                  <br />
                  <span className="text-gradient">chacun de tes trades.</span>
                </h3>
                <p className="mt-5 text-slate-400 leading-7 text-lg">
                  Pose une question en langage naturel. Le Coach IA puise dans ton historique réel
                  pour te répondre — pas de généralités, uniquement des insights sur TON trading.
                </p>
                <div className="mt-7 space-y-3.5">
                  {[
                    "Réponses basées sur tes vraies données",
                    "Diagnostic précis en quelques secondes",
                    "Plans d'action concrets, pas de théorie",
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-3.5 text-base text-slate-300">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {AIS.map((a, i) => (
                <article
                  key={a.t}
                  onPointerMove={spot}
                  className="ai-card spot reveal p-7"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-xl border border-white/[.1] bg-white/[.04] ${a.c} mb-6`}
                  >
                    <Icon n={a.n} cls="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display text-lg font-bold text-white">{a.t}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{a.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <StatsSection />

        {/* ── FEATURES ── */}
        <section
          id="features"
          className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24"
        >
          <div className="grid-bg" />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Fonctionnalités"
              title={
                <>
                  Tout ce qu'il faut pour <span className="text-gradient">progresser</span>. Rien
                  d'inutile.
                </>
              }
              sub="Chaque outil est là pour une seule raison : te faire prendre de meilleures décisions, trade après trade."
            />

            <div className="reveal">
              <FeaturesBento />
            </div>

            <div className="reveal mt-12 text-center">
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-primary px-8 py-4 text-[1.05rem] font-semibold"
              >
                Tout débloquer gratuitement <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <p className="mt-4 text-sm text-slate-600">14 jours Premium · sans carte bancaire</p>
            </div>
          </div>
        </section>

        {/* ─ QUI FAIT ÇA ── */}
        <section className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="grid-bg" />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <TraderProof onStart={() => open("signup", "Essai Premium 14 jours")} />
            <div className="mt-12">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* ── MÉTHODE ── */}
        <section className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="grid-bg" />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Méthode"
              title={
                <>
                  Comment <span className="text-gradient">Jarvis</span> analyse ton trading
                </>
              }
              sub="Aucune généralité : chaque analyse part de TES données, avec une méthode déterministe et transparente."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  {
                    t: "1 · Tu journalises",
                    d: "Chaque trade est enregistré : symbole, direction, risque, R-multiple, setup, erreurs, capture d'écran. 45 secondes par trade.",
                  },
                  {
                    t: "2 · Les métriques sont calculées",
                    d: "Win rate, R-multiple moyen, profit factor, drawdown, edge par jour et par setup : tout est recalculé en temps réel, sans approximation.",
                  },
                  {
                    t: "3 · Jarvis détecte tes patterns",
                    d: "Il cherche les schémas récurrents (série de pertes, sur-trading, fuite la plus coûteuse) avec un score de confiance — et ne conclut que si les données suffisent.",
                  },
                ] as const
              ).map((c) => (
                <article
                  key={c.t}
                  className="reveal rounded-2xl border border-white/[.06] bg-white/[.015] p-7"
                >
                  <h3 className="text-base font-bold text-white">{c.t}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{c.d}</p>
                </article>
              ))}
            </div>
            <div className="reveal mt-8 rounded-2xl border border-cyan-500/15 bg-cyan-500/[.05] p-6">
              <p className="text-sm leading-6 text-slate-300">
                <strong className="text-white">Le calcul des métriques, en clair.</strong> Win rate
                = trades gagnants ÷ trades décidés · R-multiple = profit ÷ risque du trade · Profit
                factor = somme des gains ÷ somme des pertes. Jarvis ne prédit jamais le marché : il
                analyse ton historique pour te montrer ce qui te coûte, et quoi corriger.
              </p>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section
          id="pricing"
          className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24"
        >
          <div className="grid-bg" />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Tarifs"
              title="Un investissement qui se rembourse en un trade"
              sub="Commence gratuitement. Passe en Premium quand tu es prêt. Sans risque, sans engagement."
            />

            <div className="reveal mb-12 flex justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/25 bg-emerald-400/[.08] px-5 py-2 text-sm font-bold text-emerald-300">
                <Icon n="sparkle" cls="h-4 w-4" /> En passant à l'année : 2 mois offerts, soit 40 €
                d'économie
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
              <div
                onPointerMove={spot}
                className="reveal spot flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-8"
              >
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">
                  Free
                </p>
                <div className="mt-5 flex items-end gap-1.5">
                  <span className="font-display text-5xl font-extrabold text-white">0 €</span>
                  <span className="mb-2 text-base text-slate-500">/ toujours</span>
                </div>
                <p className="mt-3 text-base text-slate-500">
                  Pour <span className="text-slate-300">noter</span> tes trades et poser les bases
                  de ta discipline.
                </p>
                <button
                  onClick={() => open("signup", "Plan Gratuit")}
                  className="btn-ghost w-full mt-7 py-3.5"
                >
                  Commencer gratuitement
                </button>
                <div className="mt-8 space-y-3 text-base">
                  {FREE_INCLUDED.map((f) => (
                    <p key={f} className="flex items-start gap-3 text-slate-300">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-400">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {f}
                    </p>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-white/[.06] bg-white/[.02] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">
                    Pas inclus
                  </p>
                  <div className="mt-3 space-y-2.5 text-[14px]">
                    {FREE_MISSING.map((f) => (
                      <p key={f} className="flex items-start gap-3 text-slate-600">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[.03]">
                          <Icon n="x" cls="h-3.5 w-3.5" />
                        </span>
                        {f}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div
                onPointerMove={spot}
                className="reveal spot flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.6),rgba(7,14,24,.94)_60%)] p-8 lg:-my-5 lg:py-12"
                style={{ transitionDelay: "80ms" }}
              >
                <div className="relative flex flex-col h-full">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">
                      Pro · Annuel
                    </p>
                    <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-extrabold uppercase text-[#03131b] flex items-center gap-1.5">
                      <Icon n="flame" cls="h-3.5 w-3.5 fill-current" />2 mois offerts
                    </span>
                  </div>
                  <div className="mt-5 flex items-end gap-2">
                    <span className="font-display text-6xl font-extrabold text-white">
                      {eur(Math.round(YEARLY_PER_MONTH * 100) / 100)}
                    </span>
                    <span className="mb-2.5 text-base text-slate-400">/ mois</span>
                  </div>
                  <p className="mt-3 text-base text-slate-300">
                    <span className="font-semibold text-white">{eur(YEARLY_EUR)}</span> facturés une
                    fois par an
                    <span className="ml-2 text-slate-500 line-through">
                      {eur(YEARLY_FULL_PRICE)}
                    </span>
                  </p>
                  <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-1.5 text-[13px] font-bold text-emerald-300">
                    <Icon n="check" cls="h-4 w-4" /> Tu économises {eur(YEARLY_SAVING)} / an
                  </div>
                  <button
                    onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")}
                    className="btn-primary w-full h-13! mt-7 py-4 text-[1.05rem] font-semibold"
                  >
                    Démarrer — 14 jours gratuits <Icon n="arrow" cls="h-4 w-4" />
                  </button>
                  <p className="mt-3 text-center text-[12px] text-slate-500">
                    Sans engagement · Sans carte requise
                  </p>
                  <p className="mt-8 text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">
                    Tout le plan Free, sans limite — et&nbsp;:
                  </p>
                  <div className="mt-4 space-y-3.5 text-base">
                    {PREMIUM_FEATURES.map(([f, why]) => (
                      <div key={f} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">
                          <Icon n="check" cls="h-3.5 w-3.5" />
                        </span>
                        <span>
                          <span className="block text-slate-100">{f}</span>
                          <span className="block text-[13px] leading-5 text-slate-500">{why}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                onPointerMove={spot}
                className="reveal spot flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-8 opacity-[.92]"
                style={{ transitionDelay: "160ms" }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">
                  Pro · Mensuel
                </p>
                <div className="mt-5 flex items-end gap-1.5">
                  <span className="font-display text-5xl font-extrabold text-slate-200">
                    {eur(MONTHLY_EUR)}
                  </span>
                  <span className="mb-2 text-base text-slate-500">/ mois</span>
                </div>
                <p className="mt-3 text-base text-slate-500">
                  Soit{" "}
                  <span className="font-semibold text-slate-400">
                    {eur(YEARLY_FULL_PRICE)} / an
                  </span>{" "}
                  — {eur(YEARLY_SAVING)} de plus que l'annuel.
                </p>
                <button
                  onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")}
                  className="btn-ghost w-full mt-7 py-3.5"
                >
                  Prendre au mois
                </button>
                <div className="mt-8 space-y-3 text-base">
                  <p className="text-[14px] leading-6 text-slate-500">
                    Exactement les mêmes fonctionnalités que l'annuel — seule la facturation change.
                  </p>
                  {PREMIUM_FEATURES.map(([f]) => (
                    <p key={f} className="flex items-start gap-3 text-slate-400">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-500">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="reveal mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {[
                ["shield", "14 jours gratuits sans risque"],
                ["lock", "Paiement sécurisé Stripe"],
                ["check", "Annulation en 1 clic"],
                ["download", "Données exportables"],
              ].map(([ic, t]) => (
                <span
                  key={t}
                  className="flex items-center gap-2.5 text-sm font-medium text-slate-500"
                >
                  <Icon n={ic as IName} cls="h-5 w-5 text-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="grid-bg" />
          <div className="relative mx-auto max-w-[780px] px-5 lg:px-8">
            <SectionHead
              tag="FAQ"
              title="Tout ce que tu dois savoir"
              sub="Encore un doute ? Voici les réponses aux questions les plus fréquentes."
            />
            <div className="reveal border-t border-white/[.08]">
              {FAQS.map(([q, a], i) => {
                const o = faq === i;
                return (
                  <div key={q} className="border-b border-white/[.08]">
                    <button
                      onClick={() => setFaq(o ? null : i)}
                      aria-expanded={o}
                      className="flex w-full items-center justify-between gap-5 py-6 text-left"
                    >
                      <span
                        className={`text-base font-semibold transition-colors sm:text-lg ${o ? "text-white" : "text-slate-300"}`}
                      >
                        {q}
                      </span>
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300 ${o ? "rotate-180 border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-white/[.12] text-slate-500"}`}
                      >
                        <Icon n="chevron" cls="h-4.5 w-4.5" />
                      </span>
                    </button>
                    <div className={`faq-body ${o ? "faq-open" : ""}`}>
                      <div>
                        <p className="pb-6 pr-8 text-base leading-7 text-slate-400">{a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="relative overflow-hidden border-t border-white/[.06] py-24 lg:py-32">
          <div className="grid-bg" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgba(34,211,238,.14),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[760px] px-5 text-center">
            {cd && (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/25 bg-amber-400/[.07] px-5 py-2 text-[12px] font-bold text-amber-300 mb-8">
                <span className="ping-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                Ouverture des marchés dans {cd} — ton coach est-il prêt ?
              </div>
            )}
            <h2 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold tracking-[-0.045em] text-white leading-[1.05]">
              Ton prochain trade mérite
              <br />
              <span className="h-shine">un vrai coach.</span>
            </h2>
            <p className="mt-6 text-lg text-slate-400 leading-7 max-w-[560px] mx-auto">
              TradeVault ne se contente pas d'enregistrer tes trades. Il les comprend, détecte tes
              schémas et te dit quoi corriger.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-primary px-8 py-4 text-[1.1rem] font-semibold"
              >
                Commencer gratuitement <Icon n="arrow" cls="h-5 w-5" />
              </button>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              14 jours Premium · Sans carte bancaire · Annulation en 1 clic
            </p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative border-t border-white/[.06] py-12 lg:py-16">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Logo />
                <p className="mt-4 text-sm leading-6 text-slate-500 max-w-[320px]">
                  TradeVault est le cockpit intelligent du trader. Journal, analytics, Coach IA —
                  tout ce qu'il faut pour progresser.
                </p>
                <div className="mt-6 flex items-center gap-3">
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
            <div className="mt-12 pt-8 border-t border-white/[.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-600">© 2026 TradeVault. Tous droits réservés.</p>
              <div className="flex items-center gap-6 text-sm">
                <a href="#" className="text-slate-600 hover:text-slate-400 transition">
                  Confidentialité
                </a>
                <a href="#" className="text-slate-600 hover:text-slate-400 transition">
                  CGU
                </a>
                <a href="#" className="text-slate-600 hover:text-slate-400 transition">
                  Cookies
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {auth && (
        <AuthModal
          mode={authMode}
          plan={authPlan}
          onClose={() => setAuth(false)}
          onSwitch={(m) => setAuthMode(m)}
        />
      )}
      <CookieConsent />
    </div>
  );
}
