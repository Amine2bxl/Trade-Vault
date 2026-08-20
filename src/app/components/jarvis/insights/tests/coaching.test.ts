import { describe, expect, it } from "bun:test";
import type { Trade } from "../../../../types";
import { computeStats } from "../../../../utils/tradeCalcs";
import { computeBehaviorSignals } from "../../../../utils/behaviorSignals";
import { deriveDailyRule } from "../../../../utils/edgeScore";
import { MIN_SAMPLE } from "@/modules/coaching";
import { buildDailyBrief, type DailyBriefInput } from "../coaching/brief";
import { buildDailyReview } from "../coaching/review";

let counter = 0;
function mk(date: string, pnl: number, mistakes: string[] = [], strategy = "Scalping"): Trade {
  counter += 1;
  return {
    id: `b-${counter}`,
    date,
    symbol: "NQ",
    direction: pnl >= 0 ? "long" : "short",
    pnl,
    riskAmount: 100,
    rMultiple: pnl >= 0 ? 1 : -1,
    strategy,
    mistakes,
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:30",
    exitTime: "10:00",
    confluences: [],
    confidence: 70,
  };
}

function briefInput(trades: Trade[]): DailyBriefInput {
  const stats = computeStats(trades);
  return {
    trades,
    stats,
    signals: computeBehaviorSignals(trades),
    rule: deriveDailyRule(stats),
    adherence: [],
  };
}

describe("buildDailyBrief (6A)", () => {
  it("aucun trade → mode learning, pas de section inventée", () => {
    const brief = buildDailyBrief(briefInput([]));
    expect(brief.status).toBe("learning");
    expect(brief.sections).toEqual([]);
  });

  it("peu de données → sections objectives seulement, sans affirmation", () => {
    const trades = [mk("2026-05-04", -50, ["FOMO entry"])];
    const brief = buildDailyBrief(briefInput(trades));
    // Aucun détecteur ne peut conclure : pas de section récent/temporal.
    expect(brief.sections.map((s) => s.id)).not.toContain("temporal");
  });

  it("données suffisantes → section récent avec preuve deep-linkée", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 12; i++) {
      trades.push(mk("2026-05-04", i < 8 ? -40 : 60, i < 8 ? ["FOMO entry"] : [], "Scalping"));
      trades.push(mk("2026-05-05", i % 3 === 0 ? -30 : 80, [], "Momentum"));
    }
    const brief = buildDailyBrief(briefInput(trades));
    expect(brief.status).toBe("ready");
    const recent = brief.sections.find((s) => s.id === "recent");
    expect(recent).toBeDefined();
    expect(recent!.evidence).toBeDefined();
    expect(recent!.evidence!.filter).toEqual({ mistake: "FOMO entry" });
    expect(recent!.evidence!.page).toBe("journal");
  });

  it("échantillon faible → lowSample signalé explicitement", () => {
    const trades: Trade[] = [];
    // 2 jours distincts, 6 trades chacun : buckets de 6 (< MIN_SAMPLE).
    for (let i = 0; i < 6; i++) {
      trades.push(mk("2026-05-04", 100));
      trades.push(mk("2026-05-05", -20));
    }
    const brief = buildDailyBrief(briefInput(trades));
    const temporal = brief.sections.find((s) => s.id === "temporal");
    expect(temporal).toBeDefined();
    expect(temporal!.evidence?.lowSample).toBeDefined();
    expect(temporal!.evidence!.lowSample!.required).toBe(MIN_SAMPLE);
  });
});

describe("buildDailyReview (6C)", () => {
  it("aucun trade → revue vide", () => {
    const review = buildDailyReview({
      trades: [],
      stats: computeStats([]),
      signals: {},
      adherence: [],
    });
    expect(review.status).toBe("empty");
    expect(review.wrong).toBeNull();
    expect(review.tomorrow).toBeNull();
  });

  it("journée avec erreur → problème identifié + priorité demain + preuve", () => {
    const trades = [
      mk("2026-05-06", -120, ["FOMO entry"]),
      mk("2026-05-06", -80, ["FOMO entry"]),
      mk("2026-05-06", 60),
    ];
    const review = buildDailyReview({
      trades,
      stats: computeStats(trades),
      signals: computeBehaviorSignals(trades),
      adherence: [],
    });
    expect(review.status).toBe("ready");
    expect(review.wrong).not.toBeNull();
    expect(review.wrong!.fr).toContain("FOMO entry");
    expect(review.tomorrow!.fr).toContain("FOMO entry");
    expect(review.evidence!.filter).toEqual({ trades: trades.map((t) => t.id) });
    expect(review.evidence!.page).toBe("journal");
  });

  it("journée verte propre → pas de reproche inventé", () => {
    const trades = [mk("2026-05-06", 100), mk("2026-05-06", 50)];
    const review = buildDailyReview({
      trades,
      stats: computeStats(trades),
      signals: computeBehaviorSignals(trades),
      adherence: [],
    });
    expect(review.status).toBe("ready");
    expect(review.wrong).toBeNull();
    expect(review.tomorrow!.fr).toContain("même process");
  });
});
