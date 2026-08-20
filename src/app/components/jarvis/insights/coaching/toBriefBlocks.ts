import type { JarvisBlock } from "../../blocks";
import type { DailyBrief } from "./types";

/**
 * briefToBlocks — transforme un DailyBrief structuré en `JarvisBlock[]`.
 *
 * Chaque section devient un bloc `insight` : titre, lignes narratives, métriques
 * et — quand il y a une preuve — un deep-link filtré (« voir les trades »).
 * Aucune prose ajoutée ici : ce module ne fait que localiser et mettre en forme
 * ce que `buildDailyBrief` a produit.
 */

export function briefToBlocks(brief: DailyBrief, lang: "fr" | "en"): JarvisBlock[] {
  return brief.sections.map((section) => ({
    type: "insight",
    patternLabel: section.title[lang] ?? section.title.en,
    metrics:
      section.evidence?.metrics.map((m) => ({
        label: m.label[lang] ?? m.label.en,
        value: m.value,
        tone: m.tone,
      })) ?? [],
    lines: section.lines.map((l) => l[lang] ?? l.en),
    filter: section.evidence?.filter,
    page: section.evidence?.page,
    viewTradesLabel: section.evidence?.filter
      ? lang === "fr"
        ? "Voir les trades"
        : "View trades"
      : undefined,
  }));
}
