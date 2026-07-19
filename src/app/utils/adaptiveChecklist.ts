import type { ChkItem } from "../pages/checklistDefaults";
import type { OnboardingData } from "../store";

// Adaptive checklist rules, derived from the onboarding profile (style,
// biggest weakness, monthly target). Pure function: profile in, personalized
// rule items out. The checklist wizard appends these to the chosen preset
// (deduped by title), so a trader who says "overtrading" gets a hard
// "stop after 3 losing trades" rule on day one.

const isFr = (lang: string) => lang === "fr";

type Pair = [fr: ChkItem, en: ChkItem];

const pick = (lang: string, pairs: Pair[]): ChkItem[] =>
  pairs.map(([fr, en]) => (isFr(lang) ? fr : en));

/** Weakness-specific hard rules — the core of the adaptive system. */
function weaknessItems(pain: string | null | undefined, lang: string): ChkItem[] {
  switch (pain) {
    case "overtrading":
      return pick(lang, [
        [
          {
            title: "STOP après 3 trades perdants",
            desc: "3 pertes = journée terminée, sans négociation. Le marché sera là demain.",
          },
          {
            title: "STOP after 3 losing trades",
            desc: "3 losses = day over, no negotiation. The market will be there tomorrow.",
          },
        ],
        [
          {
            title: "Max 3 trades aujourd'hui",
            desc: "Trois balles, pas une de plus. Chaque entrée doit mériter sa place.",
          },
          {
            title: "Max 3 trades today",
            desc: "Three bullets, not one more. Every entry must earn its place.",
          },
        ],
        [
          {
            title: "5 min de pause entre deux trades",
            desc: "Timer obligatoire après chaque sortie. Pas de ré-entrée à chaud.",
          },
          {
            title: "5 min break between trades",
            desc: "Mandatory timer after each exit. No hot re-entries.",
          },
        ],
      ]);
    case "emotions":
      return pick(lang, [
        [
          {
            title: "Scan émotionnel avant d'ouvrir le chart",
            desc: "Stressé, énervé, revanchard ? Je ne trade pas tant que ce n'est pas réglé.",
          },
          {
            title: "Emotional scan before opening the chart",
            desc: "Stressed, angry, in revenge mode? I don't trade until it's handled.",
          },
        ],
        [
          {
            title: "Après une perte : 10 respirations, chart fermé",
            desc: "La perte est un coût d'exploitation, pas une attaque personnelle.",
          },
          {
            title: "After a loss: 10 breaths, chart closed",
            desc: "A loss is a cost of doing business, not a personal attack.",
          },
        ],
        [
          {
            title: "Aucun trade pour « se refaire »",
            desc: "Le revenge trading a détruit plus de comptes que toutes les crises réunies.",
          },
          {
            title: 'No trade to "win it back"',
            desc: "Revenge trading has destroyed more accounts than every crisis combined.",
          },
        ],
      ]);
    case "consistency":
      return pick(lang, [
        [
          {
            title: "Plan relu AVANT la session",
            desc: "Setup, entrée, stop, target écrits noir sur blanc. Pas de plan = pas de trade.",
          },
          {
            title: "Plan re-read BEFORE the session",
            desc: "Setup, entry, stop, target written down. No plan = no trade.",
          },
        ],
        [
          {
            title: "Chaque entrée coche 100% des critères",
            desc: "« Presque valide » = invalide. Le plan décide, pas l'envie.",
          },
          {
            title: "Every entry ticks 100% of the criteria",
            desc: '"Almost valid" = invalid. The plan decides, not the urge.',
          },
        ],
        [
          {
            title: "Stop-loss placé AVANT de cliquer",
            desc: "Jamais d'entrée sans sortie de secours déjà définie.",
          },
          {
            title: "Stop-loss set BEFORE clicking",
            desc: "Never enter without the escape hatch already defined.",
          },
        ],
      ]);
    case "risk":
      return pick(lang, [
        [
          {
            title: "Risque ≤ 1% du compte sur ce trade",
            desc: "Calculé, pas estimé. Le calculateur de position fait le travail.",
          },
          {
            title: "Risk ≤ 1% of the account on this trade",
            desc: "Calculated, not guessed. The position calculator does the work.",
          },
        ],
        [
          {
            title: "Jamais moyenner une position perdante",
            desc: "Ajouter à une perte, c'est doubler une erreur.",
          },
          {
            title: "Never average down a losing position",
            desc: "Adding to a loss is doubling a mistake.",
          },
        ],
      ]);
    case "journaling":
      return pick(lang, [
        [
          {
            title: "Trade loggé dans les 5 minutes",
            desc: "Sortie = journal, immédiatement. Un trade non loggé est une leçon perdue.",
          },
          {
            title: "Trade logged within 5 minutes",
            desc: "Exit = journal, immediately. An unlogged trade is a lost lesson.",
          },
        ],
        [
          {
            title: "Capture d'écran du setup jointe",
            desc: "Le graphique du moment vaut mille souvenirs déformés.",
          },
          {
            title: "Setup screenshot attached",
            desc: "The chart of the moment beats a thousand distorted memories.",
          },
        ],
      ]);
    default:
      return [];
  }
}

/** Style-specific additions. */
function styleItems(style: string | null | undefined, lang: string): ChkItem[] {
  switch (style) {
    case "scalping":
      return pick(lang, [
        [
          {
            title: "Spread & volatilité vérifiés",
            desc: "Scalper un marché mort ou un spread large, c'est payer pour perdre.",
          },
          {
            title: "Spread & volatility checked",
            desc: "Scalping a dead market or wide spread is paying to lose.",
          },
        ],
      ]);
    case "daytrading":
      return pick(lang, [
        [
          {
            title: "Niveaux clés de la journée marqués",
            desc: "Open, high/low de la veille, zones de liquidité — avant la première bougie.",
          },
          {
            title: "Key daily levels marked",
            desc: "Open, prior high/low, liquidity zones — before the first candle.",
          },
        ],
      ]);
    case "swing":
      return pick(lang, [
        [
          {
            title: "Contexte H4/Daily aligné",
            desc: "Un swing contre la tendance de fond a besoin d'une raison exceptionnelle.",
          },
          {
            title: "H4/Daily context aligned",
            desc: "A swing against the higher-timeframe trend needs an exceptional reason.",
          },
        ],
      ]);
    default:
      return [];
  }
}

/** Monthly-target anchor: keeps the ambition realistic and visible daily. */
function targetItems(target: number | null | undefined, lang: string): ChkItem[] {
  if (!target || target <= 0) return [];
  const fr = isFr(lang);
  const perDay = (target / 20).toFixed(2); // ~20 trading days per month
  return [
    fr
      ? {
          title: `Objectif du mois : ${target}% — pas de forcing`,
          desc: `Soit ~${perDay}% par jour de trading. Aucun trade « rattrapage » pour aller plus vite que le plan.`,
        }
      : {
          title: `Monthly target: ${target}% — no forcing`,
          desc: `That's ~${perDay}% per trading day. No "catch-up" trades to outrun the plan.`,
        },
  ];
}

/** All personalized rules for this profile, deduped by title. */
export function personalizedItems(
  onb: (OnboardingData & { monthlyTarget?: number | null }) | null,
  lang: string,
): ChkItem[] {
  if (!onb) return [];
  const all = [
    ...weaknessItems(onb.pain, lang),
    ...styleItems(onb.style, lang),
    ...targetItems(onb.monthlyTarget, lang),
  ];
  const seen = new Set<string>();
  return all.filter((it) => (seen.has(it.title) ? false : (seen.add(it.title), true)));
}
