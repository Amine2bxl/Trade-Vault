import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Shield, TrendingUp, Brain, BarChart3, Sparkles, Check, Target, Zap } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { eur, MONTHLY_EUR, YEARLY_EUR, YEARLY_FULL_PRICE, YEARLY_PER_MONTH, YEARLY_SAVING } from "../utils/pricing";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

/* ─────────────────── PRODUCT PANELS ─────────────────── */
function DashboardPanel() {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0a1525] overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400/80" /><span className="text-[11px] font-semibold text-slate-300">Equity Curve</span></div>
        <span className="text-[11px] font-bold text-cyan-300">+16.9%</span>
      </div>
      <div className="p-4">
        <div className="text-[1.5rem] font-extrabold text-emerald-400 font-mono tracking-tight">+$4,218.50</div>
        <div className="text-[10px] text-slate-500 mt-0.5 mb-4">248 trades analyzed</div>
        <svg viewBox="0 0 280 80" className="w-full h-20" preserveAspectRatio="none">
          <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22d3ee" stopOpacity=".15"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>
          <polygon points="0,68 40,54 80,62 120,36 160,48 200,22 240,34 280,10 280,80 0,80" fill="url(#dg)"/>
          <polyline points="0,68 40,54 80,62 120,36 160,48 200,22 240,34 280,10" fill="none" stroke="#22d3ee" strokeWidth="2"/>
        </svg>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[{l:"Win Rate",v:"64%"},{l:"Profit Factor",v:"2.31"},{l:"Sharpe",v:"1.84"}].map(o => (
            <div key={o.l} className="text-center"><div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">{o.l}</div><div className="text-xs font-bold text-cyan-300">{o.v}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JarvisPanel() {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0a1525] overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05]">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
        <div><div className="text-[11px] font-bold text-white">Jarvis</div><div className="text-[9px] text-emerald-400 font-medium">analyzing your trades</div></div>
      </div>
      <div className="p-4 space-y-3">
        <div className="max-w-[88%] rounded-xl bg-cyan-400/[0.04] border border-cyan-400/10 px-3.5 py-3 text-[12px] text-slate-200 leading-relaxed">
          After a winning session, your risk increases by <span className="text-red-300 font-bold">42%</span>. Losses after wins are <span className="text-red-300 font-bold">2.4× larger</span> than normal.
        </div>
        <div className="max-w-[88%] rounded-xl bg-cyan-400/[0.04] border border-cyan-400/10 px-3.5 py-3 text-[12px] text-slate-200 leading-relaxed">
          This is a confidence bias — not a strategy problem. Stopping after 1 loss would save you <span className="text-emerald-300 font-bold">~$1,800/month</span>.
        </div>
        <div className="rounded-xl bg-emerald-400/[0.05] border border-emerald-400/15 px-3.5 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Today's mission</div>
          <div className="text-[12px] text-slate-200">2 trades max · stop after 1 loss · fixed size</div>
        </div>
      </div>
    </div>
  );
}

