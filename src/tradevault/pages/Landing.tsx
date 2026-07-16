import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  AlertTriangle,
  Sparkles,
  Check,
  Star,
  Timer,
  Gauge,
  Shield,
  Upload,
  LineChart,
  Repeat,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import AuthModal from "../components/AuthModal";
import logoSrc from "@/assets/tradevault-logo.png";

/**
 * Public landing page shown at "/" for signed-out visitors. Authenticated
 * users never see it — App.tsx routes them straight into the product.
 * The CTA opens the auth screen directly on the signup tab.
 */
export default function Landing() {
  const { t } = useT();
  const [auth, setAuth] = useState<null | "login" | "signup">(null);

  if (auth) return <AuthModal initialMode={auth} onBack={() => setAuth(null)} />;

  const features = [
    { icon: BookOpen, title: t("landing.featJournalTitle"), desc: t("landing.featJournalDesc") },
    {
      icon: BarChart3,
      title: t("landing.featAnalyticsTitle"),
      desc: t("landing.featAnalyticsDesc"),
    },
    { icon: Sparkles, title: t("landing.featCoachTitle"), desc: t("landing.featCoachDesc") },
    { icon: CalendarDays, title: t("landing.featNewsTitle"), desc: t("landing.featNewsDesc") },
    {
      icon: ClipboardCheck,
      title: t("landing.featChecklistTitle"),
      desc: t("landing.featChecklistDesc"),
    },
    {
      icon: AlertTriangle,
      title: t("landing.featMistakesTitle"),
      desc: t("landing.featMistakesDesc"),
    },
  ];

  return (
    <div
      className="relative min-h-dvh text-white overflow-x-hidden"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)" }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="auth-orb w-[500px] h-[500px] bg-cyan-600 -top-40 -right-40"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="auth-orb w-[400px] h-[400px] bg-teal-600 top-[38%] -left-48"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="auth-orb w-[350px] h-[350px] bg-cyan-600 bottom-0 right-1/4"
          style={{ animationDelay: "-11s" }}
        />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-10 max-w-6xl mx-auto flex items-center justify-between px-4 md:px-6 py-4 md:py-5">
        <div className="flex items-center gap-2.5">
          <img
            src={logoSrc}
            alt="TradeVault"
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]"
          />
          <span className="text-lg font-bold">TradeVault</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuth("login")}
            className="h-11 px-4 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all"
          >
            {t("landing.signIn")}
          </button>
          <button
            onClick={() => setAuth("signup")}
            className="h-11 px-4 md:px-5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20 transition-all"
          >
            {t("landing.ctaPrimary")}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pt-10 md:pt-20 pb-14 md:pb-24 grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[11px] font-bold uppercase tracking-wider mb-5 animate-fade-in-up stagger-0">
            <Sparkles className="w-3.5 h-3.5" />
            {t("landing.heroBadge")}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] mb-5 animate-fade-in-up stagger-1">
            {t("landing.heroTitle1")}
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
              {t("landing.heroTitle2")}
            </span>
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-lg mb-7 animate-fade-in-up stagger-2">
            {t("landing.heroSubtitle")}
          </p>
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-3">
            <button
              onClick={() => setAuth("signup")}
              className="h-12 px-6 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              {t("landing.ctaPrimary")} <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="h-12 px-5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white border border-white/[0.1] hover:bg-white/[0.04] transition-all flex items-center"
            >
              {t("landing.ctaSecondary")}
            </a>
          </div>
          <p className="text-[11px] text-slate-600 mt-3 animate-fade-in-up stagger-4">
            {t("landing.heroNote")}
          </p>
        </div>

        {/* UI mockup — built from the design system, no raw screenshot */}
        <div className="relative animate-fade-in-up stagger-3" aria-hidden="true">
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-cyan-500/10 blur-3xl" />
          <div className="relative glass-strong rounded-3xl p-4 md:p-5 card-premium border border-white/[0.08] select-none">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  {t("landing.mockEquity")}
                </div>
                <div className="text-2xl md:text-3xl font-bold text-emerald-400 tabular-nums">
                  +$4,218.50
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 tabular-nums">
                +16.9%
              </span>
            </div>
            <svg viewBox="0 0 300 100" className="w-full h-28 md:h-36 mb-4">
              <defs>
                <linearGradient id="landGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--tv-highlight)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--tv-highlight)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="landStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--tv-accent)" />
                  <stop offset="100%" stopColor="var(--tv-highlight)" />
                </linearGradient>
              </defs>
              <path
                d="M4 88 L40 72 L72 78 L108 52 L140 60 L176 34 L212 42 L248 18 L296 26"
                fill="none"
                stroke="url(#landStroke)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 6px rgba(var(--tv-highlight-rgb),0.5))" }}
              />
              <path
                d="M4 88 L40 72 L72 78 L108 52 L140 60 L176 34 L212 42 L248 18 L296 26 L296 98 L4 98 Z"
                fill="url(#landGrad)"
                stroke="none"
              />
              <circle
                cx="248"
                cy="18"
                r="3.5"
                fill="var(--tv-highlight)"
                style={{ filter: "drop-shadow(0 0 5px rgba(var(--tv-highlight-rgb),0.9))" }}
              />
            </svg>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: t("landing.mockWinRate"), value: "64%", tone: "text-emerald-400" },
                { label: t("landing.mockProfitFactor"), value: "2.31", tone: "text-cyan-300" },
                { label: "Sharpe", value: "1.84", tone: "text-white" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-3">
                  <div className="text-[8px] md:text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 truncate">
                    {s.label}
                  </div>
                  <div className={`text-base md:text-lg font-bold tabular-nums ${s.tone}`}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pb-14 md:pb-20">
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {[
            { icon: Timer, value: t("landing.statTradesValue"), label: t("landing.statTrades") },
            { icon: Gauge, value: t("landing.statMetricsValue"), label: t("landing.statMetrics") },
            { icon: Shield, value: t("landing.statPrivateValue"), label: t("landing.statPrivate") },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="glass rounded-2xl p-4 md:p-5 text-center card-premium">
              <Icon className="w-5 h-5 mx-auto mb-2 text-cyan-400" />
              <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">{value}</div>
              <div className="text-[11px] md:text-xs text-slate-500 leading-snug mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section
        id="features"
        className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-16 md:pb-24"
      >
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.featuresTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.featuresSubtitle")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="glass rounded-2xl p-5 card-premium animate-fade-in-up hover:-translate-y-1 transition-transform"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.stepsTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.stepsSubtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {[
            { icon: Upload, title: t("landing.step1Title"), desc: t("landing.step1Desc") },
            { icon: LineChart, title: t("landing.step2Title"), desc: t("landing.step2Desc") },
            { icon: Repeat, title: t("landing.step3Title"), desc: t("landing.step3Desc") },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="relative glass rounded-2xl p-6 card-premium">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white font-bold flex items-center justify-center text-sm shrink-0">
                  {i + 1}
                </span>
                <Icon className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
              <p className="text-xs md:text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof (Trustpilot placeholder) ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="glass-strong rounded-3xl p-8 md:p-10 text-center card-premium">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="w-6 h-6 text-emerald-400 fill-emerald-400/80" />
            ))}
          </div>
          <h2 className="text-lg md:text-xl font-bold mb-1">{t("landing.socialTitle")}</h2>
          <p className="text-sm text-slate-500 mb-4">{t("landing.socialSubtitle")}</p>
          <p className="inline-block text-xs text-slate-400 bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5">
            {t("landing.socialPlaceholder")}
          </p>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.pricingTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.pricingSubtitle")}</p>
        </div>
        <div className="relative glass-strong rounded-3xl p-7 md:p-9 card-premium border border-cyan-500/20 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold mb-1">
                {t("landing.pricingPlan")}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-bold">{t("landing.pricingPrice")}</span>
                <span className="text-sm text-slate-500">{t("landing.pricingPeriod")}</span>
              </div>
            </div>
          </div>
          <ul className="space-y-2.5 mb-7">
            {[
              t("landing.pricingFeat1"),
              t("landing.pricingFeat2"),
              t("landing.pricingFeat3"),
              t("landing.pricingFeat4"),
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setAuth("signup")}
            className="w-full h-12 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2"
          >
            {t("landing.pricingCta")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="relative glass-strong rounded-3xl p-8 md:p-12 text-center card-premium overflow-hidden">
          <div className="pointer-events-none absolute -inset-10 bg-cyan-500/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.finalTitle")}</h2>
            <p className="text-sm md:text-base text-slate-400 mb-6 max-w-lg mx-auto">
              {t("landing.finalSubtitle")}
            </p>
            <button
              onClick={() => setAuth("signup")}
              className="h-12 px-7 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
            >
              {t("landing.ctaPrimary")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
          <div className="flex items-center gap-2.5">
            <img
              src={logoSrc}
              alt="TradeVault"
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg"
            />
            <div>
              <div className="text-sm font-bold">TradeVault</div>
              <div className="text-[11px] text-slate-600">{t("landing.footerTagline")}</div>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <a href="/terms" className="hover:text-slate-300 transition-colors">
              {t("landing.footerTerms")}
            </a>
            <a href="/privacy" className="hover:text-slate-300 transition-colors">
              {t("landing.footerPrivacy")}
            </a>
            <span className="text-slate-700">© {new Date().getFullYear()} TradeVault</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
