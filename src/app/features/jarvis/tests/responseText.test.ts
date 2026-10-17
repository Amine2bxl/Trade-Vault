import { expect, test } from "bun:test";
import { responseTextOf } from "../responseText";

test("la copie conserve le rapport complet, ses valeurs et ses actions, sans payload technique", () => {
  const full = "Analyse détaillée. ".repeat(100);
  const text = responseTextOf({
    id: "m",
    role: "assistant",
    createdAt: "2026-10-17T12:00:00Z",
    blocks: [
      { type: "markdown", content: full },
      { type: "stats", title: "Journal", metrics: [{ label: "PnL", value: "+$1,234.50" }] },
      { type: "mission", title: "Prochaine séance", items: ["Risque maximal : 1%"] },
      { type: "table", columns: ["Jour", "R"], rows: [["Lundi", "+2.5"]] },
      {
        type: "tool",
        tool: "openPage",
        label: "Voir les trades",
        payload: { internal: "private-id" },
      },
    ],
  });
  expect(text.startsWith(full)).toBe(true);
  expect(text).toContain("PnL: +$1,234.50");
  expect(text).toContain("Risque maximal : 1%");
  expect(text).toContain("Jour\tR\nLundi\t+2.5");
  expect(text).toContain("Voir les trades");
  expect(text).not.toContain("private-id");
});
