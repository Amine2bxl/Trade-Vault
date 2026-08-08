import { useEffect, useRef, useState } from "react";
import { Twitter, Linkedin, Instagram, Facebook, Youtube, ArrowRight, Bot, Shield, TrendingUp, Brain, Target, BarChart3, Sparkles, MessageSquare, Clock, AlertTriangle, CalendarDays, Zap, Layers } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { eur, MONTHLY_EUR, YEARLY_EUR, YEARLY_FULL_PRICE, YEARLY_PER_MONTH, YEARLY_SAVING } from "../utils/pricing";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

/* ─────────────────── LOGO ─────────────────── */
function Logo({ compact }: { compact?: boolean }) {
  return (
    <a href="#" className="flex items-center gap-2.5 shrink-0">
      <img src={logoSrc} alt="TradeVault" width={compact ? 28 : 36} height={compact ? 28 : 36}
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]`} />
      <span className={`font-display font-extrabold tracking-[-0.04em] text-white leading-none hidden sm:block ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}>TradeVault</span>
    </a>
  );
}

/* ─────────────────── HOOKS ─────────────────── */
function useScroll() { const [y, setY] = useState(0); const [pct, setPct] = useState(0); useEffect(() => { const h = () => { const sy = window.scrollY; setY(sy); setPct(document.documentElement.scrollHeight > window.innerHeight ? Math.min(sy / (document.documentElement.scrollHeight - window.innerHeight), 1) : 0); }; h(); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []); return { y, pct }; }
function useReveal() { useEffect(() => { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("reveal-visible"); io.unobserve(e.target); } }), { threshold: 0.06 }); setTimeout(() => document.querySelectorAll(".reveal").forEach((el) => io.observe(el)), 100); return () => io.disconnect(); }, []); }

/* ─────────────────── PRODUCT MOCKUPS (from LandingDemo) ─────────────────── */
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</div><div className={`font-display text-base font-extrabold tabular-nums ${color}`}>{value}</div></div>;
}

function DashboardMock() {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="P&L du jour" value="+$1,240" color="text-emerald-400" />
        <StatCard label="Win rate" value="64%" color="text-cyan-300" />
        <StatCard label="Trades" value="12" color="text-white" />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-end justify-between gap-1 h-16">
          {[35,48,30,55,42,62,50,72,58,80,66,92].map((h,i) => (<div key={i} className="w-full rounded-t bg-gradient-to-t from-cyan-600/40 to-teal-400/80" style={{ height: `${h}%` }} />))}
        </div>
      </div>
    </div>
  );
}

function JarvisMiniMock() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
        <span className="text-[11px] font-bold text-white">Jarvis</span>
        <span className="text-[9px] text-emerald-400 font-semibold ml-auto">en direct</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-[11px] text-slate-200 leading-relaxed">
          <span className="text-red-300 font-bold">Pattern détecté</span> : tes pertes sont 2.4× plus grandes après 2 trades gagnants. Excès de confiance.
        </div>
        <div className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2.5 text-[11px] text-white font-medium">Comment je corrige ça demain ?</div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] px-3 py-2 text-[10px]"><span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wider">Plan</span><div className="text-slate-200 mt-0.5">2 trades max · stop après 1 perte</div></div>
      </div>
    </div>
  );
}

function AnalyticsMiniMock() {
  const days = [{d:"L",v:58,w:true},{d:"M",v:34,w:false},{d:"M",v:72,w:true},{d:"J",v:46,w:false},{d:"V",v:88,w:true}];
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2.5">Edge par jour</div>
        <div className="flex items-end justify-between gap-1.5 h-16">
          {days.map((x,i) => (<div key={i} className="flex flex-col items-center gap-1 flex-1"><div className={`w-full rounded-t ${x.w ? "bg-gradient-to-t from-emerald-600/40 to-emerald-400/80" : "bg-gradient-to-t from-red-600/40 to-red-400/80"}`} style={{height:`${x.v}%`}} /><span className="text-[10px] text-slate-500">{x.d}</span></div>))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Profit factor" value="1.84" color="text-emerald-400" />
        <StatCard label="R-moyen" value="+1.6R" color="text-cyan-300" />
      </div>
    </div>
  );
}