function MistakesPanel() {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0a1525] overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <span className="text-[11px] font-semibold text-slate-300">Top Mistakes</span>
        <span className="text-[9px] font-bold uppercase text-slate-500">This month</span>
      </div>
      <div className="p-4 space-y-2">
        {[{name:"Revenge trading",count:7,cost:"-$1,240",pct:42},{name:"FOMO entries",count:12,cost:"-$890",pct:28},{name:"Overtrading",count:9,cost:"-$670",pct:18}].map((m,i) => (
          <div key={m.name} className="flex items-center justify-between py-1.5">
            <div className="flex-1 min-w-0"><div className="text-[11px] font-medium text-slate-200">{m.name}</div><div className="text-[10px] text-slate-500">{m.count}× this month</div></div>
            <div className="text-right ml-3"><div className="text-[11px] font-bold text-red-400 tabular-nums">{m.cost}</div><div className="flex items-center gap-1"><div className="w-12 h-1 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full rounded-full bg-red-500/60" style={{width:`${m.pct}%`}} /></div><span className="text-[9px] text-slate-600">{m.pct}%</span></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressPanel() {
  const items = [
    { label: "Discipline Score", from: 61, to: 87 },
    { label: "Plan Adherence", from: 64, to: 87 },
    { label: "Revenge Trading", from: 12, to: 2, down: true },
    { label: "Avg R-Multiple", from: 1.2, to: 2.1 },
  ];
  return (
    <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0a1525] overflow-hidden shadow-2xl shadow-black/40">
      <div className="px-4 py-3 border-b border-white/[0.05]"><span className="text-[11px] font-semibold text-slate-300">Your Progress</span></div>
      <div className="p-4 space-y-3">
        {items.map((m, i) => (
          <div key={m.label} className="animate-fade" style={{animationDelay:`${i*200}ms`}}>
            <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400">{m.label}</span>
              <span className={`font-bold tabular-nums ${m.down?"text-emerald-400":"text-cyan-400"}`}>{m.down?m.from:m.to}{typeof m.to==="number"&&m.to>10?"%":""}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className={`h-full rounded-full ${m.down?"bg-emerald-500/60":"bg-cyan-500/60"}`} style={{width:`${m.down?((12-m.from)/12*100):((m.from/90)*100)}%`}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── LANDING ─────────────────── */
export default function Landing() {
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [y, setY] = useState(0);
  useEffect(() => { const h = () => setY(window.scrollY); h(); window.addEventListener("scroll", h, {passive:true}); return () => window.removeEventListener("scroll", h); }, []);

  const open = (m: "login" | "signup", plan?: string) => { setAuthMode(m); setAuthPlan(plan); setAuth(true); };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100">
      <header className={`z-50 fixed inset-x-0 top-0 border-b border-white/[.06] backdrop-blur-xl transition-all duration-300 ${y > 20 ? "bg-[#060d16]/95" : "bg-[#060d16]/50"}`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}>
        <div className="mx-auto flex h-14 md:h-16 max-w-[1400px] items-center justify-between px-5 md:px-8">
          <a href="#" className="flex items-center gap-2.5"><img src={logoSrc} alt="TradeVault" width={28} height={28} className="h-7 w-7 object-contain" /><span className="font-display font-bold text-white hidden sm:block text-lg tracking-tight">TradeVault</span></a>
          <button onClick={() => open("signup")} className="btn-primary px-4 py-2 sm:px-5 text-sm">Start Free</button>
        </div>
      </header>

      <main>
        {/* ═══ 1 — HERO ═══ */}
        <section className="min-h-screen flex items-center pt-14 md:pt-16">
          <div className="mx-auto max-w-[1300px] px-5 md:px-8 w-full grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-16 items-center">
            <div className="max-w-[540px] mx-auto lg:mx-0 text-center lg:text-left">
              <h1 className="font-display text-[2.2rem] sm:text-[2.8rem] md:text-[3.5rem] font-extrabold leading-[1.06] tracking-[-0.04em] text-white">
                Your trading data.<br />
                <span className="text-gradient">Coaching you back.</span>
              </h1>
              <p className="mt-5 text-[15px] sm:text-base text-slate-400 leading-relaxed max-w-[460px]">
                TradeVault reads your history, finds the patterns you don't see, and turns everything into a personal AI coach.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                <button onClick={() => open("signup")} className="btn-primary px-7 py-3.5 text-[15px]">Start Free — €0 <ArrowRight className="w-4 h-4" /></button>
                <span className="text-[13px] text-slate-500">No credit card</span>
              </div>
              <a href="https://www.trustpilot.com/review/tradevaultt.vercel.app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 mt-6 rounded-full border border-white/[.07] bg-white/[.02] py-1.5 pl-2 pr-3.5 transition hover:border-[#00b67a]/30 hover:bg-white/[.04]">
                <span className="flex gap-0.5">{[0,1,2,3,4].map(i => (<span key={i} className="grid h-4 w-4 place-items-center rounded-[2px] bg-[#00b67a]"><Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" /></span>))}</span>
                <span className="text-xs font-medium text-slate-400">Trustpilot</span>
              </a>
            </div>
            <div className="max-w-[440px] mx-auto w-full">
              <DashboardPanel />
            </div>
          </div>
        </section>

        {/* ═══ 2 — THE PROBLEM ═══ */}
        <section className="min-h-screen flex items-center border-t border-white/[0.04]">
          <div className="mx-auto max-w-[1300px] px-5 md:px-8 w-full grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
                You're not losing because of your strategy.
              </h2>
              <p className="mt-4 text-[15px] text-slate-400 leading-relaxed max-w-[460px]">
                You're losing because of what happens after the setup. The behaviors you don't see. The patterns you repeat. The emotions that take over.
              </p>
            </div>
            <div className="max-w-[440px] mx-auto w-full">
              <MistakesPanel />
            </div>
          </div>
        </section>

        {/* ═══ 3 — JARVIS ═══ */}
        <section className="min-h-screen flex items-center border-t border-white/[0.04] bg-[#080f1b]/60">
          <div className="mx-auto max-w-[1300px] px-5 md:px-8 w-full grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-2 lg:order-1 max-w-[440px] mx-auto w-full">
              <JarvisPanel />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
                A coach that knows how you trade.
              </h2>
              <p className="mt-4 text-[15px] text-slate-400 leading-relaxed max-w-[460px]">
                Jarvis doesn't give generic advice. It analyzes your actual trades and tells you exactly what to improve — based on your data, your patterns, your mistakes.
              </p>
              <div className="mt-8 space-y-3">
                {["Detects behavioral patterns automatically","Builds a daily mission from your data","Remembers every lesson and tracks progress"].map(t => (
                  <div key={t} className="flex items-center gap-2.5 text-sm text-slate-300"><Check className="w-4 h-4 text-cyan-400 shrink-0" />{t}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 4 — DISCIPLINE ═══ */}
        <section className="min-h-screen flex items-center border-t border-white/[0.04]">
          <div className="mx-auto max-w-[1300px] px-5 md:px-8 w-full grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
                Trade with a system.<br />
                <span className="text-gradient">Not with your emotions.</span>
              </h2>
              <p className="mt-4 text-[15px] text-slate-400 leading-relaxed max-w-[460px]">
                Before every trade: checklist, readiness score, risk validation. During: live mistake detection and discipline alerts. After: reflection, lessons, AI feedback.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {[{icon:Target,label:"BEFORE",desc:"Checklist + risk check"},{icon:Shield,label:"DURING",desc:"Live error detection"},{icon:Brain,label:"AFTER",desc:"Reflection + AI feedback"}].map(s => (
                  <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-3">
                    <s.icon className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 mb-0.5">{s.label}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="max-w-[440px] mx-auto w-full">
              <ProgressPanel />
            </div>
          </div>
        </section>

        {/* ═══ 5 — ANALYTICS ═══ */}
        <section className="min-h-screen flex items-center border-t border-white/[0.04] bg-[#080f1b]/60">
          <div className="mx-auto max-w-[1300px] px-5 md:px-8 w-full text-center">
            <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
              Numbers that actually<br />
              <span className="text-gradient">tell you something.</span>
            </h2>
            <p className="mt-4 text-[15px] text-slate-400 max-w-[500px] mx-auto">20+ metrics. All computed from your data. Not market averages.</p>
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[900px] mx-auto">
              {[{l:"Win Rate",v:"64%"},{l:"Profit Factor",v:"2.31"},{l:"Expectancy",v:"+€18.40"},{l:"Sharpe Ratio",v:"1.84"},
                {l:"Max Drawdown",v:"-€2,840"},{l:"Avg R",v:"+1.6R"},{l:"Kelly Optimal",v:"2.4%"},{l:"Consistency",v:"87/100"}].map(o => (
                <div key={o.l} className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 text-center"><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{o.l}</div><div className="font-display text-lg font-extrabold text-white tabular-nums">{o.v}</div></div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 6 — PRICING ═══ */}
        <section className="min-h-screen flex items-center border-t border-white/[0.04]">
          <div className="mx-auto max-w-[1000px] px-5 md:px-8 w-full">
            <div className="text-center mb-10">
              <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
                Pays for itself in one trade.
              </h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-3 max-w-4xl mx-auto">
              {[
                { name:"Free", price:"€0", period:"forever", desc:"Start understanding your trading.", btn:"Start Free", features:["30 trades/month","Dashboard & equity","Pre-market checklist","Basic statistics"] },
                { name:"Pro Annual", price:eur(Math.round(YEARLY_PER_MONTH*100)/100), period:"/ month", desc:"Build a coach that understands you.", btn:"Start — 14 days free", features:["Jarvis AI Coach · unlimited","Unlimited trades & accounts","20+ quantitative metrics","Error & pattern detection","Monthly automated reports","Position size calculator"], highlight:true, sub:`${eur(YEARLY_EUR)} billed yearly · Save ${eur(YEARLY_SAVING)}` },
                { name:"Pro Monthly", price:eur(MONTHLY_EUR), period:"/ month", desc:"Full Pro, monthly billing.", btn:"Go Monthly", features:["Jarvis AI Coach","Unlimited trades","20+ metrics","Monthly reports"] },
              ].map(p => (
                <div key={p.name} className={`flex flex-col rounded-2xl border p-7 ${p.highlight ? "plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.45),rgba(7,14,24,.92)_60%)] border-cyan-400/30 lg:-my-6 lg:py-12" : "border-white/[.06] bg-white/[.015]"}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-[.15em] ${p.highlight?"text-cyan-300":"text-slate-400"}`}>{p.name}</p>
                  <div className="mt-3"><span className="font-display text-[2.5rem] font-extrabold text-white leading-none">{p.price}</span><span className="text-sm text-slate-500 ml-1">{p.period}</span></div>
                  {p.sub && <p className="mt-1 text-[12px] text-slate-400">{p.sub}</p>}
                  <p className="mt-2 text-sm text-slate-500">{p.desc}</p>
                  <button onClick={() => open("signup", p.name)} className={`w-full mt-6 py-3 rounded-xl text-sm font-bold ${p.highlight ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20" : "bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"}`}>{p.btn}</button>
                  <div className="mt-6 space-y-2">
                    {p.features.map((f,i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-slate-400"><Check className={`w-3.5 h-3.5 shrink-0 ${p.highlight?"text-cyan-400":"text-slate-500"}`} />{f}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 7 — CTA ═══ */}
        <section className="min-h-[60vh] flex items-center justify-center border-t border-white/[0.04]">
          <div className="text-center max-w-[560px] px-5">
            <h2 className="font-display text-[2rem] sm:text-[2.8rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
              Your trades already contain<br />the answers.
            </h2>
            <p className="mt-4 text-[15px] text-slate-400">TradeVault helps you find them.</p>
            <button onClick={() => open("signup")} className="btn-primary px-10 py-4 mt-8 text-base">Start Free — €0 forever</button>
            <p className="mt-3 text-xs text-slate-600">No credit card · Cancel anytime</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.04] bg-[#050b14] py-6">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2"><img src={logoSrc} alt="" width={20} height={20} className="h-5 w-5 opacity-60" /><span className="text-xs font-medium text-slate-500">TradeVault</span></div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <a href="/terms" className="hover:text-slate-400 transition">Terms</a><a href="/privacy" className="hover:text-slate-400 transition">Privacy</a>
            <a href="/contact" className="hover:text-slate-400 transition">Contact</a><a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-cyan-400 transition">{SUPPORT_EMAIL}</a>
          </div>
          <span className="text-[10px] text-slate-700">© {new Date().getFullYear()}</span>
        </div>
      </footer>

      <CookieConsent />
      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
