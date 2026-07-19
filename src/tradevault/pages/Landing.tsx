import { PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import logoSrc from "@/assets/tradevault-logo.png";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";

/**
 * Public landing page shown at "/" for signed-out visitors. Authenticated
 * users never see it — App.tsx routes them straight into the product.
 *
 * The sign-in / sign-up means (email · password · name · Google) opens as a
 * compact popup modal *over* the landing — not a full-page takeover. On
 * success `isAuthenticated` flips and App.tsx unmounts this whole tree.
 *
 * Copy is hardcoded French for now; we refine details step by step later.
 */

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
        className={`font-display font-extrabold tracking-[-0.04em] text-[#ffffff] leading-none ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}
      >
        Trade Vault
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

/* ─────────────────────────── AI CONVERSATION ─────────────────────────── */
function AIConversation() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[#0b1727]/90 shadow-[0_24px_64px_rgba(0,0,0,.45)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
      <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4">
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
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Actif
        </span>
      </div>
      <div className="space-y-3.5 px-5 py-5">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-white/[.08] bg-white/[.05] px-4 py-2.5">
            <p className="text-xs leading-5 text-slate-200">
              Pourquoi je perds de l'argent le vendredi ?
            </p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-cyan-400/20 bg-cyan-400/[.05] p-4">
          <p className="text-xs leading-5 text-slate-200">
            J'ai analysé tes 6 derniers vendredis. Ton win rate chute à{" "}
            <strong className="text-red-300">38%</strong> (vs 64% en semaine). Cause principale : tu
            augmentes ta taille de position de <strong className="text-cyan-300">+42%</strong> après
            un début de semaine perdant.
          </p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              Plan recommandé
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-200">
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

/* The 3 pains that actually kill accounts — kept tight so the visitor
   recognises themselves in seconds, then moves on to the solution. */
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

/* Coach IA sub-benefits — outcomes, not features. */
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

/* Benefit-driven feature grid — the strongest pages framed as results. Each
   card ends with a live-looking mini preview of the real in-app component
   (same visual language as the product) rendered by FeaturePreview below. */
type FeatKind = "journal" | "analytics" | "checklist" | "reports" | "news" | "import";
const FEATURES: (Feat & { k: FeatKind })[] = [
  {
    k: "journal",
    n: "document",
    t: "Journal en 20 secondes",
    d: "Prix, captures, émotion, note — ta mémoire de trader, enfin fiable.",
  },
  {
    k: "analytics",
    n: "trend",
    t: "Analytics qui disent vrai",
    d: "20+ métriques pro qui montrent où tu gagnes réellement.",
  },
  {
    k: "checklist",
    n: "shield",
    t: "Discipline avant chaque trade",
    d: "Checklist pré-market validée avant de risquer un centime.",
  },
  {
    k: "reports",
    n: "layers",
    t: "Rapports mensuels automatiques",
    d: "Ton bilan de perf prêt chaque mois, sans tableur.",
  },
  {
    k: "news",
    n: "bell",
    t: "Calendrier économique intégré",
    d: "Les annonces à fort impact, avant qu'elles te piègent.",
  },
  {
    k: "import",
    n: "upload",
    t: "Import CSV en 1 clic",
    d: "MT4/MT5, cTrader, IB, TradingView — des années analysées en secondes.",
  },
];

/* Mini live previews — faithful, compact recreations of the app's own
   components (same colors, radii, type) so each card shows the real thing. */
function FeaturePreview({ k }: { k: FeatKind }) {
  const wrap = "pointer-events-none select-none";
  if (k === "journal")
    return (
      <div className={`${wrap} space-y-1.5`} aria-hidden="true">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-400/10">
            <Icon n="trend" cls="h-3.5 w-3.5 text-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-white">NQ</span>
              <span className="rounded bg-emerald-400/15 px-1 py-px text-[8px] font-bold text-emerald-400">
                LONG
              </span>
              <span className="truncate text-[9px] text-slate-600">Silver Bullet</span>
            </div>
            <div className="text-[9px] text-slate-600">10:03 · 2R · 150 $ de risque</div>
          </div>
          <span className="font-display text-xs font-extrabold text-emerald-400">+300 $</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-white/[.05] bg-white/[.01] px-3 py-1.5 opacity-50">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-red-400/10">
            <Icon n="chevron" cls="h-3 w-3 text-red-400" />
          </span>
          <span className="text-[10px] font-bold text-white">EU</span>
          <span className="rounded bg-red-400/15 px-1 py-px text-[8px] font-bold text-red-400">
            SHORT
          </span>
          <span className="ml-auto font-display text-[11px] font-extrabold text-red-400">
            −80 $
          </span>
        </div>
      </div>
    );
  if (k === "analytics")
    return (
      <div className={`${wrap} grid grid-cols-3 gap-1.5`} aria-hidden="true">
        {[
          ["Sharpe", "1.84"],
          ["Profit F.", "2.31"],
          ["Win rate", "64%"],
        ].map(([l, v]) => (
          <div
            key={l}
            className="rounded-lg border border-white/[.07] bg-white/[.02] px-1.5 py-2 text-center"
          >
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
              {l}
            </div>
            <div className="font-display mt-0.5 text-sm font-extrabold text-cyan-300">{v}</div>
          </div>
        ))}
      </div>
    );
  if (k === "checklist")
    return (
      <div className={`${wrap} space-y-1.5`} aria-hidden="true">
        {[
          ["Biais H4 / D1 analysé", true],
          ["Risque max de la session défini", true],
          ["2 setups A+ repérés", false],
        ].map(([label, done]) => (
          <div
            key={label as string}
            className="flex items-center gap-2 rounded-md border border-white/[.06] bg-white/[.02] px-2.5 py-1.5"
          >
            <span
              className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded ${done ? "bg-cyan-400 text-[#03131b]" : "border border-white/20 text-transparent"}`}
            >
              <Icon n="check" cls="h-2.5 w-2.5" />
            </span>
            <span className={`text-[10px] ${done ? "text-slate-300" : "text-slate-500"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    );
  if (k === "reports")
    return (
      <div className={wrap} aria-hidden="true">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-white">Rapport · Octobre</span>
          <span className="font-display text-xs font-extrabold text-emerald-400">+1 240 $</span>
        </div>
        <div className="flex h-10 items-end gap-1">
          {[35, 55, 30, 70, 45, 85, 25, 60, 40, 90, 50, 75].map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-sm ${i === 6 ? "bg-red-400/50" : "bg-gradient-to-t from-cyan-500/30 to-cyan-400/70"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  if (k === "news")
    return (
      <div className={`${wrap} space-y-1.5`} aria-hidden="true">
        {[
          ["14:30", "NFP · USD", "FORT", "text-red-400 bg-red-400/15"],
          ["20:00", "FOMC · USD", "FORT", "text-red-400 bg-red-400/15"],
          ["11:00", "CPI · EUR", "MOYEN", "text-amber-300 bg-amber-400/15"],
        ].map(([h, ev, imp, c]) => (
          <div
            key={ev}
            className="flex items-center gap-2.5 rounded-md border border-white/[.06] bg-white/[.02] px-2.5 py-1.5"
          >
            <span className="text-[9px] font-bold tabular-nums text-slate-500">{h}</span>
            <span className="flex-1 text-[10px] font-semibold text-slate-200">{ev}</span>
            <span className={`rounded px-1.5 py-px text-[8px] font-bold ${c}`}>{imp}</span>
          </div>
        ))}
      </div>
    );
  // import
  return (
    <div className={wrap} aria-hidden="true">
      <div className="rounded-lg border-2 border-dashed border-cyan-400/30 bg-cyan-400/[.04] px-3 py-2.5 text-center">
        <span className="text-[10px] font-semibold text-slate-300">historique_2025.csv</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-0.5 text-[9px]">
        <span className="text-slate-500">248 trades détectés</span>
        <span className="flex items-center gap-1 font-bold text-emerald-400">
          <Icon n="check" cls="h-2.5 w-2.5" />
          Analyse IA lancée
        </span>
      </div>
    </div>
  );
}

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
    <div className={`reveal ${center ? "text-center mx-auto" : ""} max-w-2xl mb-12`}>
      <div className="tag-label inline-flex mb-4">{tag}</div>
      <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.85rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.08]">
        {title}
      </h2>
      {sub && <p className="mt-4 text-slate-400 leading-7">{sub}</p>}
    </div>
  );
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
  useEffect(() => {
    const onScroll = () => {
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
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const open = (mode: "login" | "signup", plan?: string) => {
    setMenu(false);
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuth(true);
  };
  // Nav clicks land the section visually centered in the viewport (below the
  // fixed 66px header). Sections taller than the viewport align to the top
  // instead — centering those would hide their heading.
  const go = (id: string) => {
    setMenu(false);
    const el = document.getElementById(id);
    if (!el) return;
    const header = 66;
    const r = el.getBoundingClientRect();
    const room = window.innerHeight - header;
    const top =
      r.height < room
        ? window.scrollY + r.top - header - (room - r.height) / 2
        : window.scrollY + r.top - header - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
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
      >
        <div
          className="scroll-bar absolute inset-x-0 top-0 h-[2px]"
          style={{ transform: `scaleX(${pct})` }}
        />
        {/* Three-track layout: the logo (left) and actions (right) keep their
            natural width, while the nav is absolutely centered on the header —
            so it stays perfectly symmetric and never collides with either side,
            whatever their content width. */}
        <div className="relative mx-auto flex h-[66px] max-w-[1600px] items-center justify-between gap-4 px-5 lg:px-8">
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
                  className={`flex items-center gap-1 rounded-full px-2 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${
                    on
                      ? "bg-cyan-400/[.12] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.25)]"
                      : isTp
                        ? "text-emerald-300 hover:bg-emerald-400/[.08]"
                        : "text-slate-400 hover:text-white hover:bg-white/[.04]"
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
          {/* Right zone — actions, natural width; mirrors the left visually. */}
          <div className="flex items-center justify-end gap-2.5">
            <div className="hidden items-center gap-2 xl:flex">
              {/* Below 2xl the centered 8-item nav needs the horizontal room, so
                  the secondary "Se connecter" only appears once there's space.
                  Wrapped because `.btn-ghost` sets its own display and would win
                  over the `hidden` utility otherwise. */}
              <div className="hidden 2xl:block">
                <button onClick={() => open("login")} className="btn-ghost px-3.5 text-[13px]">
                  Se connecter
                </button>
              </div>
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-primary px-4 text-[13px]"
              >
                Essai gratuit <Icon n="arrow" cls="h-4 w-4" />
              </button>
            </div>
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
              <button onClick={() => open("login")} className="btn-ghost mt-2.5 w-full">
                Se connecter
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section
          className="hero-mesh relative overflow-hidden pt-[120px] pb-20 lg:pt-[150px] lg:pb-28"
          onPointerMove={onHeroMove}
        >
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:px-8">
            <div className="text-center lg:text-left">
              <div className="fade-up inline-flex items-center gap-2.5 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />{" "}
                Ton coach IA de trading personnel
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
              <p className="fade-up d2 mt-6 text-base leading-7 text-slate-400 sm:text-lg max-w-[520px] mx-auto lg:mx-0">
                TradeVault n'est pas un simple journal. C'est un{" "}
                <strong className="text-slate-200">coach IA disponible 24h/24</strong> qui analyse
                tes trades, détecte tes erreurs, comprend ta psychologie et t'accompagne vers une
                progression réelle.
              </p>
              <div className="fade-up d3 mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <button
                  onClick={() => open("signup", "Essai Premium 14 jours")}
                  className="btn-primary px-6 py-3.5 text-[.95rem]"
                >
                  Essai Premium 14 jours <Icon n="arrow" cls="h-4 w-4" />
                </button>
                <button
                  onClick={() => open("signup", "Plan Gratuit")}
                  className="btn-ghost px-6 py-3.5 text-[.95rem]"
                >
                  Commencer gratuitement
                </button>
              </div>
              <div className="fade-up d4 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {["Sans carte bancaire", "Annulation en 1 clic", "Setup en 2 min"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
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

        {/* ── PROBLÈME ── */}
        <section id="problem" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROBLEMS.map((p, i) => (
                <article
                  key={p.t}
                  onPointerMove={spot}
                  className="reveal spot rounded-xl border border-red-400/12 bg-red-400/[.03] p-6 transition-colors hover:border-red-400/25"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className="grid h-11 w-11 place-items-center rounded-lg border border-red-400/20 bg-red-400/[.07] text-red-400 mb-5">
                    <Icon n={p.n} cls="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{p.t}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION IA (cœur) ── */}
        <section
          id="ai"
          className="relative border-t border-white/[.06] overflow-hidden py-20 lg:py-28"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 45% at 50% 30%,rgba(34,211,238,.08),transparent 60%)",
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

            <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-14 mb-16">
              <AIConversation />
              <div>
                <h3 className="font-display text-2xl font-bold text-white leading-tight">
                  Un mentor qui connaît
                  <br />
                  <span className="text-gradient">chacun de tes trades.</span>
                </h3>
                <p className="mt-4 text-slate-400 leading-7">
                  Pose une question en langage naturel. Le Coach IA puise dans ton historique réel
                  pour te répondre — pas de généralités, uniquement des insights sur TON trading.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    "Réponses basées sur tes vraies données",
                    "Diagnostic précis en quelques secondes",
                    "Plans d'action concrets, pas de théorie",
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-3 text-sm text-slate-300">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300">
                        <Icon n="check" cls="h-3 w-3" />
                      </span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AIS.map((a, i) => (
                <article
                  key={a.t}
                  onPointerMove={spot}
                  className="ai-card spot reveal p-6"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-xl border border-white/[.1] bg-white/[.04] ${a.c} mb-5`}
                  >
                    <Icon n={a.n} cls="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold text-white">{a.t}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{a.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section
          id="features"
          className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <article
                  key={f.t}
                  onPointerMove={spot}
                  className="reveal spot glass-card group flex flex-col overflow-hidden transition-colors hover:border-cyan-400/25"
                  style={{ transitionDelay: `${(i % 3) * 60}ms` }}
                >
                  <div className="p-5 pb-4">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="feat-icon h-9 w-9 shrink-0 transition-transform group-hover:scale-105">
                        <Icon n={f.n} cls="h-4.5 w-4.5" />
                      </div>
                      <h3 className="font-display text-[15px] font-bold text-white leading-tight">
                        {f.t}
                      </h3>
                    </div>
                    <p className="text-[13px] leading-6 text-slate-400">{f.d}</p>
                  </div>
                  {/* Real-component preview — the actual thing you get, not an illustration */}
                  <div className="mt-auto border-t border-white/[.06] bg-[#081120]/60 px-4 pt-3.5 pb-4">
                    <FeaturePreview k={f.k} />
                  </div>
                </article>
              ))}
            </div>

            <div className="reveal mt-10 text-center">
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-primary px-7 py-3.5"
              >
                Tout débloquer gratuitement <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <p className="mt-3 text-xs text-slate-600">14 jours Premium · sans carte bancaire</p>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section
          id="pricing"
          className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead
              tag="Tarifs"
              title="Un investissement qui se rembourse en un trade"
              sub="Commence gratuitement. Passe en Premium quand tu es prêt. Sans risque, sans engagement."
            />

            <div className="reveal mb-10 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[.08] px-4 py-1.5 text-xs font-bold text-emerald-300">
                <Icon n="sparkle" cls="h-3.5 w-3.5" /> En passant à l'année : 2 mois offerts + 20%
                d'économie
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
              {/* FREE — entry */}
              <div
                onPointerMove={spot}
                className="reveal spot flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7"
              >
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">
                  Free
                </p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-display text-4xl font-extrabold text-white">0 €</span>
                  <span className="mb-1.5 text-sm text-slate-500">/ toujours</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Pour poser les bases de ta discipline.
                </p>
                <button
                  onClick={() => open("signup", "Plan Gratuit")}
                  className="btn-ghost w-full mt-6"
                >
                  Commencer gratuitement
                </button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {[
                    "Dashboard",
                    "Journal de trading (30 trades / mois)",
                    "Checklist pré-market",
                    "Statistiques de base",
                  ].map((f) => (
                    <p key={f} className="flex items-center gap-2.5 text-slate-300">
                      <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-400">
                        <Icon n="check" cls="h-3 w-3" />
                      </span>
                      {f}
                    </p>
                  ))}
                  {["Assistant IA & Insights", "Import CSV automatique", "Rapports mensuels"].map(
                    (f) => (
                      <p key={f} className="flex items-center gap-2.5 text-slate-600">
                        <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.03]">
                          <Icon n="x" cls="h-3 w-3" />
                        </span>
                        <span className="line-through">{f}</span>
                      </p>
                    ),
                  )}
                </div>
              </div>

              {/* PRO ANNUEL — the hero, framed as the obvious value */}
              <div
                onPointerMove={spot}
                className="reveal spot flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] p-7 lg:-my-4 lg:py-11"
                style={{ transitionDelay: "80ms" }}
              >
                <div className="relative flex flex-col h-full">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">
                      Pro · Annuel
                    </p>
                    <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#03131b] flex items-center gap-1">
                      <Icon n="flame" cls="h-3 w-3 fill-current" />2 mois offerts
                    </span>
                  </div>
                  {/* Lead with the small monthly-equivalent, then reveal the honest annual bill */}
                  <div className="mt-4 flex items-end gap-1.5">
                    <span className="font-display text-5xl font-extrabold text-white">19,90 €</span>
                    <span className="mb-2 text-sm text-slate-400">/ mois</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="font-semibold text-white">239 €</span> facturés une fois par an
                    <span className="ml-1.5 text-slate-500 line-through">299 €</span>
                  </p>
                  <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
                    <Icon n="check" cls="h-3.5 w-3.5" /> Tu économises 60 € / an
                  </div>
                  <button
                    onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")}
                    className="btn-primary w-full h-12! mt-6"
                  >
                    Démarrer — 14 jours gratuits <Icon n="arrow" cls="h-4 w-4" />
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Sans engagement · Sans carte requise
                  </p>
                  <div className="mt-7 space-y-2.5 text-sm">
                    {[
                      "Tout le plan Free, sans limite",
                      "Assistant IA illimité 24h/24",
                      "Insights automatiques (patterns)",
                      "Import CSV automatique illimité",
                      "Analytics quantitatives (20+ métriques)",
                      "Suivi des erreurs & setups manqués",
                      "Calculateur de position intégré",
                      "Rapports mensuels automatiques",
                      "Palette de commandes ⌘K",
                      "Support prioritaire",
                    ].map((f) => (
                      <p key={f} className="flex items-center gap-2.5 text-slate-200">
                        <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">
                          <Icon n="check" cls="h-3 w-3" />
                        </span>
                        {f}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* PRO MENSUEL — deliberately the least attractive option */}
              <div
                onPointerMove={spot}
                className="reveal spot flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7 opacity-[.92]"
                style={{ transitionDelay: "160ms" }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">
                  Pro · Mensuel
                </p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-display text-4xl font-extrabold text-slate-200">
                    24,99 €
                  </span>
                  <span className="mb-1.5 text-sm text-slate-500">/ mois</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Soit <span className="font-semibold text-slate-400">299 € / an</span> — 60 € de
                  plus que l'annuel.
                </p>
                <button
                  onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")}
                  className="btn-ghost w-full mt-6"
                >
                  Prendre au mois
                </button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {[
                    "Tout le plan Free, sans limite",
                    "Assistant IA illimité 24h/24",
                    "Insights automatiques (patterns)",
                    "Import CSV automatique illimité",
                    "Analytics quantitatives avancées",
                    "Suivi des erreurs & setups manqués",
                    "Rapports mensuels automatiques",
                    "Support prioritaire",
                  ].map((f) => (
                    <p key={f} className="flex items-center gap-2.5 text-slate-400">
                      <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-500">
                        <Icon n="check" cls="h-3 w-3" />
                      </span>
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                ["shield", "14 jours gratuits sans risque"],
                ["lock", "Paiement sécurisé Stripe"],
                ["check", "Annulation en 1 clic"],
                ["download", "Données exportables"],
              ].map(([ic, t]) => (
                <span
                  key={t}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500"
                >
                  <Icon n={ic as IName} cls="h-4 w-4 text-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[760px] px-5 lg:px-8">
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
                      className="flex w-full items-center justify-between gap-5 py-5 text-left"
                    >
                      <span
                        className={`text-sm font-semibold transition-colors sm:text-base ${o ? "text-white" : "text-slate-300"}`}
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
                        <p className="pb-5 pr-8 text-sm leading-7 text-slate-400">{a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="relative overflow-hidden border-t border-white/[.06] py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgba(34,211,238,.12),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[720px] px-5 text-center">
            {cd && (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/25 bg-amber-400/[.07] px-4 py-1.5 text-[11px] font-bold text-amber-300 mb-7">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                Ouverture des marchés dans {cd} — ton coach est-il prêt ?
              </div>
            )}
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.045em] text-white leading-[1.05]">
              Ton prochain trade mérite
              <br />
              <span className="h-shine">un vrai coach.</span>
            </h2>
            <p className="mt-5 text-slate-400 leading-7 max-w-lg mx-auto">
              Arrête de trader seul et à l'aveugle. Laisse une IA analyser chaque décision et te
              guider vers le trader discipliné que tu veux devenir.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => open("signup", "Essai Premium 14 jours")}
                className="btn-primary px-8 py-4"
              >
                Essai Premium 14 jours <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <button
                onClick={() => open("signup", "Plan Gratuit")}
                className="btn-ghost px-8 py-4"
              >
                Commencer gratuitement
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-600">
              Sans carte bancaire · Annulation en 1 clic · Garantie satisfait ou remboursé 30 jours
            </p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto max-w-[1200px] px-5 py-12 lg:px-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="max-w-xs">
              <Logo compact />
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Le coach IA de référence pour les traders qui veulent progresser avec méthode.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:items-end">
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 sm:justify-end">
                <button onClick={() => go("features")} className="hover:text-slate-300 transition">
                  Fonctionnalités
                </button>
                <button onClick={() => go("pricing")} className="hover:text-slate-300 transition">
                  Tarifs
                </button>
                <a href="/terms" className="hover:text-slate-300 transition">
                  Conditions
                </a>
                <a href="/privacy" className="hover:text-slate-300 transition">
                  Confidentialité
                </a>
              </div>
              <a
                href="mailto:contact@tradevault.app"
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-cyan-300 transition"
              >
                <Icon n="mail" cls="h-3.5 w-3.5" /> contact@tradevault.app
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/[.05] pt-6 text-center text-[11px] text-slate-700">
            © {new Date().getFullYear()} TradeVault. Le trading comporte des risques. Journalise
            d'abord, trade ensuite.
          </div>
        </div>
      </footer>

      {/* ── STICKY MOBILE CTA ── */}
      {y > 500 && !auth && !menu && (
        <div className="sticky-bar-in fixed inset-x-0 bottom-0 z-40 border-t border-white/[.08] bg-[#060d16]/92 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl xl:hidden">
          <button
            onClick={() => open("signup", "Essai Premium 14 jours")}
            className="btn-primary w-full py-3.5"
          >
            Essai Premium 14 jours — gratuit
          </button>
        </div>
      )}

      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