/* ─────────────────── DATA ─────────────────── */
const PAINS = [
  { n: "err" as IName, t: "Tu analyses tes résultats, pas tes comportements", d: "Ton win rate te dit si tu gagnes. Pas pourquoi tu perds quand tu perds." },
  { n: "heart" as IName, t: "Tu sais que l'émotion te coûte de l'argent", d: "Revenge trading, FOMO, sizing au feeling. Tu le sais. Tu n'arrives pas à l'arrêter." },
  { n: "compass" as IName, t: "Tu changes de stratégie sans savoir ce qui marche", d: "Sans feedback objectif, chaque mois tu repars de zéro avec une nouvelle méthode." },
];

const SYSTEM = [
  { icon: Clock, title: "Avant", desc: "Briefing IA, checklist, validation du risque — tout est prêt avant ton premier trade." },
  { icon: Shield, title: "Pendant", desc: "Alerte quand tu dévies de ton plan. Limites de pertes, blocage du revenge trading." },
  { icon: Brain, title: "Après", desc: "Analyse immédiate de chaque trade. Leçons enregistrées. Objectifs du lendemain." },
];

const PIPELINE = [
  { label: "Tes trades", desc: "Chaque trade est enregistré : setup, émotion, capture, résultat." },
  { label: "Analyse", desc: "L'IA analyse tes patterns, erreurs, comportements et discipline." },
  { label: "Compréhension", desc: "Tu vois enfin ce qui te coûte de l'argent et ce qui fonctionne." },
  { label: "Action", desc: "Jarvis te donne un plan d'action concret pour demain." },
];

const NAV: [string, string][] = [["Problème","problem"],["Coach IA","jarvis"],["Système","discipline"],["Analytics","stats"],["Tarifs","pricing"]];

