import type { JarvisBlock } from "../../blocks";
import { uiLabel } from "../copy/templates";
import type { WeeklyEvolution, WeeklyEvidence } from "./types";

/**
 * weeklyToBlocks — transforme une Weekly Evolution structurée en `JarvisBlock[]`.
 *
 * Réutilise UNIQUEMENT les blocs existants (stats / insight / card / mission).
 * Chaque section est visuellement distincte : la preuve porte un deep-link
 * « voir les trades », et un échantillon faible se dit « signal faible ».
 */

function evidenceMetrics(e: WeeklyEvidence, lang: "fr" | "en") {
  const m = [{ label: e.metric, value: String(e.value) }];
  if (e.compare && e.compare.previous != null) {
    m.push({
      label: uiLabel(lang, "Semaine précédente", "Previous week"),
      value: String(e.compare.previous),
    });
  }
  return m.map((x) => ({ label: x.label, value: x.value }));
}

export function weeklyToBlocks(ev: WeeklyEvolution, lang: "fr" | "en"): JarvisBlock[] {
  if (ev.status === "empty") {
    return [
      {
        type: "hero",
        lines: [
          {
            kind: "context",
            text:
              lang === "fr"
                ? "Pas encore de semaine complète à analyser. Logge des trades et reviens ici la semaine prochaine."
                : "No completed week to analyze yet. Log some trades and come back here next week.",
          },
        ],
      },
    ];
  }

  const blocks: JarvisBlock[] = [];

  blocks.push({
    type: "stats",
    title: lang === "fr" ? `Semaine du ${ev.period}` : `Week of ${ev.period}`,
    metrics:
      ev.score?.current != null
        ? [{ label: uiLabel(lang, "Edge Score", "Edge Score"), value: String(ev.score.current) }]
        : [],
  });

  for (const section of ev.sections) {
    const title = section.title[lang] ?? section.title.en;
    const lines = section.lines.map((l) => l[lang] ?? l.en);

    if (section.id === "next") {
      blocks.push({ type: "mission", title, items: lines });
      continue;
    }

    if (section.evidence?.length) {
      const withWeakNote = [...lines];
      if (section.evidence.some((e) => e.lowSample)) {
        withWeakNote.push(
          lang === "fr"
            ? "Signal faible — à confirmer la semaine prochaine."
            : "Weak signal — to confirm next week.",
        );
      }
      blocks.push({
        type: "insight",
        patternLabel: title,
        lines: withWeakNote,
        metrics: section.evidence.flatMap((e) => evidenceMetrics(e, lang)),
        filter: section.evidence[0].filter,
        page: section.evidence[0].page,
        viewTradesLabel: uiLabel(lang, "Voir les trades", "View trades"),
      });
      continue;
    }

    const tone =
      section.tone === "danger"
        ? "danger"
        : section.tone === "warning"
          ? "warning"
          : section.tone === "success"
            ? "success"
            : "accent";
    blocks.push({ type: "card", title, body: lines.join("\n"), tone });
  }

  return blocks;
}
