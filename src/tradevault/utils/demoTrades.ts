import { Trade } from "../types";
import { generateId } from "../store";

/** Most recent weekday strictly before `from`. */
function prevWeekday(from: Date): Date {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Three realistic, fully editable sample trades (2 wins, 1 loss — a believable
 * week, not a fantasy). Flagged `isExample` so the Journal badges them; the
 * flag clears the moment the user edits one.
 */
export function buildDemoTrades(noteText: string): Trade[] {
  const d1 = prevWeekday(new Date());
  const d2 = prevWeekday(d1);
  const d3 = prevWeekday(d2);

  const base = {
    screenshots: [] as string[],
    mae: null,
    mfe: null,
    slippage: null,
    isExample: true,
    notes: noteText,
  };

  return [
    {
      ...base,
      id: generateId(),
      date: iso(d1),
      symbol: "NQ",
      direction: "long",
      riskAmount: 150,
      rMultiple: 2,
      pnl: 300,
      strategy: "Silver Bullet",
      mistakes: [],
      setupQuality: 4,
      entryTime: "10:03",
      exitTime: "10:41",
      confluences: ["Liquidity sweep", "Fair value gap"],
      confidence: 80,
    },
    {
      ...base,
      id: generateId(),
      date: iso(d2),
      symbol: "EURUSD",
      direction: "short",
      riskAmount: 100,
      rMultiple: -1,
      pnl: -100,
      strategy: "Breakout",
      mistakes: ["FOMO entry"],
      setupQuality: 2,
      entryTime: "08:45",
      exitTime: "09:20",
      confluences: ["Trend line"],
      confidence: 55,
    },
    {
      ...base,
      id: generateId(),
      date: iso(d3),
      symbol: "ES",
      direction: "long",
      riskAmount: 120,
      rMultiple: 1.5,
      pnl: 180,
      strategy: "Order Block",
      mistakes: [],
      setupQuality: 5,
      entryTime: "09:35",
      exitTime: "11:02",
      confluences: ["Order block", "Market structure"],
      confidence: 75,
    },
  ];
}
