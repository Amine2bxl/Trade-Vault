import { PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { Play, Compass, Twitter, Linkedin, Instagram, Facebook, Youtube, ArrowRight, Bot, Shield, TrendingUp, Brain, Target, Layers } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { eur, MONTHLY_EUR, YEARLY_EUR, YEARLY_FULL_PRICE, YEARLY_PER_MONTH, YEARLY_SAVING } from "../utils/pricing";
import { SUPPORT_EMAIL } from "../types";
import { CookieConsent } from "../components/CookieConsent";
import "./landing.css";

/* ── LOGO ── */
function Logo({ compact = false }: { compact?: boolean }) {
  const s = compact ? 28 : 34;
  return (
    <a href="#" className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm">
      <img src={logoSrc} alt="TradeVault" width={s} height={s} className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]`} />
      <span className={`font-display font-extrabold tracking-[-0.04em] text-[#ffffff] leading-none hidden sm:block ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}>TradeVault</span>
    </a>
  );
}

/* ── CURSOR GLOW ── */
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

/* ── HOOKS ── */
function useScroll() {
  const [y, setY] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const h = () => { const sy = window.scrollY; setY(sy); const m = document.documentElement.scrollHeight - window.innerHeight; setPct(m > 0 ? Math.min(sy / m, 1) : 0); };
    h(); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h);
  }, []);
  return { y, pct };
}
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("reveal-visible"); io.unobserve(e.target); } }), { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── SECTION HEADER ── */
function SectionHead({ tag, title, sub, center = true }: { tag: string; title: React.ReactNode; sub?: string; center?: boolean }) {
  return (
    <div className={`reveal ${center ? "text-center mx-auto" : ""} max-w-2xl mb-16`}>
      <div className="tag-label inline-flex mb-4">{tag}</div>
      <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.04em] text-white leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-slate-400 leading-7">{sub}</p>}
    </div>
  );
}

/* ── NAV ITEMS ── */
const NAV: [string, string][] = [
  ["Problème", "problem"],
  ["Coach IA", "ai"],
  ["Système", "discipline"],
  ["Analytics", "analytics"],
  ["Tarifs", "pricing"],
];

/* ── DATA ── */
const PROBLEMS = [
  { n: "err" as IName, t: "Tu journalises, mais tu ne comprends pas pourquoi tu perds", d: "Sans mémoire structurée, tu répètes les mêmes erreurs sans jamais les corriger." },
  { n: "heart" as IName, t: "L'émotion prend le dessus au pire moment", d: "FOMO, revenge trading, sizing au feeling : les décisions émotionnelles détruisent les comptes." },
  { n: "compass" as IName, t: "Tu changes de stratégie au hasard", d: "Sans feedback objectif, tu navigues à l'aveugle et ne sais jamais ce qui fonctionne vraiment." },
];

const JARVIS_STEPS = [
  { icon: Brain, label: "Avant la session", desc: "Checklist pré-market, objectif du jour, briefing IA personnalisé basé sur ton historique." },
  { icon: Shield, label: "Pendant le trade", desc: "Analyse en temps réel de tes patterns. Alerte quand tu répètes une erreur connue." },
  { icon: TrendingUp, label: "Après la session", desc: "Feedback immédiat sur ta discipline, tes points forts et ce que tu dois améliorer demain." },
  { icon: Layers, label: "Chaque semaine", desc: "Revue complète de tes progrès. Nouveaux objectifs calibrés sur tes données réelles." },
];

const ANALYTICS_CATEGORIES = [
  { label: "Performance", items: ["Win rate, Profit Factor, Expectancy", "Sharpe & Sortino ratios", "Courbe d'equity interactive", "Drawdown analysis"] },
  { label: "Comportement", items: ["Détection automatique des erreurs", "Score de discipline par session", "Patterns émotionnels identifiés", "Adhérence à ton plan de trading"] },
  { label: "Profondeur", items: ["Analyse par setup et par session", "Heatmap de performance horaire", "Saisonnalité de tes résultats", "Statistiques par jour de la semaine"] },
];

