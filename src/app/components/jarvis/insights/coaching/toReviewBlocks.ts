import type { JarvisBlock } from "../../blocks";
import { uiLabel } from "../copy/templates";
import type { DailyReview } from "./types";

/**
 * reviewToBlocks — transforme une Daily Review en `JarvisBlock[]`.
 *
 *   summary → stats · well → mission · wrong → card · evidence → insight
 *   (deep-link) · tomorrow → mission.
 *
 * Réutilise uniquement les blocs existants — aucun nouveau type de bloc.
 */

export function reviewToBlocks(review: DailyReview, lang: "fr" | "en"): JarvisBlock[] {
  if (review.status === "empty") {
    return [
      {
        type: "hero",
        lines: [{ kind: "context", text: review.summary[lang] ?? review.summary.en }],
      },
    ];
  }

  const blocks: JarvisBlock[] = [];

  if (review.evidence?.metrics.length) {
    blocks.push({
      type: "stats",
      title: review.summary[lang] ?? review.summary.en,
      metrics: review.evidence.metrics.map((m) => ({
        label: m.label[lang] ?? m.label.en,
        value: m.value,
        trend: m.tone,
      })),
    });
  }

  if (review.well.length > 0) {
    blocks.push({
      type: "mission",
      title: uiLabel(lang, "Ce qui a bien marché", "What went well"),
      items: review.well.map((l) => l[lang] ?? l.en),
    });
  }

  if (review.wrong) {
    blocks.push({
      type: "card",
      title: uiLabel(lang, "Le problème", "What went wrong"),
      body: review.wrong[lang] ?? review.wrong.en,
      tone: "warning",
    });
  }

  if (review.evidence?.filter) {
    blocks.push({
      type: "insight",
      patternLabel: uiLabel(lang, "Preuve", "Evidence"),
      metrics: [],
      filter: review.evidence.filter,
      page: review.evidence.page,
      viewTradesLabel: uiLabel(lang, "Voir les trades", "View trades"),
    });
  }

  if (review.tomorrow) {
    blocks.push({
      type: "mission",
      title: uiLabel(lang, "Demain", "Tomorrow"),
      items: [review.tomorrow[lang] ?? review.tomorrow.en],
    });
  }

  return blocks;
}
