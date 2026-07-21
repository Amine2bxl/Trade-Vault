import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  PlayCircle,
  Loader2,
  Compass,
  Trophy,
  Wallet,
  GraduationCap,
  ClipboardCheck,
  Sparkles,
  Flame,
  Check,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, type OnboardingData } from "../store";
import { track } from "../utils/analytics";
import { oc, fmt } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo.png";

/** What the user picked on the quick-start step — App.tsx acts on it. */
export type OnboardingAction = "import" | "demo" | null;

type StepKey = "situation" | "profile" | "mirror" | "start";

const EMPTY: OnboardingData = {
  situation: null,
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
 * Onboarding V2 (aha moment < 2 min) — every question pays back on screen:
 *   1. situation (prop challenge / own account / learning) — shapes the copy,
 *   2. ONE profile screen (style + biggest leak, cards only, zero typing),
 *   3. the mirror: "your plan" built deterministically from the answers,
 *   4. quick start: DEMO by default (the wow never fails), CSV import second.
 * Language is auto (existing default) with a discreet switcher on step 1.
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
  const [situation, setSituation] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [pain, setPain] = useState<string | null>(null);

  const steps: StepKey[] = ["situation", "profile", "mirror", "start"];
  const step = steps[Math.min(idx, steps.length - 1)];
  const progress = (idx + 1) / steps.length;

  useEffect(() => {
    track("onboarding_step", { step });
  }, [step]);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const finish = useCallback(
    async (action: OnboardingAction) => {
      if (saving) return;
      setSaving(action ?? "fresh");
      try {
        await saveOnboarding(userId, { ...EMPTY, situation, style, pain }, { skipped: false });
      } catch (e) {
        console.error("Failed to save onboarding", e);
      } finally {
        track("onboarding_completed", { action: action ?? "fresh" });
        onDone(action);
      }
    },
    [saving, userId, onDone, situation, style, pain],
  );

  const langs = Object.entries(LANG_NAMES) as [Lang, string][];
  const painLabel =
    pain === "emotions"
      ? c.pEmo
      : pain === "consistency"
        ? c.pCons
        : pain === "overtrading"
          ? c.pOver
          : pain === "risk"
            ? c.pRisk
            : pain === "journaling"
              ? c.pJour
              : c.pEmo;

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

      {/* Top bar: back · progress · discreet language switcher */}
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

        <select
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-cyan-500/40"
        >
          {langs.map(([code, name]) => (
            <option key={code} value={code} className="bg-slate-900">
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Body */}
      <div className="relative z-10 h-[calc(100%-3.5rem)] flex items-center justify-center px-4 py-4 overflow-y-auto">
        <div key={step} className="w-full max-w-lg animate-fade-in-up">
          {step === "situation" && (
            <div>
              <div className="flex justify-center mb-4">
                <img
                  src={logoSrc}
                  alt="TradeVault"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-2xl drop-shadow-[0_0_14px_rgba(6,182,212,0.5)]"
                />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {c.sitTitle}
              </h1>
              <p className="text-sm text-slate-400 text-center mb-6">{c.sitSub}</p>
              <div className="grid gap-3 onb-in">
                {(
                  [
                    ["prop", Trophy, c.sitProp, c.sitPropD],
                    ["real", Wallet, c.sitReal, c.sitRealD],
                    ["learning", GraduationCap, c.sitLearn, c.sitLearnD],
                  ] as const
                ).map(([id, Icon, label, desc]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setSituation(id);
                      setTimeout(next, 160);
                    }}
                    className={cn(
                      "onb-card flex items-start gap-3.5 rounded-2xl p-4 border text-left",
                      situation === id
                        ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{label}</div>
                      <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
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
              <div className="grid grid-cols-2 gap-2 mb-7 onb-in">
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

          {step === "mirror" && (
            <div>
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-emerald-300" />
                </div>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {c.revealTitle}
              </h2>
              <p className="text-sm text-slate-400 text-center mb-6">{c.mirrorTitle}</p>
              <div className="grid gap-3 text-left mb-7 onb-in">
                {[
                  { icon: ClipboardCheck, text: c.mirrorPlanChecklist },
                  ...(pain
                    ? [{ icon: Sparkles, text: fmt(c.mirrorPlanCoach, { pain: painLabel }) }]
                    : []),
                  { icon: Flame, text: c.mirrorPlanReview },
                  ...(situation === "prop" ? [{ icon: Trophy, text: c.mirrorPropExtra }] : []),
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="glass rounded-2xl p-3.5 flex gap-3 items-center">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div className="text-sm text-slate-200">{text}</div>
                    <Check className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
                  </div>
                ))}
              </div>
              <button
                onClick={next}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
              >
                {c.revealCta}
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
                {/* Primary: demo — the first wow can never fail */}
                <button
                  onClick={() => finish("demo")}
                  disabled={!!saving}
                  className="onb-card relative flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-cyan-500/[0.1] border-cyan-400/40 shadow-lg shadow-cyan-500/10 hover:bg-cyan-500/[0.15] transition-all disabled:opacity-60"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/25">
                    {saving === "demo" ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <PlayCircle className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      {c.startDemo} <ArrowRight className="w-3.5 h-3.5 text-cyan-300" />
                    </div>
                    <div className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      {c.startDemoD}
                    </div>
                  </div>
                </button>

                {/* Secondary: CSV import (falls back to demo on failure) */}
                <button
                  onClick={() => finish("import")}
                  disabled={!!saving}
                  className="onb-card flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all disabled:opacity-60"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                    {saving === "import" ? (
                      <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-cyan-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{c.startImport}</div>
                    <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      {c.startImportD}
                    </div>
                  </div>
                </button>
              </div>

              {saving === "fresh" && (
                <div className="w-full mt-5 py-2.5 text-center text-xs text-slate-500">
                  {c.startWorking}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