/* ── LANDING ── */
export default function Landing() {
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [menu, setMenu] = useState(false);
  const [activeSec, setActiveSec] = useState("");
  const { y, pct } = useScroll();
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
    return () => { window.removeEventListener("scroll", onScroll); if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, []);

  const open = (mode: "login" | "signup", plan?: string) => { setMenu(false); setAuthMode(mode); setAuthPlan(plan); setAuth(true); };
  const go = (id: string) => {
    setMenu(false);
    setActiveSec(id);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollLockRef.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    scrollTimerRef.current = setTimeout(() => { scrollLockRef.current = false; }, 1000);
  };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[#060d16] text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <CursorGlow />
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 55% at 60% -10%,rgba(6,182,212,.09),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.07),transparent 55%)" }} />

      {/* ── NAV ── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 10 ? "bg-[#060d16]/85 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/40"}`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}>
        <div className="scroll-bar absolute inset-x-0 top-0 h-[2px]" style={{ transform: `scaleX(${pct})` }} />
        <div className="relative mx-auto flex h-[60px] md:h-[66px] max-w-[1600px] items-center justify-between gap-3 px-4 md:px-5 lg:px-8">
          <Logo />
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border border-white/[.08] bg-white/[.03] p-1 backdrop-blur-md xl:flex">
            {NAV.map(([l, id]) => {
              const on = activeSec === id;
              return (
                <button key={id} onClick={() => go(id)} className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${on ? "bg-cyan-400/[.14] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.28)]" : "text-slate-400 hover:bg-cyan-400/[.07] hover:text-cyan-100"}`}>
                  {l}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center justify-end gap-2">
            <a href="/demo" className="btn-ghost hidden px-4 sm:inline-flex"><Play className="w-3.5 h-3.5" /> Démo</a>
            <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-3.5 sm:px-4">Essai gratuit <Icon n="arrow" cls="h-4 w-4 hidden sm:inline" /></button>
            <button onClick={() => setMenu(!menu)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-200 xl:hidden" aria-label="Menu">
              <Icon n={menu ? "close" : "menu"} cls="h-5 w-5" />
            </button>
          </div>
        </div>
        {menu && (
          <div className="xl:hidden border-t border-white/[.07] bg-[#070f1a]/98 backdrop-blur-xl px-5 py-4">
            <div className="flex flex-col">
              {NAV.map(([l, id]) => (
                <button key={id} onClick={() => go(id)} className={`mobile-nav-link ${activeSec === id ? "text-cyan-300" : ""}`}>{l}</button>
              ))}
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary mt-4 w-full">Essai gratuit <Icon n="arrow" cls="h-4 w-4" /></button>
              <a href="/demo" className="btn-ghost mt-2.5 w-full"><Play className="w-3.5 h-3.5" /> Démo</a>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ── 1 · HERO ── */}
        <section className="hero-mesh relative overflow-hidden pt-[100px] pb-24 lg:pt-[130px] lg:pb-32 text-center">
          <div className="mx-auto max-w-[900px] px-5 lg:px-8">
            <div className="fade-up inline-flex items-center gap-2.5 rounded-full border border-cyan-400/22 bg-cyan-400/[.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-cyan-300 mb-8">
              <span className="ping-dot relative inline-flex h-2 w-2 rounded-full bg-cyan-400" /> TradeVault · Ton coach IA de trading
            </div>
            <h1 className="fade-up d1 font-display text-[clamp(2.8rem,6vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-white">
              Stop trading <span className="text-gradient">blindly.</span>
            </h1>
            <p className="fade-up d2 mt-6 text-lg sm:text-xl leading-8 text-slate-400 max-w-[620px] mx-auto">
              TradeVault transforme ton historique de trading en un coach IA qui analyse tes erreurs, détecte tes patterns et t'aide à devenir le trader discipliné que tu veux être.
            </p>
            <div className="fade-up d3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-8 py-4 text-[.95rem]">
                Commencer gratuitement <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <a href="/demo" className="btn-ghost px-6 py-4 text-[.95rem]"><Compass className="w-4 h-4" /> Voir la démo</a>
            </div>
            <div className="fade-up d4 mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {["Sans carte bancaire", "Annulation en 1 clic", "Setup en 2 min"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500"><Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />{t}</span>
              ))}
            </div>
            <a href="https://www.trustpilot.com/review/tradevaultt.vercel.app" target="_blank" rel="noreferrer"
              className="fade-up d4 mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/[.08] bg-white/[.03] py-1.5 pl-2 pr-3.5 transition hover:border-[#00b67a]/40 hover:bg-white/[.05]">
              <span className="flex gap-0.5">{[0,1,2,3,4].map((i) => (<span key={i} className="grid h-4 w-4 place-items-center rounded-[2px] bg-[#00b67a]"><Icon n="star" cls="h-2.5 w-2.5 text-white fill-white" /></span>))}</span>
              <span className="text-xs font-semibold text-slate-300">Avis vérifiés sur <span className="text-white font-bold">Trustpilot</span></span>
            </a>
          </div>
        </section>

        {/* ── 2 · PROBLÈME ── */}
        <section id="problem" className="relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <SectionHead tag="Le vrai problème" title={<>Ce n'est pas ta stratégie<br /><span className="text-slate-500">qui te fait perdre.</span></>}
              sub="Le vrai tueur de comptes, c'est l'absence de feedback objectif et de mémoire structurée." />
            <div className="grid gap-4 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <article key={p.t} className="reveal rounded-2xl border border-red-400/12 bg-red-400/[.03] p-6 md:p-7 transition-colors hover:border-red-400/25">
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-red-400/20 bg-red-400/[.07] text-red-400 mb-5"><Icon n={p.n} cls="h-5 w-5" /></div>
                  <h3 className="font-display text-base font-bold text-white">{p.t}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3 · LA DIFFÉRENCE — introduit Jarvis ── */}
        <section id="ai" className="relative border-t border-white/[.06] overflow-hidden py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 45% at 50% 30%,rgba(34,211,238,.08),transparent 60%)" }} />
          <div className="relative mx-auto max-w-[1100px] px-5 lg:px-8">
            <SectionHead tag="La différence" title={<>Ton historique devient<br /><span className="text-gradient">ton coach personnel.</span></>}
              sub="TradeVault n'est pas un simple journal. C'est une IA qui lit chacun de tes trades, détecte ce qui te coûte de l'argent, et te dit exactement quoi améliorer." />
            <div className="reveal text-center">
              <div className="inline-flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm font-semibold text-slate-400">
                <span className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">📊 Tes trades</span>
                <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">🔍 Analyse IA</span>
                <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">🧠 Patterns détectés</span>
                <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">🎯 Plan d'action</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4 · JARVIS — le hero product ── */}
        <section className="relative border-t border-white/[.06] py-24 lg:py-28 bg-[#070f1a]/60">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <SectionHead tag="Coach IA" title={<>Meet <span className="text-gradient">Jarvis.</span></>}
              sub="Pas un chatbot générique. Un coach qui connaît chacun de tes trades et qui te parle de TES erreurs, TES progrès, TES objectifs." />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {JARVIS_STEPS.map(({ icon: Ic, label, desc }, i) => (
                <article key={label} className="reveal rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6 transition-colors hover:border-cyan-400/20" style={{ transitionDelay: `${i * 70}ms` }}>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/20 text-cyan-400 mb-4"><Ic className="w-5 h-5" /></div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{label}</h3>
                  <p className="text-xs leading-6 text-slate-400">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5 · DISCIPLINE OS ── */}
        <section id="discipline" className="relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <SectionHead tag="Le système" title={<>Plus qu'un journal.<br /><span className="text-gradient">Un système de discipline.</span></>}
              sub="TradeVault ne se contente pas d'enregistrer ce que tu as fait. Il t'aide à contrôler ce que tu fais ensuite." />
            <div className="reveal grid gap-3 md:grid-cols-3">
              {[
                { title: "Avant le trade", items: ["Briefing IA du jour", "Checklist pré-market", "Validation du risque"] },
                { title: "Pendant la session", items: ["Détection des erreurs en direct", "Limite de pertes configurable", "Mode discipline activable"] },
                { title: "Après la session", items: ["Analyse émotionnelle", "Feedback personnalisé", "Nouveaux objectifs"] },
              ].map((col) => (
                <div key={col.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
                  <h3 className="text-sm font-bold text-white mb-3">{col.title}</h3>
                  <ul className="space-y-2">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-xs text-slate-400">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/10 text-cyan-300"><Icon n="check" cls="h-3 w-3" /></span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6 · ANALYTICS ── */}
        <section id="analytics" className="section-mesh relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
            <SectionHead tag="Analytics" title={<>Des insights que tu ne trouves<br /><span className="text-gradient">nulle part ailleurs.</span></>}
              sub="Parce que chaque métrique est calculée sur TES données, pas sur des moyennes de marché." />
            <div className="grid gap-4 md:grid-cols-3">
              {ANALYTICS_CATEGORIES.map((cat) => (
                <div key={cat.label} className="reveal rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
                  <h3 className="text-sm font-bold text-white mb-4">{cat.label}</h3>
                  <ul className="space-y-2.5">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs text-slate-400 leading-5">
                        <Icon n="check" cls="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7 · PRICING ── */}
        <section id="pricing" className="section-mesh relative border-t border-white/[.06] py-24 lg:py-28">
          <div className="mx-auto max-w-[1000px] px-5 lg:px-8">
            <SectionHead tag="Tarifs" title={<>Un investissement qui se rembourse<br /><span className="text-gradient">en un seul trade.</span></>}
              sub="Commence gratuitement. Passe en Premium quand tu es prêt." />
            <div className="reveal grid gap-4 lg:grid-cols-3">
              {/* FREE */}
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Free</p>
                <div className="mt-4 flex items-end gap-1"><span className="font-display text-4xl font-extrabold text-white">0 €</span><span className="mb-1.5 text-sm text-slate-500">/ toujours</span></div>
                <p className="mt-2 text-sm text-slate-500">Pour commencer à structurer ta discipline.</p>
                <button onClick={() => open("signup", "Plan Gratuit")} className="btn-ghost w-full mt-6">Commencer gratuitement</button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {["Journal — 30 trades / mois", "Dashboard & equity curve", "Checklist pré-market", "Statistiques de base"].map((f) => (
                    <p key={f} className="flex items-start gap-2.5 text-slate-300"><Icon n="check" cls="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{f}</p>
                  ))}
                </div>
              </div>

              {/* PRO ANNUEL */}
              <div className="flex flex-col rounded-2xl plan-popular bg-[linear-gradient(160deg,rgba(14,58,82,.55),rgba(7,14,24,.92)_60%)] p-7 lg:-my-4 lg:py-11">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">Pro · Annuel</p>
                  <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#03131b] flex items-center gap-1"><Icon n="flame" cls="h-3 w-3 fill-current" />2 mois offerts</span>
                </div>
                <div className="mt-4 flex items-end gap-1.5">
                  <span className="font-display text-5xl font-extrabold text-white">{eur(Math.round(YEARLY_PER_MONTH * 100) / 100)}</span>
                  <span className="mb-2 text-sm text-slate-400">/ mois</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{eur(YEARLY_EUR)} facturés une fois par an <span className="ml-1.5 text-slate-500 line-through">{eur(YEARLY_FULL_PRICE)}</span></p>
                <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[12px] font-bold text-emerald-300"><Icon n="check" cls="h-3.5 w-3.5" /> Tu économises {eur(YEARLY_SAVING)} / an</div>
                <button onClick={() => open("signup", "Pro Annuel — 14 jours d'essai")} className="btn-primary w-full h-12! mt-6">Démarrer — 14 jours gratuits <Icon n="arrow" cls="h-4 w-4" /></button>
                <p className="mt-2 text-center text-[11px] text-slate-500">Sans engagement · Sans carte requise</p>
                <p className="mt-7 text-[11px] font-bold uppercase tracking-[.12em] text-cyan-300/80">Tout le plan Free, sans limite :</p>
                <div className="mt-3 space-y-2.5 text-sm">
                  {["Coach IA Jarvis illimité", "Trades & comptes illimités", "20+ métriques quantitatives", "Détection automatique des erreurs", "Rapports mensuels", "Calculateur de position", "Support prioritaire"].map((f) => (
                    <p key={f} className="flex items-start gap-2.5 text-slate-300"><Icon n="check" cls="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />{f}</p>
                  ))}
                </div>
              </div>

              {/* PRO MENSUEL */}
              <div className="flex flex-col rounded-2xl border border-white/[.06] bg-white/[.015] p-7">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Pro · Mensuel</p>
                <div className="mt-4 flex items-end gap-1"><span className="font-display text-4xl font-extrabold text-slate-200">{eur(MONTHLY_EUR)}</span><span className="mb-1.5 text-sm text-slate-500">/ mois</span></div>
                <p className="mt-2 text-sm text-slate-500">Soit {eur(YEARLY_FULL_PRICE)} / an. Toutes les features Pro.</p>
                <button onClick={() => open("signup", "Pro Mensuel — 14 jours d'essai")} className="btn-ghost w-full mt-6">Prendre au mois</button>
                <div className="mt-7 space-y-2.5 text-sm">
                  {["Coach IA Jarvis illimité", "Trades & comptes illimités", "20+ métriques quantitatives", "Rapports mensuels"].map((f) => (
                    <p key={f} className="flex items-start gap-2.5 text-slate-400"><Icon n="check" cls="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{f}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 8 · CTA FINAL ── */}
        <section className="relative overflow-hidden border-t border-white/[.06] py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,rgba(34,211,238,.12),transparent_60%)]" />
          <div className="reveal relative mx-auto max-w-[640px] px-5 text-center">
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-[-0.045em] text-white leading-[1.08]">
              Tes trades contiennent déjà<br />les réponses.
            </h2>
            <p className="mt-5 text-slate-400 leading-7 max-w-lg mx-auto">
              TradeVault t'aide à les trouver.
            </p>
            <div className="mt-8">
              <button onClick={() => open("signup", "Essai Premium 14 jours")} className="btn-primary px-8 py-4">
                Essai gratuit 14 jours <Icon n="arrow" cls="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-600">Sans carte bancaire · Annulation en 1 clic</p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <Logo compact />
              <p className="text-xs leading-5 text-slate-500 max-w-[220px]">Le coach IA de référence pour les traders qui veulent progresser avec méthode.</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-cyan-300 transition mt-1"><Icon n="mail" cls="h-3.5 w-3.5" /> {SUPPORT_EMAIL}</a>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Navigation</p>
              <div className="flex flex-col gap-2">
                {[["problem", "Problème"], ["ai", "Coach IA"], ["discipline", "Système"], ["analytics", "Analytics"], ["pricing", "Tarifs"]].map(([id, label]) => (
                  <button key={id} onClick={() => go(id)} className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition text-left">{label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Légal</p>
              <div className="flex flex-col gap-2">
                <a href="/terms" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Conditions d'utilisation</a>
                <a href="/privacy" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Politique de confidentialité</a>
                <a href="/contact" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Contact</a>
                <a href="/demo" className="text-xs font-medium text-slate-500 hover:text-cyan-300 transition">Démo</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 mb-3">Suivez-nous</p>
              <div className="flex items-center gap-3">
                {([{ icon: Twitter, label: "X" }, { icon: Linkedin, label: "LinkedIn" }, { icon: Instagram, label: "Instagram" }, { icon: Facebook, label: "Facebook" }, { icon: Youtube, label: "YouTube" }] as const).map((s) => (
                  <span key={s.label} aria-label={s.label} title={`${s.label} — bientôt`} className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-white/[.08] bg-white/[.02] text-slate-600 transition-colors"><s.icon className="w-4 h-4" /></span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-white/[.05] pt-6 text-center text-[11px] text-slate-700">
            © {new Date().getFullYear()} TradeVault. Le trading comporte des risques.
          </div>
        </div>
      </footer>

      <CookieConsent />
      {auth && <AuthModal onClose={() => setAuth(false)} initialMode={authMode} plan={authPlan} />}
    </div>
  );
}
