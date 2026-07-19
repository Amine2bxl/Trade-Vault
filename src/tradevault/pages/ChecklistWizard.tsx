import { useMemo, useState } from "react";
import { Check, ArrowLeft, Sparkles, Clock, ShieldCheck, X } from "lucide-react";
import { cn } from "../utils/cn";
import type { ChkItem, ChkTemplate } from "./checklistDefaults";

/* A friendly, beginner-first setup for the pre-market checklist. Three tiny
   steps, plain language, big tap targets — no jargon, nothing to drag. It
   pre-selects everything from the user's onboarding profile, so a new trader
   can just tap "Create" and be done. Advanced editing still lives in the
   config panel for anyone who wants it. */

export interface WizardToggles {
  oneTrade: boolean;
  news: boolean;
  rr: boolean;
  dd: boolean;
}
export interface WizardResult {
  items: ChkItem[];
  startTime: string;
  timeZone: string;
}

const isFr = (lang: string) => lang === "fr";

// Beginner-friendly one-liners per preset (the template names stay as-is).
function presetBlurb(id: string, fr: boolean): string {
  const m: Record<string, [string, string]> = {
    simple: ["3 checks. Parfait pour débuter.", "3 checks. Perfect to start."],
    ict: ["ICT / Smart Money. 6 checks.", "ICT / Smart Money. 6 checks."],
    swing: ["Pour les trades sur plusieurs jours.", "For multi-day trades."],
    prop: ["Axé risque, pour comptes fundés.", "Risk-focused, for funded accounts."],
  };
  const e = m[id];
  return e ? (fr ? e[0] : e[1]) : "";
}

function addonItems(fr: boolean): Record<keyof WizardToggles, ChkItem> {
  return fr
    ? {
        oneTrade: {
          title: "Max 1 trade aujourd'hui",
          desc: "Une perte le matin = chart fermé. Journée terminée.",
        },
        news: {
          title: "Pas de news rouge dans 30 min",
          desc: "FOMC, NFP, CPI : je vérifie le calendrier d'abord.",
        },
        rr: {
          title: "Gain visé ≥ 2× mon risque",
          desc: "Si le trade ne paie pas 2 fois le risque, je passe.",
        },
        dd: {
          title: "Limite de perte journalière vérifiée",
          desc: "Je connais ma marge restante avant d'entrer.",
        },
      }
    : {
        oneTrade: { title: "Max 1 trade today", desc: "A morning loss = chart closed. Day over." },
        news: {
          title: "No red news in the next 30 min",
          desc: "FOMC, NFP, CPI: I check the calendar first.",
        },
        rr: {
          title: "Target ≥ 2× my risk",
          desc: "If the trade doesn't pay twice the risk, I skip it.",
        },
        dd: {
          title: "Daily loss limit checked",
          desc: "I know my remaining margin before entering.",
        },
      };
}

const TIME_PRESETS: { id: string; label: string; start: string; tz: string }[] = [
  { id: "ny", label: "New York — 09:30", start: "09:30", tz: "America/New_York" },
  { id: "london", label: "London — 08:00", start: "08:00", tz: "Europe/London" },
  { id: "tokyo", label: "Tokyo — 09:00", start: "09:00", tz: "Asia/Tokyo" },
];

