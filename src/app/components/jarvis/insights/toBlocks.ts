import type { JarvisInsight } from "./types";
import type { JarvisBlock } from "../blocks";
import { jarvisHeroCopy, jarvisLearningCopy } from "./copy";
import {
  formatMoney,
  missionText,
  num,
  patternLabel,
  uiLabel,
  type CopyContext,
} from "./copy/templates";

/**
 * toBlocks — transforme un JarvisInsight VALIDÉ en JarvisBlock[] (Phase 1,
 * Étape 4). Pur, déterministe, sans UI. Les textes proviennent du Copy Layer
 * (déjà localisés) — ce module n'invente rien, il met en forme.
 *
 * Sortie : [hero, insight (preuve), mission (action)].
 */

interface Metric {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}

function metricsOf(insight: JarvisInsight, lang: "fr" | "en"): Metric[] {
  const ev = insight.evidence;
  switch (insight.pattern) {
    case "risk_after_loss":
      return [
        {
          label: uiLabel(lang, "Risque après perte", "Risk after a loss"),
          value: `+${num(ev.driftPct)}%`,
          tone: "down",
        },
        {
          label: uiLabel(lang, "Trades après perte", "Trades after a loss"),
          value: String(insight.sampleSize),
        },
      ];
    case "overtrading": {
      const busy = num(ev.avgPnlPerTradeBusy);
      const calm = num(ev.avgPnlPerTradeCalm);
      return [
        {
          label: uiLabel(lang, "Journées chargées", "Busy days"),
          value: `${busy}$/trade`,
          tone: "down",
        },
        {
          label: uiLabel(lang, "Journées calmes", "Calm days"),
          value: `${calm >= 0 ? "+" : ""}${Math.round(calm)}$/trade`,
        },
      ];
    }
    case "costliest_mistake":
      return [
        { label: uiLabel(lang, "Erreur", "Mistake"), value: String(ev.mistake ?? "") },
        { label: uiLabel(lang, "Occurrences", "Occurrences"), value: String(num(ev.count)) },
      ];
    case "discipline_streak":
      return [
        {
          label: uiLabel(lang, "Série de victoires", "Win streak"),
          value: String(num(ev.currentStreak)),
          tone: "up",
        },
      ];
    default:
      return [];
  }
}

export function insightToBlocks(insight: JarvisInsight, ctx: CopyContext): JarvisBlock[] {
  const hero = jarvisHeroCopy(insight, ctx);
  const blocks: JarvisBlock[] = [
    { type: "hero", lines: hero.lines.map(({ kind, text }) => ({ kind, text })) },
  ];

  const metrics = metricsOf(insight, ctx.lang);
  if (metrics.length > 0) {
    blocks.push({
      type: "insight",
      patternLabel: patternLabel(insight.pattern, ctx.lang),
      metrics,
      impact: insight.impact
        ? `${uiLabel(ctx.lang, "Impact estimé", "Estimated impact")} : ${formatMoney(insight.impact.amount, ctx.lang)}`
        : undefined,
    });
  }

  blocks.push({
    type: "mission",
    title: uiLabel(ctx.lang, "Mission du jour", "Today's mission"),
    items: insight.mission.map((m) => missionText(m, insight.evidence, ctx.lang)),
  });

  return blocks;
}

/** Mode apprentissage : un seul bloc Hero avec la ligne de non-conclusion. */
export function learningToBlock(sampleSize: number, ctx: CopyContext): JarvisBlock {
  const { line } = jarvisLearningCopy(sampleSize, ctx);
  return { type: "hero", lines: [{ kind: "context", text: line }] };
}
