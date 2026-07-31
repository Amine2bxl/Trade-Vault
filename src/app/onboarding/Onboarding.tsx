import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  PlayCircle,
  Loader2,
  Compass,
  Target,
  Layers,
  GraduationCap,
  UserRound,
  Globe,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, type OnboardingData } from "../store";
import { oc } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo.png";

/** What the user picked on the quick-start step — App.tsx acts on it. */
export type OnboardingAction = "import" | "demo" | null;

// Refonte Phase 1 : 3 moments au lieu de 6.
//   1. IDENTITÉ  — prénom + langue (Jarvis s'adresse à toi par ton prénom)
//   2. PROFIL    — style, marchés, expérience, objectif, faiblesse, cible, ICT
//   3. C'EST PARTI — Import CSV / Démo / Démarrer à zéro (3 cartes)
// La demande de permission push a été RETIRÉE du flux (demandée au bon moment,
// dans Settings) ; la sauvegarde est atomique (retry si échec).
type StepKey = "identity" | "profile" | "start";

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

export default function Onboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (action?: OnboardingAction) => void;
}) {
  const { lang, setLang, t } = useT();
  const fr = lang === "fr";
  const c = oc(lang);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState<OnboardingAction | "fresh" | null>(null);
  const [saveError, setSaveError] = useState(false);
  // Prénom — mémorisé par Jarvis (voix de bienvenue, emails).
  const [firstName, setFirstName] = useState("");
  // Profiling answers (all optional — skipping keeps safe defaults).
  const [style, setStyle] = useState<string | null>(null);
  const [pain, setPain] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [usesIct, setUsesIct] = useState(false);

  const steps: StepKey[] = ["identity", "profile", "start"];
  const step = steps[Math.min(idx, steps.length - 1)];
  const progress = (idx + 1) / steps.length;

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  // Atomic save : on ne quitte l'onboarding QUE si la sauvegarde réussit
  // (sinon `onboarded_at` n'est pas posé et le flux recommencerait au prochain
  // chargement). En cas d'échec → message + retry.
  const finish = useCallback(
    async (action: OnboardingAction) => {
      if (saving) return;
      setSaving(action ?? "fresh");
      setSaveError(false);
      const parsed = parseFloat(target.replace(",", "."));
      const monthlyTarget = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : null;
      try {
        await saveOnboarding(
          userId,
          { ...EMPTY, style, pain, monthlyTarget, goal, experience, assets, usesIct },
          { skipped: false, firstName },
        );
        onDone(action);
      } catch (e) {
        console.error("Failed to save onboarding", e);
        setSaveError(true);
        setSaving(null);
      }
    },
    [saving, userId, onDone, style, pain, target, goal, experience, assets, usesIct, firstName],
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
          {/* ── MOMENT 1 · IDENTITÉ ── */}
          {step === "identity" && (
            <div>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="onb-halo absolute inset-0 rounded-2xl bg-cyan-500/40 blur-xl" />
                  <img
                    src={logoSrc}
                    alt="TradeVault"
                    width={64}
                    height={64}
                    className="relative w-16 h-16 rounded-2xl drop-shadow-[0_0_14px_rgba(6,182,212,0.5)]"
                  />
                </div>
              </div>

              <div className="flex justify-center mb-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <UserRound className="w-5 h-5 text-cyan-300" />
                </div>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {t("onb.nameTitle")}
              </h1>
              <p className="text-sm text-slate-400 text-center mb-5 max-w-sm mx-auto">
                {t("onb.nameSub")}
              </p>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
                placeholder={t("onb.namePlaceholder")}
                maxLength={40}
                className="w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 text-center text-lg font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
              />

              <div className="mt-5 mb-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <Globe className="w-4 h-4 text-cyan-300" />
                  <span className="text-xs font-semibold text-slate-400">{c.langTitle}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 onb-in">
                  {langs.map(([code, name]) => (
                    <button
                      key={code}
                      onClick={() => setLang(code)}
                      className={cn(
                        "onb-card rounded-xl px-3 py-2.5 border text-center text-[13px] font-semibold",
                        code === lang
                          ? "bg-cyan-500/15 border-cyan-400/50 text-white"
                          : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20",
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={next}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
              >
                {t("onb.nameCta")} <ArrowRight className="w-4 h-4 inline-block -mt-0.5" />
              </button>
            </div>
          )}

          {/* ── MOMENT 2 · PROFIL TRADER ── */}
          {step === "profile" && (
            <div>
              <div className="text-center mb-5">
                <div className="flex justify-center mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                    <Compass className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-1.5">
                  {t("onb.profileTitle")}
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">{t("onb.profileSub")}</p>
              </div>

              {/* Style */}
              <h2 className="text-base font-bold text-white text-center mb-1">{c.styleTitle}</h2>
              <p className="text-xs text-slate-400 text-center mb-3">{c.styleSub}</p>
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

              {/* Marchés */}
              <div className="flex items-center gap-2 justify-center mb-1">
                <Layers className="w-4 h-4 text-cyan-300" />
                <h2 className="text-base font-bold text-white text-center">{c.assetsTitle}</h2>
              </div>
              <p className="text-xs text-slate-400 text-center mb-3">{c.assetsSub}</p>
              <div className="flex flex-wrap justify-center gap-2 mb-6 onb-in">
                {(
                  [
                    ["futures", c.aFutures],
                    ["forex", c.aForex],
                    ["stocks", c.aStocks],
                    ["options", c.aOptions],
                    ["crypto", c.aCrypto],
                  ] as const
                ).map(([id, label]) => {
                  const on = assets.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() =>
                        setAssets((a) => (on ? a.filter((x) => x !== id) : [...a, id]))
                      }
                      className={cn(
                        "onb-card rounded-xl px-3.5 py-2 border text-[13px] font-semibold",
                        on
                          ? "bg-cyan-500/15 border-cyan-400/50 text-white"
                          : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Expérience */}
              <div className="flex items-center gap-2 justify-center mb-1">
                <GraduationCap className="w-4 h-4 text-cyan-300" />
                <h2 className="text-base font-bold text-white text-center">{c.expTitle}</h2>
              </div>
              <p className="text-xs text-slate-400 text-center mb-3">{c.expSub}</p>
              <div className="grid grid-cols-2 gap-2 mb-6 onb-in">
                {(
                  [
                    ["new", c.eNew, c.eNewD],
                    ["intermediate", c.eInt, c.eIntD],
                    ["seasoned", c.eSea, c.eSeaD],
                    ["funded", c.eFund, c.eFundD],
                  ] as const
                ).map(([id, label, desc]) => (
                  <button
                    key={id}
                    onClick={() => setExperience(experience === id ? null : id)}
                    className={cn(
                      "onb-card rounded-2xl px-3 py-2.5 border text-left",
                      experience === id
                        ? "bg-cyan-500/15 border-cyan-400/50"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[13px] font-semibold",
                        experience === id ? "text-white" : "text-slate-300",
                      )}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight">{desc}</div>
                  </button>
                ))}
              </div>

              {/* Objectif */}
              <h2 className="text-base font-bold text-white text-center mb-1">{c.goalTitle}</h2>
              <p className="text-xs text-slate-400 text-center mb-3">{c.goalSub}</p>
              <div className="grid grid-cols-2 gap-2 mb-6 onb-in">
                {(
                  [
                    ["consistency", c.gCons, c.gConsD],
                    ["prop_challenge", c.gProp, c.gPropD],
                    ["discipline", c.gDisc, c.gDiscD],
                    ["fulltime", c.gFull, c.gFullD],
                    ["side", c.gSide, c.gSideD],
                  ] as const
                ).map(([id, label, desc]) => (
                  <button
                    key={id}
                    onClick={() => setGoal(goal === id ? null : id)}
                    className={cn(
                      "onb-card rounded-2xl px-3 py-2.5 border text-left",
                      goal === id
                        ? "bg-cyan-500/15 border-cyan-400/50"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[13px] font-semibold",
                        goal === id ? "text-white" : "text-slate-300",
                      )}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight">{desc}</div>
                  </button>
                ))}
              </div>

              {/* Faiblesse déclarée */}
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

              {/* Cible mensuelle */}
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

              {/* ICT */}
              <div className="flex items-center gap-2 justify-center mb-1">
                <Compass className="w-4 h-4 text-cyan-300" />
                <h2 className="text-base font-bold text-white text-center">{c.ictTitle}</h2>
              </div>
              <p className="text-xs text-slate-400 text-center mb-3">{c.ictSub}</p>
              <div className="grid grid-cols-2 gap-2 max-w-[280px] mx-auto mb-7 onb-in">
                {(
                  [
                    [true, c.ictYes],
                    [false, c.ictNo],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={String(val)}
                    onClick={() => setUsesIct(val)}
                    className={cn(
                      "onb-card rounded-xl px-3 py-2.5 border text-[13px] font-semibold text-center",
                      usesIct === val
                        ? "bg-cyan-500/15 border-cyan-400/50 text-white"
                        : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20",
                    )}
                  >
                    {label}
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

          {/* ── MOMENT 3 · C'EST PARTI ── */}
          {step === "start" && (
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1.5">
                {c.startTitle}
              </h2>
              <p className="text-sm text-slate-400 text-center mb-6">{c.startSub}</p>

              {saveError && (
                <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3.5 py-3 flex items-center gap-2.5">
                  <p className="flex-1 text-[12.5px] text-red-300">{t("onb.saveError")}</p>
                  <button
                    onClick={() => setSaveError(false)}
                    className="text-xs font-bold text-red-200 hover:text-white transition-colors"
                  >
                    {t("onb.saveRetry")}
                  </button>
                </div>
              )}

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
