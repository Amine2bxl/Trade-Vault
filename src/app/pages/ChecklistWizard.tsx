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
import { Button, TimeField } from "@/shared/ui";
import { intlLocale } from "../i18n/locale";

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

/**
 * L'ASSISTANT DE CHECKLIST — le premier écran de la routine du matin.
 *
 * ── CE QUI CLOCHAIT ─────────────────────────────────────────────────────────
 *
 * « Il fait trop AI générique. » C'était juste, et ça se décompose :
 *
 *   • IL COMMENÇAIT PAR UNE QUESTION. Une fenêtre s'ouvrait sur « Ton style de
 *     trading ? » sans avoir dit bonjour, ni pourquoi elle demandait, ni
 *     combien de temps ça prend. On répond mal à qui ne s'est pas présenté —
 *     et c'est là qu'on abandonne.
 *   • RIEN NE BOUGEAIT. Le contenu se remplaçait d'un coup : impossible de
 *     savoir si l'on avait avancé, reculé, ou si la fenêtre s'était rechargée.
 *     L'onboarding principal a POURTANT ce vocabulaire depuis longtemps
 *     (`onb-step-fwd`, `onb-step-back`, `onb-in`) — l'assistant ne s'en servait
 *     pas. On le réutilise ici plutôt que d'en écrire un second.
 *   • LA PROGRESSION MENTAIT UN PEU. Cinq segments détachés disent « cinq
 *     choses à faire » sans dire où l'on en est. Un compte (« 2 / 5 ») le dit.
 *   • IL FINISSAIT SUR UN CLIC. La checklist apparaissait, construite, sans
 *     qu'on ait vu ce qui venait d'être décidé pour soi. Elle se dessine
 *     maintenant ligne à ligne, une seconde : le temps de reconnaître ses
 *     réponses dans le résultat.
 *   • IL ÉTAIT CYAN EN DUR. `bg-cyan-500` ignorait le thème que le trader a
 *     choisi. Tout passe par l'accent.
 */
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

  /* `-1` = l'accueil. Les questions occupent `0..n-1`, l'heure de séance `n`.
     Un pas négatif plutôt qu'un état séparé : toute la navigation (avant,
     arrière, progression) continue de se lire sur un seul nombre. */
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [time, setTime] = useState(defaultTime);
  /* Le sens du dernier déplacement — c'est LUI que l'animation porte, et rien
     d'autre : en avant l'étape vient de la droite, en arrière de la gauche. */
  const [sens, setSens] = useState<"fwd" | "back">("fwd");
  /* La checklist en train de s'écrire. `null` tant qu'on n'a pas terminé. */
  const [construction, setConstruction] = useState<ChkItem[] | null>(null);

  const total = questions.length + 1; // + l'étape de l'heure
  const onTimeStep = step === questions.length;

  const next = () => {
    setSens("fwd");
    setStep((s) => Math.min(s + 1, questions.length));
  };
  const back = () => {
    setSens("back");
    setStep((s) => Math.max(s - 1, -1));
  };
  const anim = sens === "fwd" ? "onb-step-fwd" : "onb-step-back";

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

  const composer = (): ChkItem[] => {
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
    return items;
  };

  /* LA CHECKLIST SE DESSINE AVANT DE S'APPLIQUER.
     Elle apparaissait d'un coup, déjà faite : on n'avait jamais vu le lien
     entre ses réponses et le résultat. Les lignes arrivent l'une après l'autre
     — 70 ms chacune, une seconde au total pour six items — puis la fenêtre se
     ferme d'elle-même. Assez pour reconnaître ce qu'on a choisi, trop court
     pour agacer. */
  const terminer = () => {
    const items = composer();
    setConstruction(items);
    const duree = Math.min(1100, 420 + items.length * 70);
    setTimeout(() => onApply({ items, startTime: time.startTime, timeZone: time.timeZone }), duree);
  };

  return (
    <div
      className="fixed inset-0 z-[var(--tv-z-overlay)] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={construction ? undefined : onClose}
    >
      <div
        className="glass-strong rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ══ EN-TÊTE ═══════════════════════════════════════════════════════
            Absent de l'accueil et de la construction : sur l'un il n'y a rien
            derrière soi, sur l'autre il n'y a plus rien à faire. */}
        {step >= 0 && !construction && (
          <div className="mb-5 flex items-center gap-3">
            <button
              onClick={back}
              aria-label={tr("Retour", "Back")}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>

            {/* UNE barre continue, pas cinq segments détachés. Cinq traits
                disent « cinq choses à faire » ; une barre qui avance dit où
                l'on en est. Le compte l'écrit noir sur blanc. */}
            <div className="flex flex-1 items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[var(--tv-accent)] transition-[width] duration-300 ease-out"
                  style={{ width: `${((step + 1) / total) * 100}%` }}
                />
              </div>
              <span className="tv-figure shrink-0 text-[11px] tabular-nums text-slate-500">
                {step + 1}/{total}
              </span>
            </div>

            <button
              onClick={onClose}
              aria-label={tr("Fermer", "Close")}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* ══ L'ACCUEIL ═════════════════════════════════════════════════════
            Ce que c'est, ce que ça coûte, ce qu'on en retire — et une porte de
            sortie visible. Une fenêtre qui s'ouvre sur une question sans avoir
            dit bonjour est une fenêtre qu'on ferme. */}
        {step === -1 && !construction && (
          <div className="onb-in">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="tv-accent-fill grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                <Sparkles className="h-5 w-5" />
              </span>
              <button
                onClick={onClose}
                aria-label={tr("Fermer", "Close")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
              {tr("On monte ta checklist ensemble", "Let's build your checklist together")}
            </h2>
            <p className="tv-prose mt-2 text-slate-400">
              {tr(
                "Quatre questions sur ta façon de trader. Chaque réponse ajoute les vérifications qui te concernent — tu n'hérites pas d'une liste générique.",
                "Four questions about how you trade. Each answer adds the checks that apply to you — you don't inherit a generic list.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {tr("Moins d'une minute", "Under a minute")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                {tr("Modifiable à tout moment", "Editable at any time")}
              </span>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Button onClick={next} className="flex-1">
                {tr("C'est parti", "Let's go")}
              </Button>
              <button
                onClick={onClose}
                className="shrink-0 px-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-300"
              >
                {tr("Plus tard", "Later")}
              </button>
            </div>
          </div>
        )}

        {/* ══ LES QUESTIONS ═════════════════════════════════════════════════ */}
        {step >= 0 &&
          !onTimeStep &&
          !construction &&
          (() => {
            const q = questions[step];
            const Icon = q.icon;
            const picked = answers[q.id] ?? [];
            return (
              /* `key` sur l'étape : sans lui React réutilise le nœud et
                 l'animation ne rejoue pas — le contenu changerait sans que rien
                 ne signale le déplacement. */
              <div key={step} className={anim}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-[var(--tv-highlight)]" />
                  <h2 className="tv-title">{q.title}</h2>
                </div>
                <p className="mb-5 text-sm text-slate-400">{q.sub}</p>
                <div className="onb-in grid gap-2.5">
                  {q.options.map((opt) => {
                    const on = picked.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => (q.multi ? toggleMulti(q, opt.id) : pickSingle(q, opt.id))}
                        aria-pressed={on}
                        className={cn(
                          "flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition duration-150",
                          on
                            ? "border-[rgb(var(--tv-accent-rgb)/0.5)] bg-[rgb(var(--tv-accent-rgb)/0.14)]"
                            : "border-white/[0.08] bg-white/[0.04] hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.06]",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white">{opt.label}</div>
                          {opt.hint && <div className="text-xs text-slate-500">{opt.hint}</div>}
                        </div>
                        {q.multi ? (
                          <div
                            className={cn(
                              "h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
                              on ? "bg-[var(--tv-accent)]" : "bg-white/[0.12]",
                            )}
                          >
                            <div
                              className={cn(
                                "h-5 w-5 rounded-full bg-white transition-transform duration-200",
                                on && "translate-x-5",
                              )}
                            />
                          </div>
                        ) : (
                          on && <Check className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={next}
                    className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {tr("Passer", "Skip")}
                  </button>
                  {q.multi && <Button onClick={next}>{tr("Continuer", "Continue")}</Button>}
                </div>
              </div>
            );
          })()}

        {/* ══ L'HEURE DE SÉANCE ═════════════════════════════════════════════ */}
        {onTimeStep && !construction && (
          <div key="time" className={anim}>
            <div className="mb-1.5 flex items-center gap-2">
              <Clock className="h-5 w-5 text-[var(--tv-highlight)]" />
              <h2 className="tv-title">
                {tr("Quand commence ta session ?", "When does your session start?")}
              </h2>
            </div>
            <p className="tv-prose mb-5 text-slate-500">
              {tr(
                "On s'en sert pour verrouiller la checklist avant l'ouverture et t'alerter au départ.",
                "We use it to lock the checklist before the open and alert you at the start.",
              )}
            </p>
            <div className="onb-in mb-4 grid gap-2.5">
              {TIME_PRESETS.map((p) => {
                const active = time.startTime === p.start && time.timeZone === p.tz;
                return (
                  <button
                    key={p.id}
                    onClick={() => setTime({ startTime: p.start, timeZone: p.tz })}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border p-3.5 transition duration-150",
                      active
                        ? "border-[rgb(var(--tv-accent-rgb)/0.5)] bg-[rgb(var(--tv-accent-rgb)/0.14)]"
                        : "border-white/[0.08] bg-white/[0.04] hover:-translate-y-px hover:border-white/20",
                    )}
                  >
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    {active && <Check className="h-4 w-4 text-[var(--tv-highlight)]" />}
                  </button>
                );
              })}
              <label className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
                <span className="text-sm text-slate-300">{tr("Heure perso", "Custom time")}</span>
                <div className="ml-auto">
                  <TimeField
                    value={time.startTime}
                    onChange={(v) => v && setTime((t) => ({ ...t, startTime: v }))}
                    locale={intlLocale(lang)}
                    aria-label={tr("Heure perso", "Custom time")}
                    className="h-9 w-[9.5rem] px-2.5 text-sm"
                  />
                </div>
              </label>
            </div>
            <Button onClick={terminer} className="w-full">
              <Gauge className="h-4 w-4" /> {tr("Créer ma checklist", "Create my checklist")}
            </Button>
          </div>
        )}

        {/* ══ LA CHECKLIST S'ÉCRIT ══════════════════════════════════════════
            Le seul moment de la fenêtre qui ne demande rien. Il montre le lien
            entre ce qu'on vient de répondre et ce qu'on obtient — et il dure
            une seconde. */}
        {construction && (
          <div className="py-2 text-center">
            <span className="tv-accent-fill mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl">
              <Gauge className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-bold text-white">
              {tr("Ta checklist est prête", "Your checklist is ready")}
            </h2>
            <p className="tv-row-label mt-1">
              {tr(
                `${construction.length} vérifications, taillées sur tes réponses`,
                `${construction.length} checks, built from your answers`,
              )}
            </p>
            <ul className="onb-in mt-4 space-y-1.5 text-left">
              {construction.map((it) => (
                <li
                  key={it.title}
                  className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                >
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-[var(--tv-highlight)]"
                    strokeWidth={3}
                  />
                  <span className="truncate text-[13px] text-slate-200">{it.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
