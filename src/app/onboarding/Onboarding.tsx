import { useCallback, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Sparkles,
  Globe,
  ArrowLeft,
  ArrowRight,
  Upload,
  PlayCircle,
  Loader2,
  Compass,
  Target,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, type OnboardingData } from "../store";
import { track } from "../utils/analytics";
import { oc } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo.png";

/** What the user picked on the quick-start step — App.tsx acts on it. */
export type OnboardingAction = "import" | "demo" | null;

type StepKey = "language" | "welcome" | "profile" | "start";

const EMPTY: OnboardingData = {
  goal: null,
  assets: [],
  style: null,
  experience: null,
  usesIct: false,
  brokers: [],
  pain: null,
  monthlyTarget: null,
  onboardedAt: null,
  skipped: false,
};

/**
 * Minimal onboarding (aha moment < 2 min): language, welcome, then ONE
 * profiling screen with the 3 questions that drive the adaptive checklist
 * (style · biggest weakness · realistic monthly target), then straight to
 * filling the journal — CSV import first, demo trades as fallback. Every
 * profile question is skippable; safe defaults keep everything working.
 */
export default function Onboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (action?: OnboardingAction) => void;
}) {
  const { lang, setLang } = useT();
  const c = oc(lang);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState<OnboardingAction | "fresh" | null>(null);
  // The 3 profiling answers (all optional — skipping keeps safe defaults).
  const [style, setStyle] = useState<string | null>(null);
  const [pain, setPain] = useState<string | null>(null);
  const [target, setTarget] = useState("");

  const steps: StepKey[] = ["language", "welcome", "profile", "start"];
  const step = steps[Math.min(idx, steps.length - 1)];
  const progress = (idx + 1) / steps.length;

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const finish = useCallback(
    async (action: OnboardingAction) => {
      if (saving) return;
      setSaving(action ?? "fresh");
      const parsed = parseFloat(target.replace(",", "."));
      const monthlyTarget = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : null;
      try {
        await saveOnboarding(userId, { ...EMPTY, style, pain, monthlyTarget }, { skipped: false });
      } catch (e) {
        console.error("Failed to save onboarding", e);
      } finally {
        track("onboarding_completed", { action: action ?? "fresh" });
        onDone(action);
      }
    },
    [saving, userId, onDone, style, pain, target],
  );

  const langs = Object.entries(LANG_NAMES) as [Lang, string][];

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)" }}
    >
      <div
        className="auth-orb w-[500px] h-[500px] bg-cyan-600 -top-40 -left-40"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="auth-orb w-[400px] h-[400px] bg-teal-600 -bottom-32 -right-32"
        style={{ animationDelay: "-5s" }}
      />

      {/* Top bar: back · progress */}
      <div className="relative z-20 flex items-center gap-3 px-4 pt-4 md:px-6 max-w-2xl mx-auto w-full">
        {idx > 0 ? (
          <button
            onClick={back}
            aria-label={c.skip}
            className="shrink-0 w-11 h-11 -m-2.5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          >
            <div className="onb-progress-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
        </div>
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
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {c.langTitle}
              </h2>
              <p className="text-sm text-slate-400 text-center mb-6">{c.langSub}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 onb-in">
                {langs.map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLang(code);
                      setTimeout(next, 160);
                    }}
                    className={cn(
                      "onb-card rounded-2xl p-3.5 border text-center min-h-[44px]",
                      code === lang
                        ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        code === lang ? "text-white" : "text-slate-300",
                      )}
                    >
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
                <img
                  src={logoSrc}
                  alt="TradeVault"
                  width={64}
                  height={64}
                  className="relative w-16 h-16 rounded-2xl drop-shadow-[0_0_14px_rgba(6,182,212,0.5)]"
                />
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
              <button
                onClick={next}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
              >
                {c.welcomeCta}
              </button>
              <button
                onClick={() => finish(null)}
                disabled={!!saving}
                className="mt-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {c.welcomeSkip}
              </button>
            </div>
          )}

          {step === "profile" && (
            <div>
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                  <Compass className="w-6 h-6 text-cyan-300" />
                </div>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {c.styleTitle}
              </h2>
              <p className="text-sm text-slate-400 text-center mb-4">{c.styleSub}</p>
              <div className="grid grid-cols-3 gap-2 mb-6 onb-in">
                {(
                  [
                    ["scalping", c.sScalper, c.sScalperD],
                    ["daytrading", c.sDay, c.sDayD],
                    ["swing", c.sSwing, c.sSwingD],
                  ] as const
                ).map(([id, label, desc]) => (
                  <button
                    key={id}
                    onClick={() => setStyle(style === id ? null : id)}
                    className={cn(
                      "onb-card rounded-2xl p-3 border text-center",
                      style === id
                        ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-bold",
                        style === id ? "text-white" : "text-slate-300",
                      )}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{desc}</div>
                  </button>
                ))}
              </div>

              <h2 className="text-base font-bold text-white text-center mb-1">{c.painTitle}</h2>
              <p className="text-xs text-slate-400 text-center mb-3">{c.painSub}</p>
              <div className="grid grid-cols-2 gap-2 mb-6 onb-in">
                {(
                  [
                    ["emotions", c.pEmo, c.pEmoD],
                    ["consistency", c.pCons, c.pConsD],
                    ["overtrading", c.pOver, c.pOverD],
                    ["risk", c.pRisk, c.pRiskD],
                    ["journaling", c.pJour, c.pJourD],
                  ] as const
                ).map(([id, label, desc]) => (
                  <button
                    key={id}
                    onClick={() => setPain(pain === id ? null : id)}
                    className={cn(
                      "onb-card rounded-2xl px-3 py-2.5 border text-left",
                      pain === id
                        ? "bg-cyan-500/15 border-cyan-400/50"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[13px] font-semibold",
                        pain === id ? "text-white" : "text-slate-300",
                      )}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight">{desc}</div>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 justify-center mb-1">
                <Target className="w-4 h-4 text-cyan-300" />
                <h2 className="text-base font-bold text-white text-center">{c.targetTitle}</h2>
              </div>
              <p className="text-xs text-slate-400 text-center mb-3">{c.targetSub}</p>
              <div className="relative max-w-[200px] mx-auto mb-7">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.5}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="3"
                  className="w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-4 pr-10 text-center text-lg font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  %
                </span>
              </div>

              <button
                onClick={next}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
              >
                {c.cont}
              </button>
              <button
                onClick={next}
                className="w-full mt-2.5 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {c.skip}
              </button>
            </div>
          )}

          {step === "start" && (
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {c.startTitle}
              </h2>
              <p className="text-sm text-slate-400 text-center mb-6">{c.startSub}</p>

              <div className="grid gap-3 onb-in">
                {/* Primary: CSV import */}
                <button
                  onClick={() => finish("import")}
                  disabled={!!saving}
                  className="onb-card relative flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-cyan-500/[0.1] border-cyan-400/40 shadow-lg shadow-cyan-500/10 hover:bg-cyan-500/[0.15] transition-all disabled:opacity-60"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/25">
                    {saving === "import" ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      {c.startImport} <ArrowRight className="w-3.5 h-3.5 text-cyan-300" />
                    </div>
                    <div className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      {c.startImportD}
                    </div>
                  </div>
                </button>

                {/* Alternative: demo trades */}
                <button
                  onClick={() => finish("demo")}
                  disabled={!!saving}
                  className="onb-card flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all disabled:opacity-60"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                    {saving === "demo" ? (
                      <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                    ) : (
                      <PlayCircle className="w-5 h-5 text-cyan-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{c.startDemo}</div>
                    <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      {c.startDemoD}
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => finish(null)}
                disabled={!!saving}
                className="w-full mt-5 py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {saving === "fresh" ? c.startWorking : c.startFresh}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
