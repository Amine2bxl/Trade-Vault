import { useEffect, useRef, useState } from "react";
import { Bot, Shield, BarChart3, BookOpen, ArrowRight, ChevronDown } from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";
import { useLandingT, type LandingLang } from "./i18n";

/**
 * Navbar de la landing — stable, calme, traduite.
 *
 * Un seul menu déroulant (Produit), des liens plats, un toggle de langue et
 * deux actions à droite. Les états sont subtils : pas de surbrillance, pas de
 * bruit — on sait toujours où l'on est.
 */

interface MegaNavProps {
  activeSec: string;
  go: (id: string) => void;
  open: (mode: "login" | "signup", plan?: string) => void;
  y: number;
  pct: number;
}

const LINKS: { key: "nav.features" | "nav.problem" | "pricing.tag" | "faq.tag"; id: string }[] = [
  { key: "nav.features", id: "features" },
  { key: "nav.problem", id: "problem" },
  { key: "pricing.tag", id: "pricing" },
  { key: "faq.tag", id: "faq" },
];

export default function MegaNav({ activeSec, go, open, y, pct }: MegaNavProps) {
  const { t, lang, setLang } = useLandingT();
  const [openMenu, setOpenMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as HTMLElement)) setOpenMenu(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const productItems = [
    { icon: Bot, title: t("nav.p.jarvis"), desc: t("nav.p.jarvis.d"), id: "ai" },
    { icon: Shield, title: t("nav.p.discipline"), desc: t("nav.p.discipline.d"), id: "features" },
    { icon: BarChart3, title: t("nav.p.analytics"), desc: t("nav.p.analytics.d"), id: "features" },
    { icon: BookOpen, title: t("nav.p.journal"), desc: t("nav.p.journal.d"), id: "features" },
  ];

  const goTo = (id: string) => {
    setOpenMenu(false);
    setMobile(false);
    go(id);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        y > 10
          ? "border-white/[.07] bg-[var(--tv-bg)]/90 backdrop-blur-[12px]"
          : "border-transparent bg-transparent"
      }`}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}
    >
      <div
        className="scroll-bar absolute inset-x-0 top-0 h-[2px]"
        style={{ transform: `scaleX(${pct})` }}
      />

      <div
        ref={ref}
        className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-4 md:px-6"
      >
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 shrink-0">
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

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {/* Produit dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-400 hover:text-white transition-colors"
            >
              {t("nav.product")}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${openMenu ? "rotate-180" : ""}`}
              />
            </button>
            {openMenu && (
              <div className="absolute left-0 top-full mt-2 w-[360px] rounded-xl border border-white/[.08] bg-[var(--tv-plate-1)] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,.45)]">
                {productItems.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => goTo(item.id)}
                    className="flex w-full gap-3 items-start rounded-lg p-2.5 text-left hover:bg-white/[.04] transition-colors"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-lg border border-white/[.06] bg-white/[.03] flex items-center justify-center text-slate-400">
                      <item.icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                activeSec === l.id ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {t(l.key)}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Language toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-white/[.08] p-0.5">
            {(["en", "fr"] as LandingLang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition-colors ${
                  lang === l ? "bg-white/[.08] text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={() => open("login")}
            className="hidden sm:block text-[13px] font-medium text-slate-400 hover:text-white transition-colors px-3 py-1.5"
          >
            {t("nav.signin")}
          </button>
          <button
            onClick={() => open("signup", t("nav.cta.plan"))}
            className="btn-primary px-4 py-2 text-[13px]"
          >
            {t("nav.cta")} <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMobile((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] text-slate-200 lg:hidden"
            aria-label="Menu"
          >
            {mobile ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path
                  fillRule="evenodd"
                  d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm8.25 5.25a.75.75 0 01.75-.75h8.25a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobile && (
        <div className="lg:hidden border-t border-white/[.07] bg-[#070f1a] px-5 py-4">
          <div className="flex flex-col">
            <p className="tv-label text-slate-600 mb-2 px-1">{t("nav.product")}</p>
            {productItems.map((item) => (
              <button
                key={item.title}
                onClick={() => goTo(item.id)}
                className="mobile-nav-link flex items-center gap-2.5 text-left"
              >
                <item.icon className="w-4 h-4 text-slate-400 shrink-0" /> {item.title}
              </button>
            ))}
            {LINKS.map((l) => (
              <button key={l.id} onClick={() => goTo(l.id)} className="mobile-nav-link">
                {t(l.key)}
              </button>
            ))}
            <div className="flex items-center gap-2 mt-3">
              {(["en", "fr"] as LandingLang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex-1 rounded-lg border py-2 text-[12px] font-semibold uppercase transition-colors ${
                    lang === l
                      ? "border-cyan-400/30 bg-cyan-400/[.08] text-cyan-300"
                      : "border-white/[.08] text-slate-400"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMobile(false);
                open("signup", t("nav.cta.plan"));
              }}
              className="btn-primary mt-4 w-full"
            >
              {t("nav.cta")} <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setMobile(false);
                open("login");
              }}
              className="w-full mt-2.5 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {t("nav.signin")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