/* ─────────────────── LANDING ─────────────────── */
export default function Landing() {
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [menu, setMenu] = useState(false);
  const [activeSec, setActiveSec] = useState("");
  const { y, pct } = useScroll();
  useReveal();

  const scrollLockRef = useRef(false); const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onScroll = () => { if (scrollLockRef.current) return; let cur = ""; for (const [, id] of NAV) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top + window.scrollY <= window.scrollY + 120) cur = id; } setActiveSec(cur); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, []);

  const open = (m: "login" | "signup", plan?: string) => { setMenu(false); setAuthMode(m); setAuthPlan(plan); setAuth(true); };
  const go = (id: string) => { setMenu(false); setActiveSec(id); if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); scrollLockRef.current = true; document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); scrollTimerRef.current = setTimeout(() => { scrollLockRef.current = false; }, 1000); };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 60% at 60% -10%,rgba(6,182,212,.08),transparent 60%),radial-gradient(ellipse 50% 50% at 90% 60%,rgba(99,102,241,.05),transparent 55%)" }} />

      {/* NAV */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 20 ? "bg-[#060d16]/90 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/30"}`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}>
        <div className="scroll-bar absolute inset-x-0 top-0 h-[2px]" style={{ transform: `scaleX(${pct})` }} />
        <div className="mx-auto flex h-[60px] md:h-[66px] max-w-[1400px] items-center justify-between gap-3 px-4 md:px-5 lg:px-8">
          <Logo />
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border border-white/[.08] bg-white/[.03] p-1 backdrop-blur-md xl:flex">
            {NAV.map(([l, id]) => <button key={id} onClick={() => go(id)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${activeSec === id ? "bg-cyan-400/[.14] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.28)]" : "text-slate-400 hover:text-cyan-100"}`}>{l}</button>)}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-3.5 sm:px-5">Start Free</button>
            <button onClick={() => setMenu(!menu)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-200 xl:hidden"><Icon n={menu ? "close" : "menu"} cls="h-5 w-5" /></button>
          </div>
        </div>
        {menu && (
          <div className="xl:hidden border-t border-white/[.07] bg-[#070f1a]/98 backdrop-blur-xl px-5 py-4">
            {NAV.map(([l, id]) => <button key={id} onClick={() => go(id)} className={`mobile-nav-link ${activeSec === id ? "text-cyan-300" : ""}`}>{l}</button>)}
            <button onClick={() => open("signup")} className="btn-primary mt-4 w-full">Start Free <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ═══ 1 · HERO — product visible immediately ═══ */}
        <section className="hero-mesh relative overflow-hidden pt-[100px] pb-16 lg:pt-[150px] lg:pb-24">
          <div className="mx-auto max-w-[1300px] px-5 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_1.05fr] items-center gap-10 lg:gap-14">
              <div className="text-center lg:text-left max-w-[540px] mx-auto lg:mx-0">
                <div className="fade-up inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300 mb-7">
                  <span className="ping-dot relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" /> AI Trading Coach
                </div>
                <h1 className="fade-up d1 font-display text-[clamp(2.5rem,5vw,4.2rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-white">
                  Your trading data<br />
                  <span className="text-gradient">already has the answers.</span>
                </h1>
                <p className="fade-up d2 mt-5 text-base sm:text-lg leading-7 text-slate-400">
                  TradeVault reads your history, finds your patterns, and turns everything into a personal coach that helps you trade with more discipline — every single day.
                </p>
                <div className="fade-up d3 mt-7 flex flex-col sm:flex-row items-center gap-3 lg:justify-start">
                  <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-8 py-4 text-[.95rem]">
                    Start Free <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-500">Free forever · No credit card</span>
                </div>
                <a href="https://www.trustpilot.com/review/tradevaultt.vercel.app" target="_blank" rel="noreferrer"
                  className="fade-up d4 mt-5 inline-flex items-center gap-2.5 rounded-full border border-white/[.08] bg-white/[.03] py-1.5 pl-2 pr-3.5 transition hover:border-[#00b67a]/40 hover:bg-white/[.05]">
                  <span className="flex gap-0.5">{[0,1,2,3,4].map((i) => (<span key={i} className="grid h-4 w-4 place-items-center rounded-[2px] bg-[#00b67a]"><Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" /></span>))}</span>
                  <span className="text-xs font-semibold text-slate-300">Trustpilot</span>
                </a>
              </div>
              <div className="fade-up d2 grid gap-3">
                <DashboardMock />
                <JarvisMiniMock />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 2 · THE PROBLEM ═══ */}
        <section id="problem" className="relative border-t border-white/[.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-red-400/20 bg-red-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-red-400/80 mb-6">The real problem</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                Your journal records what happened.<br />
                <span className="text-slate-500">But it never tells you how to get better.</span>
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
              {PAINS.map((p, i) => (
                <div key={p.t} className="reveal group rounded-2xl border border-red-400/[0.08] bg-red-400/[0.015] hover:border-red-400/20 transition-all duration-500 p-6" style={{ transitionDelay: `${i*80}ms` }}>
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-red-400/[0.06] border border-red-400/15 text-red-400 mb-4"><Icon n={p.n} cls="w-4 h-4" /></div>
                  <h3 className="text-sm font-bold text-white mb-2">{p.t}</h3>
                  <p className="text-xs leading-5 text-slate-500">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 3 · HOW IT WORKS — the pipeline ═══ */}
        <section className="relative border-t border-white/[.06] py-20 lg:py-28 bg-[#080f1b]/70">
          <div className="mx-auto max-w-[1000px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-6">How TradeVault works</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                From raw data to<br />
                <span className="text-gradient">personal coaching.</span>
              </h2>
            </div>
            <div className="reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
              {PIPELINE.map((step, i) => (
                <div key={step.label} className="text-center p-5" style={{ transitionDelay: `${i*100}ms` }}>
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/25 flex items-center justify-center mx-auto mb-4"><span className="font-display text-lg font-extrabold text-cyan-400">{i+1}</span></div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{step.label}</h3>
                  <p className="text-[11px] leading-5 text-slate-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 4 · JARVIS — the hero product ═══ */}
        <section id="jarvis" className="relative border-t border-white/[.06] overflow-hidden py-20 lg:py-28">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 55% 30%,rgba(34,211,238,.08),transparent 65%)" }} />
          <div className="relative mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-6">Meet Jarvis</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                A coach that knows<br />
                <span className="text-gradient">your entire trading history.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-400 max-w-md mx-auto">
                Not a generic chatbot. Jarvis analyzes your actual trades and gives you advice based on YOUR patterns, YOUR mistakes, YOUR progress.
              </p>
            </div>
            <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto items-start">
              <div className="reveal rounded-2xl border border-white/[0.06] bg-[#0a1525]/95 backdrop-blur-xl overflow-hidden shadow-xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-md shadow-cyan-500/20"><Bot className="w-4 h-4 text-white" /></div>
                  <div><div className="text-xs font-bold text-white">Jarvis · Coach IA</div><div className="text-[9px] text-emerald-400 font-semibold">Analyzing trades · in real time</div></div>
                  <span className="ml-auto h-5 px-1.5 rounded-md bg-emerald-400/10 border border-emerald-400/20 text-[9px] font-bold uppercase text-emerald-300">Live</span>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <div className="flex justify-end"><div className="max-w-[80%] rounded-xl bg-white/[0.05] border border-white/[0.08] px-4 py-2.5 text-xs text-slate-200 rounded-tr-sm">Why do I keep losing money after good days?</div></div>
                  <div className="flex gap-2"><div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div><div className="max-w-[88%] rounded-xl bg-cyan-400/[0.04] border border-cyan-400/15 px-4 py-2.5 text-xs text-slate-200 rounded-tl-sm">I analyzed your last 3 months. After a winning session, your risk increases by <span className="text-red-300 font-bold">42%</span> on average. Losses that follow are <span className="text-red-300 font-bold">2.4× larger</span> than normal.</div></div>
                  <div className="flex gap-2"><div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div><div className="max-w-[88%] rounded-xl bg-cyan-400/[0.04] border border-cyan-400/15 px-4 py-2.5 text-xs text-slate-200 rounded-tl-sm">This isn't your strategy. It's a confidence bias. Stop after 2 wins or 1 loss — that alone would save you <span className="text-emerald-300 font-bold">~$1,800/month</span>.</div></div>
                  <div className="flex justify-end"><div className="max-w-[75%] rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-xs text-white font-medium rounded-tr-sm">Add this rule to my checklist.</div></div>
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] px-3.5 py-3"><div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Mission du jour</div><div className="text-xs text-slate-200 mt-1">Max 2 trades · Stop après 1 perte · Taille fixe</div></div>
                </div>
              </div>
              <div className="reveal space-y-5" style={{ transitionDelay: "150ms" }}>
                <h3 className="text-lg font-bold text-white">Your personal trading intelligence.</h3>
                <ul className="space-y-3">
                  {["Knows your win rate by setup, session, and day of the week","Detects when you're about to repeat a known mistake","Builds a daily mission based on YOUR recent performance","Remembers every lesson you've learned and tracks your progress"].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/10 text-cyan-300 mt-0.5"><Icon n="check" cls="h-3 w-3" /></span>{item}</li>
                  ))}
                </ul>
                <div className="pt-2"><button onClick={() => open("signup")} className="btn-primary px-6 py-3 text-sm">Try Jarvis Free <ArrowRight className="w-3.5 h-3.5" /></button></div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 5 · THE SYSTEM ═══ */}
        <section id="discipline" className="relative border-t border-white/[.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-6">Discipline OS</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                Trade with a system.<br />
                <span className="text-gradient">Not with your emotions.</span>
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
              {SYSTEM.map((s, i) => (
                <div key={s.title} className="reveal group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-cyan-400/15 transition-all duration-500 p-6" style={{ transitionDelay: `${i*80}ms` }}>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"><s.icon className="w-5 h-5 text-cyan-400" /></div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400/70 mb-1.5">{s.title} le trade</div>
                  <p className="text-xs leading-6 text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 6 · ANALYTICS ═══ */}
        <section id="stats" className="section-mesh relative border-t border-white/[.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-6">Advanced analytics</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                Numbers that actually<br />
                <span className="text-gradient">tell you something.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-400 max-w-md mx-auto">
                20+ metrics, all computed from YOUR trading data. Not market averages.
              </p>
            </div>
            <div className="reveal max-w-lg mx-auto"><AnalyticsMiniMock /></div>
          </div>
        </section>

        {/* ═══ 7 · PRICING ═══ */}
        <section id="pricing" className="section-mesh relative border-t border-white/[.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1000px] px-5 lg:px-8">
            <div className="reveal text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-6">Pricing</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                An investment that pays for itself<br />
                <span className="text-gradient">in one good trade.</span>
              </h2>
            </div>
            <div className="reveal grid gap-4 lg:grid-cols-3 max-w-4xl mx-auto">
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Free</p>
                <div className="mt-4"><span className="font-display text-4xl font-extrabold text-white">€0</span><span className="text-sm text-slate-500 ml-1">/ forever</span></div>
                <p className="mt-2 text-sm text-slate-500">Start building your discipline.</p>
                <button onClick={() => open("signup")} className="btn-ghost w-full mt-6">Start Free</button>
                <div className="mt-6 space-y-2 text-xs">
                  {["30 trades/month","Dashboard & equity","Pre-market checklist","Basic statistics"].map((f,i) => (<p key={i} className="flex items-center gap-2 text-slate-400"><Icon n="check" cls="h-3.5 w-3.5 text-slate-500 shrink-0" />{f}</p>))}
                </div>
              </div>
              <div className="flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] p-7 lg:-my-6 lg:py-12">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">Pro Annual</p><span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#03131b]">2 months free</span></div>
                <div className="mt-4"><span className="font-display text-5xl font-extrabold text-white">{eur(Math.round(YEARLY_PER_MONTH*100)/100)}</span><span className="text-sm text-slate-400 ml-1">/ month</span></div>
                <p className="mt-2 text-xs text-slate-300">{eur(YEARLY_EUR)} billed yearly <span className="text-slate-500 line-through ml-1">{eur(YEARLY_FULL_PRICE)}</span></p>
                <p className="mt-2 text-[11px] font-bold text-emerald-300">Save {eur(YEARLY_SAVING)}/year</p>
                <button onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")} className="btn-primary w-full mt-5 py-3 text-sm">Start — 14 days free</button>
                <p className="mt-2 text-center text-[10px] text-slate-500">No card required</p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">Everything in Free +</p>
                <div className="mt-3 space-y-2 text-xs">
                  {["Jarvis AI Coach · unlimited","Unlimited trades & accounts","20+ quantitative metrics","Error & pattern detection","Monthly automated reports","Position size calculator"].map((f,i) => (<p key={i} className="flex items-center gap-2 text-slate-300"><Icon n="check" cls="h-3.5 w-3.5 text-cyan-400 shrink-0" />{f}</p>))}
                </div>
              </div>
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Pro Monthly</p>
                <div className="mt-4"><span className="font-display text-4xl font-extrabold text-slate-200">{eur(MONTHLY_EUR)}</span><span className="text-sm text-slate-500 ml-1">/ month</span></div>
                <p className="mt-2 text-sm text-slate-500">Full Pro, monthly billing.</p>
                <button onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")} className="btn-ghost w-full mt-6">Go Monthly</button>
                <div className="mt-6 space-y-2 text-xs">
                  {["Jarvis AI Coach","Unlimited trades","20+ metrics","Monthly reports"].map((f,i) => (<p key={i} className="flex items-center gap-2 text-slate-400"><Icon n="check" cls="h-3.5 w-3.5 text-slate-500 shrink-0" />{f}</p>))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 8 · FINAL CTA ═══ */}
        <section className="relative overflow-hidden border-t border-white/[.06] py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_120%,rgba(34,211,238,.1),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[600px] px-5 text-center">
            <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-6" />
            <h2 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.1]">
              Ready to understand<br />your trading?
            </h2>
            <p className="mt-4 text-slate-400 text-lg">Your data already knows what's next. TradeVault just connects the dots.</p>
            <button onClick={() => open("signup")} className="btn-primary px-12 py-4 mt-8 text-base">Start Free — forever</button>
            <p className="mt-3 text-xs text-slate-600">No credit card · Cancel anytime</p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto max-w-[1200px] px-5 py-10 lg:py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <Logo compact />
              <p className="mt-3 text-[11px] leading-5 text-slate-500 max-w-[200px]">The AI coach that helps traders progress with method.</p>
            </div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Product</p>
              {[["jarvis","Coach IA"],["discipline","Discipline OS"],["stats","Analytics"],["pricing","Pricing"]].map(([id,l]) => (<button key={id} onClick={() => go(id)} className="block text-xs font-medium text-slate-500 hover:text-cyan-300 transition mb-1.5">{l}</button>))}
            </div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Legal</p>
              <a href="/terms" className="block text-xs font-medium text-slate-500 hover:text-cyan-300 transition mb-1.5">Terms</a>
              <a href="/privacy" className="block text-xs font-medium text-slate-500 hover:text-cyan-300 transition mb-1.5">Privacy</a>
              <a href="/contact" className="block text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Contact</a>
            </div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Connect</p>
              <div className="flex gap-2">
                {[{icon:Twitter,l:"X"},{icon:Linkedin,l:"LI"},{icon:Instagram,l:"IG"},{icon:Youtube,l:"YT"}].map(s => (<span key={s.l} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[.06] bg-white/[.02] text-slate-600 cursor-not-allowed" title={`${s.l} — soon`}><s.icon className="w-3.5 h-3.5" /></span>))}
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/[.05] pt-5 text-center text-[10px] text-slate-700">© {new Date().getFullYear()} TradeVault · Trading involves risk</div>
        </div>
      </footer>

      <CookieConsent />
      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
