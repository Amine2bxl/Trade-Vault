import {
  FormEvent,
  PointerEvent as RPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import TrustpilotWidget, { TRUSTPILOT_BUSINESS_UNIT_ID } from "../components/TrustpilotWidget";
import logoSrc from "@/assets/tradevault-logo.png";

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

/* ─────────────────────────── ICONS ─────────────────────────── */
type IName =
  | "arrow" | "bell" | "brain" | "calendar" | "chart" | "check" | "chevron"
  | "close" | "compass" | "document" | "download" | "err" | "eye" | "flame"
  | "heart" | "layers" | "lock" | "mail" | "menu" | "mobile" | "plus" | "radar"
  | "shield" | "sparkle" | "star" | "target" | "trend" | "upload" | "user" | "x" | "zap";
function Icon({ n, cls = "" }: { n: IName; cls?: string }) {
  const p: Record<IName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
    brain: <><path d="M12 5a3 3 0 0 0-5.7 1.25A3.5 3.5 0 0 0 6.5 13 3 3 0 0 0 12 15" /><path d="M12 5a3 3 0 0 1 5.7 1.25A3.5 3.5 0 0 1 17.5 13 3 3 0 0 1 12 15" /><path d="M12 5v10" /><path d="M9 19a3 3 0 0 0 3-3" /><path d="M15 19a3 3 0 0 1-3-3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chart: <><path d="M3 17 9 11l4 4 8-9" /><path d="M15 6h6v6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6 6-2Z" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    err: <><path d="M12 9v4" /><path d="M10.3 3.3 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /><path d="M12 17h.01" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    flame: <path d="M12 22c4.4 0 7-2.8 7-6.5 0-2.4-1.2-4.2-2.5-5.8C15 8.2 14.7 6.6 15.2 4c-3.1 1-5 4-5 6.8 0 .5 0 1 .13 1.5C9.4 11.6 8.9 10.8 8.7 9.5 6.9 11 5 13.2 5 15.9 5 19.2 7.6 22 12 22Z" />,
    heart: <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 8.5 5 10.5 6.5 12 8c1.5-1.5 3.5-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21Z" />,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    mobile: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    radar: <><path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 12 20 4" /><circle cx="12" cy="12" r="4" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkle: <><path d="m12 3-1.2 4.1L7 8.4l3.8 1.3L12 14l1.2-4.3L17 8.4l-3.8-1.3L12 3Z" /><path d="m19 15-.6 2.1-1.9.6 1.9.7.6 2 .7-2 1.9-.7-1.9-.6L19 15Z" /></>,
    star: <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45l-5.8 3.05 1.1-6.47L2.6 9.45l6.5-.95L12 2.6Z" />,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m15 9-3 3" /></>,
    trend: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
    x: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    zap: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  };
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[n]}
    </svg>
  );
}

