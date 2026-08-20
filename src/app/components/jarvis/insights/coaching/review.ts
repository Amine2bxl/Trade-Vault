import type { Trade, TradeStats } from "../../../../types";
import type { BehaviorSignals } from "../../../../utils/behaviorSignals";
import type { RuleAdherence } from "../../../../utils/ruleAdherence";
import { computeStats } from "../../../../utils/tradeCalcs";
import { sampleVerdict } from "@/modules/coaching";
import { formatMoney } from "../copy/templates";
import type { DailyReview } from "./types";

/**
 * Daily Review (Step 6C) — le bilan de fin de journée.
 *
 * Produit UNE conclusion principale (« what went wrong »), sa preuve (les
 * trades du jour, deep-linkés) et UNE priorité pour demain. Jamais 15 conseils :
 * au plus une poignée de lignes, toutes adossées à des chiffres réels.
 *
 * La journée analysée est la dernière journée TRADÉE (pas « aujourd'hui ») :
 * un trader qui ouvre l'app le matin lit le bilan d'hier, pas un écran vide.
 */

export interface DailyReviewInput {
  trades: Trade[];
  stats: TradeStats;
  signals: BehaviorSignals;
  adherence: RuleAdherence[];
}

const signedMoney = (v: number, lang: "fr" | "en"): string =>
  `${v < 0 ? "-" : "+"}${formatMoney(Math.abs(v), lang)}`;

export function buildDailyReview(input: DailyReviewInput): DailyReview {
  const empty = (): DailyReview => ({
    status: "empty",
    summary: {
      fr: "Pas encore de trades à revoir.",
      en: "No trades to review yet.",
    },
    well: [],
    wrong: null,
    tomorrow: null,
  });

  if (input.trades.length === 0) return empty();

  const latest = input.trades.reduce((a, t) => (t.date > a ? t.date : a), input.trades[0].date);
  const day = input.trades.filter((t) => t.date === latest);
  const dayStats = computeStats(day);

  const well: DailyReview["well"] = [];
  const clean = day.filter((t) => t.mistakes.length === 0).length;

  if (dayStats.totalPnl > 0) {
    well.push({
      fr: `Journée verte : ${signedMoney(dayStats.totalPnl, "fr")} sur ${day.length} trade(s).`,
      en: `Green day: ${signedMoney(dayStats.totalPnl, "en")} over ${day.length} trade(s).`,
    });
  }
  if (clean > 0) {
    well.push({
      fr: `${clean}/${day.length} trade(s) journalisé(s) sans erreur cochée.`,
      en: `${clean}/${day.length} trade(s) logged with no mistake flagged.`,
    });
  }
  const held = input.adherence.find((a) => a.ratePct >= 80 && a.applicable >= 3);
  if (held) {
    well.push({
      fr: `Règle tenue : « ${held.text} » (${held.kept}/${held.applicable}).`,
      en: `Rule held: "${held.text}" (${held.kept}/${held.applicable}).`,
    });
  }

  // Le principal problème : la fuite la plus coûteuse de la journée, sinon le
  // résultat net négatif. Jamais un reproche inventé.
  const worstMistake = Object.entries(dayStats.mistakeStats)
    .filter(([, v]) => v.totalPnl < 0)
    .sort((a, b) => a[1].totalPnl - b[1].totalPnl)[0];

  let wrong: DailyReview["wrong"] = null;
  let tomorrow: DailyReview["tomorrow"] = null;

  if (worstMistake) {
    const [name, s] = worstMistake;
    wrong = {
      fr: `Le problème principal : « ${name} » — ${s.count}×, ${signedMoney(s.totalPnl, "fr")}.`,
      en: `Main problem: "${name}" — ${s.count}×, ${signedMoney(s.totalPnl, "en")}.`,
    };
    tomorrow = {
      fr: `Demain : une seule priorité — éliminer « ${name} ».`,
      en: `Tomorrow: one priority — eliminate "${name}".`,
    };
  } else if (dayStats.totalPnl < 0) {
    wrong = {
      fr: `Le problème principal : journée nette négative — ${signedMoney(dayStats.totalPnl, "fr")}.`,
      en: `Main problem: net negative day — ${signedMoney(dayStats.totalPnl, "en")}.`,
    };
    tomorrow = {
      fr: "Demain : réduire la taille et attendre la confirmation avant chaque entrée.",
      en: "Tomorrow: cut size and wait for confirmation before every entry.",
    };
  } else if (day.length > 0) {
    tomorrow = {
      fr: "Demain : garder exactement le même process.",
      en: "Tomorrow: keep exactly the same process.",
    };
  }

  const summary = {
    fr: `${day.length} trade(s), ${signedMoney(dayStats.totalPnl, "fr")} au total.`,
    en: `${day.length} trade(s), ${signedMoney(dayStats.totalPnl, "en")} net.`,
  };

  const evidence = {
    metric: "day_pnl",
    sampleSize: day.length,
    metrics: [
      { label: { fr: "Trades", en: "Trades" }, value: String(day.length) },
      {
        label: { fr: "P&L", en: "P&L" },
        value: signedMoney(dayStats.totalPnl, "en"),
        tone: (dayStats.totalPnl >= 0 ? "up" : "down") as "up" | "down",
      },
    ],
    filter: { trades: day.map((t) => t.id) },
    page: "journal" as const,
    lowSample: sampleVerdict(day.length, 3).sufficient
      ? undefined
      : { n: day.length, required: 3, unit: "trades" },
  };

  return { status: "ready", summary, well, wrong, evidence, tomorrow };
}
