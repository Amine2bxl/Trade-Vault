import { useMemo, useState } from "react";
import {
  Check,
  ArrowLeft,
  Sparkles,
  Clock,
  ShieldCheck,
  X,
  Gauge,
  Crosshair,
  Brain,
  LineChart,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { ChkItem } from "./checklistDefaults";
import { Button } from "@/shared/ui";

/* Adaptive setup for the pre-market checklist. A short, visual questionnaire
   whose answers BUILD the checklist — every option carries the exact checks it
   adds, so the result targets this trader (style, market, read, weakness, risk)
   instead of a generic preset. One tap per question, big cards, no jargon. */

export interface WizardResult {
  items: ChkItem[];
  startTime: string;
  timeZone: string;
}

const isFr = (lang: string) => lang === "fr";

interface Opt {
  id: string;
  label: string;
  hint?: string;
  items: ChkItem[];
}
interface Question {
  id: string;
  icon: typeof Sparkles;
  title: string;
  sub: string;
  multi?: boolean;
  options: Opt[];
}

// Base checks every trader gets — the non-negotiable spine of any plan.
function baseItems(fr: boolean): ChkItem[] {
  return fr
    ? [
        {
          title: "Biais HTF défini",
          desc: "Tendance ou range identifié sur ton unité de référence.",
        },
        {
          title: "Plan écrit : entrée · invalidation · cible",
          desc: "Les 3 niveaux notés avant d'armer.",
        },
      ]
    : [
        {
          title: "HTF bias defined",
          desc: "Trend or range identified on your reference timeframe.",
        },
        {
          title: "Plan written: entry · invalidation · target",
          desc: "All 3 levels noted before arming.",
        },
      ];
}

function buildQuestions(fr: boolean): Question[] {
  const I = (f: string, e: string, df: string, de: string): ChkItem => ({
    title: fr ? f : e,
    desc: fr ? df : de,
  });
  return [
    {
      id: "style",
      icon: Crosshair,
      title: fr ? "Ton style de trading ?" : "Your trading style?",
      sub: fr
        ? "On cible les checks qui comptent pour toi."
        : "We target the checks that matter to you.",
      options: [
        {
          id: "scalp",
          label: fr ? "Scalping" : "Scalping",
          hint: fr ? "Très court terme" : "Very short term",
          items: [
            I(
              "Spread & liquidité OK",
              "Spread & liquidity OK",
              "Conditions serrées avant d'entrer.",
              "Tight conditions before entry.",
            ),
          ],
        },
        {
          id: "intraday",
          label: fr ? "Intraday" : "Intraday",
          hint: fr ? "Clôturé le jour même" : "Closed same day",
          items: [
            I(
              "Niveaux clés du jour marqués",
              "Key levels of the day marked",
              "Zones de la séance tracées à l'avance.",
              "Session zones drawn ahead.",
            ),
          ],
        },
        {
          id: "swing",
          label: fr ? "Swing" : "Swing",
          hint: fr ? "Sur plusieurs jours" : "Multi-day",
          items: [
            I(
              "Alignement H4 / Daily",
              "H4 / Daily alignment",
              "Le setup respecte les unités hautes.",
              "Setup agrees with higher timeframes.",
            ),
          ],
        },
      ],
    },
    {
      id: "market",
      icon: LineChart,
      title: fr ? "Ton marché principal ?" : "Your main market?",
      sub: fr ? "Chaque marché a son piège du matin." : "Each market has its morning trap.",
      options: [
        {
          id: "forex",
          label: "Forex",
          items: [
            I(
              "Pas de news rouge < 30 min",
              "No red news < 30 min",
              "FOMC, NFP, CPI : je vérifie le calendrier.",
              "FOMC, NFP, CPI: I check the calendar.",
            ),
          ],
        },
        {
          id: "indices",
          label: fr ? "Indices" : "Indices",
          items: [
            I(
              "Pas de news rouge < 30 min",
              "No red news < 30 min",
              "FOMC, CPI, ouverture cash vérifiés.",
              "FOMC, CPI, cash open checked.",
            ),
          ],
        },
        {
          id: "crypto",
          label: "Crypto",
          items: [
            I(
              "Volatilité & funding vérifiés",
              "Volatility & funding checked",
              "Contexte de marché avant d'entrer.",
              "Market context before entry.",
            ),
          ],
        },
        {
          id: "stocks",
          label: fr ? "Actions" : "Stocks",
          items: [
            I(
              "Earnings / catalyseurs vérifiés",
              "Earnings / catalysts checked",
              "Pas de surprise fondamentale imminente.",
              "No imminent fundamental surprise.",
            ),
          ],
        },
      ],
    },
    {
      id: "read",
      icon: Sparkles,
      title: fr ? "Ta lecture du marché ?" : "How do you read the market?",
      sub: fr
        ? "On ajoute le check de validation de ton approche."
        : "We add the validation check for your approach.",
      options: [
        {
          id: "ict",
          label: "ICT / Smart Money",
          items: [
            I(
              "Liquidité prise + POI (FVG/OB)",
              "Liquidity taken + POI (FVG/OB)",
              "Prix dans ma zone après la prise de liquidité.",
              "Price in my zone after the liquidity grab.",
            ),
          ],
        },
        {
          id: "pa",
          label: "Price Action",
          items: [
            I(
              "Structure de marché confirmée",
              "Market structure confirmed",
              "BOS / CHoCH clair avant l'entrée.",
              "Clear BOS / CHoCH before entry.",
            ),
          ],
        },
        {
          id: "indic",
          label: fr ? "Indicateurs" : "Indicators",
          items: [
            I(
              "Confluence d'indicateurs alignée",
              "Indicator confluence aligned",
              "Mes signaux pointent dans le même sens.",
              "My signals point the same way.",
            ),
          ],
        },
      ],
    },
    {
      id: "weakness",
      icon: Brain,
      title: fr ? "Ta plus grosse fuite ?" : "Your biggest leak?",
      sub: fr
        ? "C'est LE garde-fou qu'on met en avant pour toi."
        : "This is THE guardrail we put front and center for you.",
      options: [
        {
          id: "fomo",
          label: "FOMO",
          hint: fr ? "Peur de rater" : "Fear of missing out",
          items: [
            I(
              "J'attends MA config — pas de chasse",
              "I wait for MY setup — no chasing",
              "Si je cours après le prix, je ne prends pas.",
              "If I chase price, I don't take it.",
            ),
          ],
        },
        {
          id: "overtrading",
          label: "Overtrading",
          hint: fr ? "Trop de trades" : "Too many trades",
          items: [
            I(
              "Max 1 trade — une perte = chart fermé",
              "Max 1 trade — a loss = chart closed",
              "Une seule balle aujourd'hui.",
              "One bullet today.",
            ),
          ],
        },
        {
          id: "revenge",
          label: fr ? "Revenge trading" : "Revenge trading",
          hint: fr ? "Reprendre après une perte" : "Trading back a loss",
          items: [
            I(
              "Après une perte : 15 min de pause",
              "After a loss: 15-min pause",
              "Je respire avant toute décision.",
              "I breathe before any decision.",
            ),
          ],
        },
        {
          id: "risk",
          label: fr ? "Sur-risque" : "Over-risking",
          hint: fr ? "Taille trop grosse" : "Size too big",
          items: [
            I(
              "Risque fixe — jamais augmenté",
              "Fixed risk — never increased",
              "Même % sur chaque trade, sans exception.",
              "Same % on every trade, no exception.",
            ),
          ],
        },
        {
          id: "noplan",
          label: fr ? "Manque de plan" : "No plan",
          hint: fr ? "Entrées impulsives" : "Impulsive entries",
          items: [
            I(
              "Aucune entrée sans plan complet",
              "No entry without a full plan",
              "Entrée, stop et cible écrits — ou je passe.",
              "Entry, stop and target written — or I skip.",
            ),
          ],
        },
      ],
    },
    {
      id: "guards",
      icon: ShieldCheck,
      multi: true,
      title: fr ? "Garde-fous risque ?" : "Risk guardrails?",
      sub: fr
        ? "Active ce qui te parle (plusieurs possibles)."
        : "Turn on what speaks to you (pick any).",
      options: [
        {
          id: "rr",
          label: fr ? "Gain visé ≥ 2× le risque" : "Target ≥ 2× the risk",
          items: [
            I(
              "Gain visé ≥ 2× mon risque",
              "Target ≥ 2× my risk",
              "Sinon je ne prends pas le trade.",
              "Otherwise I skip the trade.",
            ),
          ],
        },
        {
          id: "dd",
          label: fr ? "Limite de perte journalière" : "Daily loss limit",
          items: [
            I(
              "Limite de perte journalière vérifiée",
              "Daily loss limit checked",
              "Je connais ma marge restante avant d'entrer.",
              "I know my remaining margin before entering.",
            ),
          ],
        },
        {
          id: "size",
          label: fr ? "Taille = mon % exact" : "Size = my exact %",
          items: [
            I(
              "Taille = mon % de risque exact",
              "Size = my exact risk %",
              "Position calculée, pas au feeling.",
              "Position calculated, not by feel.",
            ),
          ],
        },
      ],
    },
  ];
}

const TIME_PRESETS: { id: string; label: string; start: string; tz: string }[] = [
  { id: "ny", label: "New York — 09:30", start: "09:30", tz: "America/New_York" },
  { id: "london", label: "London — 08:00", start: "08:00", tz: "Europe/London" },
  { id: "tokyo", label: "Tokyo — 09:00", start: "09:00", tz: "Asia/Tokyo" },
];

export default function ChecklistWizard({
  lang,
  defaultTime,
  onApply,
  onClose,
}: {
  lang: string;
  defaultTime: { startTime: string; timeZone: string };
  onApply: (r: WizardResult) => void;
  onClose: () => void;
}) {
  const fr = isFr(lang);
  const tr = (f: string, e: string) => (fr ? f : e);
  const questions = useMemo(() => buildQuestions(fr), [fr]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [time, setTime] = useState(defaultTime);

  const total = questions.length + 1; // + the session-time step
  const onTimeStep = step === questions.length;

  const next = () => setStep((s) => Math.min(s + 1, questions.length));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const pickSingle = (q: Question, optId: string) => {
    setAnswers((a) => ({ ...a, [q.id]: [optId] }));
    setTimeout(next, 160);
  };
  const toggleMulti = (q: Question, optId: string) =>
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      return {
        ...a,
        [q.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId],
      };
    });

  const buildAndApply = () => {
    const items: ChkItem[] = [...baseItems(fr)];
    for (const q of questions) {
      const picked = answers[q.id] ?? [];
      for (const opt of q.options) {
        if (!picked.includes(opt.id)) continue;
        for (const it of opt.items) {
          if (!items.some((x) => x.title === it.title)) items.push({ ...it });
        }
      }
    }
    onApply({ items, startTime: time.startTime, timeZone: time.timeZone });
  };

  return (
    <div
      className="fixed inset-0 z-[var(--tv-z-overlay)] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + progress */}
        <div className="flex items-center gap-3 mb-5">
          {step > 0 ? (
            <button onClick={back} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: total }, (_, i) => (
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

        {/* Question steps */}
        {!onTimeStep &&
          (() => {
            const q = questions[step];
            const Icon = q.icon;
            const picked = answers[q.id] ?? [];
            return (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white">{q.title}</h2>
                </div>
                <p className="text-sm text-slate-400 mb-5">{q.sub}</p>
                <div className="grid gap-2.5">
                  {q.options.map((opt) => {
                    const on = picked.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => (q.multi ? toggleMulti(q, opt.id) : pickSingle(q, opt.id))}
                        className={cn(
                          "flex items-center gap-3.5 rounded-2xl p-3.5 border text-left transition",
                          on
                            ? "bg-cyan-500/15 border-cyan-400/50"
                            : "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{opt.label}</div>
                          {opt.hint && <div className="text-xs text-slate-500">{opt.hint}</div>}
                        </div>
                        {q.multi ? (
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
                        ) : (
                          on && <Check className="w-4 h-4 text-cyan-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={next}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {tr("Passer", "Skip")}
                  </button>
                  {q.multi && <Button onClick={next}>{tr("Continuer", "Continue")}</Button>}
                </div>
              </div>
            );
          })()}

        {/* Final step — session start */}
        {onTimeStep && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                {tr("Quand commence ta session ?", "When does your session start?")}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              {tr(
                "On s'en sert pour verrouiller la checklist avant l'ouverture et t'alerter au départ.",
                "We use it to lock the checklist before the open and alert you at the start.",
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
                      "flex items-center justify-between rounded-2xl p-3.5 border transition",
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
            <Button onClick={buildAndApply}>
              <Gauge className="w-4 h-4" /> {tr("Créer ma checklist", "Create my checklist")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
