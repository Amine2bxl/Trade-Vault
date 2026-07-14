import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3, DollarSign, TrendingUp, Layers, Bitcoin,
  Zap, Sun, Waves, Mountain,
  Sprout, Dumbbell, ShieldCheck, Trophy,
  Target, Flag, Briefcase, Coins, Brain,
  Repeat, Flame, Shield, NotebookPen, Activity,
  Check, ArrowLeft, SkipForward, Sparkles, Rocket, BookOpen, Globe,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, saveConfluences, type OnboardingData } from "../store";
import { oc, fmt, type OnboardingCopy } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo.png";

type StepKey =
  | "language" | "welcome" | "assets" | "style" | "ict" | "experience"
  | "goal" | "pain" | "brokers" | "reveal";

interface Choice { id: string; label: string; desc?: string; icon?: LucideIcon }

const BROKERS_BY_ASSET: Record<string, string[]> = {
  futures: ["Tradovate", "NinjaTrader", "Rithmic", "Topstep", "Apex", "AMP"],
  forex: ["MT4", "MT5", "cTrader", "OANDA", "IC Markets"],
  stocks: ["IBKR", "Webull", "ThinkorSwim", "Robinhood", "Fidelity"],
  options: ["ThinkorSwim", "Tastytrade", "IBKR", "Webull"],
  crypto: ["Binance", "Bybit", "Coinbase", "Kraken", "OKX"],
};

// ICT users get a market-structure-first confluence list so their journal
// speaks their language from trade #1.
const ICT_CONFLUENCES = [
  "Liquidity sweep", "Order block", "Fair value gap", "Break of structure",
  "Change of character", "Market structure shift", "Killzone (session)", "Displacement",
  "Optimal trade entry", "Imbalance", "Premium/Discount", "Equal highs/lows",
];

// id → copy-key maps, so translated labels drive both the cards and the reveal.
const ASSET_KEYS: Record<string, keyof OnboardingCopy> = {
  futures: "aFutures", forex: "aForex", stocks: "aStocks", options: "aOptions", crypto: "aCrypto",
};
const PAIN_KEYS: Record<string, keyof OnboardingCopy> = {
  consistency: "pCons", emotion: "pEmo", risk: "pRisk", journaling: "pJour", overtrading: "pOver",
};
const MISSION_KEYS: Record<string, keyof OnboardingCopy> = {
  consistency: "missionCons", prop_challenge: "missionProp", full_time: "missionFull",
  side_income: "missionSide", discipline: "missionDisc",
};

