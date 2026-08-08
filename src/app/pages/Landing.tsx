import { useEffect, useRef, useState } from "react";
import { Play, Twitter, Linkedin, Instagram, Facebook, Youtube, ArrowRight, Bot, Shield, TrendingUp, Brain, Target, BarChart3, Sparkles, MessageSquare, Clock, AlertTriangle, CalendarDays } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { eur, MONTHLY_EUR, YEARLY_EUR, YEARLY_FULL_PRICE, YEARLY_PER_MONTH, YEARLY_SAVING } from "../utils/pricing";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

const log = (msg: string) => console.log(msg); log;

/* ─────────────────────────── LOGO ─────────────────────────── */
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#" className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm">
      <img src={logoSrc} alt="TradeVault" width={compact ? 28 : 34} height={compact ? 28 : 34}
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]`} />
      <span className={`font-display font-extrabold tracking-[-0.04em] text-[#ffffff] leading-none hidden sm:block ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}>TradeVault</span>
    </a>
  );
}

/* ─────────────────────────── CURSOR GLOW ─────────────────────────── */
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = window.innerWidth / 2, ty = window.innerHeight / 2, cx = tx, cy = ty, raf = 0, active = false;
    const onMove = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; if (!active) { active = true; el.style.opacity = "1"; } };
    const onLeave = () => { active = false; el.style.opacity = "0"; };
    const tick = () => { cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16; el.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`; raf = requestAnimationFrame(tick); };
    window.addEventListener("pointermove", onMove, { passive: true }); document.addEventListener("pointerleave", onLeave); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); };
  }, []);
  return <div ref={ref} className="landing-cursor-glow" aria-hidden="true" />;
}

/* ─────────────────────────── HOOKS ─────────────────────────── */
function useScroll() {
  const [y, setY] = useState(0); const [pct, setPct] = useState(0);
  useEffect(() => { const h = () => { const sy = window.scrollY; setY(sy); const m = document.documentElement.scrollHeight - window.innerHeight; setPct(m > 0 ? Math.min(sy / m, 1) : 0); }; h(); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);
  return { y, pct };
}
function useReveal() {
  useEffect(() => { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("reveal-visible"); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: "0px 0px -3% 0px" }); document.querySelectorAll(".reveal").forEach((el) => io.observe(el)); return () => io.disconnect(); }, []);
}

/* ─────────────────────────── COMPONENTS ─────────────────────────── */
function SectionTag({ children }: { children: string }) {
  return <div className="tag-label inline-flex mb-5">{children}</div>;
}

function ProductCard({ icon: Ic, title, desc, href, cta, delay = 0 }: { icon: typeof Brain; title: string; desc: string; href?: string; cta?: string; delay?: number }) {
  return (
    <div className="reveal group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-cyan-400/20 transition-all duration-500 p-6 md:p-7" style={{ transitionDelay: `${delay * 60}ms` }}>
      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"><Ic className="w-5 h-5 text-cyan-400" /></div>
      <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs leading-6 text-slate-400">{desc}</p>
    </div>
  );
}

/* ─────────────────────────── DATA ─────────────────────────── */
const PROBLEMS = [
  { n: "err" as IName, t: "Tu répètes les mêmes erreurs", d: "Sans mémoire structurée, les mêmes patterns reviennent trade après trade.", c: "text-red-400" },
  { n: "heart" as IName, t: "L'émotion prend le dessus", d: "FOMO, revenge trading, sizing au feeling : tu sais que c'est le problème.", c: "text-amber-400" },
  { n: "compass" as IName, t: "Tu changes sans savoir pourquoi", d: "Changer de stratégie au hasard parce que tu ne sais pas ce qui fonctionne vraiment.", c: "text-slate-400" },
];

const JARVIS_LINES = [
  { role: "user", text: "Pourquoi je perds après 2 bons trades ?" },
  { role: "jarvis", text: "Sur tes 3 derniers mois, après 2 trades gagnants, tu augmentes ton risque de 40% en moyenne. Et tu perds 62% de ces trades." },
  { role: "jarvis", text: "Ce n'est pas ta stratégie. C'est un biais comportemental : l'excès de confiance après une série positive." },
  { role: "jarvis", text: "Mon conseil : après 2 gains consécutifs, bloque ta taille de position. Je peux ajouter cette règle à ta checklist ?" },
];

const PIPELINE = ["Tes trades", "Analyse comportementale", "Patterns détectés", "Plan d'action personnalisé"];

const DISCIPLINE_STEPS = [
  { icon: Clock, title: "Avant le trade", items: ["Briefing IA du jour", "Checklist pré-market", "Objectif de la session", "Validation du risque"] },
  { icon: Shield, title: "Pendant le trade", items: ["Détection d'erreurs en live", "Limite de pertes", "Mode discipline activable"] },
  { icon: Brain, title: "Après le trade", items: ["Analyse émotionnelle immédiate", "Feedback personnalisé", "Leçon enregistrée"] },
];

const ANALYTICS = [
  { label: "Performance", icon: TrendingUp, items: ["Win rate, Profit Factor, Expectancy", "Sharpe & Sortino ratios", "Courbe d'equity interactive", "Analyse de drawdown"] },
  { label: "Comportement", icon: Brain, items: ["Erreurs détectées automatiquement", "Score de discipline", "Patterns émotionnels", "Adhérence au plan"] },
  { label: "Profondeur", icon: BarChart3, items: ["Par setup & par session", "Heatmap horaire", "Saisonnalité", "Par jour de la semaine"] },
];

const NAV: [string, string][] = [["Problème", "problem"], ["Coach IA", "jarvis"], ["Système", "discipline"], ["Analytics", "analytics"], ["Tarifs", "pricing"]];

/* ─────────────────────────── LANDING ─────────────────────────── */
export default function Landing() {
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [menu, setMenu] = useState(false);
  const [activeSec, setActiveSec] = useState("");
  const [typing, setTyping] = useState(0);
  const { y, pct } = useScroll();
  useReveal();

  const scrollLockRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onScroll = () => { if (scrollLockRef.current) return; const pos = window.scrollY + 120; let cur = ""; for (const [, id] of NAV) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top + window.scrollY <= pos) cur = id; } setActiveSec(cur); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, []);

  const open = (mode: "login" | "signup", plan?: string) => { setMenu(false); setAuthMode(mode); setAuthPlan(plan); setAuth(true); };
  const go = (id: string) => { setMenu(false); setActiveSec(id); if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); scrollLockRef.current = true; document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); scrollTimerRef.current = setTimeout(() => { scrollLockRef.current = false; }, 1000); };

  // Jarvis typing animation (only when section is visible)
  useEffect(() => {
    if (!activeSec) return;
    const id = setInterval(() => setTyping((t) => Math.min(t + 1, JARVIS_LINES.length)), 2200);
    return () => clearInterval(id);
  }, [activeSec]);

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <CursorGlow />
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 55% at 60% -10%,rgba(6,182,212,.09),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.07),transparent 55%)" }} />

      {/* ── NAV ── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 10 ? "bg-[#060d16]/85 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/40"}`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}>
        <div className="scroll-bar absolute inset-x-0 top-0 h-[2px]" style={{ transform: `scaleX(${pct})` }} />
        <div className="relative mx-auto flex h-[60px] md:h-[66px] max-w-[1400px] items-center justify-between gap-3 px-4 md:px-5 lg:px-8">
          <Logo />
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border border-white/[.08] bg-white/[.03] p-1 backdrop-blur-md xl:flex">
            {NAV.map(([l, id]) => {
              const on = activeSec === id;
              return <button key={id} onClick={() => go(id)} className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${on ? "bg-cyan-400/[.14] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.28)]" : "text-slate-400 hover:bg-cyan-400/[.07] hover:text-cyan-100"}`}>{l}</button>;
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-3.5 sm:px-4">Essai gratuit <Icon n="arrow" cls="h-4 w-4 hidden sm:inline" /></button>
            <button onClick={() => setMenu(!menu)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-200 xl:hidden" aria-label="Menu"><Icon n={menu ? "close" : "menu"} cls="h-5 w-5" /></button>
          </div>
        </div>
        {menu && (
          <div className="xl:hidden border-t border-white/[.07] bg-[#070f1a]/98 backdrop-blur-xl px-5 py-4">
            <div className="flex flex-col">
              {NAV.map(([l, id]) => (<button key={id} onClick={() => go(id)} className={`mobile-nav-link ${activeSec === id ? "text-cyan-300" : ""}`}>{l}</button>))}
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary mt-4 w-full">Essai gratuit <Icon n="arrow" cls="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ═══════════ 1 · HERO ═══════════ */}
        <section className="hero-mesh relative overflow-hidden pt-[90px] pb-20 lg:pt-[140px] lg:pb-36">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(6,182,212,.07), transparent 60%)" }} />
          <div className="relative mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_1.05fr] items-center gap-12 lg:gap-16">
              {/* Left: copy */}
              <div className="text-center lg:text-left">
                <div className="fade-up inline-flex items-center gap-2.5 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300 mb-8">
                  <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" /> TradeVault · AI Trading Coach
                </div>
                <h1 className="fade-up d1 font-display text-[clamp(2.8rem,5.5vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-white">
                  Your trading data<br />
                  <span className="text-gradient">already knows</span><br />
                  what's holding you back.
                </h1>
                <p className="fade-up d2 mt-6 text-base sm:text-lg leading-7 text-slate-400 max-w-[520px] mx-auto lg:mx-0">
                  TradeVault learns how you trade, finds the patterns you don't see, and turns your own data into a personal trading coach.
                </p>
                <div className="fade-up d3 mt-8 flex flex-col sm:flex-row items-center gap-3 lg:justify-start">
                  <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-8 py-4 text-[.95rem]">
                    Start Free <Icon n="arrow" cls="h-4 w-4" />
                  </button>
                  <span className="text-xs text-slate-500">No credit card · Free forever</span>
                </div>
                <a href="https://www.trustpilot.com/review/tradevaultt.vercel.app" target="_blank" rel="noreferrer"
                  className="fade-up d4 mt-5 inline-flex items-center gap-2.5 rounded-full border border-white/[.08] bg-white/[.03] py-1.5 pl-2 pr-3.5 transition hover:border-[#00b67a]/40 hover:bg-white/[.05]">
                  <span className="flex gap-0.5">{[0,1,2,3,4].map((i) => (<span key={i} className="grid h-4 w-4 place-items-center rounded-[2px] bg-[#00b67a]"><Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" /></span>))}</span>
                  <span className="text-xs font-semibold text-slate-300">Trustpilot <span className="text-white font-bold">· Reviews</span></span>
                </a>
              </div>

              {/* Right: product preview */}
              <div className="fade-up d2 relative">
                <div className="pointer-events-none absolute -inset-12 rounded-[3rem] bg-cyan-500/[.04] blur-3xl" />
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a1625]/95 backdrop-blur-xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.5)]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                  {/* Dashboard header bar */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.5)]" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Equity Curve</span></div>
                    <div className="flex gap-1.5">{[["7D",true],["30D",false],["YTD",false]].map(([label]) => (<span key={String(label)} className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${label === "7D" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-600"}`}>{label}</span>))}</div>
                  </div>
                  {/* Chart SVG */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-end justify-between mb-4">
                      <div><div className="font-display text-[1.6rem] font-extrabold text-emerald-400 tabular-nums">+$4,218.50</div><div className="text-[11px] text-slate-500">+16.9% · 248 trades</div></div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Profitable</span>
                    </div>
                    <svg viewBox="0 0 320 90" className="w-full h-20" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22d3ee" stopOpacity=".18" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
                      </defs>
                      {[22,44,66].map((yy) => (<path key={yy} d={`M0 ${yy}H320`} stroke="rgba(148,163,184,.07)" />))}
                      <polygon points="0,78 42,66 84,72 126,42 168,56 210,30 252,44 294,18 320,8 320,90 0,90" fill="url(#hg)" />
                      <polyline points="0,78 42,66 84,72 126,42 168,56 210,30 252,44 294,18 320,8" fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      <circle cx="320" cy="8" r="3.5" fill="#0a1625" stroke="#67e8f9" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-t border-white/[0.06]">
                    {[["Win Rate","64%"],["Profit Factor","2.31"],["Sharpe","1.84"]].map(([l,v]) => (
                      <div key={l} className="px-3 py-2.5 text-center"><div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">{l}</div><div className="font-display text-sm font-bold text-cyan-300 tabular-nums mt-0.5">{v}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 2 · THE PROBLEM — emotional ═══════════ */}
        <section id="problem" className="relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-16">
              <SectionTag>Le vrai problème</SectionTag>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                You're not a bad trader.<br />
                <span className="text-slate-500">You just don't understand your own patterns yet.</span>
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
              {PROBLEMS.map((p, i) => (
                <article key={p.t} className="reveal group rounded-2xl border border-red-400/10 bg-red-400/[.02] hover:border-red-400/25 hover:bg-red-400/[.04] transition-all duration-500 p-6" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className={`${p.c} text-[10px] font-bold uppercase tracking-[.15em] mb-3`}>Problem #{i + 1}</div>
                  <h3 className="text-sm font-bold text-white mb-2">{p.t}</h3>
                  <p className="text-xs leading-5 text-slate-500">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 3 · JARVIS — the wow moment ═══════════ */}
        <section id="jarvis" className="relative border-t border-white/[.06] overflow-hidden py-24 lg:py-28 bg-[#080f1b]/80">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%,rgba(34,211,238,.07),transparent 65%)" }} />
          <div className="relative mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-16">
              <SectionTag>Meet Jarvis</SectionTag>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                An AI coach that actually<br />
                <span className="text-gradient">knows how you trade.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-400 max-w-md mx-auto">
                Not a generic chatbot. Jarvis reads your trading history, finds what's costing you money, and tells you exactly what to fix.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-10 items-start max-w-5xl mx-auto">
              {/* Conversation */}
              <div className="reveal rounded-2xl border border-white/[0.06] bg-[#0a1525]/95 backdrop-blur-xl overflow-hidden shadow-xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-md shadow-cyan-500/20"><Bot className="w-4 h-4 text-white" /></div>
                  <div><div className="text-[11px] font-bold text-white">Jarvis · Coach IA</div><div className="text-[9px] text-emerald-400">Analyzing 248 trades · live</div></div>
                </div>
                <div className="px-4 py-4 space-y-3.5">
                  {JARVIS_LINES.map((line, i) => {
                    if (i >= typing) return null;
                    const isUser = line.role === "user";
                    return (
                      <div key={i} className={`flex ${isUser ? "justify-end" : ""}`}>
                        <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-5 ${isUser ? "bg-white/[0.06] border border-white/[0.08] rounded-tr-sm text-slate-200" : "rounded-tl-sm text-slate-200 border border-cyan-400/15 bg-cyan-400/[0.04]"}`}>
                          {line.text}
                        </div>
                      </div>
                    );
                  })}
                  {typing < JARVIS_LINES.length && (
                    <div className="flex items-center gap-1.5 py-1">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-md"><Bot className="w-4 h-4 text-white" /></div>
                      <div className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} /><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} /></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline */}
              <div className="reveal space-y-4" style={{ transitionDelay: "150ms" }}>
                <h3 className="text-lg font-bold text-white">Your trades become your coach.</h3>
                <p className="text-sm text-slate-400 leading-6">
                  TradeVault connects the dots between your trades, mistakes, and behavior to give you answers you can act on.
                </p>
                <div className="space-y-2 mt-6">
                  {PIPELINE.map((step, i) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[11px] font-bold text-cyan-300 shrink-0">{i + 1}</span>
                      <span className="text-sm text-slate-300">{step}</span>
                      {i < PIPELINE.length - 1 && <ArrowRight className="w-4 h-4 text-cyan-500/40 ml-auto shrink-0 hidden sm:block" />}
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-4">
                  <div className="flex items-center gap-2 mb-1.5"><Sparkles className="w-4 h-4 text-emerald-400" /><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Result</span></div>
                  <p className="text-xs text-slate-300 leading-5">You stop guessing. You know exactly what to improve, when to stop, and what's actually working.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 4 · DISCIPLINE OS ═══════════ */}
        <section id="discipline" className="relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-16">
              <SectionTag>Discipline OS</SectionTag>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                Trade with a system.<br />
                <span className="text-gradient">Not with your emotions.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-400 max-w-md mx-auto">
                TradeVault turns discipline into a process you can follow, not a willpower battle you keep losing.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
              {DISCIPLINE_STEPS.map((step, i) => (
                <div key={step.title} className="reveal rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 hover:border-cyan-400/15 transition-all duration-500" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/20 flex items-center justify-center mb-4"><step.icon className="w-5 h-5 text-cyan-400" /></div>
                  <h3 className="text-sm font-bold text-white mb-3">{step.title}</h3>
                  <ul className="space-y-2">
                    {step.items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-xs text-slate-400"><Icon n="check" cls="h-3.5 w-3.5 text-cyan-400 shrink-0" />{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 5 · ANALYTICS ═══════════ */}
        <section id="analytics" className="section-mesh relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-16">
              <SectionTag>Analytics</SectionTag>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                Every metric is calculated<br />
                <span className="text-gradient">on YOUR data.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-400 max-w-md mx-auto">
                Not generic market averages. Your patterns, your mistakes, your edge.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
              {ANALYTICS.map((cat, i) => (
                <div key={cat.label} className="reveal rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 hover:border-cyan-400/15 transition-all duration-500" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/20 flex items-center justify-center mb-4"><cat.icon className="w-5 h-5 text-cyan-400" /></div>
                  <h3 className="text-sm font-bold text-white mb-4">{cat.label}</h3>
                  <ul className="space-y-2.5">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs text-slate-400 leading-5"><Icon n="check" cls="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 6 · PRICING ═══════════ */}
        <section id="pricing" className="section-mesh relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1000px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-16">
              <SectionTag>Pricing</SectionTag>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                An investment that pays for itself<br />
                <span className="text-gradient">in one good trade.</span>
              </h2>
            </div>
            <div className="reveal grid gap-4 lg:grid-cols-3 max-w-4xl mx-auto">
              {/* Free */}
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Free</p>
                <div className="mt-4 flex items-end gap-1"><span className="font-display text-4xl font-extrabold text-white">0 €</span><span className="mb-1.5 text-sm text-slate-500">/ toujours</span></div>
                <p className="mt-2 text-sm text-slate-500">Start building your discipline.</p>
                <button onClick={() => open("signup", "Plan Gratuit")} className="btn-ghost w-full mt-6">Start Free</button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {["Journal — 30 trades / mois", "Dashboard & equity curve", "Checklist pré-market", "Stats de base"].map((f) => (<p key={f} className="flex items-start gap-2.5 text-slate-300"><Icon n="check" cls="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{f}</p>))}
                </div>
              </div>
              {/* Pro Annual */}
              <div className="flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] p-7 lg:-my-4 lg:py-11">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">Pro · Annual</p><span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#03131b]"><Icon n="flame" cls="h-3 w-3 fill-current" /> 2 months free</span></div>
                <div className="mt-4 flex items-end gap-1.5"><span className="font-display text-5xl font-extrabold text-white">{eur(Math.round(YEARLY_PER_MONTH * 100) / 100)}</span><span className="mb-2 text-sm text-slate-400">/ mois</span></div>
                <p className="mt-2 text-sm text-slate-300">{eur(YEARLY_EUR)} billed once a year <span className="text-slate-500 line-through ml-1">{eur(YEARLY_FULL_PRICE)}</span></p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[12px] font-bold text-emerald-300"><Icon n="check" cls="h-3.5 w-3.5" /> Save {eur(YEARLY_SAVING)} / year</div>
                <button onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")} className="btn-primary w-full h-12! mt-6">Start — 14 days free <Icon n="arrow" cls="h-4 w-4" /></button>
                <p className="mt-2 text-center text-[11px] text-slate-500">No commitment · No card required</p>
                <p className="mt-7 text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">Everything in Free, plus:</p>
                <div className="mt-3 space-y-2.5 text-sm">
                  {["Coach IA Jarvis · unlimited", "Unlimited trades & accounts", "20+ advanced metrics", "Error detection", "Monthly reports", "Position calculator", "Priority support"].map((f) => (<p key={f} className="flex items-start gap-2.5 text-slate-300"><Icon n="check" cls="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />{f}</p>))}
                </div>
              </div>
              {/* Pro Monthly */}
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Pro · Monthly</p>
                <div className="mt-4 flex items-end gap-1"><span className="font-display text-4xl font-extrabold text-slate-200">{eur(MONTHLY_EUR)}</span><span className="mb-1.5 text-sm text-slate-500">/ mois</span></div>
                <p className="mt-2 text-sm text-slate-500">Same features, monthly billing.</p>
                <button onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")} className="btn-ghost w-full mt-6">Go monthly</button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {["Coach IA Jarvis", "Unlimited trades", "20+ metrics", "Monthly reports"].map((f) => (<p key={f} className="flex items-start gap-2.5 text-slate-400"><Icon n="check" cls="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{f}</p>))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 7 · FINAL CTA ═══════════ */}
        <section className="relative overflow-hidden border-t border-white/[.06] py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgba(34,211,238,.12),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[640px] px-5 text-center">
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-[-0.045em] text-white leading-[1.08]">
              Your trades already contain<br />the answers.
            </h2>
            <p className="mt-5 text-slate-400 text-lg leading-7">TradeVault helps you find them.</p>
            <div className="mt-10"><button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-10 py-4 text-[1rem]">Start Free <Icon n="arrow" cls="h-4 w-4" /></button></div>
            <p className="mt-4 text-xs text-slate-600">No credit card · Cancel anytime</p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <Logo compact />
              <p className="text-xs leading-5 text-slate-500 max-w-[220px]">The AI coach for traders who want to progress with method.</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-cyan-300 transition mt-1"><Icon n="mail" cls="h-3.5 w-3.5" /> {SUPPORT_EMAIL}</a>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Product</p>
              <div className="flex flex-col gap-2">
                {[["jarvis","Coach IA"],["discipline","Discipline OS"],["analytics","Analytics"],["pricing","Pricing"]].map(([id,label]) => (<button key={id} onClick={() => go(id)} className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition text-left">{label}</button>))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Legal</p>
              <div className="flex flex-col gap-2">
                <a href="/terms" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Terms</a>
                <a href="/privacy" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Privacy</a>
                <a href="/contact" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Contact</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Social</p>
              <div className="flex items-center gap-3">
                {([{icon:Twitter,label:"X"},{icon:Linkedin,label:"LinkedIn"},{icon:Instagram,label:"Instagram"},{icon:Facebook,label:"Facebook"},{icon:Youtube,label:"YouTube"}] as const).map((s) => (<span key={s.label} aria-label={s.label} title={`${s.label} — coming soon`} className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-white/[.08] bg-white/[.02] text-slate-600 transition-colors"><s.icon className="w-4 h-4" /></span>))}
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-white/[.05] pt-6 text-center text-[11px] text-slate-700">© {new Date().getFullYear()} TradeVault. Trading involves risk. Journal first, trade after.</div>
        </div>
      </footer>

      <CookieConsent />
      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