export default function ChecklistWizard({
  lang,
  templates,
  recommendedId,
  defaultToggles,
  defaultTime,
  personalItems = [],
  onApply,
  onClose,
}: {
  lang: string;
  templates: ChkTemplate[];
  recommendedId: string;
  defaultToggles: WizardToggles;
  defaultTime: { startTime: string; timeZone: string };
  /** Adaptive rules from the onboarding profile — appended to any preset. */
  personalItems?: ChkItem[];
  onApply: (r: WizardResult) => void;
  onClose: () => void;
}) {
  const fr = isFr(lang);
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState(recommendedId);
  const [toggles, setToggles] = useState<WizardToggles>(defaultToggles);
  const [time, setTime] = useState(defaultTime);
  const addons = useMemo(() => addonItems(fr), [fr]);

  const tr = (f: string, e: string) => (fr ? f : e);

  const buildAndApply = () => {
    const base = templates.find((t) => t.id === presetId)?.items ?? [];
    const items: ChkItem[] = structuredClone(base);
    (Object.keys(toggles) as (keyof WizardToggles)[]).forEach((k) => {
      if (toggles[k] && !items.some((it) => it.title === addons[k].title)) items.push(addons[k]);
    });
    // Adaptive rules derived from onboarding (weakness, style, monthly target).
    for (const it of personalItems) {
      if (!items.some((x) => x.title === it.title)) items.push(structuredClone(it));
    }
    onApply({ items, startTime: time.startTime, timeZone: time.timeZone });
  };

  const next = () => setStep((s) => Math.min(s + 1, 2));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleGuard = (k: keyof WizardToggles) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          {step > 0 ? (
            <button onClick={back} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div className="flex-1 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-cyan-500" : "bg-white/[0.08]",
                )}
              />
            ))}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1 — detail level */}
        {step === 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                {tr("Ta checklist, en 20 secondes", "Your checklist, in 20 seconds")}
              </h2>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              {tr(
                "On a déjà choisi le meilleur départ pour toi. Change si tu veux.",
                "We already picked the best start for you. Change it if you like.",
              )}
            </p>
            <div className="grid gap-2.5">
              {templates.map((tp) => {
                const active = presetId === tp.id;
                const rec = tp.id === recommendedId;
                return (
                  <button
                    key={tp.id}
                    onClick={() => {
                      setPresetId(tp.id);
                      setTimeout(next, 160);
                    }}
                    className={cn(
                      "flex items-center gap-3.5 rounded-2xl p-3.5 border text-left transition-all",
                      active
                        ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                        active ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-slate-400",
                      )}
                    >
                      {tp.items.length}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{tp.name}</span>
                        {rec && (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-full">
                            {tr("Recommandé", "Recommended")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{presetBlurb(tp.id, fr)}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — guardrails */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                {tr("Quelques garde-fous ?", "A few guardrails?")}
              </h2>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              {tr(
                "Active ce qui te parle. On peut changer plus tard.",
                "Turn on what speaks to you. You can change it later.",
              )}
            </p>
            <div className="grid gap-2.5">
              {(Object.keys(addons) as (keyof WizardToggles)[]).map((k) => {
                const on = toggles[k];
                return (
                  <button
                    key={k}
                    onClick={() => toggleGuard(k)}
                    className={cn(
                      "flex items-center gap-3.5 rounded-2xl p-3.5 border text-left transition-all",
                      on
                        ? "bg-cyan-500/15 border-cyan-400/50"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{addons[k].title}</div>
                      <div className="text-xs text-slate-500">{addons[k].desc}</div>
                    </div>
                    <div
                      className={cn(
                        "w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors",
                        on ? "bg-cyan-500" : "bg-white/[0.12]",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full bg-white transition-transform",
                          on && "translate-x-5",
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={next}
              className="w-full mt-6 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
            >
              {tr("Continuer", "Continue")}
            </button>
          </div>
        )}

        {/* Step 3 — session start */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                {tr("Quand commence ta session ?", "When does your session start?")}
              </h2>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              {tr(
                "Aucune entrée avant cette heure. C'est ta règle n°1.",
                "No entries before this time. That's your rule #1.",
              )}
            </p>
            <div className="grid gap-2.5 mb-4">
              {TIME_PRESETS.map((p) => {
                const active = time.startTime === p.start && time.timeZone === p.tz;
                return (
                  <button
                    key={p.id}
                    onClick={() => setTime({ startTime: p.start, timeZone: p.tz })}
                    className={cn(
                      "flex items-center justify-between rounded-2xl p-3.5 border transition-all",
                      active
                        ? "bg-cyan-500/15 border-cyan-400/50"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                    )}
                  >
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    {active && <Check className="w-4 h-4 text-cyan-300" />}
                  </button>
                );
              })}
              <label className="flex items-center gap-3 rounded-2xl p-3.5 border bg-white/[0.04] border-white/[0.08]">
                <span className="text-sm text-slate-300">{tr("Heure perso", "Custom time")}</span>
                <input
                  type="time"
                  value={time.startTime}
                  onChange={(e) =>
                    e.target.value && setTime((t) => ({ ...t, startTime: e.target.value }))
                  }
                  className="ml-auto bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                />
              </label>
            </div>
            <button
              onClick={buildAndApply}
              className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20 transition-all"
            >
              {tr("Créer ma checklist", "Create my checklist")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
