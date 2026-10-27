import { describe, expect, test } from "bun:test";
import { newestFirst } from "../src/app/trading/tradeOrder";
import { verifiedPriorClosedTrade } from "../src/domain/tradeOrder";
import type { Trade } from "../src/app/types";

const t = (date: string, entryTime: string, exitTime = "23:59") =>
  ({ id: `${date}-${entryTime}`, date, entryTime, exitTime }) as Trade;

describe("ordre du journal — date puis heure d'entrée, du plus récent au plus ancien", () => {
  test("le cas de référence", () => {
    const list = [
      t("2026-09-27", "09:20"),
      t("2026-09-28", "09:47"),
      t("2026-09-27", "15:30"),
      t("2026-09-28", "11:42"),
      t("2026-09-28", "10:31"),
    ];
    expect([...list].sort(newestFirst).map((x) => x.id)).toEqual([
      "2026-09-28-11:42",
      "2026-09-28-10:31",
      "2026-09-28-09:47",
      "2026-09-27-15:30",
      "2026-09-27-09:20",
    ]);
  });

  test("l'heure d'ENTRÉE décide, jamais celle de sortie", () => {
    const early = t("2026-09-28", "09:00", "16:00");
    const late = t("2026-09-28", "10:00", "10:05");
    expect([early, late].sort(newestFirst)[0]).toBe(late);
  });

  test("une heure sans zéro initial reste chronologique", () => {
    const nine = t("2026-09-28", "9:05");
    const ten = t("2026-09-28", "10:00");
    expect([nine, ten].sort(newestFirst)[0]).toBe(ten);
  });
});

describe("realized equity chronology", () => {
  test("closing order, not opening order, determines realized P&L order", async () => {
    const { compareRealizedChronological, hasVerifiedRealizedOrder } =
      await import("../src/domain/tradeOrder");
    const a = { ...t("2026-07-01", "09:30", "12:00"), id: "a" };
    const b = { ...t("2026-07-01", "10:00", "10:15"), id: "b" };
    expect([a, b].sort(compareRealizedChronological).map((x) => x.id)).toEqual(["b", "a"]);
    expect(hasVerifiedRealizedOrder([a, b])).toBe(true);
  });
  test("same-minute or overnight exits lack verified realization order", async () => {
    const { hasVerifiedRealizedOrder } = await import("../src/domain/tradeOrder");
    const a = t("2026-07-01", "09:30", "10:00");
    const b = t("2026-07-01", "09:45", "10:00");
    expect(hasVerifiedRealizedOrder([a, b])).toBe(false);
    expect(hasVerifiedRealizedOrder([t("2026-07-01", "23:00", "00:15")])).toBe(false);
  });
});

describe("previously closed trade evidence", () => {
  test("an overlapping loss is unknown, then a genuinely closed loss is known", () => {
    const first = { ...t("2026-07-01", "09:30", "11:00"), id: "loss", pnl: -100 };
    const overlap = { ...t("2026-07-01", "10:00", "10:20"), id: "overlap" };
    const after = { ...t("2026-07-01", "11:05", "11:20"), id: "after" };
    expect(verifiedPriorClosedTrade([first, overlap], 1)).toBeNull();
    expect(verifiedPriorClosedTrade([first, after], 1)?.id).toBe("loss");
  });

  test("same-minute entries, cross-account data and unknown broker clocks stay UNKNOWN", () => {
    const first = { ...t("2026-07-01", "09:30", "10:00"), id: "a", accountId: "a" };
    const tie = { ...t("2026-07-01", "10:00", "10:15"), id: "tie", accountId: "a" };
    const other = { ...t("2026-07-02", "09:30", "10:00"), id: "b", accountId: "b" };
    expect(verifiedPriorClosedTrade([first, tie], 1)).toBeNull();
    expect(verifiedPriorClosedTrade([first, other], 1)).toBeNull();
    expect(
      verifiedPriorClosedTrade(
        [
          { ...first, broker: "tradovate" },
          { ...other, accountId: "a" },
        ],
        1,
      ),
    ).toBeNull();
  });
});
