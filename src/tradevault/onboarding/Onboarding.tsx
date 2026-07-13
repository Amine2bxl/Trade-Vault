import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3, DollarSign, TrendingUp, Layers, Bitcoin,
  Zap, Sun, Waves, Mountain,
  Sprout, Dumbbell, ShieldCheck, Trophy,
  Target, Flag, Briefcase, Coins, Brain,
  Repeat, Flame, Shield, NotebookPen, Activity,
  Globe, Check, ArrowLeft, SkipForward, Sparkles, Rocket, BookOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, saveConfluences, type OnboardingData } from "../store";
import logoSrc from "@/assets/tradevault-logo.png";

type StepKey =
  | "welcome" | "assets" | "style" | "ict" | "experience"
  | "goal" | "pain" | "brokers" | "reveal";

interface Choice { id: string; label: string; desc?: string; icon?: LucideIcon }

const ASSETS: Choice[] = [
  { id: "futures", label: "Futures", icon: BarChart3 },
  { id: "forex", label: "Forex", icon: DollarSign },
  { id: "stocks", label: "Stocks", icon: TrendingUp },
  { id: "options", label: "Options", icon: Layers },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
];

const STYLES: Choice[] = [
  { id: "scalper", label: "Scalper", desc: "In and out. Seconds to minutes.", icon: Zap },
  { id: "day", label: "Day Trader", desc: "Flat by the close. No overnight risk.", icon: Sun },
  { id: "swing", label: "Swing", desc: "Days to weeks. Riding the bigger move.", icon: Waves },
  { id: "position", label: "Position", desc: "Weeks to months. Macro conviction.", icon: Mountain },
];

const EXPERIENCE: Choice[] = [
  { id: "new", label: "Just started", desc: "Under a year", icon: Sprout },
  { id: "intermediate", label: "Getting reps in", desc: "1–3 years", icon: Dumbbell },
  { id: "seasoned", label: "Seasoned", desc: "3 years+", icon: ShieldCheck },
  { id: "funded", label: "Funded / Prop", desc: "Trading allocated capital", icon: Trophy },
];

const GOALS: Choice[] = [
  { id: "consistency", label: "Get consistent", desc: "Stop giving back the winners.", icon: Target },
  { id: "prop_challenge", label: "Pass a prop challenge", desc: "Hit the target, respect the rules.", icon: Flag },
  { id: "full_time", label: "Go full-time", desc: "Replace the paycheck.", icon: Briefcase },
  { id: "side_income", label: "Side income", desc: "Stack extra, low stress.", icon: Coins },
  { id: "discipline", label: "Build discipline", desc: "Master the mind, not just the charts.", icon: Brain },
];

const PAINS: Choice[] = [
  { id: "consistency", label: "Consistency", desc: "Green week, red week, repeat.", icon: Repeat },
  { id: "emotion", label: "Emotional control", desc: "Revenge trades, FOMO, tilt.", icon: Flame },
  { id: "risk", label: "Risk management", desc: "One trade wrecks the month.", icon: Shield },
  { id: "journaling", label: "Journaling", desc: "I don't log, so I don't learn.", icon: NotebookPen },
  { id: "overtrading", label: "Overtrading", desc: "Can't sit on my hands.", icon: Activity },
];

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

// The reveal sentence assembled from the answers, so it reads like it was
// written about this specific trader.
function identitySentence(d: OnboardingData): string {
  const style = d.style ? STYLES.find((s) => s.id === d.style)?.label.toLowerCase() : null;
  const asset = d.assets[0] ? ASSETS.find((a) => a.id === d.assets[0])?.label.toLowerCase() : null;
  const goalPhrase: Record<string, string> = {
    consistency: "hunting consistency",
    prop_challenge: "chasing the payout",
    full_time: "going full-time",
    side_income: "stacking on the side",
    discipline: "building discipline",
  };
  const who = [style, asset].filter(Boolean).join(" ") || "trader";
  const tail = d.goal ? goalPhrase[d.goal] ?? "" : "";
  return `Built for a ${who}${style || asset ? " trader" : ""}${tail ? " " + tail : ""}.`;
}