/* ─────────────────────────── LOGO ─────────────────────────── */
function Logo({ compact = false }: { compact?: boolean }) {
  const s = compact ? 28 : 34;
  return (
    <a href="#" className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm">
      <img
        src={logoSrc}
        alt="TradeVault"
        width={s}
        height={s}
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]`}
      />
      <span className={`font-display font-extrabold tracking-[-0.04em] text-[#ffffff] leading-none ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}>
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
    let tx = window.innerWidth / 2, ty = window.innerHeight / 2, cx = tx, cy = ty, raf = 0, active = false;
    const onMove = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; if (!active) { active = true; el.style.opacity = "1"; } };
    const onLeave = () => { active = false; el.style.opacity = "0"; };
    const tick = () => { cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16; el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`; raf = requestAnimationFrame(tick); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); };
  }, []);
  return <div ref={ref} className="landing-cursor-glow" aria-hidden="true" />;
}

/* ─────────────────────────── HOOKS ─────────────────────────── */
function useScroll() {
  const [y, setY] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const h = () => {
      const sy = window.scrollY; setY(sy);
      const m = document.documentElement.scrollHeight - window.innerHeight;
      setPct(m > 0 ? Math.min(sy / m, 1) : 0);
    };
    h(); window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return { y, pct };
}
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("reveal-visible"); io.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
function useCountdown() {
  const calc = () => {
    const n = new Date(); const d = n.getDay();
    if (d === 0 || d === 6) return null;
    const o = new Date(n); o.setHours(9, 30, 0, 0);
    const df = o.getTime() - n.getTime();
    return df > 0 ? df : null;
  };
  const [ms, setMs] = useState<number | null>(calc);
  useEffect(() => { const id = setInterval(() => setMs(calc()), 1000); return () => clearInterval(id); }, []);
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
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
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Courbe de capital</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-400 tracking-tight">+4 218,50 €</p>
          </div>
          <span className="mt-1 rounded-full bg-emerald-400/12 border border-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400">+16.9%</span>
        </div>
        <div className="h-24 w-full">
          <svg viewBox="0 0 345 125" className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <defs><linearGradient id="hf" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#22d3ee" stopOpacity=".22" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs>
            {[30, 65, 100].map((yy) => <path key={yy} d={`M0 ${yy}H345`} stroke="rgba(148,163,184,.1)" strokeDasharray="3 5" />)}
            <polygon points={`${pts} 340,125 0,125`} fill="url(#hf)" />
            <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="chart-line" />
            <circle cx="340" cy="20" r="4.5" fill="#0a1625" stroke="#67e8f9" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[.07] pt-4">
          {[["Réussite", "64%"], ["Profit Factor", "2.31"], ["Sharpe", "1.84"]].map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="text-[9px] font-medium uppercase tracking-[.08em] text-slate-500">{l}</p>
              <p className="mt-1 font-display text-base font-bold text-cyan-300">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="float-a absolute -bottom-10 -left-6 z-10 w-[230px] rounded-xl border border-cyan-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl hidden sm:block">
        <div className="flex items-center gap-2 mb-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-500"><Icon n="brain" cls="h-3.5 w-3.5 text-[#03131b]" /></div>
          <p className="text-[10px] font-bold text-white">Coach IA</p>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live</span>
        </div>
        <p className="text-[10px] leading-4 text-slate-300">Tu surtrades après une perte. <span className="text-cyan-300 font-semibold">Limite à 3 setups demain.</span></p>
      </div>

      <div className="float-b absolute -top-8 -right-5 z-10 w-[190px] rounded-xl border border-violet-400/25 bg-[#0b1a2b]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl hidden md:block">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon n="radar" cls="h-3.5 w-3.5 text-violet-300" />
          <p className="text-[10px] font-bold text-white">Pattern détecté</p>
        </div>
        <p className="text-[10px] leading-4 text-slate-300">Tes setups <span className="text-violet-300 font-semibold">VWAP</span> : 71% de réussite.</p>
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
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500"><Icon n="brain" cls="h-4.5 w-4.5 text-[#03131b]" /></div>
          <div>
            <p className="text-xs font-bold text-white">TradeVault Coach IA</p>
            <p className="text-[10px] text-emerald-400">Analyse de 248 trades · en direct</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Actif</span>
      </div>
      <div className="space-y-3.5 px-5 py-5">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-white/[.08] bg-white/[.05] px-4 py-2.5">
            <p className="text-xs leading-5 text-slate-200">Pourquoi je perds de l'argent le vendredi ?</p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-cyan-400/20 bg-cyan-400/[.05] p-4">
          <p className="text-xs leading-5 text-slate-200">J'ai analysé tes 6 derniers vendredis. Ton win rate chute à <strong className="text-red-300">38%</strong> (vs 64% en semaine). Cause principale : tu augmentes ta taille de position de <strong className="text-cyan-300">+42%</strong> après un début de semaine perdant.</p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-4">
          <div className="flex items-center gap-1.5 mb-2"><Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" /><span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Plan recommandé</span></div>
          <p className="text-xs leading-5 text-slate-200">Vendredi : taille fixe, max 2 trades, stop après 1 perte. J'ajoute cette règle à ta checklist pré-market ?</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl rounded-tl-sm border border-white/[.06] bg-white/[.03] px-4 py-3"><span className="typing"><span /><span /><span /></span></div>
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

/* ─────────────────────────── JARVIS CHECKLIST ─────────────────────────── */
function JarvisChecklist() {
  const [done, setDone] = useState<boolean[]>([true, true, true, false, false]);
  const spot = useSpot();
  const items = [
    "Analyser le biais du marché (H4 / D1)",
    "Consulter le calendrier économique du jour",
    "Définir mon risque maximum de la session",
    "Repérer 2 setups A+ à surveiller",
    "Respirer. Aucune urgence à trader.",
  ];
  const doneCount = done.filter(Boolean).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const toggle = (i: number) => setDone((d) => d.map((v, idx) => (idx === i ? !v : v)));

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="hud-ring inset-0 -m-6" aria-hidden="true" />
      <div className="hud-ring reverse inset-0 -m-12" aria-hidden="true" />
      <div onPointerMove={spot} className="spot hud-panel relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#081120]/92 shadow-[0_30px_90px_rgba(0,0,0,.5)] backdrop-blur-xl">
        <div className="scan-line" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
        <div className="relative flex items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0">
              <svg viewBox="0 0 44 44" className="-rotate-90">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="3.5" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${pct * 1.13} 200`} style={{ transition: "stroke-dasharray .4s cubic-bezier(.22,1,.36,1)" }} />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-cyan-300">{doneCount}/{items.length}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">Checklist Pré-Market</p>
              <p className="text-[10px] text-cyan-300/80">Protocole de discipline · style HUD</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
            <Icon n="flame" cls="h-3 w-3" />12 jours
          </span>
        </div>
        <div className="relative space-y-2 px-5 py-5">
          {items.map((label, i) => (
            <button key={label} onClick={() => toggle(i)} className={`check-item flex w-full items-center gap-3 rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2.5 text-left ${done[i] ? "done" : ""}`}>
              <span className={`check-box grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-white/20 ${done[i] ? "text-[#03131b]" : "text-transparent"}`}>
                <Icon n="check" cls="h-3 w-3" />
              </span>
              <span className={`text-xs leading-5 ${done[i] ? "text-slate-300" : "text-slate-400"}`}>{label}</span>
            </button>
          ))}
        </div>
        <div className="relative flex items-center gap-2 border-t border-white/[.07] px-5 py-3.5">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
          <p className="text-[10px] text-slate-500">{pct === 100 ? "Discipline activée. Bonne session." : `${pct}% complété — termine avant l'ouverture.`}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── ROI CALCULATOR ─────────────────────────── */
function RoiCalc({ onCta }: { onCta: () => void }) {
  const [sl, setSl] = useState(150);
  const [rt, setRt] = useState(3);
  const spot = useSpot();
  const yearly = Math.round(rt * sl * 52);
  return (
    <div onPointerMove={spot} className="spot glass-card p-6 sm:p-8">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="feat-icon"><Icon n="chart" cls="h-5 w-5" /></div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.13em] text-emerald-400">Simulateur concret</p>
          <p className="font-display text-lg font-bold text-white">Le coût réel de l'indiscipline</p>
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-slate-400">Stop-loss moyen</span>
            <span className="text-cyan-300">{sl} €</span>
          </div>
          <input type="range" min={20} max={1500} step={10} value={sl} onChange={(e) => setSl(+e.target.value)} aria-label="Stop-loss moyen" />
        </div>
        <div>
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-slate-400">Trades hors-plan / semaine</span>
            <span className="text-cyan-300">{rt}</span>
          </div>
          <input type="range" min={1} max={12} step={1} value={rt} onChange={(e) => setRt(+e.target.value)} aria-label="Trades hors-plan par semaine" />
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-5 py-4">
        <p className="text-xs font-semibold text-slate-400 mb-1">Coût annuel estimé de ces trades</p>
        <p className="font-display text-3xl font-extrabold text-emerald-400 tracking-tight">{yearly.toLocaleString("fr-FR")} €<span className="text-sm font-semibold text-slate-500 ml-1">/ an</span></p>
        <p className="mt-1 text-[11px] text-slate-500">En repérant ces trades avant qu'ils partent, avec la checklist et le suivi des erreurs.</p>
      </div>
      <button onClick={onCta} className="btn-primary w-full mt-5">Reprendre le contrôle <Icon n="arrow" cls="h-4 w-4" /></button>
    </div>
  );
}

