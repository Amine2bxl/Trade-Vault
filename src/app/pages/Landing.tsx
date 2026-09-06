import { PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
// Les cinq logos de réseaux sociaux ont quitté cet import avec les liens morts
// qu'ils portaient : voir le pied de page plus bas.
import { PlayCircle, Check } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { Icon, type IName } from "./landing/Icon";
import { AuthModal } from "./landing/AuthModal";
import { FeaturesBento } from "./landing/FeaturesBento";
import { PlatformsStrip, TraderProof, TrustStrip } from "./landing/Showcase";
import MegaNav from "./landing/MegaNav";
import { CookieConsent } from "../components/CookieConsent";
import { faqPageJsonLd } from "@/shared/seo";
import PricingPlans from "../components/pricing/PricingPlans";
import {
  LandingLangProvider,
  useLandingT,
  type LandingKey,
  type LandingLang,
} from "./landing/i18n";
import "./landing.css";

/* ─────────────────────────── LOGO ────────────────────────── */
function Logo() {
  return (
    // `href="/"`, pas `href="#"`. Le logo est le lien de retour à l'accueil le
    // plus universellement compris du web, et c'est le seul lien qu'un robot
    // d'indexation s'attend à trouver sur chaque page. Pointé sur `#`, il ne
    // désignait rien.
    <a
      href="/"
      className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tv-accent)] rounded-sm"
    >
      <img
        src={logoSrc}
        alt="TradeVault"
        width={30}
        height={30}
        className="h-8 w-8 object-contain"
      />
      <span className="font-display font-bold tracking-[-0.02em] text-white leading-none hidden sm:block text-[1.15rem]">
        TradeVault
      </span>
    </a>
  );
}

/* ─────────────────────────── PIED DE PAGE ─────────────────────────── */

/**
 * LES LIENS DU PIED DE PAGE — la seule structure de maillage du site.
 *
 * Ils étaient TREIZE à pointer vers `href="#"` : quatre « Produit », quatre
 * « Ressources », cinq icônes sociales. Le pied de page est le bloc que tout
 * moteur d'indexation lit sur chaque page pour découvrir le reste du site ;
 * celui-ci ne menait nulle part, et `/contact` — pourtant déclarée dans le
 * sitemap — n'était atteignable par AUCUN lien du produit.
 *
 * Quatre des libellés annonçaient en plus des pages qui n'existent pas
 * (« Intégrations », « Changelog », « Documentation », « Blog »). Un lien de
 * pied de page est une promesse de contenu ; on n'en écrit pas qu'on ne tient
 * pas.
 *
 * Chaque entrée ci-dessous désigne donc une ancre RÉELLE de cette page ou une
 * route RÉELLE du produit. Le lien vers `/demo` et `/demo-site` est délibéré
 * bien que ces deux routes soient en `noindex` : elles sont utiles au visiteur,
 * et un lien vers une page non indexée reste un lien parfaitement valide.
 */
type FooterLink = { k: LandingKey; href: string };

const FOOTER_PRODUCT: FooterLink[] = [
  { k: "footer.f1", href: "#problem" },
  { k: "footer.f2", href: "#ai" },
  { k: "footer.f3", href: "#features" },
  { k: "footer.f4", href: "#pricing" },
];

const FOOTER_RESOURCES: FooterLink[] = [
  { k: "footer.r1", href: "/demo-site" },
  { k: "footer.r2", href: "/demo" },
  { k: "footer.r3", href: "#faq" },
  { k: "footer.r4", href: "/contact" },
];

