import { describe, it, expect } from "bun:test";
import { closedTradeMonths, currentMonth, missingReportMonths } from "../reportMonths";

const NOW = new Date("2026-08-07T10:00:00Z");

describe("currentMonth", () => {
  it("rend le mois courant en YYYY-MM", () => {
    expect(currentMonth(NOW)).toBe("2026-08");
  });
});

describe("closedTradeMonths", () => {
  it("EXCLUT le mois en cours — un bilan partiel n'est pas un bilan", () => {
    // Figer août le 7 août ferait croire, un mois plus tard, que c'est le
    // rapport complet du mois.
    const months = closedTradeMonths(["2026-08-03", "2026-07-15"], NOW);
    expect(months).toEqual(["2026-07"]);
  });

  it("dédoublonne et trie du plus récent au plus ancien", () => {
    const months = closedTradeMonths(["2026-03-01", "2026-07-15", "2026-03-28", "2026-05-02"], NOW);
    expect(months).toEqual(["2026-07", "2026-05", "2026-03"]);
  });

  it("ignore les dates invalides sans planter", () => {
    expect(closedTradeMonths(["", "pas-une-date", "2026-06-01"], NOW)).toEqual(["2026-06"]);
  });
});

describe("missingReportMonths", () => {
  it("six mois d'historique importé donnent six rapports générables", () => {
    // Le cas produit exact : saisie manuelle ou CSV sur six mois, aucun
    // rapport encore généré.
    const dates = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"].map(
      (m) => `${m}-10`,
    );
    expect(missingReportMonths(dates, [], NOW)).toHaveLength(6);
  });

  it("ne repropose pas un mois déjà généré", () => {
    const dates = ["2026-06-10", "2026-07-10"];
    expect(missingReportMonths(dates, ["2026-07"], NOW)).toEqual(["2026-06"]);
  });

  it("rend une liste vide quand tout est à jour", () => {
    expect(missingReportMonths(["2026-07-10"], ["2026-07"], NOW)).toEqual([]);
  });
});
