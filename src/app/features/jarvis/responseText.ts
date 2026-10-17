import type { JarvisMessage } from "./blocks";

/** Copie intégrale des données lisibles, indépendante du résumé borné de mémoire. */
export function responseTextOf(message: JarvisMessage): string {
  return message.blocks
    .map((b) => {
      switch (b.type) {
        case "markdown":
          return b.content;
        case "hero":
          return b.lines.map((l) => l.text).join("\n");
        case "stats":
          return [b.title, ...b.metrics.map((m) => `${m.label}: ${m.value}`)]
            .filter(Boolean)
            .join("\n");
        case "insight":
          return [
            b.patternLabel,
            ...(b.lines ?? []),
            ...b.metrics.map((m) => `${m.label}: ${m.value}`),
            b.impact,
          ]
            .filter(Boolean)
            .join("\n");
        case "mission":
          return [b.title, ...b.items].join("\n");
        case "card":
        case "recommendation":
        case "notification":
          return `${b.title}\n${b.body}`;
        case "report":
          return `${b.title}\n${b.summary}`;
        case "checklist":
          return [b.title, ...b.items.map((i) => `${i.done ? "✓" : "○"} ${i.label}`)]
            .filter(Boolean)
            .join("\n");
        case "alert":
          return b.message;
        case "table":
          return [b.columns, ...b.rows].map((r) => r.join("\t")).join("\n");
        case "comparison":
          return [b.title, ...b.rows.map((r) => r.join("\t"))].join("\n");
        case "timeline":
          return b.events.map((e) => `${e.time} ${e.label}`).join("\n");
        case "tool":
          return b.label;
        case "chart":
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
