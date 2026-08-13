import { useEffect, useState } from "react";
import {
  Bot,
  Shield,
  BarChart3,
  BookOpen,
  Play,
  Target,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import logoSrc from "@/assets/tradevault-logo.webp";

/**
 * MegaNav — navbar de la landing avec menus déroulants (mega-menu).
 *
 * Adapté au thème sombre TradeVault : fond #060d16, accents cyan/teal,
 * logo TradeVault, CTA "Essai gratuit". Deux menus : Produit et Ressources.
 */

interface MegaNavProps {
  activeSec: string;
  go: (id: string) => void;
  open: (mode: "login" | "signup", plan?: string) => void;
  y: number;
  pct: number;
}

interface NavItem {
  title: string;
  desc: string;
  icon: typeof Bot;
  action: () => void;
}

const PRODUCT: NavItem[] = [
  {
    title: "Jarvis — Coach IA",
    desc: "Un coach qui lit chacun de tes trades.",
    icon: Bot,
    action: () => {},
  },
  {
    title: "Discipline OS",
    desc: "Checklist, Risk Guard, discipline avant chaque trade.",
    icon: Shield,
    action: () => {},
  },
  {
    title: "Analytics",
    desc: "20+ métriques sur tes données réelles.",
    icon: BarChart3,
    action: () => {},
  },
  {
    title: "Journal",
    desc: "Chaque trade enregistré en 45 secondes.",
    icon: BookOpen,
    action: () => {},
  },
];

const RESOURCES: NavItem[] = [
  { title: "Démo", desc: "Vois l'app en action.", icon: Play, action: () => {} },
  { title: "Tarifs", desc: "Free ou Pro, sans engagement.", icon: Target, action: () => {} },
  { title: "FAQ", desc: "Les réponses à tes questions.", icon: HelpCircle, action: () => {} },
];

export default function MegaNav({ activeSec, go, open, y, pct }: MegaNavProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".mega-nav")) setOpenMenu(null);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const toggleMenu = (key: string) => setOpenMenu((prev) => (prev === key ? null : key));

  const goProduct = (i: number) => {
    const ids = ["ai", "features", "features", "features"];
    setOpenMenu(null);
    go(ids[i]);
  };
  const goResource = (i: number) => {
    const ids = ["demo", "pricing", "faq"];
    setOpenMenu(null);
    if (i === 0) window.location.href = "/demo";
    else go(ids[i]);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-white/[.08] backdrop-blur-[12px] transition-all duration-300 ${y > 10 ? "bg-[#060d16]/90 shadow-[0_8px_32px_rgba(0,0,0,.28)]" : "bg-[#060d16]/40"}`}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px) - 2px)" }}
    >
      <div
        className="scroll-bar absolute inset-x-0 top-0 h-[2px]"
        style={{ transform: `scaleX(${pct})` }}
      />

      <div className="mega-nav relative mx-auto flex h-[60px] md:h-[66px] max-w-[1400px] items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <img
            src={logoSrc}
            alt="TradeVault"
            width={30}
            height={30}
            className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]"
          />
          <span className="font-display font-extrabold tracking-[-0.04em] text-white leading-none hidden sm:block text-[1.2rem]">
            TradeVault
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {/* Produit dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("product")}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-400 hover:text-cyan-100 transition-colors"
            >
              Produit
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-4 h-4 transition-transform ${openMenu === "product" ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {openMenu === "product" && (
              <div className="absolute left-1/2 top-full -translate-x-1/2 mt-2 w-[480px] rounded-2xl border border-white/[0.08] bg-[#0a1220]/98 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,.5)] p-2">
                <div className="grid grid-cols-2 gap-1">
                  {PRODUCT.map((item, i) => (
                    <button
                      key={item.title}
                      onClick={() => goProduct(i)}
                      className="group flex gap-3 items-start rounded-xl p-3 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-white">{item.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ressources dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("resources")}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-400 hover:text-cyan-100 transition-colors"
            >
              Ressources
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-4 h-4 transition-transform ${openMenu === "resources" ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {openMenu === "resources" && (
              <div className="absolute left-1/2 top-full -translate-x-1/2 mt-2 w-[360px] rounded-2xl border border-white/[0.08] bg-[#0a1220]/98 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,.5)] p-2">
                <div className="grid grid-cols-1 gap-1">
                  {RESOURCES.map((item, i) => (
                    <button
                      key={item.title}
                      onClick={() => goResource(i)}
                      className="group flex gap-3 items-start rounded-xl p-3 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-white">{item.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Flat links */}
          <button
            onClick={() => go("problem")}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${activeSec === "problem" ? "text-cyan-200" : "text-slate-400 hover:text-cyan-100"}`}
          >
            Problème
          </button>
          <button
            onClick={() => go("features")}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${activeSec === "features" ? "text-cyan-200" : "text-slate-400 hover:text-cyan-100"}`}
          >
            Fonctionnalités
          </button>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => open("login")}
            className="hidden sm:block text-[13px] font-semibold text-slate-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Se connecter
          </button>
          <button
            onClick={() => open("signup", "Essai Premium 14 jours")}
            className="btn-primary px-4 py-2 text-[13px]"
          >
            Essai gratuit <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMobile(!mobile)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-200 lg:hidden"
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
        <div className="lg:hidden border-t border-white/[0.07] bg-[#070f1a]/98 backdrop-blur-xl px-5 py-4">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2 px-1">
              Produit
            </p>
            {PRODUCT.map((item, i) => (
              <button
                key={item.title}
                onClick={() => {
                  setMobile(false);
                  goProduct(i);
                }}
                className="mobile-nav-link flex items-center gap-2.5 text-left"
              >
                <item.icon className="w-4 h-4 text-cyan-400 shrink-0" /> {item.title}
              </button>
            ))}
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2 mt-3 px-1">
              Ressources
            </p>
            {RESOURCES.map((item, i) => (
              <button
                key={item.title}
                onClick={() => {
                  setMobile(false);
                  goResource(i);
                }}
                className="mobile-nav-link flex items-center gap-2.5 text-left"
              >
                <item.icon className="w-4 h-4 text-cyan-400 shrink-0" /> {item.title}
              </button>
            ))}
            <button
              onClick={() => {
                setMobile(false);
                go("problem");
              }}
              className="mobile-nav-link"
            >
              Problème
            </button>
            <button
              onClick={() => {
                setMobile(false);
                go("features");
              }}
              className="mobile-nav-link"
            >
              Fonctionnalités
            </button>
            <button
              onClick={() => open("signup", "Essai Premium 14 jours")}
              className="btn-primary mt-4 w-full"
            >
              Essai gratuit <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => open("login")}
              className="w-full mt-2.5 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Se connecter
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
