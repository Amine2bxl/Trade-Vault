import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowRight, Bot, Shield, TrendingUp, Brain, Target, BarChart3, Sparkles, Clock, AlertTriangle, Zap, Check } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { eur, MONTHLY_EUR, YEARLY_EUR, YEARLY_FULL_PRICE, YEARLY_PER_MONTH, YEARLY_SAVING } from "../utils/pricing";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

/* ── HOOKS ── */
function useScroll() { const [y, setY] = useState(0); const [pct, setPct] = useState(0); useEffect(() => { const h = () => { const sy = window.scrollY; setY(sy); setPct(sy > 0 ? Math.min(sy / (document.documentElement.scrollHeight - window.innerHeight), 1) : 0); }; h(); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []); return { y, pct }; }

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.3) {
  const [inView, setInView] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold }); io.observe(el); return () => io.disconnect(); }, [ref, threshold]);
  return inView;
}

function AnimatedNumber({ target, duration = 2000, prefix = "", suffix = "", inView }: { target: number; duration?: number; prefix?: string; suffix?: string; inView: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => { if (!inView) return; let start = 0; const step = (t: number) => { const progress = Math.min(t / duration, 1); setVal(Math.round(target * progress)); if (progress < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, [inView, target, duration]);
  return <span className="font-display font-extrabold tabular-nums">{prefix}{val.toLocaleString()}{suffix}</span>;
}

/* ── PRODUCT PANELS ── */
function LiveDashboard({ inView }: { inView: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a1625]/95 backdrop-blur-xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.5)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.4)]" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Dashboard</span></div>
        <div className="flex gap-1">
          {["7D","30D","ALL"].map((l,i) => (<span key={l} className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${i===0?"bg-cyan-500/15 text-cyan-300":"text-slate-600"}`}>{l}</span>))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">P&L</div>
          <div className={`font-display text-sm font-extrabold tabular-nums mt-0.5 ${inView ? "text-emerald-400 animate-fade" : "text-emerald-400"}`}>
            {inView ? <AnimatedNumber target={1240} prefix="+$" inView={true} /> : "+$0"}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Win Rate</div>
          <div className="font-display text-sm font-extrabold tabular-nums mt-0.5 text-cyan-300">{inView ? <AnimatedNumber target={64} suffix="%" inView={true} /> : "0%"}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Trades</div>
          <div className="font-display text-sm font-extrabold tabular-nums mt-0.5 text-white">{inView ? <AnimatedNumber target={248} inView={true} /> : "0"}</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <svg viewBox="0 0 300 70" className="w-full h-16" preserveAspectRatio="none">
          <defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22d3ee" stopOpacity=".15" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs>
          {[17,34,51].map(y => (<path key={y} d={`M0 ${y}H300`} stroke="rgba(148,163,184,.06)" />))}
          <polygon points="0,58 38,48 76,52 114,34 152,44 190,24 228,36 266,16 300,10 300,70 0,70" fill="url(#lg1)" />
          <polyline points="0,58 38,48 76,52 114,34 152,44 190,24 228,36 266,16 300,10" fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}

function JarvisPanel({ inView }: { inView: boolean }) {
  const [line, setLine] = useState(0);
  useEffect(() => { if (!inView) return; const t = setTimeout(() => setLine(1), 600); const t2 = setTimeout(() => setLine(2), 2000); const t3 = setTimeout(() => setLine(3), 3400); return () => { clearTimeout(t); clearTimeout(t2); clearTimeout(t3); }; }, [inView]);
  const TYPING_DELAY = "animate-typing";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a1525]/95 backdrop-blur-xl overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
        <div><div className="text-[11px] font-bold text-white">Jarvis</div><div className="text-[9px] text-emerald-400 font-semibold">analyzing 248 trades</div></div>
        <span className="ml-auto h-5 px-1.5 rounded-md bg-emerald-400/10 border border-emerald-400/20 text-[9px] font-bold uppercase text-emerald-300">Live</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-end"><div className="max-w-[80%] rounded-xl bg-white/[0.05] border border-white/[0.08] px-3.5 py-2.5 text-[11px] text-slate-200 rounded-tr-sm">Why do I keep losing after good days?</div></div>
        {line >= 1 && (
          <div className="flex gap-2"><div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
            <div className="max-w-[88%] rounded-xl bg-cyan-400/[0.04] border border-cyan-400/15 px-3.5 py-2.5 text-[11px] text-slate-200 rounded-tl-sm">After a winning session, your risk increases by <span className="text-red-300 font-bold">42%</span>. Losses after wins are <span className="text-red-300 font-bold">2.4× larger</span>.</div>
          </div>
        )}
        {line >= 2 && (
          <div className="flex justify-end"><div className="max-w-[70%] rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-3.5 py-2.5 text-[11px] text-white font-medium rounded-tr-sm">How do I fix this?</div></div>
        )}
        {line >= 3 && (
          <div className="flex gap-2"><div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
            <div className="max-w-[88%] rounded-xl bg-emerald-400/[0.04] border border-emerald-400/20 px-3.5 py-2.5 text-[11px] text-slate-200 rounded-tl-sm"><span className="text-emerald-300 font-bold text-[10px] uppercase tracking-wider">Mission du jour</span><div className="mt-1">2 trades max · stop after 1 loss · fixed size</div></div>
          </div>
        )}
        {line < 3 && <div className="flex gap-1.5 py-1"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay:"0ms"}} /><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay:"200ms"}} /><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay:"400ms"}} /></div>}
      </div>
    </div>
  );
}

function BehavioralPanel({ inView }: { inView: boolean }) {
  const [activeTab, setActiveTab] = useState<"performance" | "behavior" | "risk" | "discipline">("behavior");
  const tabs = { performance: { label: "Performance", color: "text-cyan-400", bg: "bg-cyan-500/10", data: ["Win rate: 64%","Profit Factor: 2.31","Expectancy: +$18.40","Sharpe: 1.84"] },
    behavior: { label: "Behavior", color: "text-violet-400", bg: "bg-violet-500/10", data: ["Revenge trading: 7×","Avg loss after revenge: -1.4R","FOMO entries: 12× this month","Overtrading on Thu: +42%"] },
    risk: { label: "Risk", color: "text-amber-400", bg: "bg-amber-500/10", data: ["Max drawdown: -$2,840","Risk of ruin: 4.2%","Avg risk per trade: 1.1%","Kelly optimal: 2.4%"] },
    discipline: { label: "Discipline", color: "text-emerald-400", bg: "bg-emerald-500/10", data: ["Plan adherence: 78%","Checklist completed: 92%","Stop-loss respected: 88%","Rules followed: 14/18"] },
  };
  const t = tabs[activeTab];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a1625]/95 backdrop-blur-xl overflow-hidden">
      <div className="flex gap-1 p-2 border-b border-white/[0.06]">
        {(Object.keys(tabs) as Array<keyof typeof tabs>).map(k => (
          <button key={k} onClick={() => setActiveTab(k)} className={`flex-1 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab===k ? `${tabs[k].bg} ${tabs[k].color} border border-current/20` : "text-slate-500 hover:text-slate-300"}`}>{tabs[k].label}</button>
        ))}
      </div>
      <div className="p-4 space-y-2.5">
        {t.data.map((d, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2 animate-fade" style={{animationDelay:`${i*150+300}ms`}}>
            <span className="text-[11px] text-slate-300">{d}</span>
            <div className="w-16 h-1 rounded-full bg-white/[0.05] overflow-hidden"><div className={`h-full rounded-full ${activeTab==="behavior"?"bg-violet-500/60":activeTab==="risk"?"bg-amber-500/60":activeTab==="discipline"?"bg-emerald-500/60":"bg-cyan-500/60"}`} style={{width:`${60+Math.random()*35}%`}} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressPanel({ inView }: { inView: boolean }) {
  const metrics = [
    { label: "Discipline Score", from: 61, to: 87, color: "emerald" },
    { label: "Plan Adherence", from: 64, to: 87, color: "cyan" },
    { label: "Revenge Trading", from: 12, to: 2, color: "red", inverse: true },
    { label: "Avg R-Multiple", from: 1.2, to: 2.1, color: "emerald" },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a1625]/95 backdrop-blur-xl overflow-hidden p-5">
      <h4 className="text-sm font-bold text-white mb-4">Your Progress</h4>
      <div className="space-y-3">
        {metrics.map((m, i) => (
          <div key={m.label} className="animate-fade" style={{animationDelay:`${i*200+400}ms`}}>
            <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400">{m.label}</span>
              <span className={`font-bold tabular-nums ${m.color==="emerald"?"text-emerald-400":m.color==="red"?"text-red-400":"text-cyan-400"}`}>
                {inView ? <AnimatedNumber target={m.inverse ? m.from : m.to} suffix={m.to>10?"%":m.to>1?"R":""} inView={true} /> : "—"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-[2500ms] ease-out ${m.color==="emerald"?"bg-emerald-500/60":m.color==="red"?"bg-red-500/60":"bg-cyan-500/60"}`}
                style={{width: inView ? `${(m.to/(m.inverse?m.from:m.to))*100}%` : "0%"}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DisciplineFlow() {
  const steps = [
    { icon: Clock, label: "Pre-session", desc: "AI briefing + checklist" },
    { icon: Shield, label: "Risk check", desc: "Position size validated" },
    { icon: TrendingUp, label: "Trade", desc: "Execution tracked" },
    { icon: Brain, label: "Reflection", desc: "Emotion + lesson saved" },
    { icon: BarChart3, label: "Weekly review", desc: "Patterns + new goals" },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a1625]/95 backdrop-blur-xl overflow-hidden p-5">
      <h4 className="text-sm font-bold text-white mb-4">Discipline OS</h4>
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01] animate-fade" style={{animationDelay:`${i*200}ms`}}>
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/20 flex items-center justify-center shrink-0"><s.icon className="w-3.5 h-3.5 text-cyan-400" /></div>
            <div className="flex-1 min-w-0"><div className="text-[11px] font-semibold text-white">{s.label}</div><div className="text-[10px] text-slate-500">{s.desc}</div></div>
            {i < steps.length-1 && <ArrowRight className="w-3.5 h-3.5 text-cyan-500/30 shrink-0 hidden sm:block" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── LANDING ── */
const NAV: [string,string][] = [];

export default function Landing() {
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [menu, setMenu] = useState(false);
  const { y, pct } = useScroll();
  const s1Ref = useRef<HTMLDivElement>(null); const s1InView = useInView(s1Ref, 0.2);
  const s2Ref = useRef<HTMLDivElement>(null); const s2InView = useInView(s2Ref, 0.2);
  const s3Ref = useRef<HTMLDivElement>(null); const s3InView = useInView(s3Ref, 0.15);
  const s4Ref = useRef<HTMLDivElement>(null); const s4InView = useInView(s4Ref, 0.15);
  const s6Ref = useRef<HTMLDivElement>(null); const s6InView = useInView(s6Ref, 0.2);

  const open = (m: "login" | "signup", plan?: string) => { setMenu(false); setAuthMode(m); setAuthPlan(plan); setAuth(true); };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 60% at 60% -10%,rgba(6,182,212,.08),transparent 60%),radial-gradient(ellipse 50% 50% at 90% 60%,rgba(99,102,241,.05),transparent 55%)" }} />

      <header className={`z-50 fixed inset-x-0 top-0 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 20 ? "bg-[#060d16]/90 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/30"}`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}>
        <div className="scroll-bar absolute inset-x-0 top-0 h-[2px]" style={{ transform: `scaleX(${pct})` }} />
        <div className="mx-auto flex h-[56px] md:h-[62px] max-w-[1400px] items-center justify-between px-4 md:px-6">
          <a href="#" className="flex items-center gap-2.5"><img src={logoSrc} alt="TradeVault" width={28} height={28} className="h-7 w-7 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]" /><span className="font-display font-extrabold tracking-[-0.04em] text-white leading-none hidden sm:block text-[1.15rem]">TradeVault</span></a>
          <button onClick={() => open("signup")} className="btn-primary px-4 sm:px-6">Start Free</button>
        </div>
      </header>

      <main className="relative z-10">
        {/* ═══ SCREEN 1 · IMPACT ═══ */}
        <section ref={s1Ref} className="hero-mesh relative min-h-screen flex items-center py-20 lg:py-0">
          <div className="mx-auto max-w-[1300px] px-5 lg:px-8 w-full">
            <div className="grid lg:grid-cols-[1fr_1.1fr] items-center gap-10 lg:gap-16">
              <div className="text-center lg:text-left max-w-[520px] mx-auto lg:mx-0">
                <div className={`fade-up inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300 mb-7 ${s1InView ? "opacity-100" : "opacity-0"}`} style={{transition:"opacity 0.6s 0.2s"}}>
                  <span className="ping-dot relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" /> AI Trading Coach
                </div>
                <h1 className={`font-display text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-white transition-all duration-700 ${s1InView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                  Stop guessing<br />
                  <span className="text-gradient">why you lose.</span>
                </h1>
                <p className={`mt-5 text-base sm:text-lg leading-7 text-slate-400 transition-all duration-700 delay-200 ${s1InView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                  TradeVault reads your trading history, finds the patterns you don't see, and turns everything into a personal coach that helps you trade with more discipline.
                </p>
                <div className={`mt-7 flex flex-col sm:flex-row items-center gap-3 lg:justify-start transition-all duration-700 delay-300 ${s1InView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                  <button onClick={() => open("signup")} className="btn-primary px-8 py-4 text-[.95rem]">Start Free — €0 <ArrowRight className="w-4 h-4" /></button>
                  <span className="text-xs text-slate-500">No credit card required</span>
                </div>
              </div>
              <div className={`transition-all duration-1000 delay-400 ${s1InView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
                <LiveDashboard inView={s1InView} />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SCREEN 2 · PROBLEM + RECOGNITION ═══ */}
        <section ref={s2Ref} className="relative border-t border-white/[.06] min-h-screen flex items-center py-20 lg:py-0 bg-[#080f1b]/80">
          <div className="mx-auto max-w-[900px] px-5 lg:px-8 text-center w-full">
            <h2 className={`font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.14] transition-all duration-700 ${s2InView ? "opacity-100" : "opacity-0"}`}>
              Your journal records.<br />
              <span className="text-slate-500">TradeVault understands.</span>
            </h2>
            <p className={`mt-5 text-slate-400 text-base max-w-lg mx-auto transition-all duration-700 delay-300 ${s2InView ? "opacity-100" : "opacity-0"}`}>
              You have hundreds of trades. You know your win rate. But you still don't know WHY you keep repeating the same mistakes.
            </p>
            <div className="mt-12 max-w-sm mx-auto">
              {[
                { label: "LOSS", color: "text-red-400", delay: 600 },
                { label: "LOSS", color: "text-red-400", delay: 900 },
                { label: "WIN", color: "text-emerald-400", delay: 1200 },
                { label: "LOSS", color: "text-red-400", delay: 1500 },
                { label: "WIN", color: "text-emerald-400", delay: 1800 },
                { label: "LOSS", color: "text-red-400", delay: 2100 },
              ].map((t, i) => (
                <div key={i} className={`inline-flex items-center gap-2 px-3 py-1.5 mx-1 my-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[11px] font-bold transition-all duration-500 ${t.color} ${s2InView ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}
                  style={{ transitionDelay: `${t.delay}ms` }}>{t.label}</div>
              ))}
            </div>
            <div className={`mt-8 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.03] px-5 py-4 max-w-md mx-auto transition-all duration-700 delay-[2500ms] ${s2InView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <p className="text-sm text-cyan-200 font-medium">Pattern detected:</p>
              <p className="text-[13px] text-slate-300 mt-1 leading-relaxed">43% of your losses happen after your first losing trade of the day.</p>
              <p className="text-[11px] text-slate-500 mt-2">The problem might not be your setup. It might be what happens AFTER the setup.</p>
            </div>
          </div>
        </section>

        {/* ═══ SCREEN 3 · INTERACTIVE EXPLORER ═══ */}
        <section ref={s3Ref} className="relative border-t border-white/[.06] min-h-screen flex items-center py-16 lg:py-0">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8 w-full">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className={`font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.14] transition-all duration-700 ${s3InView ? "opacity-100" : "opacity-0"}`}>
                  Explore what TradeVault<br />
                  <span className="text-gradient">can detect.</span>
                </h2>
                <p className={`mt-4 text-slate-400 text-sm transition-all duration-700 delay-200 ${s3InView ? "opacity-100" : "opacity-0"}`}>Select a category to see what the product reveals.</p>
              </div>
              <div className={`transition-all duration-1000 delay-400 ${s3InView ? "opacity-100" : "opacity-0"}`}>
                <BehavioralPanel inView={s3InView} />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SCREEN 4 · JARVIS ═══ */}
        <section ref={s4Ref} className="relative border-t border-white/[.06] min-h-screen flex items-center py-16 lg:py-0 bg-[#080f1b]/70">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%,rgba(34,211,238,.07),transparent 65%)" }} />
          <div className="relative mx-auto max-w-[1100px] px-5 lg:px-8 w-full">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-6 transition-all duration-700 ${s4InView ? "opacity-100" : "opacity-0"}`}>Meet Jarvis</div>
                <h2 className={`font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.14] transition-all duration-700 ${s4InView ? "opacity-100" : "opacity-0"}`}>
                  A coach that knows<br />
                  <span className="text-gradient">your entire history.</span>
                </h2>
                <p className={`mt-4 text-slate-400 text-sm max-w-md transition-all duration-700 delay-200 ${s4InView ? "opacity-100" : "opacity-0"}`}>
                  Not a generic chatbot. Jarvis analyzes your actual trades and gives you advice based on YOUR patterns, YOUR mistakes, YOUR progress.
                </p>
                <div className={`mt-6 space-y-2 transition-all duration-700 delay-300 ${s4InView ? "opacity-100" : "opacity-0"}`}>
                  {["Knows your best setups and worst sessions","Detects behavioral patterns before you repeat them","Builds a daily mission based on recent performance","Remembers every lesson and tracks your improvement"].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-slate-300"><Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />{item}</div>
                  ))}
                </div>
              </div>
              <div className={`transition-all duration-1000 delay-400 ${s4InView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
                <JarvisPanel inView={s4InView} />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SCREEN 5 · DISCIPLINE + PROGRESS ═══ */}
        <section className="relative border-t border-white/[.06] min-h-screen flex items-center py-16 lg:py-0">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8 w-full">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <DisciplineFlow />
              <ProgressPanel inView={true} />
            </div>
          </div>
        </section>

        {/* ═══ SCREEN 6 · PRICING ═══ */}
        <section ref={s6Ref} className="section-mesh relative border-t border-white/[.06] min-h-screen flex items-center py-16 lg:py-0">
          <div className="mx-auto max-w-[1000px] px-5 lg:px-8 w-full">
            <div className={`text-center mb-12 transition-all duration-700 ${s6InView ? "opacity-100" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.04] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-400/80 mb-5">Pricing</div>
              <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.12]">
                Pays for itself<br /><span className="text-gradient">in one good trade.</span>
              </h2>
            </div>
            <div className={`grid gap-4 lg:grid-cols-3 max-w-4xl mx-auto transition-all duration-700 delay-200 ${s6InView ? "opacity-100" : "opacity-0"}`}>
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Free</p>
                <div className="mt-4"><span className="font-display text-4xl font-extrabold text-white">€0</span><span className="text-sm text-slate-500 ml-1">/ forever</span></div>
                <p className="mt-3 text-sm text-slate-500">Start understanding your trading.</p>
                <button onClick={() => open("signup")} className="btn-ghost w-full mt-6">Start Free</button>
                <div className="mt-6 space-y-2 text-xs text-slate-400">
                  {["30 trades/month","Dashboard & equity","Pre-market checklist","Basic statistics"].map((f,i) => (<div key={i} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />{f}</div>))}
                </div>
              </div>
              <div className="flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] p-7 lg:-my-6 lg:py-12">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">Pro Annual</p><span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#03131b]">2 months free</span></div>
                <div className="mt-4"><span className="font-display text-5xl font-extrabold text-white">{eur(Math.round(YEARLY_PER_MONTH*100)/100)}</span><span className="text-sm text-slate-400 ml-1">/ month</span></div>
                <p className="mt-2 text-xs text-slate-300">{eur(YEARLY_EUR)} billed yearly <span className="text-slate-500 line-through ml-1">{eur(YEARLY_FULL_PRICE)}</span></p>
                <p className="mt-2 text-[11px] font-bold text-emerald-300">Save {eur(YEARLY_SAVING)}/year</p>
                <button onClick={() => open("signup","Pro Annuel — 14 jours d'essai")} className="btn-primary w-full mt-5 py-3 text-sm">Start — 14 days free</button>
                <p className="mt-2 text-center text-[10px] text-slate-500">No card required</p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">Everything in Free +</p>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  {["Jarvis AI Coach · unlimited","Unlimited trades & accounts","20+ quantitative metrics","Error & pattern detection","Monthly automated reports"].map((f,i) => (<div key={i} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />{f}</div>))}
                </div>
              </div>
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Pro Monthly</p>
                <div className="mt-4"><span className="font-display text-4xl font-extrabold text-slate-200">{eur(MONTHLY_EUR)}</span><span className="text-sm text-slate-500 ml-1">/ month</span></div>
                <p className="mt-3 text-sm text-slate-500">Full Pro, monthly billing.</p>
                <button onClick={() => open("signup","Pro Mensuel — 14 jours d'essai")} className="btn-ghost w-full mt-6">Go Monthly</button>
                <div className="mt-6 space-y-2 text-xs text-slate-400">
                  {["Jarvis AI Coach","Unlimited trades","20+ metrics","Monthly reports"].map((f,i) => (<div key={i} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />{f}</div>))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SCREEN 7 · FINAL CTA ═══ */}
        <section className="relative overflow-hidden border-t border-white/[.06] min-h-[60vh] flex items-center justify-center py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_120%,rgba(34,211,238,.1),transparent_60%)]" />
          <div className="relative mx-auto max-w-[600px] px-5 text-center">
            <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-6" />
            <h2 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.1]">
              Your trades already contain<br />the answers.
            </h2>
            <p className="mt-4 text-slate-400 text-lg">TradeVault helps you find them.</p>
            <button onClick={() => open("signup")} className="btn-primary px-12 py-4 mt-8 text-base">Start Free — €0 forever</button>
            <p className="mt-3 text-xs text-slate-600">No credit card · Cancel anytime</p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[.06] bg-[#050b14] py-8">
        <div className="mx-auto max-w-[1200px] px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} alt="TradeVault" width={22} height={22} className="h-5.5 w-5.5 object-contain" />
            <span className="font-display font-bold text-sm text-white">TradeVault</span>
          </div>
          <div className="flex items-center gap-5 text-[11px] text-slate-500">
            <a href="/terms" className="hover:text-slate-300 transition">Terms</a>
            <a href="/privacy" className="hover:text-slate-300 transition">Privacy</a>
            <a href="/contact" className="hover:text-slate-300 transition">Contact</a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-cyan-300 transition">{SUPPORT_EMAIL}</a>
          </div>
          <span className="text-[10px] text-slate-700">© {new Date().getFullYear()}</span>
        </div>
      </footer>

      <CookieConsent />
      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
