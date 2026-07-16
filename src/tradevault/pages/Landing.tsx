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
  X,
  Star,
  Timer,
  Gauge,
  Shield,
  Upload,
  LineChart,
  Repeat,
  MessageSquare,
  TrendingDown,
  ChevronDown,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import AuthModal from "../components/AuthModal";
import logoSrc from "@/assets/tradevault-logo.png";

/**
 * Public landing page shown at "/" for signed-out visitors. Authenticated
 * users never see it — App.tsx routes them straight into the product.
 * The CTA opens the auth screen directly on the signup tab.
 *
 * Structure is modelled on data-driven trading funnels (hero → proof →
 * comparison → product showcase → AI coach → features → pricing → FAQ):
 * the page lives in normal document flow with `min-h-dvh`, so the browser
 * scrolls it natively — no fixed shell, no overflow lock.
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

  // Capability comparison — TradeVault always wins, spreadsheets never do,
  // other journals land somewhere in between (per-row `other` flag).
  const compareRows = [
    { label: t("landing.compareRow1"), other: false },
    { label: t("landing.compareRow2"), other: false },
    { label: t("landing.compareRow3"), other: false },
    { label: t("landing.compareRow4"), other: true },
    { label: t("landing.compareRow5"), other: true },
    { label: t("landing.compareRow6"), other: false },
  ];

  const showcase = [
    {
      icon: BarChart3,
      title: t("landing.showcase1Title"),
      desc: t("landing.showcase1Desc"),
      mock: <ShowcaseDashboardMock equityLabel={t("landing.mockEquity")} />,
    },
    {
      icon: BookOpen,
      title: t("landing.showcase2Title"),
      desc: t("landing.showcase2Desc"),
      mock: <ShowcaseJournalMock />,
    },
    {
      icon: ClipboardCheck,
      title: t("landing.showcase3Title"),
      desc: t("landing.showcase3Desc"),
      mock: <ShowcaseChecklistMock />,
    },
  ];

  const coachPatterns = [
    { label: t("landing.coachP1"), value: t("landing.coachP1Val") },
    { label: t("landing.coachP2"), value: t("landing.coachP2Val") },
    { label: t("landing.coachP3"), value: t("landing.coachP3Val") },
  ];

  const faqs = [
    { q: t("landing.faqQ1"), a: t("landing.faqA1") },
    { q: t("landing.faqQ2"), a: t("landing.faqA2") },
    { q: t("landing.faqQ3"), a: t("landing.faqA3") },
    { q: t("landing.faqQ4"), a: t("landing.faqA4") },
    { q: t("landing.faqQ5"), a: t("landing.faqA5") },
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
              {t("landing.heroCta")} <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="h-12 px-5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white border border-white/[0.1] hover:bg-white/[0.04] transition-all flex items-center"
            >
              {t("landing.ctaSecondary")}
            </a>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 animate-fade-in-up stagger-4">
            {t("landing.heroTrust")}
          </p>
          {/* Rating strip */}
          <div className="flex items-center gap-3 mt-5 animate-fade-in-up stagger-4">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-4 h-4 text-emerald-400 fill-emerald-400/80" />
              ))}
            </div>
            <span className="text-xs text-slate-500">{t("landing.ratingText")}</span>
          </div>
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

      {/* ── Comparison table ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.compareTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.compareSubtitle")}</p>
        </div>
        <div className="glass-strong rounded-3xl card-premium border border-white/[0.08] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="p-3 md:p-4 text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t("landing.compareCapability")}
                </th>
                <th className="p-3 md:p-4 text-center text-[11px] md:text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  {t("landing.compareUs")}
                </th>
                <th className="p-3 md:p-4 text-center text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t("landing.compareSheet")}
                </th>
                <th className="p-3 md:p-4 text-center text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t("landing.compareOther")}
                </th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 ? "bg-white/[0.015]" : ""}
                >
                  <td className="p-3 md:p-4 text-xs md:text-sm text-slate-300 leading-snug">
                    {row.label}
                  </td>
                  <td className="p-3 md:p-4">
                    <CompareCell on />
                  </td>
                  <td className="p-3 md:p-4">
                    <CompareCell />
                  </td>
                  <td className="p-3 md:p-4">
                    <CompareCell on={row.other} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Product showcase (alternating) ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.showcaseTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.showcaseSubtitle")}</p>
        </div>
        <div className="space-y-12 md:space-y-20">
          {showcase.map(({ icon: Icon, title, desc, mock }, i) => (
            <div
              key={title}
              className="grid md:grid-cols-2 gap-6 md:gap-12 items-center"
            >
              <div className={i % 2 ? "md:order-2" : ""}>
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{title}</h3>
                <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-md">
                  {desc}
                </p>
              </div>
              <div className={i % 2 ? "md:order-1" : ""} aria-hidden="true">
                <div className="relative">
                  <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-cyan-500/10 blur-2xl" />
                  <div className="relative glass-strong rounded-3xl p-5 card-premium border border-white/[0.08] select-none">
                    {mock}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Coach dialogue ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[11px] font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            {t("landing.coachBadge")}
          </div>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.coachTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.coachSubtitle")}</p>
        </div>
        <div className="relative glass-strong rounded-3xl p-5 md:p-8 card-premium border border-white/[0.08] overflow-hidden">
          <div className="pointer-events-none absolute -inset-10 bg-cyan-500/10 blur-3xl" />
          <div className="relative space-y-4">
            {/* User bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-medium px-4 py-2.5 shadow-lg shadow-cyan-500/20">
                {t("landing.coachQuestion")}
              </div>
            </div>
            {/* Coach bubble */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-300">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-md bg-white/[0.04] border border-white/[0.07] px-4 py-3.5">
                <p className="text-sm text-slate-300 mb-3">{t("landing.coachIntro")}</p>
                <ul className="space-y-2">
                  {coachPatterns.map((p) => (
                    <li
                      key={p.label}
                      className="flex items-center justify-between gap-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/15 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-xs md:text-sm text-slate-300">
                        <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                        {p.label}
                      </span>
                      <span className="text-xs md:text-sm font-bold text-rose-400 tabular-nums">
                        {p.value}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-cyan-300 font-semibold mt-3">{t("landing.coachOutro")}</p>
              </div>
            </div>
          </div>
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

      {/* ── FAQ ── */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{t("landing.faqTitle")}</h2>
          <p className="text-sm md:text-base text-slate-500">{t("landing.faqSubtitle")}</p>
        </div>
        <div className="space-y-3">
          {faqs.map(({ q, a }) => (
            <details
              key={q}
              className="group glass rounded-2xl card-premium border border-white/[0.06] overflow-hidden [&_summary]:list-none"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer px-5 py-4 text-sm md:text-base font-semibold text-white select-none">
                {q}
                <ChevronDown className="w-4 h-4 text-cyan-400 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-4 -mt-1 text-sm text-slate-400 leading-relaxed">{a}</div>
            </details>
          ))}
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
              {t("landing.heroCta")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
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
        {/* Risk disclaimer */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
          <p className="text-[11px] text-slate-600 leading-relaxed border-t border-white/[0.04] pt-5">
            {t("landing.riskDisclaimer")}
          </p>
        </div>
      </footer>
    </div>
  );
}

/** One capability cell — emerald check when supported, muted cross when not. */
function CompareCell({ on = false }: { on?: boolean }) {
  return (
    <div className="flex justify-center">
      {on ? (
        <span className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
        </span>
      ) : (
        <span className="w-6 h-6 rounded-full bg-white/[0.04] flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-slate-600" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

/** Mini dashboard mock for the product-showcase section. */
function ShowcaseDashboardMock({ equityLabel }: { equityLabel: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
          {equityLabel}
        </span>
        <span className="text-xs font-bold text-emerald-400 tabular-nums">+16.9%</span>
      </div>
      <svg viewBox="0 0 300 80" className="w-full h-20 mb-3">
        <path
          d="M4 68 L48 56 L92 60 L136 40 L180 46 L224 24 L296 20"
          fill="none"
          stroke="var(--tv-highlight)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Win", v: "64%" },
          { l: "PF", v: "2.31" },
          { l: "DD", v: "-8%" },
        ].map((s) => (
          <div key={s.l} className="glass rounded-lg p-2 text-center">
            <div className="text-[8px] uppercase text-slate-500 font-semibold">{s.l}</div>
            <div className="text-sm font-bold text-white tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mini journal rows mock. */
function ShowcaseJournalMock() {
  const rows = [
    { sym: "EURUSD", side: "L", rr: "+2.4R", pos: true },
    { sym: "NQ", side: "S", rr: "-1.0R", pos: false },
    { sym: "XAUUSD", side: "L", rr: "+1.8R", pos: true },
    { sym: "GBPJPY", side: "S", rr: "+3.1R", pos: true },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.sym}
          className="flex items-center justify-between glass rounded-lg px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{r.sym}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400">
              {r.side}
            </span>
          </div>
          <span
            className={`text-xs font-bold tabular-nums ${r.pos ? "text-emerald-400" : "text-rose-400"}`}
          >
            {r.rr}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Mini checklist mock. */
function ShowcaseChecklistMock() {
  const items = [
    { l: "HTF bias aligned", done: true },
    { l: "Liquidity swept", done: true },
    { l: "Confluence ≥ 3", done: true },
    { l: "Emotional state calm", done: false },
  ];
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.l} className="flex items-center gap-2.5">
          <span
            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
              it.done ? "bg-emerald-500/15" : "bg-white/[0.04]"
            }`}
          >
            {it.done ? (
              <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            )}
          </span>
          <span className={`text-xs ${it.done ? "text-slate-300" : "text-slate-500"}`}>
            {it.l}
          </span>
        </div>
      ))}
      <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
      </div>
    </div>
  );
}