export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { lang, setLang } = useT();
  const c = oc(lang);
  const [data, setData] = useState<OnboardingData>({
    goal: null, assets: [], style: null, experience: null,
    usesIct: false, brokers: [], pain: null, onboardedAt: null, skipped: false,
  });
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const ASSETS: Choice[] = [
    { id: "futures", label: c.aFutures, icon: BarChart3 },
    { id: "forex", label: c.aForex, icon: DollarSign },
    { id: "stocks", label: c.aStocks, icon: TrendingUp },
    { id: "options", label: c.aOptions, icon: Layers },
    { id: "crypto", label: c.aCrypto, icon: Bitcoin },
  ];
  const STYLES: Choice[] = [
    { id: "scalper", label: c.sScalper, desc: c.sScalperD, icon: Zap },
    { id: "day", label: c.sDay, desc: c.sDayD, icon: Sun },
    { id: "swing", label: c.sSwing, desc: c.sSwingD, icon: Waves },
    { id: "position", label: c.sPos, desc: c.sPosD, icon: Mountain },
  ];
  const EXPERIENCE: Choice[] = [
    { id: "new", label: c.eNew, desc: c.eNewD, icon: Sprout },
    { id: "intermediate", label: c.eInt, desc: c.eIntD, icon: Dumbbell },
    { id: "seasoned", label: c.eSea, desc: c.eSeaD, icon: ShieldCheck },
    { id: "funded", label: c.eFund, desc: c.eFundD, icon: Trophy },
  ];
  const GOALS: Choice[] = [
    { id: "consistency", label: c.gCons, desc: c.gConsD, icon: Target },
    { id: "prop_challenge", label: c.gProp, desc: c.gPropD, icon: Flag },
    { id: "full_time", label: c.gFull, desc: c.gFullD, icon: Briefcase },
    { id: "side_income", label: c.gSide, desc: c.gSideD, icon: Coins },
    { id: "discipline", label: c.gDisc, desc: c.gDiscD, icon: Brain },
  ];
  const PAINS: Choice[] = [
    { id: "consistency", label: c.pCons, desc: c.pConsD, icon: Repeat },
    { id: "emotion", label: c.pEmo, desc: c.pEmoD, icon: Flame },
    { id: "risk", label: c.pRisk, desc: c.pRiskD, icon: Shield },
    { id: "journaling", label: c.pJour, desc: c.pJourD, icon: NotebookPen },
    { id: "overtrading", label: c.pOver, desc: c.pOverD, icon: Activity },
  ];

  const showIct =
    (data.assets.includes("futures") || data.assets.includes("forex") || data.assets.includes("crypto")) &&
    (data.style === "scalper" || data.style === "day");

  const steps: StepKey[] = useMemo(() => {
    const s: StepKey[] = ["language", "welcome", "assets", "style"];
    if (showIct) s.push("ict");
    s.push("experience", "goal", "pain", "brokers", "reveal");
    return s;
  }, [showIct]);

  const step = steps[Math.min(idx, steps.length - 1)];
  const firstData = steps.indexOf("assets");
  const lastData = steps.indexOf("brokers");
  const progress =
    step === "reveal" ? 1
      : idx < firstData ? 0.08
        : (idx - firstData + 1) / (lastData - firstData + 1);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const pick = useCallback((patch: Partial<OnboardingData>, advance = true) => {
    setData((d) => ({ ...d, ...patch }));
    if (advance) setTimeout(next, 160);
  }, [next]);

  const toggleInArray = useCallback((key: "assets" | "brokers", value: string) => {
    setData((d) => {
      const cur = d[key];
      return { ...d, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }, []);

  const finish = useCallback(async (skipped: boolean) => {
    setSaving(true);
    const final = skipped
      ? { ...data, goal: data.goal ?? "consistency", pain: data.pain ?? "consistency" }
      : data;
    try {
      await saveOnboarding(userId, final, { skipped });
      if (final.usesIct) await saveConfluences(userId, ICT_CONFLUENCES).catch(() => {});
    } catch (e) {
      console.error("Failed to save onboarding", e);
    } finally {
      onDone();
    }
  }, [data, userId, onDone]);

  const langs = Object.entries(LANG_NAMES) as [Lang, string][];
  const assetNames = data.assets.map((a) => c[ASSET_KEYS[a]]).join(", ");

  return (
    <div className="relative h-dvh w-full overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)" }}>
      <div className="auth-orb w-[500px] h-[500px] bg-cyan-600 -top-40 -left-40" style={{ animationDelay: "0s" }} />
      <div className="auth-orb w-[400px] h-[400px] bg-teal-600 -bottom-32 -right-32" style={{ animationDelay: "-5s" }} />

      {/* Top bar: back · progress · skip */}
      <div className="relative z-20 flex items-center gap-3 px-4 pt-4 md:px-6 max-w-2xl mx-auto w-full">
        {idx > 0 && step !== "reveal" ? (
          <button onClick={back} aria-label="Back"
            className="shrink-0 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : <span className="w-5" />}

        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}>
            <div className="onb-progress-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
        </div>

        {step !== "reveal" && step !== "language" && (
          <button onClick={() => finish(true)} disabled={saving}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            {c.skip} <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 h-[calc(100%-3.5rem)] flex items-center justify-center px-4 py-4 overflow-y-auto">
        <div key={step} className="w-full max-w-lg animate-fade-in-up">

          {step === "language" && (
            <div>
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-cyan-300" />
                </div>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">{c.langTitle}</h2>
              <p className="text-sm text-slate-400 text-center mb-6">{c.langSub}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 onb-in">
                {langs.map(([code, name]) => (
                  <button key={code}
                    onClick={() => { setLang(code); setTimeout(next, 160); }}
                    className={cn("onb-card rounded-2xl p-3.5 border text-center",
                      code === lang
                        ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]")}>
                    <span className={cn("text-sm font-semibold", code === lang ? "text-white" : "text-slate-300")}>
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "welcome" && (
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-5">
                <div className="onb-halo absolute inset-0 rounded-2xl bg-cyan-500/40 blur-xl" />
                <img src={logoSrc} alt="TradeVault" width={64} height={64}
                  className="relative w-16 h-16 rounded-2xl drop-shadow-[0_0_14px_rgba(6,182,212,0.5)]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{c.welcomeTitle}</h1>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mb-7">{c.welcomeSub}</p>
              <div className="grid gap-3 text-left mb-7">
                {[
                  { icon: BookOpen, t: c.feat1T, d: c.feat1D },
                  { icon: BarChart3, t: c.feat2T, d: c.feat2D },
                  { icon: Sparkles, t: c.feat3T, d: c.feat3D },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="glass rounded-2xl p-3.5 flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t}</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={next}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all">
                {c.welcomeCta}
              </button>
              <button onClick={() => finish(true)} disabled={saving}
                className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                {c.welcomeSkip}
              </button>
            </div>
          )}

          {step === "assets" && (
            <StepShell title={c.assetsTitle} sub={c.assetsSub}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 onb-in">
                {ASSETS.map((ch) => (
                  <ChipCard key={ch.id} choice={ch} active={data.assets.includes(ch.id)}
                    onClick={() => toggleInArray("assets", ch.id)} />
                ))}
              </div>
              <ContinueBtn disabled={data.assets.length === 0} onClick={next} label={c.cont} />
            </StepShell>
          )}

          {step === "style" && (
            <StepShell title={c.styleTitle} sub={c.styleSub}>
              <div className="grid gap-2.5 onb-in">
                {STYLES.map((ch) => (
                  <RowCard key={ch.id} choice={ch} active={data.style === ch.id}
                    onClick={() => pick({ style: ch.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "ict" && (
            <StepShell title={c.ictTitle} sub={c.ictSub}>
              <div className="grid grid-cols-2 gap-2.5 onb-in">
                <ChipCard choice={{ id: "yes", label: c.ictYes, icon: Check }}
                  active={data.usesIct} onClick={() => pick({ usesIct: true })} />
                <ChipCard choice={{ id: "no", label: c.ictNo, icon: Layers }}
                  active={false} onClick={() => pick({ usesIct: false })} />
              </div>
            </StepShell>
          )}

          {step === "experience" && (
            <StepShell title={c.expTitle} sub={c.expSub}>
              <div className="grid gap-2.5 onb-in">
                {EXPERIENCE.map((ch) => (
                  <RowCard key={ch.id} choice={ch} active={data.experience === ch.id}
                    onClick={() => pick({ experience: ch.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "goal" && (
            <StepShell title={c.goalTitle} sub={c.goalSub}>
              <div className="grid gap-2.5 onb-in">
                {GOALS.map((ch) => (
                  <RowCard key={ch.id} choice={ch} active={data.goal === ch.id}
                    onClick={() => pick({ goal: ch.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "pain" && (
            <StepShell title={c.painTitle} sub={c.painSub}>
              <div className="grid gap-2.5 onb-in">
                {PAINS.map((ch) => (
                  <RowCard key={ch.id} choice={ch} active={data.pain === ch.id}
                    onClick={() => pick({ pain: ch.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "brokers" && (
            <StepShell title={c.brokersTitle} sub={c.brokersSub}>
              <div className="flex flex-wrap gap-2 justify-center">
                {(data.assets.length ? data.assets : ["futures"])
                  .flatMap((a) => BROKERS_BY_ASSET[a] ?? [])
                  .filter((b, i, arr) => arr.indexOf(b) === i)
                  .map((b) => (
                    <button key={b} onClick={() => toggleInArray("brokers", b)}
                      className={cn("px-3.5 py-2 rounded-full text-sm font-medium border transition-all",
                        data.brokers.includes(b)
                          ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
                          : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20")}>
                      {b}
                    </button>
                  ))}
              </div>
              <ContinueBtn label={data.brokers.length ? c.cont : c.skipAdd} onClick={next} />
            </StepShell>
          )}

          {step === "reveal" && (() => {
            const lines = [
              fmt(c.revealJournal, { assets: assetNames || c.yourMarkets }),
              data.pain ? fmt(c.revealPain, { pain: c[PAIN_KEYS[data.pain]] }) : null,
              data.usesIct ? c.revealIct : null,
              fmt(c.revealLang, { lang: LANG_NAMES[lang] }),
              data.brokers.length > 0 ? fmt(c.revealBrokers, { brokers: data.brokers.join(", ") }) : null,
            ].filter(Boolean) as string[];
            return (
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="onb-halo absolute inset-0 rounded-2xl bg-cyan-500/50 blur-xl" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Rocket className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">{c.revealTitle}</h1>
              {data.goal && <p className="text-cyan-300 font-medium mb-6">{c[MISSION_KEYS[data.goal]]}</p>}

              <div className="glass rounded-2xl p-4 text-left space-y-2.5 mb-6">
                {lines.map((line, i) => (
                  <RevealLine key={i} text={line} delay={0.15 + i * 0.14} />
                ))}
              </div>

              <button onClick={() => finish(false)} disabled={saving}
                className={cn("w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:brightness-110",
                  saving ? "bg-cyan-500/50 text-cyan-200 cursor-wait"
                    : "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20")}>
                {saving ? c.revealSaving : c.revealCta}
              </button>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function StepShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">{title}</h2>
      {sub && <p className="text-sm text-slate-400 text-center mb-6">{sub}</p>}
      {children}
    </div>
  );
}

function ChipCard({ choice, active, onClick }: { choice: Choice; active: boolean; onClick: () => void }) {
  const Icon = choice.icon;
  return (
    <button onClick={onClick}
      className={cn("onb-card relative flex flex-col items-center justify-center gap-2 rounded-2xl p-4 border",
        active ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
          : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]")}>
      {active && <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-cyan-300" />}
      {Icon && <Icon className={cn("w-6 h-6", active ? "text-cyan-300" : "text-slate-400")} />}
      <span className={cn("text-sm font-semibold", active ? "text-white" : "text-slate-300")}>{choice.label}</span>
    </button>
  );
}

function RowCard({ choice, active, onClick }: { choice: Choice; active: boolean; onClick: () => void }) {
  const Icon = choice.icon;
  return (
    <button onClick={onClick}
      className={cn("onb-card flex items-center gap-3.5 rounded-2xl p-3.5 border text-left",
        active ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
          : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]")}>
      {Icon && (
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          active ? "bg-cyan-500/20" : "bg-white/[0.04]")}>
          <Icon className={cn("w-5 h-5", active ? "text-cyan-300" : "text-slate-400")} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-semibold", active ? "text-white" : "text-slate-200")}>{choice.label}</div>
        {choice.desc && <div className="text-xs text-slate-500">{choice.desc}</div>}
      </div>
      {active && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
    </button>
  );
}

function ContinueBtn({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn("w-full mt-6 py-3.5 rounded-xl text-sm font-bold transition-all",
        disabled ? "bg-white/[0.04] text-slate-600 cursor-not-allowed"
          : "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20")}>
      {label}
    </button>
  );
}

function RevealLine({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <div
      className="flex items-start gap-2.5"
      style={{ opacity: 0, animation: `onbInUp 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}s forwards` }}
    >
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-emerald-500/20">
        <Check className="w-3 h-3 text-emerald-400" />
      </div>
      <span className="text-sm text-slate-300">{text}</span>
    </div>
  );
}
