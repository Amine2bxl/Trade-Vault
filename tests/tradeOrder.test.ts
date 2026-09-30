import { describe, expect, test } from "bun:test";
import { newestFirst } from "../src/app/trading/tradeOrder";
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