/* ─────────────────────────── AUTH MODAL (real auth, popup over landing) ─────────────────────────── */
function AuthModal({ onClose, initialMode = "signup", plan }: { onClose: () => void; initialMode?: "login" | "signup"; plan?: string }) {
  const { login, signup, loginWithGoogle, loginWithDiscord, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Lock the real scroller (<html>) so the landing behind doesn't scroll,
    // and restore its exact prior value on close — never clobber body styles.
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => { el.style.overflow = prev; window.removeEventListener("keydown", k); };
  }, [onClose]);

  // On success `isAuthenticated` flips and App.tsx unmounts this whole tree, so
  // we intentionally keep `loading` true rather than clearing state that vanishes.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    if (mode === "login") {
      const err = await login(email, password);
      if (err) { setError(err); setLoading(false); }
    } else {
      const err = await signup(name, email, password);
      if (err) { setError(err); setLoading(false); }
      else {
        // Email verification disabled — sign in immediately after signup.
        const le = await login(email, password);
        if (le) { setError(le); setLoading(false); }
      }
    }
  };

  const oauth = async (provider: "google" | "discord") => {
    setError(""); setInfo(""); setLoading(true);
    const err = provider === "google" ? await loginWithGoogle() : await loginWithDiscord();
    if (err) { setError(err); setLoading(false); }
  };

  const forgot = async () => {
    setError(""); setInfo("");
    if (!email) { setError("Entre ton e-mail pour recevoir le lien de réinitialisation."); return; }
    const err = await requestPasswordReset(email);
    if (err) setError(err);
    else setInfo("Lien de réinitialisation envoyé. Vérifie ta boîte mail.");
  };

  const field = "w-full rounded-lg border border-white/[.1] bg-white/[.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/55 focus:bg-white/[.04] focus:ring-2 focus:ring-cyan-400/12";
  const toggleMode = () => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md overflow-y-auto" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <div className="modal-in relative my-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c1421] shadow-[0_30px_90px_rgba(0,0,0,.6)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <button onClick={onClose} aria-label="Fermer" className="absolute right-3.5 top-3.5 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[.06] hover:text-white transition"><Icon n="close" cls="h-4 w-4" /></button>

        <div className="p-7 sm:p-8">
          <img src={logoSrc} alt="TradeVault" width={32} height={32} className="h-8 w-8 object-contain" />

          {plan && (
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.06] px-2.5 py-1 text-[11px] font-semibold text-cyan-300"><Icon n="sparkle" cls="h-3 w-3" />{plan}</div>
          )}
          <h2 className="mt-4 font-display text-[1.4rem] font-bold tracking-[-0.01em] text-white">{mode === "login" ? "Ravi de te revoir" : "Créer ton compte"}</h2>
          <p className="mt-1 text-sm text-slate-400">{mode === "login" ? "Connecte-toi pour reprendre où tu t'es arrêté." : "14 jours pour transformer ton trading."}</p>

          {/* SSO — fastest paths */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <button onClick={() => oauth("google")} disabled={loading} className="flex items-center justify-center gap-2.5 rounded-lg border border-white/[.1] bg-white/[.04] py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[.07] disabled:opacity-60">
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button onClick={() => oauth("discord")} disabled={loading} className="flex items-center justify-center gap-2.5 rounded-lg border border-white/[.1] bg-white/[.04] py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[.07] disabled:opacity-60">
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Discord
            </button>
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[.07]" />
            <span className="text-[11px] text-slate-600">ou</span>
            <div className="h-px flex-1 bg-white/[.07]" />
          </div>

          {error && <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">{error}</div>}
          {info && <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-400">{info}</div>}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom d'utilisateur</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alex Martin" className={field} />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">E-mail</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nom@exemple.com" className={field} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                {mode === "login" && (
                  <button type="button" onClick={forgot} className="text-[11px] text-slate-500 hover:text-cyan-300 transition">Oublié ?</button>
                )}
              </div>
              <div className="relative">
                <input required type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} placeholder="6+ caractères" className={`${field} pr-10`} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer" : "Afficher"} className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:text-slate-300 transition">
                  <Icon n="eye" cls="h-4 w-4" />
                </button>
              </div>
            </div>
            <button disabled={loading} className="btn-primary w-full h-11! mt-1 disabled:opacity-60 disabled:cursor-wait">
              {loading ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
              {!loading && <Icon n="arrow" cls="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-slate-500">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button onClick={toggleMode} className="font-semibold text-cyan-300 hover:text-cyan-200 transition">{mode === "login" ? "Créer un compte" : "Se connecter"}</button>
          </p>
          <p className="mt-3 text-center text-[10.5px] leading-4 text-slate-600">
            En continuant, tu acceptes nos <a href="/terms" className="underline hover:text-slate-400">Conditions</a> et notre <a href="/privacy" className="underline hover:text-slate-400">Politique de confidentialité</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── DATA ─────────────────────────── */
const PROBLEMS = [
  { n: "err" as IName, t: "Ils répètent leurs erreurs", d: "Sans mémoire structurée, la même erreur revient 50 fois. Chaque répétition coûte de l'argent — invisible dans un carnet Excel." },
  { n: "eye" as IName, t: "Ils oublient leurs anciens trades", d: "Impossible de progresser sur ce qu'on ne revoit jamais. Les leçons du passé s'évaporent dès la clôture." },
  { n: "heart" as IName, t: "Ils tradent sous émotion", d: "Peur, FOMO, revenge trading. Les décisions émotionnelles détruisent plus de comptes que les mauvais setups." },
  { n: "compass" as IName, t: "Ils ignorent pourquoi ils perdent", d: "Sans data, la perte reste un mystère. On change de stratégie au hasard au lieu de corriger le vrai problème." },
  { n: "layers" as IName, t: "Ils n'ont aucun système", d: "Pas de routine, pas de checklist, pas de règles. Le trading devient un jeu de hasard émotionnel plutôt qu'un métier." },
  { n: "trend" as IName, t: "Ils stagnent depuis des mois", d: "Toujours le même niveau, les mêmes montagnes russes. Sans feedback structuré, la progression est bloquée." },
];

const AIS = [
  { n: "brain" as IName, t: "Assistant IA", d: "Pose une question en langage naturel sur tes trades. Il te répond en s'appuyant sur TON historique réel — pas sur des généralités toutes faites.", c: "text-cyan-300" },
  { n: "radar" as IName, t: "Insights automatiques", d: "Dès que ton historique grandit, TradeVault détecte tes schémas récurrents (heures, setups, erreurs) et te les remonte avant que tu ne les répètes.", c: "text-violet-300" },
  { n: "calendar" as IName, t: "Rapports mensuels", d: "Un récapitulatif clair de ta performance, généré automatiquement chaque mois. Zéro tableur à remplir un dimanche soir.", c: "text-amber-300" },
];

const FEATURES = [
  { n: "chart" as IName, t: "Dashboard en temps réel" },
  { n: "document" as IName, t: "Journal de trading rapide" },
  { n: "calendar" as IName, t: "Calendrier économique" },
  { n: "trend" as IName, t: "Analytics quantitatives" },
  { n: "err" as IName, t: "Suivi des erreurs" },
  { n: "eye" as IName, t: "Setups manqués" },
  { n: "target" as IName, t: "Calculateur de position" },
  { n: "upload" as IName, t: "Import CSV automatique" },
];

const COMPARE = [
  ["Dimanche soir, bilan de la semaine", "Ouvre un Excel à moitié rempli, abandonne après 10 minutes", "Le rapport mensuel est déjà généré automatiquement, prêt à lire"],
  ["Juste après un trade perdant", "Ferme l'appli, la frustration reste sans réponse", "Le trade est tagué et l'erreur ajoutée au suivi des erreurs"],
  ["Un setup repéré mais jamais pris", "« J'aurais dû » oublié en 5 minutes, la leçon jamais tirée", "Le setup manqué est loggé et analysé pour la prochaine fois"],
  ["Calcul de la taille de position", "Approximation au feeling, en plein trade", "Calculateur de position intégré, taille exacte en secondes"],
  ["Juste avant l'ouverture du marché", "Se jette sur le premier trade qui passe", "Checklist pré-market complétée, discipline activée"],
  ["Une question sur sa performance", "Rouvre un tableur et recalcule tout à la main", "La pose à l'Assistant IA, réponse immédiate sur ses vrais trades"],
];

const FAQS: [string, string][] = [
  ["En quoi TradeVault est différent d'un simple journal ?", "Un journal enregistre. TradeVault comprend. C'est un coach IA qui analyse tes données réelles, détecte tes schémas, t'alerte sur tes biais émotionnels et te guide vers une vraie progression — comme un mentor privé disponible 24h/24."],
  ["Comment fonctionne le Coach IA ?", "Il analyse tes setups, erreurs, horaires, tailles de position et états émotionnels. Puis il répond à tes questions et te donne un diagnostic précis qu'aucun modèle générique ne pourrait produire — car il connaît TON trading."],
  ["L'essai gratuit est-il vraiment sans engagement ?", "Oui. 14 jours d'accès Premium complet, sans carte bancaire demandée. Tu peux annuler en 1 clic à tout moment. Aucun prélèvement surprise, aucun risque."],
  ["Mes données de trading sont-elles sécurisées ?", "Totalement. Cryptage en transit et au repos, sauvegardes cloud automatiques, paiements sécurisés par Stripe. Nous ne demandons jamais l'accès direct à ton compte de courtage."],
  ["Puis-je importer mon historique existant ?", "Oui, en quelques secondes. Importe un CSV depuis ton courtier ou ton ancien journal, TradeVault structure tout automatiquement. Tu peux vérifier avant de sauvegarder."],
  ["Que se passe-t-il si j'annule ?", "Tu gardes l'accès jusqu'à la fin de ta période. Tes données restent exportables gratuitement. Aucune pénalité, aucune question."],
];

/* ─────────────────────────── SECTION TITLE ─────────────────────────── */
function SectionHead({ tag, title, sub, center = true }: { tag: string; title: React.ReactNode; sub?: string; center?: boolean }) {
  return (
    <div className={`reveal ${center ? "text-center mx-auto" : ""} max-w-2xl mb-12`}>
      <div className="tag-label inline-flex mb-4">{tag}</div>
      <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.85rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.08]">{title}</h2>
      {sub && <p className="mt-4 text-slate-400 leading-7">{sub}</p>}
    </div>
  );
}

/* Nav items — order MUST mirror the on-page scroll order of the anchors.
   Every landing section is reachable from the bar. */
const NAV: [string, string][] = [
  ["Fonctionnement", "how"],
  ["Checklist", "checklist"],
  ["Coach IA", "ai"],
  ["Fonctionnalités", "features"],
  ["Calculateur", "calculator"],
  ["Avis", "trustpilot"],
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

  const open = (mode: "login" | "signup", plan?: string) => { setMenu(false); setAuthMode(mode); setAuthPlan(plan); setAuth(true); };
  const go = (id: string) => { setMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  const onHeroMove = (e: RPointerEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`); };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <CursorGlow />
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 55% at 60% -10%,rgba(6,182,212,.09),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.07),transparent 55%)" }} />

      {/* ── NAV ── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 10 ? "bg-[#060d16]/85 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/40"}`}>
        <div className="scroll-bar absolute inset-x-0 top-0 h-[2px]" style={{ transform: `scaleX(${pct})` }} />
        <div className="mx-auto flex h-[66px] max-w-[1280px] items-center gap-4 px-5 lg:px-8">
          {/* Left zone — equal width to the right zone so the centered nav is symmetric. */}
          <div className="flex flex-1 items-center">
            <Logo />
          </div>
          {/* Center — every section, perfectly centered between two equal zones. */}
          <nav className="hidden shrink-0 items-center gap-0.5 rounded-full border border-white/[.08] bg-white/[.03] p-1 backdrop-blur-md xl:flex">
            {NAV.map(([l, id]) => {
              const on = activeSec === id;
              const isTp = id === "trustpilot";
              return (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 ${
                    on
                      ? "bg-cyan-400/[.12] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.25)]"
                      : isTp
                        ? "text-emerald-300 hover:bg-emerald-400/[.08]"
                        : "text-slate-400 hover:text-white hover:bg-white/[.04]"
                  }`}
                >
                  {isTp && <span className="grid h-3.5 w-3.5 place-items-center rounded-[2px] bg-[#00b67a]"><Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" /></span>}
                  {l}
                </button>
              );
            })}
          </nav>
          {/* Right zone — same flex-1 width as the left. */}
          <div className="flex flex-1 items-center justify-end gap-2.5">
            <div className="hidden items-center gap-2.5 xl:flex">
              <button onClick={() => open("login")} className="btn-ghost px-5 text-sm">Se connecter</button>
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-5 text-sm">Essai gratuit <Icon n="arrow" cls="h-4 w-4" /></button>
            </div>
            <button onClick={() => setMenu(!menu)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-200 xl:hidden" aria-label="Menu"><Icon n={menu ? "close" : "menu"} cls="h-5 w-5" /></button>
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
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary mt-4 w-full">Essai gratuit <Icon n="arrow" cls="h-4 w-4" /></button>
              <button onClick={() => open("login")} className="btn-ghost mt-2.5 w-full">Se connecter</button>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">

        {/* ── HERO ── */}
        <section className="hero-mesh relative overflow-hidden pt-[120px] pb-20 lg:pt-[150px] lg:pb-28" onPointerMove={onHeroMove}>
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:px-8">
            <div className="text-center lg:text-left">
              <div className="fade-up inline-flex items-center gap-2.5 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300">
                <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" /> Ton coach IA de trading personnel
              </div>
              <h1 className="fade-up d1 font-display mt-6 text-[clamp(2.6rem,5.4vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-white">
                Deviens le trader{" "}
                <span className="text-gradient relative inline-block">discipliné
                  <svg className="scribble" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 14C40 6 70 18 105 12S190 4 226 12S280 16 296 8" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" /></svg>
                </span>{" "}que tu veux devenir.
              </h1>
              <p className="fade-up d2 mt-6 text-base leading-7 text-slate-400 sm:text-lg max-w-[520px] mx-auto lg:mx-0">
                TradeVault n'est pas un simple journal. C'est un <strong className="text-slate-200">coach IA disponible 24h/24</strong> qui analyse tes trades, détecte tes erreurs, comprend ta psychologie et t'accompagne vers une progression réelle.
              </p>
              <div className="fade-up d3 mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-6 py-3.5 text-[.95rem]">Essai Premium 14 jours <Icon n="arrow" cls="h-4 w-4" /></button>
                <button onClick={() => open("signup", "Plan Gratuit")} className="btn-ghost px-6 py-3.5 text-[.95rem]">Commencer gratuitement</button>
              </div>
              <div className="fade-up d4 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {["Sans carte bancaire", "Annulation en 1 clic", "Setup en 2 min"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500"><Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />{t}</span>
                ))}
              </div>
            </div>
            <div className="fade-up d2 w-full max-w-[440px] mx-auto lg:mx-0 lg:ml-auto lg:mt-0 mt-6">
              <HeroDashboard />
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-[900px] px-5 lg:mt-24">
            <div className="reveal grid grid-cols-2 gap-4 rounded-2xl border border-white/[.07] bg-white/[.02] p-6 backdrop-blur-md sm:grid-cols-4">
              {[["<10s", "pour importer ton historique"], ["20+", "métriques calculées"], ["100%", "de tes données t'appartiennent"], ["24h/24", "assistant IA disponible"]].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="font-display text-2xl font-extrabold text-white">{v}</p>
                  <p className="mt-1 text-xs text-slate-500">{l}</p>
                </div>
              ))}
            </div>
            <button onClick={() => go("trustpilot")} className="reveal mx-auto mt-5 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition">
              <span className="grid h-4.5 w-4.5 place-items-center rounded-[3px] bg-[#00b67a]"><Icon n="star" cls="h-3 w-3 text-white fill-white" /></span>
              Avis Trustpilot ouverts — sois parmi les premiers <Icon n="arrow" cls="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* ── PROBLÈME ── */}
        <section id="problem" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag="Le vrai problème" title={<>90% des traders perdent.<br /><span className="text-slate-500">Pas par manque de stratégie.</span></>} sub="Le vrai tueur de comptes, ce n'est pas le marché. C'est l'absence de système, de mémoire et de feedback. Reconnais-tu ces symptômes ?" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROBLEMS.map((p, i) => (
                <article key={p.t} onPointerMove={spot} className="reveal spot rounded-xl border border-red-400/12 bg-red-400/[.03] p-6 transition-colors hover:border-red-400/25" style={{ transitionDelay: `${i * 60}ms` }}>
                  <div className="grid h-11 w-11 place-items-center rounded-lg border border-red-400/20 bg-red-400/[.07] text-red-400 mb-5"><Icon n={p.n} cls="h-5 w-5" /></div>
                  <h3 className="font-display text-base font-bold text-white">{p.t}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── SOLUTION ── */}
        <section className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[900px] px-5 text-center lg:px-8">
            <div className="reveal">
              <div className="tag-label inline-flex mb-5">La solution</div>
              <h2 className="font-display text-[clamp(1.9rem,4vw,3.1rem)] font-extrabold tracking-[-0.045em] leading-[1.08]">
                <span className="text-white">Et si une IA</span> <span className="text-gradient">connaissait ton trading</span> <span className="text-white">mieux que toi ?</span>
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-400 max-w-2xl mx-auto">
                TradeVault transforme chaque trade en leçon exploitable. Il se souvient de tout, calcule tout, détecte tout — et te parle comme un mentor qui aurait étudié chacune de tes décisions.
              </p>
            </div>
            <div className="reveal mt-12 grid gap-4 sm:grid-cols-3" style={{ transitionDelay: "120ms" }}>
              {[["Désorganisé", "Discipliné", "target"], ["Émotionnel", "Basé sur la data", "chart"], ["Seul", "Accompagné 24h/24", "brain"]].map(([from, to, ic]) => (
                <div key={to} className="rounded-xl border border-white/[.08] bg-white/[.02] p-6">
                  <div className="feat-icon mx-auto mb-4"><Icon n={ic as IName} cls="h-5 w-5" /></div>
                  <p className="text-sm text-slate-500 line-through decoration-red-400/50">{from}</p>
                  <div className="my-1.5 flex justify-center text-cyan-400"><Icon n="chevron" cls="h-4 w-4 rotate-180" /></div>
                  <p className="font-display text-base font-bold text-white">{to}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMMENT ÇA FONCTIONNE ── */}
        <section id="how" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag="Comment ça marche" title="Opérationnel en moins de 2 minutes" sub="Aucune galère de configuration. Importe, laisse l'IA analyser, progresse." />
            <div className="grid gap-4 sm:grid-cols-3">
              {[["Importe ou saisis", "Connecte ton historique CSV ou ajoute tes trades en un geste. Teste immédiatement avec des trades de démo.", "upload"], ["L'IA analyse tout", "Le Coach IA décortique tes patterns, ta psychologie et tes stats en temps réel — automatiquement.", "brain"], ["Progresse chaque semaine", "Applique le plan de ton coach, suis ta checklist, et laisse la discipline composer tes résultats.", "trend"]].map(([t, d, ic], i) => (
                <div key={t} onPointerMove={spot} className="reveal spot glass-card p-6 relative" style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="step-num">{i + 1}</div>
                    <div className="feat-icon"><Icon n={ic as IName} cls="h-5 w-5" /></div>
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{t}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CHECKLIST JARVIS ── */}
        <section id="checklist" className="section-mesh relative border-t border-white/[.06] overflow-hidden py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="reveal order-2 text-center lg:order-1 lg:text-left">
              <div className="tag-label inline-flex mb-5">Discipline avant l'ouverture</div>
              <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.85rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.08]">
                Ta checklist pré-market,<br /><span className="text-gradient">version HUD.</span>
              </h2>
              <p className="mt-5 text-slate-400 leading-7">Fini les post-it et les routines oubliées. Une interface futuriste qui rend ta préparation aussi rigoureuse qu'un cockpit — et qui garde le score de ta régularité, jour après jour.</p>
              <div className="mt-7 space-y-3">
                {["Chaque étape validée avant de risquer un centime", "Streak de discipline visible en un coup d'œil", "Une routine qui devient un réflexe, pas une corvée"].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm text-slate-300 justify-center lg:justify-start"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300"><Icon n="check" cls="h-3 w-3" /></span>{t}</div>
                ))}
              </div>
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary mt-8 px-6 py-3.5">Activer ma checklist <Icon n="arrow" cls="h-4 w-4" /></button>
            </div>
            <div className="reveal order-1 lg:order-2" style={{ transitionDelay: "100ms" }}>
              <JarvisChecklist />
            </div>
          </div>
        </section>

        {/* ── SECTION IA (cœur) ── */}
        <section id="ai" className="relative border-t border-white/[.06] overflow-hidden py-20 lg:py-28">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 45% at 50% 30%,rgba(34,211,238,.08),transparent 60%)" }} />
          <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag="Le cœur du produit" title={<>Pas une couche IA de plus. <span className="text-gradient">Une IA qui connaît vraiment tes trades.</span></>} sub="L'assistant lit ton historique réel — pas des généralités de marché. Plus tu loggues, plus ses réponses deviennent précises." />

            <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-14 mb-16">
              <AIConversation />
              <div>
                <h3 className="font-display text-2xl font-bold text-white leading-tight">Un mentor qui connaît<br /><span className="text-gradient">chacun de tes trades.</span></h3>
                <p className="mt-4 text-slate-400 leading-7">Pose une question en langage naturel. Le Coach IA puise dans ton historique réel pour te répondre — pas de généralités, uniquement des insights sur TON trading.</p>
                <div className="mt-6 space-y-3">
                  {["Réponses basées sur tes vraies données", "Diagnostic précis en quelques secondes", "Plans d'action concrets, pas de théorie"].map((t) => (
                    <div key={t} className="flex items-center gap-3 text-sm text-slate-300"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300"><Icon n="check" cls="h-3 w-3" /></span>{t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AIS.map((a, i) => (
                <article key={a.t} onPointerMove={spot} className="ai-card spot reveal p-6" style={{ transitionDelay: `${i * 70}ms` }}>
                  <div className={`grid h-11 w-11 place-items-center rounded-xl border border-white/[.1] bg-white/[.04] ${a.c} mb-5`}><Icon n={a.n} cls="h-5 w-5" /></div>
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
        <section id="features" className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag="Fonctionnalités" title="Tout ce qu'il faut à un trader sérieux" sub="Un écosystème complet — pas juste un carnet. Chaque outil est conçu pour créer de la valeur mesurable." />
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <div key={f.t} onPointerMove={spot} className="reveal spot glass-card flex items-center gap-3 p-4" style={{ transitionDelay: `${i * 40}ms` }}>
                  <div className="feat-icon h-9 w-9"><Icon n={f.n} cls="h-4.5 w-4.5" /></div>
                  <p className="text-sm font-semibold text-slate-200 leading-tight">{f.t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── IMPORT AUTO ── */}
        <section className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="reveal order-2 lg:order-1">
              <div className="relative rounded-2xl border border-white/10 bg-[#0a1625]/90 p-6 shadow-[0_24px_64px_rgba(0,0,0,.4)] backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                <div className="rounded-xl border-2 border-dashed border-cyan-400/30 bg-cyan-400/[.04] p-8 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-cyan-400/10 text-cyan-300"><Icon n="upload" cls="h-6 w-6" /></div>
                  <p className="text-sm font-semibold text-white">Glisse ton fichier CSV ici</p>
                  <p className="mt-1 text-xs text-slate-500">MT4/MT5, cTrader, Interactive Brokers, TradingView…</p>
                </div>
                <div className="mt-4 space-y-2">
                  {[["historique_2025.csv", "248 trades importés", "text-emerald-400"], ["Analyse IA en cours…", "détection des patterns", "text-cyan-300"]].map(([f, s, c]) => (
                    <div key={f} className="flex items-center justify-between rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                      <div className="flex items-center gap-2.5"><Icon n="document" cls="h-4 w-4 text-slate-500" /><span className="text-xs font-medium text-slate-300">{f}</span></div>
                      <span className={`text-[11px] font-semibold ${c}`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="reveal order-1 lg:order-2 text-center lg:text-left" style={{ transitionDelay: "100ms" }}>
              <div className="tag-label inline-flex mb-5">Import automatique</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.1]">Tout ton historique.<br /><span className="text-gradient">Analysé en secondes.</span></h2>
              <p className="mt-5 text-slate-400 leading-7">Importe des années de trades en un glisser-déposer. TradeVault structure, calcule et analyse tout automatiquement — dès la première seconde, ton coach IA a de quoi travailler.</p>
              <div className="mt-7 space-y-3">
                {["Compatible avec tous les grands courtiers", "Détection automatique des colonnes", "Analyse IA instantanée après import"].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm text-slate-300 justify-center lg:justify-start"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-emerald-400"><Icon n="check" cls="h-3 w-3" /></span>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── COMPARATIF ── */}
        <section className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1000px] px-5 lg:px-8">
            <SectionHead tag="Une même journée, deux trajectoires" title={<>Le même trader. <span className="text-gradient">Sans</span> puis <span className="text-gradient">avec</span> TradeVault.</>} sub="Pas de théorie — juste les 6 moments qui font la différence entre stagner et progresser." />

            <div className="reveal space-y-3 sm:hidden">
              {COMPARE.map(([label, without, wth]) => (
                <div key={label} className="rounded-xl border border-white/[.08] bg-white/[.02] p-4">
                  <p className="mb-3 text-sm font-bold text-white">{label}</p>
                  <div className="mb-2 flex items-start gap-2 rounded-lg bg-red-400/[.04] p-2.5">
                    <Icon n="x" cls="h-4 w-4 mt-0.5 shrink-0 text-red-400/70" />
                    <p className="text-xs leading-5 text-slate-500">{without}</p>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[.05] p-2.5">
                    <Icon n="check" cls="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                    <p className="text-xs leading-5 text-slate-200">{wth}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="reveal hidden overflow-hidden rounded-2xl border border-white/[.08] sm:block">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-white/[.02] text-xs font-bold uppercase tracking-wider">
                <div className="p-4 text-slate-500"></div>
                <div className="p-4 text-center text-slate-400 border-l border-white/[.06]">Sans TradeVault</div>
                <div className="p-4 text-center text-cyan-300 border-l border-cyan-400/20 bg-cyan-400/[.05]">Avec TradeVault</div>
              </div>
              {COMPARE.map(([label, without, wth], i) => (
                <div key={label} className={`grid grid-cols-[1.2fr_1fr_1fr] text-sm ${i % 2 ? "bg-white/[.015]" : ""}`}>
                  <div className="p-4 font-semibold text-slate-200">{label}</div>
                  <div className="flex items-start gap-2 p-4 text-slate-500 border-l border-white/[.06]"><Icon n="x" cls="h-4 w-4 mt-0.5 shrink-0 text-red-400/70" /><span className="text-xs leading-5">{without}</span></div>
                  <div className="flex items-start gap-2 p-4 text-slate-200 border-l border-cyan-400/20 bg-cyan-400/[.04]"><Icon n="check" cls="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" /><span className="text-xs leading-5">{wth}</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ROI CALCULATOR ── */}
        <section id="calculator" className="relative border-t border-white/[.06] bg-[#070e18] py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="reveal text-center lg:text-left">
              <div className="tag-label inline-flex mb-5">Mets un chiffre dessus</div>
              <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.85rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.08]">Ton indiscipline a un prix.<br />Calcule-le.</h2>
              <p className="mt-5 text-slate-400 leading-7">Pas de théorie : ajuste les curseurs avec tes propres chiffres et regarde ce qu'un trade hors-plan par semaine te coûte vraiment sur un an.</p>
              <div className="mt-7 space-y-3">
                {["Basé sur ton stop-loss moyen réel", "Projection annuelle honnête, sans arrondi optimiste", "Le meilleur argument pour rester discipliné"].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm text-slate-300 justify-center lg:justify-start"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-emerald-400"><Icon n="check" cls="h-3 w-3" /></span>{t}</div>
                ))}
              </div>
            </div>
            <div className="reveal" style={{ transitionDelay: "100ms" }}>
              <RoiCalc onCta={() => open("signup", "Essai Premium 14 jours")} />
            </div>
          </div>
        </section>

        {/* ── TRUSTPILOT ── */}
        <section id="trustpilot" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag="Transparence totale" title="On construit TradeVault avec nos premiers traders." sub="TradeVault est en accès anticipé. Pas de faux avis, pas de chiffres gonflés — juste une réputation qu'on préfère mériter, un trader à la fois." />
            <div className="reveal mx-auto grid max-w-[1000px] gap-4 md:grid-cols-[1fr_1.3fr]">
              <div onPointerMove={spot} className="spot glass-card flex flex-col items-center justify-center p-8 text-center">
                <div className="flex items-center gap-2 mb-4">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#00b67a]"><Icon n="star" cls="h-5 w-5 text-white fill-white" /></div>
                  <span className="font-display text-lg font-extrabold text-white">Trustpilot</span>
                </div>
                {/* Live TrustBox (global score + real review count) once the
                    business unit id is configured; static invite until then. */}
                {TRUSTPILOT_BUSINESS_UNIT_ID ? (
                  <TrustpilotWidget className="mb-4 w-full" />
                ) : (
                  <div className="flex gap-1 mb-4">
                    {[0, 1, 2, 3, 4].map((i) => <span key={i} className="grid h-7 w-7 place-items-center rounded-[3px] bg-[#00b67a]"><Icon n="star" cls="h-4 w-4 text-white fill-white" /></span>)}
                  </div>
                )}
                <p className="text-sm font-bold text-slate-200">Sois parmi les tout premiers à laisser un avis.</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">Ton retour façonne directement la feuille de route du produit.</p>
                <a href="https://www.trustpilot.com/review/tradevaultt.vercel.app" target="_blank" rel="noreferrer" className="btn-ghost mt-6 w-full">Voir sur Trustpilot <Icon n="arrow" cls="h-4 w-4" /></a>
              </div>
              <div onPointerMove={spot} className="spot glass-card flex flex-col justify-center p-8">
                <h3 className="font-display text-lg font-bold text-white">Pourquoi on ne met pas de faux témoignages ici</h3>
                <div className="mt-5 space-y-4">
                  {[
                    ["Accès anticipé, assumé", "Le produit est jeune. On préfère te le dire plutôt que d'inventer 2 000 utilisateurs fantômes."],
                    ["Tes avis, notre roadmap", "Chaque retour Trustpilot est lu et discuté avant chaque mise à jour du produit."],
                    ["Zéro engagement pour tester", "14 jours d'essai gratuit, sans carte bancaire — le meilleur avis, c'est le tien."],
                  ].map(([t, d]) => (
                    <div key={t} className="flex gap-3">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/12 text-cyan-300"><Icon n="check" cls="h-3.5 w-3.5" /></span>
                      <div><p className="text-sm font-semibold text-slate-200">{t}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{d}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="section-mesh relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <SectionHead tag="Tarifs" title="Un investissement qui se rembourse en un trade" sub="Commence gratuitement. Passe en Premium quand tu es prêt. Sans risque, sans engagement." />

            <div className="reveal mb-10 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[.08] px-4 py-1.5 text-xs font-bold text-emerald-300">
                <Icon n="sparkle" cls="h-3.5 w-3.5" /> En passant à l'année : 2 mois offerts + 20% d'économie
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
              {/* FREE — entry */}
              <div onPointerMove={spot} className="reveal spot flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Free</p>
                <div className="mt-4 flex items-end gap-1"><span className="font-display text-4xl font-extrabold text-white">0 €</span><span className="mb-1.5 text-sm text-slate-500">/ toujours</span></div>
                <p className="mt-2 text-sm text-slate-500">Pour poser les bases de ta discipline.</p>
                <button onClick={() => open("signup", "Plan Gratuit")} className="btn-ghost w-full mt-6">Commencer gratuitement</button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {["Dashboard", "Journal de trading (30 trades / mois)", "Checklist pré-market", "Statistiques de base"].map((f) => (
                    <p key={f} className="flex items-center gap-2.5 text-slate-300"><span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-400"><Icon n="check" cls="h-3 w-3" /></span>{f}</p>
                  ))}
                  {["Assistant IA & Insights", "Import CSV automatique", "Rapports mensuels"].map((f) => (
                    <p key={f} className="flex items-center gap-2.5 text-slate-600"><span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.03]"><Icon n="x" cls="h-3 w-3" /></span><span className="line-through">{f}</span></p>
                  ))}
                </div>
              </div>

              {/* PRO ANNUEL — the hero, framed as the obvious value */}
              <div onPointerMove={spot} className="reveal spot flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] p-7 lg:-my-4 lg:py-11" style={{ transitionDelay: "80ms" }}>
                <div className="relative flex flex-col h-full">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">Pro · Annuel</p>
                    <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#03131b] flex items-center gap-1"><Icon n="flame" cls="h-3 w-3 fill-current" />2 mois offerts</span>
                  </div>
                  {/* Lead with the small monthly-equivalent, then reveal the honest annual bill */}
                  <div className="mt-4 flex items-end gap-1.5">
                    <span className="font-display text-5xl font-extrabold text-white">19,90 €</span><span className="mb-2 text-sm text-slate-400">/ mois</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="font-semibold text-white">239 €</span> facturés une fois par an
                    <span className="ml-1.5 text-slate-500 line-through">299 €</span>
                  </p>
                  <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
                    <Icon n="check" cls="h-3.5 w-3.5" /> Tu économises 60 € / an
                  </div>
                  <button onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")} className="btn-primary w-full h-12! mt-6">Démarrer — 14 jours gratuits <Icon n="arrow" cls="h-4 w-4" /></button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">Sans engagement · Sans carte requise</p>
                  <div className="mt-7 space-y-2.5 text-sm">
                    {["Tout le plan Free, sans limite", "Assistant IA illimité 24h/24", "Insights automatiques (patterns)", "Import CSV automatique illimité", "Analytics quantitatives (20+ métriques)", "Suivi des erreurs & setups manqués", "Calculateur de position intégré", "Rapports mensuels automatiques", "Palette de commandes ⌘K", "Support prioritaire"].map((f) => (
                      <p key={f} className="flex items-center gap-2.5 text-slate-200"><span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-cyan-300"><Icon n="check" cls="h-3 w-3" /></span>{f}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* PRO MENSUEL — deliberately the least attractive option */}
              <div onPointerMove={spot} className="reveal spot flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7 opacity-[.92]" style={{ transitionDelay: "160ms" }}>
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Pro · Mensuel</p>
                <div className="mt-4 flex items-end gap-1"><span className="font-display text-4xl font-extrabold text-slate-200">24,99 €</span><span className="mb-1.5 text-sm text-slate-500">/ mois</span></div>
                <p className="mt-2 text-sm text-slate-500">Soit <span className="font-semibold text-slate-400">299 € / an</span> — 60 € de plus que l'annuel.</p>
                <button onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")} className="btn-ghost w-full mt-6">Prendre au mois</button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {["Tout le plan Free, sans limite", "Assistant IA illimité 24h/24", "Insights automatiques (patterns)", "Import CSV automatique illimité", "Analytics quantitatives avancées", "Suivi des erreurs & setups manqués", "Rapports mensuels automatiques", "Support prioritaire"].map((f) => (
                    <p key={f} className="flex items-center gap-2.5 text-slate-400"><span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-white/[.06] text-slate-500"><Icon n="check" cls="h-3 w-3" /></span>{f}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[["shield", "14 jours gratuits sans risque"], ["lock", "Paiement sécurisé Stripe"], ["check", "Annulation en 1 clic"], ["download", "Données exportables"]].map(([ic, t]) => (
                <span key={t} className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon n={ic as IName} cls="h-4 w-4 text-emerald-400" />{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative border-t border-white/[.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[760px] px-5 lg:px-8">
            <SectionHead tag="FAQ" title="Tout ce que tu dois savoir" sub="Encore un doute ? Voici les réponses aux questions les plus fréquentes." />
            <div className="reveal border-t border-white/[.08]">
              {FAQS.map(([q, a], i) => {
                const o = faq === i;
                return (
                  <div key={q} className="border-b border-white/[.08]">
                    <button onClick={() => setFaq(o ? null : i)} aria-expanded={o} className="flex w-full items-center justify-between gap-5 py-5 text-left">
                      <span className={`text-sm font-semibold transition-colors sm:text-base ${o ? "text-white" : "text-slate-300"}`}>{q}</span>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${o ? "rotate-180 border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-white/[.12] text-slate-500"}`}><Icon n="chevron" cls="h-4 w-4" /></span>
                    </button>
                    <div className={`faq-body ${o ? "faq-open" : ""}`}><div><p className="pb-5 pr-8 text-sm leading-7 text-slate-400">{a}</p></div></div>
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
            {cd && <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/25 bg-amber-400/[.07] px-4 py-1.5 text-[11px] font-bold text-amber-300 mb-7"><span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-amber-400" />Ouverture des marchés dans {cd} — ton coach est-il prêt ?</div>}
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.045em] text-white leading-[1.05]">
              Ton prochain trade mérite<br /><span className="h-shine">un vrai coach.</span>
            </h2>
            <p className="mt-5 text-slate-400 leading-7 max-w-lg mx-auto">Arrête de trader seul et à l'aveugle. Laisse une IA analyser chaque décision et te guider vers le trader discipliné que tu veux devenir.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-8 py-4">Essai Premium 14 jours <Icon n="arrow" cls="h-4 w-4" /></button>
              <button onClick={() => open("signup", "Plan Gratuit")} className="btn-ghost px-8 py-4">Commencer gratuitement</button>
            </div>
            <p className="mt-5 text-xs text-slate-600">Sans carte bancaire · Annulation en 1 clic · Garantie satisfait ou remboursé 30 jours</p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto max-w-[1200px] px-5 py-12 lg:px-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="max-w-xs">
              <Logo compact />
              <p className="mt-3 text-xs leading-5 text-slate-600">Le coach IA de référence pour les traders qui veulent progresser avec méthode.</p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:items-end">
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 sm:justify-end">
                <button onClick={() => go("features")} className="hover:text-slate-300 transition">Fonctionnalités</button>
                <button onClick={() => go("pricing")} className="hover:text-slate-300 transition">Tarifs</button>
                <a href="/terms" className="hover:text-slate-300 transition">Conditions</a>
                <a href="/privacy" className="hover:text-slate-300 transition">Confidentialité</a>
              </div>
              <a href="mailto:contact@tradevault.app" className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-cyan-300 transition">
                <Icon n="mail" cls="h-3.5 w-3.5" /> contact@tradevault.app
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/[.05] pt-6 text-center text-[11px] text-slate-700">© {new Date().getFullYear()} TradeVault. Le trading comporte des risques. Journalise d'abord, trade ensuite.</div>
        </div>
      </footer>

      {/* ── STICKY MOBILE CTA ── */}
      {y > 500 && !auth && !menu && (
        <div className="sticky-bar-in fixed inset-x-0 bottom-0 z-40 border-t border-white/[.08] bg-[#060d16]/92 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl xl:hidden">
          <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary w-full py-3.5">Essai Premium 14 jours — gratuit</button>
        </div>
      )}

      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
