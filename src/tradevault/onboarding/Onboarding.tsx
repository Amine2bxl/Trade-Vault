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
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, type OnboardingData } from "../store";
import { oc } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo.png";

/** What the user picked on the quick-start step — App.tsx acts on it. */
export type OnboardingAction = "import" | "demo" | null;

type StepKey = "language" | "welcome" | "start";

const EMPTY: OnboardingData = {
  goal: null,
  assets: [],
  style: null,
  experience: null,
  usesIct: false,
  brokers: [],
  pain: null,
  onboardedAt: null,
  skipped: false,
};

/**
 * Deliberately minimal onboarding (aha moment < 2 min): pick a language, one
 * welcome screen, then straight to filling the journal — CSV import first,
 * demo trades as the no-data fallback. All profiling questions were removed;
 * the pre-market checklist wizard self-configures with safe defaults instead.
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

  const steps: StepKey[] = ["language", "welcome", "start"];
  const step = steps[Math.min(idx, steps.length - 1)];
  const progress = (idx + 1) / steps.length;

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const finish = useCallback(
    async (action: OnboardingAction) => {
      if (saving) return;
      setSaving(action ?? "fresh");
      try {
        await saveOnboarding(userId, EMPTY, { skipped: false });
      } catch (e) {
        console.error("Failed to save onboarding", e);
      } finally {
        onDone(action);
      }
    },
    [saving, userId, onDone],
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