function FooterColumn({
  title,
  links,
  t,
}: {
  title: string;
  links: FooterLink[];
  t: (k: LandingKey) => string;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-white mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm">
        {links.map(({ k, href }) => (
          <li key={k}>
            <a
              href={href}
              className="-my-1.5 inline-flex min-h-[36px] items-center text-slate-500 transition hover:text-slate-300"
            >
              {t(k)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────────────── SPLINE · COURBE ─────────────────────────── */
/**
 * La spline de la courbe — même famille que le `natural` de recharts.
 * Catmull-Rom passe par tous les points ; calculée une fois au chargement.
 */
const HERO_PTS: [number, number][] = [
  [0, 130],
  [42, 118],
  [84, 124],
  [126, 96],
  [168, 106],
  [210, 74],
  [252, 88],
  [294, 52],
  [336, 62],
  [376, 30],
];

function buildSpline(p: [number, number][]): string {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const HERO_D = buildSpline(HERO_PTS);
const ANALYTICS_D = buildSpline([
  [0, 96],
  [40, 88],
  [80, 92],
  [120, 70],
  [160, 78],
  [200, 52],
  [240, 62],
  [280, 40],
]);

/* ─────────────────────────── HERO — THE PRODUCT ─────────────────────────── */
function HeroProductVisual() {
  const { t } = useLandingT();
  return (
    <div className="relative">
      {/* La plaque produit — la même matière qu'une carte de l'app. */}
      <div className="lp-panel p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="tv-label text-slate-500">{t("hero.eq")}</p>
            <p className="tv-figure mt-1 text-2xl tabular-nums text-[var(--tv-chart-green)]">
              +$4,218.50
            </p>
          </div>
          <span className="tv-figure mt-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] tabular-nums text-emerald-300">
            +16.9%
          </span>
        </div>

        <div className="h-32 w-full">
          <svg viewBox="0 0 376 145" className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hf" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="var(--tv-chart-green)" stopOpacity=".22" />
                <stop offset="1" stopColor="var(--tv-chart-green)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[34, 74, 114].map((yy) => (
              <path key={yy} d={`M0 ${yy}H376`} stroke="rgba(148,163,184,.09)" />
            ))}
            <path d={`${HERO_D} L376,145 L0,145 Z`} fill="url(#hf)" />
            <path
              d="M0 138H376"
              stroke="var(--tv-chart-red)"
              strokeWidth="1.5"
              strokeDasharray="6 5"
            />
            <path
              d={HERO_D}
              fill="none"
              stroke="var(--tv-chart-green)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="chart-line"
            />
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[.08] pt-4">
          {[
            [t("hero.winrate"), "64%"],
            [t("hero.pf"), "2.31"],
            [t("hero.sharpe"), "1.96"],
          ].map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="tv-label text-slate-500">{l}</p>
              <p className="mt-1 font-display text-base font-bold tabular-nums text-white">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Le coach — une vraie remarque sur des données réelles. */}
      <div className="absolute -bottom-7 -left-3 z-10 hidden w-[236px] sm:block">
        <div className="lp-card p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <div className="tv-accent-fill grid h-6 w-6 place-items-center rounded-md">
              <Icon n="brain" cls="h-3.5 w-3.5" />
            </div>
            <p className="text-[11px] font-bold text-white">{t("hero.coach")}</p>
            <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("ai.c.active")}
            </span>
          </div>
          <p className="text-[11px] leading-4 text-slate-300">
            {t("hero.coach.tip")}{" "}
            <span className="text-[var(--tv-highlight)] font-semibold">
              {t("hero.coach.action")}
            </span>
          </p>
        </div>
      </div>

      {/* Le pattern détecté. */}
      <div className="absolute -top-7 -right-3 z-10 hidden w-[200px] md:block">
        <div className="lp-card p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <Icon n="radar" cls="h-3.5 w-3.5 text-[var(--tv-highlight)]" />
            <p className="text-[11px] font-bold text-white">{t("hero.pattern")}</p>
          </div>
          <p className="text-[11px] leading-4 text-slate-300">
            <span className="text-[var(--tv-highlight)] font-semibold">
              {t("hero.pattern.tip")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── AI CONVERSATION ─────────────────────────── */
function AIConversation() {
  const { t } = useLandingT();
  return (
    <div className="lp-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[.08] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="tv-accent-fill grid h-9 w-9 place-items-center rounded-lg">
            <Icon n="brain" cls="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="tv-prose font-bold text-white">{t("ai.c.title")}</p>
            <p className="text-[11px] text-emerald-300">{t("ai.c.sub")}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("ai.c.active")}
        </span>
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-white/[.08] bg-white/[.05] px-4 py-2.5">
            <p className="tv-prose text-slate-200">{t("ai.c.q")}</p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-[rgb(var(--tv-accent-rgb)/0.35)] bg-[rgb(var(--tv-accent-rgb)/0.06)] p-3.5">
          <p className="tv-prose text-slate-200">{t("ai.c.a")}</p>
        </div>
        <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-emerald-400/20 bg-emerald-400/[.05] p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Icon n="check" cls="h-3.5 w-3.5 text-emerald-400" />
            <span className="tv-label text-emerald-400">{t("ai.c.plan")}</span>
          </div>
          <p className="tv-prose text-slate-200">{t("ai.c.plan.d")}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── SECTION HEAD ─────────────────────────── */
function SectionHead({ title, sub }: { title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold tracking-[-0.03em] text-white leading-[1.1]">
        {title}
      </h2>
      {sub && <p className="mt-4 leading-7 text-slate-400">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────── CORE VALUE · 4 TEMPS ─────────────────────────── */
function CoreValueSection() {
  const { t } = useLandingT();
  const steps: { n: string; t: string; d: string }[] = [
    { n: "01", t: t("journey.s1.t"), d: t("journey.s1.d") },
    { n: "02", t: t("journey.s2.t"), d: t("journey.s2.d") },
    { n: "03", t: t("journey.s3.t"), d: t("journey.s3.d") },
    { n: "04", t: t("journey.s4.t"), d: t("journey.s4.d") },
  ];
  return (
    <section className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <SectionHead
          title={
            <>
              {t("journey.title.a")} <span className="text-accent">{t("journey.title.b")}</span>
            </>
          }
          sub={t("journey.sub")}
        />
        <div className="reveal mx-auto grid max-w-[860px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n} className="journey-step">
              <span className="journey-num">{s.n}</span>
              <div>
                <p className="font-display text-[15px] font-bold text-white">{s.t}</p>
                <p className="mt-1 text-[12.5px] leading-5 text-slate-400">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── ANALYTICS ─────────────────────────── */
function AnalyticsSection() {
  const { t } = useLandingT();
  const caps: { t: string; d: string }[] = [
    { t: t("analytics.c1.t"), d: t("analytics.c1.d") },
    { t: t("analytics.c2.t"), d: t("analytics.c2.d") },
    { t: t("analytics.c3.t"), d: t("analytics.c3.d") },
    { t: t("analytics.c4.t"), d: t("analytics.c4.d") },
  ];
  return (
    <section id="analytics" className="relative section-divider py-14 lg:py-24">
      <div className="lp-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal">
            <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              {t("analytics.title.a")} <span className="text-accent">{t("analytics.title.b")}</span>
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">{t("analytics.sub")}</p>
            <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {caps.map((c) => (
                <div key={c.t} className="flex items-start gap-3">
                  <span className="mt-1.5 grid h-2 w-2 shrink-0 place-items-center rounded-full bg-[var(--tv-highlight)]" />
                  <div>
                    <p className="text-sm font-semibold text-white">{c.t}</p>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-slate-400">{c.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal">
            <div className="lp-panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="tv-label text-slate-500">{t("hero.eq")}</p>
                <span className="tv-figure rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] tabular-nums text-emerald-300">
                  +$4,218.50 · 6m
                </span>
              </div>
              <div className="h-28 w-full">
                <svg viewBox="0 0 280 100" className="h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="aa" x1="0" x2="0" y1="0" y2="1">
                      <stop stopColor="var(--tv-chart-green)" stopOpacity=".2" />
                      <stop offset="1" stopColor="var(--tv-chart-green)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[24, 50, 76].map((yy) => (
                    <path key={yy} d={`M0 ${yy}H280`} stroke="rgba(148,163,184,.09)" />
                  ))}
                  <path d={`${ANALYTICS_D} L280,100 L0,100 Z`} fill="url(#aa)" />
                  <path
                    d="M0 96H280"
                    stroke="var(--tv-chart-red)"
                    strokeWidth="1.5"
                    strokeDasharray="6 5"
                  />
                  <path
                    d={ANALYTICS_D}
                    fill="none"
                    stroke="var(--tv-chart-green)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Win rate", "64%"],
                  ["Profit factor", "2.31"],
                  ["Expectancy", "+0.68R"],
                  ["Sharpe", "1.96"],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    className="rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5"
                  >
                    <p className="tv-label text-slate-500">{l}</p>
                    <p className="mt-0.5 tv-figure text-sm tabular-nums text-white">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── MISTAKES · PSYCHOLOGIE ─────────────────────────── */
function MistakesSection() {
  const { t } = useLandingT();
  const qs: LandingKey[] = ["mistakes.q1", "mistakes.q2", "mistakes.q3", "mistakes.q4"];
  const leaks: { n: string; c: string; v: number }[] = [
    { n: "Revenge trading", c: "−$1,240", v: 82 },
    { n: "FOMO entry", c: "−$890", v: 58 },
    { n: "Overtrading", c: "−$670", v: 42 },
  ];
  return (
    <section id="mistakes" className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal order-2 lg:order-1">
            <div className="lp-panel p-5">
              <p className="tv-label mb-4 text-slate-500">{t("bento.errors.thismonth")}</p>
              <div className="space-y-3">
                {leaks.map((m) => (
                  <div key={m.n}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-slate-200">{m.n}</span>
                      <span className="tv-figure tabular-nums text-[var(--tv-chart-red)]">
                        {m.c}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[.05]">
                      <div
                        className="h-full rounded-full bg-[var(--tv-chart-red)]/60"
                        style={{ width: `${m.v}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="tv-label mt-4 text-slate-500">{t("bento.errors.d")}</p>
            </div>
          </div>

          <div className="reveal order-1 lg:order-2">
            <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              {t("mistakes.title.a")}{" "}
              <span className="text-slate-500">{t("mistakes.title.b")}</span>
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">{t("mistakes.sub")}</p>
            <ul className="mt-8 space-y-3">
              {qs.map((q, i) => (
                <li
                  key={q}
                  className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.02] px-4 py-3"
                >
                  <span className="tv-figure w-5 shrink-0 text-[11px] tabular-nums text-slate-600">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] text-slate-200">{t(q)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── USE CASES ─────────────────────────── */
function UseCasesSection() {
  const { t } = useLandingT();
  const cards: LandingKey[] = ["uses.u1.t", "uses.u2.t", "uses.u3.t"];
  const descs: LandingKey[] = ["uses.u1.d", "uses.u2.d", "uses.u3.d"];
  const icons: IName[] = ["chart", "calendar", "radar"];
  return (
    <section id="use-cases" className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <SectionHead
          title={
            <>
              {t("uses.title.a")} <span className="text-accent">{t("uses.title.b")}</span>
            </>
          }
        />
        <div className="reveal grid gap-4 sm:grid-cols-3">
          {cards.map((title, i) => (
            <div key={title} className="use-card">
              <div className="feat-icon mb-4 h-10 w-10">
                <Icon n={icons[i]} cls="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-white">{t(title)}</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">{t(descs[i])}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── EXCEL / NOTION ─────────────────────────── */
function AlternativeSection() {
  const { t } = useLandingT();
  const rows: LandingKey[] = ["alt.r1", "alt.r2", "alt.r3", "alt.r4", "alt.r5", "alt.r6"];
  return (
    <section id="alternative" className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <SectionHead
          title={
            <>
              {t("alt.title.a")} <span className="text-slate-500">{t("alt.title.b")}</span>
            </>
          }
          sub={t("alt.sub")}
        />
        <div className="reveal mx-auto max-w-[760px]">
          <div className="lp-panel px-4 py-5 sm:px-6">
            <div className="cmp-row" style={{ borderTop: "none" }}>
              <div />
              <p className="cmp-col">{t("alt.h.excel")}</p>
              <p className="cmp-col">{t("alt.h.notion")}</p>
              <p className="cmp-col cmp-tv">{t("alt.h.tv")}</p>
            </div>
            <div className="cmp-row">
              <p className="text-[12.5px] text-slate-200">{t("alt.excel.d")}</p>
              <p className="cmp-col text-slate-500">—</p>
              <p className="cmp-col text-slate-500">~</p>
              <p className="cmp-col cmp-tv">
                <Check className="mx-auto h-3.5 w-3.5" />
              </p>
            </div>
            <div className="cmp-row">
              <p className="text-[12.5px] text-slate-200">{t("alt.notion.d")}</p>
              <p className="cmp-col text-slate-500">~</p>
              <p className="cmp-col text-slate-500">—</p>
              <p className="cmp-col cmp-tv">
                <Check className="mx-auto h-3.5 w-3.5" />
              </p>
            </div>
            {rows.map((r, i) => (
              <div key={r} className="cmp-row">
                <p className="text-[13px] text-slate-200">{t(r)}</p>
                <p className="cmp-col">
                  {i === 5 ? (
                    <Check className="mx-auto h-3.5 w-3.5 text-[var(--tv-chart-green)]" />
                  ) : (
                    <span className="text-slate-600">–</span>
                  )}
                </p>
                <p className="cmp-col">
                  {i === 5 ? (
                    <Check className="mx-auto h-3.5 w-3.5 text-[var(--tv-chart-green)]" />
                  ) : (
                    <span className="text-slate-600">–</span>
                  )}
                </p>
                <p className="cmp-col cmp-tv">
                  <Check className="mx-auto h-3.5 w-3.5" />
                </p>
              </div>
            ))}
            <p className="tv-label mt-3 text-slate-600">{t("alt.tv.d")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── NAV ─────────────────────────── */
const NAV: [string, string][] = [
  ["nav.problem", "problem"],
  ["nav.analytics", "analytics"],
  ["nav.features", "features"],
  ["pricing.tag", "pricing"],
  ["faq.tag", "faq"],
];

/* ─────────────────────────── LANDING ─────────────────────────── */
function LandingPage() {
  const { t, lang } = useLandingT();
  const [auth, setAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<string | undefined>();
  const [faq, setFaq] = useState<number | null>(0);
  const [activeSec, setActiveSec] = useState("");
  const { y, pct } = useScroll();
  useReveal();

  const problems = [
    { n: "err" as IName, t: t("problem.p1.t"), d: t("problem.p1.d") },
    { n: "heart" as IName, t: t("problem.p2.t"), d: t("problem.p2.d") },
    { n: "compass" as IName, t: t("problem.p3.t"), d: t("problem.p3.d") },
  ];
  const ais = [
    { n: "brain" as IName, t: t("ai.f1.t"), d: t("ai.f1.d") },
    { n: "radar" as IName, t: t("ai.f2.t"), d: t("ai.f2.d") },
    { n: "err" as IName, t: t("ai.f3.t"), d: t("ai.f3.d") },
  ];
  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
  ];
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
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuth(true);
  };
  const go = (id: string) => {
    setActiveSec(id);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollLockRef.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    scrollTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, 1000);
  };

  return (
    <div className="landing-root min-h-screen overflow-x-clip bg-[var(--tv-bg)] text-white">
      <MegaNav activeSec={activeSec} go={go} open={open} y={y} pct={pct} />

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section className="relative overflow-hidden pt-[96px] pb-16 lg:pt-[128px] lg:pb-24">
          <div className="lp-container">
            <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
              <div className="text-center lg:text-left">
                <h1 className="fade-up font-display text-[clamp(2.6rem,5.2vw,4.4rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-white">
                  {t("hero.h1a")} <span className="text-accent">{t("hero.h1b")}</span>
                </h1>
                <p className="fade-up d2 mt-6 max-w-[540px] text-[17px] leading-7 text-slate-400">
                  {t("hero.sub")}
                </p>
                <div className="fade-up d3 mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                  <button
                    onClick={() => open("signup", t("nav.cta.plan"))}
                    className="btn-primary px-7 py-3 text-base"
                  >
                    {t("hero.cta")} <Icon n="arrow" cls="h-4 w-4" />
                  </button>
                  <a
                    href="/demo-site"
                    className="group -my-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-white"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {t("hero.demo")}
                  </a>
                </div>
                <div className="fade-up d4 mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
                  {[t("hero.t1"), t("hero.t2"), t("hero.t3")].map((s) => (
                    <span key={s} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                      <Check className="h-3.5 w-3.5 text-[var(--tv-chart-green)]" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="fade-up d3 relative mt-6 w-full max-w-[520px] mx-auto pb-8 lg:mx-0 lg:ml-auto lg:mt-0">
                <HeroProductVisual />
              </div>
            </div>
          </div>
        </section>

        {/* ── PLATEFORMES ── */}
        <section className="relative pb-14 lg:pb-20">
          <div className="lp-container">
            <PlatformsStrip />
          </div>
        </section>

        {/* ── PROBLÈME ── */}
        <section id="problem" className="relative section-divider py-14 lg:py-20">
          <div className="lp-container">
            <SectionHead
              title={
                <>
                  {t("problem.title.a")}{" "}
                  <span className="text-slate-500">{t("problem.title.b")}</span>
                </>
              }
              sub={t("problem.sub")}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {problems.map((p) => (
                <article key={p.t} className="reveal card-premium p-6">
                  <div className="feat-icon mb-4 h-11 w-11">
                    <Icon n={p.n} cls="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{p.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CORE VALUE — 4 temps ── */}
        <CoreValueSection />

        {/* ── ANALYTICS ── */}
        <AnalyticsSection />

        {/* ── AI / JARVIS ── */}
        <section id="ai" className="relative section-divider py-14 lg:py-20">
          <div className="lp-container">
            <SectionHead
              title={
                <>
                  {t("ai.title.a")} <span className="text-accent">{t("ai.title.b")}</span>
                </>
              }
              sub={t("ai.sub")}
            />
            <div className="reveal mb-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <AIConversation />
              <div>
                <h3 className="font-display text-2xl font-bold text-white leading-tight mb-4">
                  {t("ai.head.a")}
                  <br />
                  <span className="text-accent">{t("ai.head.b")}</span>
                </h3>
                <p className="text-slate-400 leading-7 mb-6">{t("ai.body")}</p>
                <div className="space-y-3">
                  {[t("ai.b1"), t("ai.b2"), t("ai.b3")].map((s) => (
                    <div key={s} className="flex items-center gap-3 text-[15px] text-slate-300">
                      <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-[rgb(var(--tv-accent-rgb)/0.1)] text-[var(--tv-highlight)]">
                        <Icon n="check" cls="h-3.5 w-3.5" />
                      </span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {ais.map((a) => (
                <article key={a.t} className="ai-card reveal p-5">
                  <div className="feat-icon mb-4 grid h-11 w-11 place-items-center rounded-xl text-[var(--tv-highlight)]">
                    <Icon n={a.n} cls="h-5.5 w-5.5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{a.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{a.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── MISTAKES · PSYCHOLOGIE ── */}
        <MistakesSection />

        {/* ── PRODUIT EN PROFONDEUR ── */}
        <section id="features" className="relative section-divider py-14 lg:py-20">
          <div className="lp-container">
            <SectionHead
              title={
                <>
                  {t("features.title.a")}{" "}
                  <span className="text-accent">{t("features.title.b")}</span>{" "}
                  {t("features.title.c")}
                </>
              }
              sub={t("features.sub")}
            />
            <div className="reveal">
              <FeaturesBento />
            </div>
            <div className="reveal mt-10 text-center">
              <button
                onClick={() => open("signup", t("nav.cta.plan"))}
                className="btn-primary px-7 py-2.5 text-base"
              >
                {t("features.cta")} <Icon n="arrow" cls="h-4 w-4" />
              </button>
              <p className="mt-3 text-[13px] text-slate-600">{t("features.cta.sub")}</p>
            </div>
          </div>
        </section>

        {/* ── USE CASES ── */}
        <UseCasesSection />

        {/* ── EXCEL / NOTION ── */}
        <AlternativeSection />

        {/* ── POURQUOI ÇA, ET PAR QUI ── */}
        <section className="relative section-divider py-14 lg:py-20">
          <div className="lp-container">
            <TraderProof onStart={() => open("signup", t("nav.cta.plan"))} />
            <div className="mt-8">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="relative section-divider py-14 lg:py-20">
          <div className="lp-container">
            <SectionHead title={t("pricing.title")} sub={t("pricing.sub")} />
            <div className="reveal">
              <PricingPlans
                lang={lang}
                onChoose={(plan) => open("signup", `TradeVault — ${plan}`)}
                onFree={() => open("signup", "Free")}
              />
            </div>
            <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                ["shield", "pricing.trust1"],
                ["lock", "pricing.trust2"],
                ["check", "pricing.trust3"],
              ].map(([ic, s]) => (
                <span
                  key={s}
                  className="flex items-center gap-2 text-sm font-medium text-slate-500"
                >
                  <Icon n={ic as IName} cls="h-4 w-4 text-[var(--tv-chart-green)]" />
                  {t(s)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative section-divider py-14 lg:py-20">
          <div className="mx-auto w-full max-w-[760px] px-5 lg:px-8">
            {/* `FAQPage` — construit à partir du MÊME tableau `faqs` que
                l'accordéon rendu juste en dessous, donc incapable d'en
                diverger. C'est le contenu le plus directement extractible du
                site, par un moteur de recherche comme par un moteur de
                réponse, et il n'était balisé nulle part.

                Émis dans le corps plutôt que dans `head()` : le JSON doit
                sortir VERBATIM (`head()` sérialise des balises, pas un corps de
                script), et schema.org accepte le JSON-LD partout dans le
                document. Autre bénéfice : le balisage suit automatiquement la
                langue rendue, donc `/fr` publie la FAQ française. */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: faqPageJsonLd(faqs) }}
            />
            <SectionHead title={t("faq.title")} />
            <div className="reveal border-t border-white/[.08]">
              {faqs.map(({ q, a }, i) => {
                const o = faq === i;
                return (
                  <div key={q} className="border-b border-white/[.08]">
                    <button
                      onClick={() => setFaq(o ? null : i)}
                      aria-expanded={o}
                      className="flex w-full items-center justify-between gap-5 py-5 text-left"
                    >
                      <span
                        className={`text-base font-semibold transition-colors ${o ? "text-white" : "text-slate-300"}`}
                      >
                        {q}
                      </span>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${o ? "rotate-180 border-[rgb(var(--tv-accent-rgb)/0.4)] bg-[rgb(var(--tv-accent-rgb)/0.1)] text-[var(--tv-highlight)]" : "border-white/[.12] text-slate-500"}`}
                      >
                        <Icon n="chevron" cls="h-4 w-4" />
                      </span>
                    </button>
                    <div className={`faq-body ${o ? "faq-open" : ""}`}>
                      <div>
                        <p className="pb-5 pr-8 text-[15px] leading-7 text-slate-400">{a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="relative section-divider py-20 lg:py-28">
          <div className="lp-container">
            <div className="reveal mx-auto max-w-[680px] text-center">
              <h2 className="font-display text-[clamp(2rem,4.4vw,3.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                {t("cta.title.a")}
                <br />
                <span className="text-accent">{t("cta.title.b")}</span>
              </h2>
              <button
                onClick={() => open("signup", t("nav.cta.plan"))}
                className="btn-primary mt-9 px-8 py-3 text-lg"
              >
                {t("cta.buttonShort")} <Icon n="arrow" cls="h-5 w-5" />
              </button>
              <p className="mt-5 text-sm text-slate-500">{t("cta.note")}</p>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative section-divider py-12">
          <div className="lp-container">
            <div className="grid gap-8 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Logo />
                <p className="mt-4 text-sm leading-6 text-slate-500 max-w-[320px]">
                  {t("footer.tagline")}
                </p>
                {/* LES CINQ ICÔNES SOCIALES ONT ÉTÉ RETIRÉES.
                    Elles pointaient toutes vers `href="#"` : Twitter, LinkedIn,
                    Instagram, Facebook et YouTube dessinaient une présence que
                    la marque n'a pas. Un logo de réseau est une affirmation —
                    « nous sommes là » — et celle-ci était fausse. Elles
                    reviendront le jour où les comptes existeront, avec leurs
                    vraies URL, et elles rejoindront alors `sameAs`
                    (`shared/seo.ts`), qui est l'autre endroit où cette même
                    vérité se déclare. */}
              </div>
              <FooterColumn title={t("footer.product")} links={FOOTER_PRODUCT} t={t} />
              <FooterColumn title={t("footer.resources")} links={FOOTER_RESOURCES} t={t} />
            </div>
            <div className="mt-10 pt-6 border-t border-white/[.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-600">{t("footer.rights")}</p>
              <div className="flex items-center gap-6 text-sm">
                <a
                  href="/privacy"
                  className="-my-2 inline-flex min-h-[36px] items-center text-slate-600 transition hover:text-slate-400"
                >
                  {t("footer.privacy")}
                </a>
                <a
                  href="/terms"
                  className="-my-2 inline-flex min-h-[36px] items-center text-slate-600 transition hover:text-slate-400"
                >
                  {t("footer.terms")}
                </a>
                <a
                  href="/cgu"
                  className="-my-2 inline-flex min-h-[36px] items-center text-slate-600 transition hover:text-slate-400"
                >
                  CGU
                </a>
                <a
                  href="/privacy"
                  className="-my-2 inline-flex min-h-[36px] items-center text-slate-600 transition hover:text-slate-400"
                >
                  {t("footer.cookies")}
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {auth && <AuthModal initialMode={authMode} plan={authPlan} onClose={() => setAuth(false)} />}
      <CookieConsent />
    </div>
  );
}

/**
 * `lang` — la langue portée par l'URL, quand l'URL en porte une.
 *
 * `/` sert l'anglais (`SSR_LANG`) et laisse la préférence enregistrée du
 * visiteur reprendre la main après hydratation. `/fr` sert le français dès le
 * rendu serveur, et l'impose : c'est l'adresse qui fait foi. Voir
 * `shared/lang.ts` pour la raison — jusqu'ici la vitrine française n'avait
 * aucune adresse, donc aucune existence pour un moteur de recherche.
 */
export default function Landing({ lang }: { lang?: LandingLang } = {}) {
  return (
    <LandingLangProvider pinned={lang}>
      <LandingPage />
    </LandingLangProvider>
  );
}