export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { lang, setLang } = useT();
  const [data, setData] = useState<OnboardingData>({
    goal: null, assets: [], style: null, experience: null,
    usesIct: false, brokers: [], pain: null, onboardedAt: null, skipped: false,
  });
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // ICT micro-step only surfaces for the community that actually uses it:
  // fast intraday futures/forex/crypto traders.
  const showIct =
    (data.assets.includes("futures") || data.assets.includes("forex") || data.assets.includes("crypto")) &&
    (data.style === "scalper" || data.style === "day");

  const steps: StepKey[] = useMemo(() => {
    const s: StepKey[] = ["welcome", "assets", "style"];
    if (showIct) s.push("ict");
    s.push("experience", "goal", "pain", "brokers", "reveal");
    return s;
  }, [showIct]);

  const step = steps[Math.min(idx, steps.length - 1)];
  const dataStepCount = steps.length - 2; // exclude welcome + reveal
  const dataStepNo = Math.max(0, Math.min(idx, dataStepCount)); // 0 on welcome
  const progress = step === "welcome" ? 0.12 : step === "reveal" ? 1 : dataStepNo / dataStepCount;

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const pick = useCallback((patch: Partial<OnboardingData>, advance = true) => {
    setData((d) => ({ ...d, ...patch }));
    if (advance) setTimeout(next, 160); // brief highlight before advancing
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
      onDone(); // never trap the user in the flow, even if the write failed
    }
  }, [data, userId, onDone]);

  const langs = Object.entries(LANG_NAMES) as [Lang, string][];

  return (
    <div className="relative h-dvh w-full overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)" }}>
      <div className="auth-orb w-[500px] h-[500px] bg-cyan-600 -top-40 -left-40" style={{ animationDelay: "0s" }} />
      <div className="auth-orb w-[400px] h-[400px] bg-teal-600 -bottom-32 -right-32" style={{ animationDelay: "-5s" }} />

      {/* Top bar: back · progress · language · skip */}
      <div className="relative z-20 flex items-center gap-3 px-4 pt-4 md:px-6 max-w-2xl mx-auto w-full">
        {idx > 0 && step !== "reveal" ? (
          <button onClick={back} aria-label="Back"
            className="shrink-0 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : <span className="w-5" />}

        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <div className="relative shrink-0">
          <button onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs font-medium">
            <Globe className="w-4 h-4" /> {lang.toUpperCase()}
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-2 w-40 max-h-64 overflow-y-auto glass-strong rounded-xl p-1 z-30 animate-fade-in">
              {langs.map(([code, name]) => (
                <button key={code}
                  onClick={() => { setLang(code); setLangOpen(false); }}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    code === lang ? "bg-cyan-500/20 text-cyan-300" : "text-slate-300 hover:bg-white/[0.06]")}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {step !== "reveal" && (
          <button onClick={() => finish(true)} disabled={saving}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Skip <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 h-[calc(100%-3.5rem)] flex items-center justify-center px-4 py-4 overflow-y-auto">
        <div key={step} className="w-full max-w-lg animate-fade-in-up">

          {step === "welcome" && (
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl bg-cyan-500/40 blur-xl opacity-70" />
                <img src={logoSrc} alt="TradeVault" width={64} height={64}
                  className="relative w-16 h-16 rounded-2xl drop-shadow-[0_0_14px_rgba(6,182,212,0.5)]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Welcome to TradeVault</h1>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mb-7">
                Your trading journal, built to find your edge. Log every trade, see what's
                actually working, and fix the leaks — before they cost you.
              </p>
              <div className="grid gap-3 text-left mb-7">
                {[
                  { icon: BookOpen, t: "Journal every trade", d: "Entries, exits, screenshots, mistakes — one clean log." },
                  { icon: BarChart3, t: "See your real edge", d: "Win rate, R-multiples, and analytics that don't lie." },
                  { icon: Sparkles, t: "AI insights + checklist", d: "Spot patterns and lock in your process before the bell." },
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
                Set it up — takes 30 seconds
              </button>
              <button onClick={() => finish(true)} disabled={saving}
                className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Skip, I'll explore on my own
              </button>
            </div>
          )}

          {step === "assets" && (
            <StepShell title="What do you trade?" sub="Pick all that apply. We'll talk in your units.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ASSETS.map((c) => (
                  <ChipCard key={c.id} choice={c} active={data.assets.includes(c.id)}
                    onClick={() => toggleInArray("assets", c.id)} />
                ))}
              </div>
              <ContinueBtn disabled={data.assets.length === 0} onClick={next} />
            </StepShell>
          )}

          {step === "style" && (
            <StepShell title="How do you trade it?" sub="Your bread and butter.">
              <div className="grid gap-2.5">
                {STYLES.map((c) => (
                  <RowCard key={c.id} choice={c} active={data.style === c.id}
                    onClick={() => pick({ style: c.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "ict" && (
            <StepShell title="Do you trade ICT / SMC concepts?" sub="Order blocks, liquidity, FVGs, killzones.">
              <div className="grid grid-cols-2 gap-2.5">
                <ChipCard choice={{ id: "yes", label: "Yes, that's me", icon: Check }}
                  active={data.usesIct} onClick={() => pick({ usesIct: true })} />
                <ChipCard choice={{ id: "no", label: "Not really", icon: Layers }}
                  active={false} onClick={() => pick({ usesIct: false })} />
              </div>
            </StepShell>
          )}

          {step === "experience" && (
            <StepShell title="How long you been at this?" sub="No judgment — this just tunes what we show you.">
              <div className="grid gap-2.5">
                {EXPERIENCE.map((c) => (
                  <RowCard key={c.id} choice={c} active={data.experience === c.id}
                    onClick={() => pick({ experience: c.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "goal" && (
            <StepShell title="What's the mission right now?" sub="The real reason you opened this journal.">
              <div className="grid gap-2.5">
                {GOALS.map((c) => (
                  <RowCard key={c.id} choice={c} active={data.goal === c.id}
                    onClick={() => pick({ goal: c.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "pain" && (
            <StepShell title="What's costing you the most?" sub="Be honest — this is where we start.">
              <div className="grid gap-2.5">
                {PAINS.map((c) => (
                  <RowCard key={c.id} choice={c} active={data.pain === c.id}
                    onClick={() => pick({ pain: c.id })} />
                ))}
              </div>
            </StepShell>
          )}

          {step === "brokers" && (
            <StepShell title="Where do you execute?" sub="For one-tap CSV import later. No login now — just the name.">
              <div className="flex flex-wrap gap-2 justify-center">
                {(data.assets.length ? data.assets : ["futures"])
                  .flatMap((a) => BROKERS_BY_ASSET[a] ?? [])
                  .filter((b, i, arr) => arr.indexOf(b) === i)
                  .concat("Other")
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
              <ContinueBtn label={data.brokers.length ? "Continue" : "Skip, I'll add later"} onClick={next} />
            </StepShell>
          )}

          {step === "reveal" && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Rocket className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">Your vault's ready.</h1>
              <p className="text-cyan-300 font-medium mb-6">{identitySentence(data)}</p>

              <div className="glass rounded-2xl p-4 text-left space-y-2.5 mb-6">
                <RevealLine ok text={`Journal set up for ${data.assets.length
                  ? data.assets.map((a) => ASSETS.find((x) => x.id === a)?.label).join(", ")
                  : "your markets"}`} />
                {data.pain && (
                  <RevealLine ok text={`We'll start with your biggest leak: ${PAINS.find((p) => p.id === data.pain)?.label.toLowerCase()}`} />
                )}
                {data.usesIct && <RevealLine ok text="ICT / SMC confluence checklist loaded" />}
                <RevealLine ok text={`Language set to ${LANG_NAMES[lang]}`} />
                {data.brokers.length > 0 && (
                  <RevealLine ok text={`${data.brokers.join(", ")} import ready in Settings`} />
                )}
              </div>

              <button onClick={() => finish(false)} disabled={saving}
                className={cn("w-full py-3.5 rounded-xl text-sm font-bold transition-all",
                  saving ? "bg-cyan-500/50 text-cyan-200 cursor-wait"
                    : "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20")}>
                {saving ? "Setting up…" : "Enter TradeVault →"}
              </button>
            </div>
          )}
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
      className={cn("relative flex flex-col items-center justify-center gap-2 rounded-2xl p-4 border transition-all",
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
      className={cn("flex items-center gap-3.5 rounded-2xl p-3.5 border text-left transition-all",
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

function ContinueBtn({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn("w-full mt-6 py-3.5 rounded-xl text-sm font-bold transition-all",
        disabled ? "bg-white/[0.04] text-slate-600 cursor-not-allowed"
          : "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20")}>
      {label}
    </button>
  );
}

function RevealLine({ text, ok }: { text: string; ok?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        ok ? "bg-emerald-500/20" : "bg-white/[0.06]")}>
        <Check className="w-3 h-3 text-emerald-400" />
      </div>
      <span className="text-sm text-slate-300">{text}</span>
    </div>
  );
}
