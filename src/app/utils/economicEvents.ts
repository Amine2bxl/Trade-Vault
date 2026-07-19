// ============================================================
//  Economic calendar — provider architecture.
// ------------------------------------------------------------
//  The UI only talks to `getEventsForWeek()`, which delegates to the
//  active EventProvider. Today that is `builtinScheduleProvider`: a
//  fully offline, rules-based generator of the recurring macro events
//  every trader tracks (NFP, CPI, FOMC, jobless claims, PMIs…).
//
//  Times are INDICATIVE (each event carries `approximate`) — the UI
//  labels them as such. Swapping in a live data source later means
//  implementing EventProvider once and changing `activeProvider`;
//  no page code changes. Deliberately NOT scraping Forex Factory
//  (ToS) — this module is the seam where a licensed API plugs in.
// ============================================================

export type ImpactLevel = "high" | "medium" | "low";
export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "NZD" | "CHF" | "CNY";

export interface EconomicEvent {
  id: string;
  /** Local ISO date (yyyy-mm-dd) of the event. */
  date: string;
  /** Event time in US Eastern hours/minutes (release convention), converted for display. */
  etHour: number;
  etMinute: number;
  currency: Currency;
  name: string;
  impact: ImpactLevel;
  /** True when the day/time follows a rule of thumb rather than a confirmed schedule. */
  approximate: boolean;
  /** Short plain-language note: what the release measures and how it typically moves markets. */
  note: string;
}

export interface EventProvider {
  /** Events for the 7 days starting at weekStart (a Monday, local midnight). */
  getEventsForWeek(weekStart: Date): Promise<EconomicEvent[]>;
}

// ---- date helpers ---------------------------------------------------------

const DAY = 86_400_000;

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  return new Date(x.getTime() - dow * DAY);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function firstBusinessDay(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Convert an ET release time to the viewer's local HH:MM string (approximate: fixed ET−5 offset handled via UTC math with DST heuristic). */
export function formatLocalTime(dateIso: string, etHour: number, etMinute: number): string {
  // US Eastern is UTC−5 (winter) / UTC−4 (DST, second Sunday of March → first Sunday of November).
  const [y, m, d] = dateIso.split("-").map(Number);
  const dstStart = nthWeekdayOfMonth(y, 2, 0, 2); // 2nd Sunday of March
  const dstEndFirstSunNov = nthWeekdayOfMonth(y, 10, 0, 1); // 1st Sunday of November
  const probe = new Date(y, m - 1, d);
  const isDst = probe >= dstStart && probe < dstEndFirstSunNov;
  const utc = Date.UTC(y, m - 1, d, etHour + (isDst ? 4 : 5), etMinute);
  const local = new Date(utc);
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
}

// ---- built-in rules-based schedule -----------------------------------------

interface MonthlyRule {
  currency: Currency;
  name: string;
  impact: ImpactLevel;
  etHour: number;
  etMinute: number;
  approximate: boolean;
  note: string;
  /** Returns the event dates for a given month (usually one). */
  datesInMonth(year: number, month: number): Date[];
}

const MONTHLY_RULES: MonthlyRule[] = [
  {
    currency: "USD",
    name: "Non-Farm Payrolls (NFP)",
    impact: "high",
    etHour: 8,
    etMinute: 30,
    approximate: false,
    note: "US jobs added last month. The single most volatile monthly release for USD pairs and indices.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 5, 1)], // first Friday
  },
  {
    currency: "USD",
    name: "ADP Employment Change",
    impact: "medium",
    etHour: 8,
    etMinute: 15,
    approximate: true,
    note: "Private payrolls preview, two days before NFP. Sets expectations more than it moves price.",
    datesInMonth: (y, m) => [addDays(nthWeekdayOfMonth(y, m, 5, 1), -2)], // Wednesday before first Friday
  },
  {
    currency: "USD",
    name: "CPI (Consumer Price Index)",
    impact: "high",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "US inflation print. Drives Fed-rate expectations — large moves on any surprise vs forecast.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 2, 2)], // ~2nd Tuesday (varies by month)
  },
  {
    currency: "USD",
    name: "PPI (Producer Price Index)",
    impact: "medium",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "Wholesale inflation, usually the day after CPI. Confirms or fades the CPI narrative.",
    datesInMonth: (y, m) => [addDays(nthWeekdayOfMonth(y, m, 2, 2), 1)],
  },
  {
    currency: "USD",
    name: "Retail Sales",
    impact: "high",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "US consumer spending. Strong beats lift yields and USD; misses fuel rate-cut bets.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 4, 3)], // ~3rd Thursday window
  },
  {
    currency: "USD",
    name: "ISM Manufacturing PMI",
    impact: "medium",
    etHour: 10,
    etMinute: 0,
    approximate: false,
    note: "Factory activity survey on the first business day. Above 50 = expansion.",
    datesInMonth: (y, m) => [firstBusinessDay(y, m)],
  },
  {
    currency: "USD",
    name: "Core PCE Price Index",
    impact: "high",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "The Fed's preferred inflation gauge, released near month-end with personal income/spending.",
    datesInMonth: (y, m) => [
      addDays(new Date(y, m + 1, 0), -(new Date(y, m + 1, 0).getDay() + 2) % 7),
    ], // last Friday
  },
  {
    currency: "EUR",
    name: "Euro Area Flash CPI",
    impact: "high",
    etHour: 5,
    etMinute: 0,
    approximate: true,
    note: "Eurozone inflation estimate at month-end. Key ECB input; moves EUR crosses.",
    datesInMonth: (y, m) => [new Date(y, m + 1, 0)], // last day of month (flash estimate window)
  },
  {
    currency: "GBP",
    name: "UK CPI",
    impact: "high",
    etHour: 2,
    etMinute: 0,
    approximate: true,
    note: "UK inflation, mid-month Wednesday. Repricing of BoE path hits GBP hard on surprises.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 3, 3)],
  },
  {
    currency: "JPY",
    name: "BoJ Summary / Tokyo CPI window",
    impact: "medium",
    etHour: 19,
    etMinute: 30,
    approximate: true,
    note: "Late-month JPY inflation signal (released Tokyo morning). Watch for policy-shift hints.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 5, 4)],
  },
  {
    currency: "CAD",
    name: "Canada Employment Change",
    impact: "medium",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "Canadian jobs report, usually the same Friday as NFP — CAD pairs get both at once.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 5, 1)],
  },
  {
    currency: "USD",
    name: "ISM Services PMI",
    impact: "medium",
    etHour: 10,
    etMinute: 0,
    approximate: true,
    note: "Services-sector activity survey, early month. Above 50 = expansion; the larger half of the US economy.",
    datesInMonth: (y, m) => [addDays(firstBusinessDay(y, m), 2)],
  },
  {
    currency: "USD",
    name: "JOLTS Job Openings",
    impact: "medium",
    etHour: 10,
    etMinute: 0,
    approximate: true,
    note: "Open-positions count. A labour-tightness gauge the Fed watches closely.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 2, 1)],
  },
  {
    currency: "USD",
    name: "CB Consumer Confidence",
    impact: "medium",
    etHour: 10,
    etMinute: 0,
    approximate: true,
    note: "Households' outlook survey, last Tuesday. Leads discretionary spending.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 2, 4)],
  },
  {
    currency: "USD",
    name: "UoM Consumer Sentiment (Prelim)",
    impact: "low",
    etHour: 10,
    etMinute: 0,
    approximate: true,
    note: "Michigan sentiment + inflation-expectations survey. Watched for the expectations component.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 5, 2)],
  },
  {
    currency: "USD",
    name: "Durable Goods Orders",
    impact: "low",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "New orders for long-lived manufactured goods — a business-investment proxy.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 3, 4)],
  },
  {
    currency: "USD",
    name: "Advance GDP (Quarterly)",
    impact: "high",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "First estimate of quarterly growth. Big misses reprice the whole rate path.",
    datesInMonth: (y, m) => ([0, 3, 6, 9].includes(m) ? [nthWeekdayOfMonth(y, m, 4, 4)] : []),
  },
  {
    currency: "EUR",
    name: "Germany CPI (Flash)",
    impact: "medium",
    etHour: 8,
    etMinute: 0,
    approximate: true,
    note: "Largest euro-area economy's inflation — a strong tell for the EZ flash the next day.",
    datesInMonth: (y, m) => [addDays(new Date(y, m + 1, 0), -1)],
  },
  {
    currency: "EUR",
    name: "Euro Area Unemployment Rate",
    impact: "low",
    etHour: 5,
    etMinute: 0,
    approximate: true,
    note: "Bloc-wide jobless rate. Slow-moving; matters at turning points.",
    datesInMonth: (y, m) => [firstBusinessDay(y, m)],
  },
  {
    currency: "EUR",
    name: "German Ifo Business Climate",
    impact: "low",
    etHour: 4,
    etMinute: 0,
    approximate: true,
    note: "Widely-followed German business-sentiment index.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 1, 4)],
  },
  {
    currency: "GBP",
    name: "UK GDP (Monthly)",
    impact: "medium",
    etHour: 2,
    etMinute: 0,
    approximate: true,
    note: "Britain publishes monthly GDP — a higher-frequency growth read than most economies.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 3, 2)],
  },
  {
    currency: "GBP",
    name: "UK Claimant Count / Employment",
    impact: "medium",
    etHour: 2,
    etMinute: 0,
    approximate: true,
    note: "UK jobs + wage growth. Pay data is the BoE's key inflation-persistence signal.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 2, 3)],
  },
  {
    currency: "GBP",
    name: "UK Retail Sales",
    impact: "low",
    etHour: 2,
    etMinute: 0,
    approximate: true,
    note: "Consumer-spending volume. Noisy month to month.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 5, 3)],
  },
  {
    currency: "JPY",
    name: "Tokyo Core CPI",
    impact: "medium",
    etHour: 19,
    etMinute: 30,
    approximate: true,
    note: "Leading indicator for national Japan inflation, released Tokyo Friday morning.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 5, 4)],
  },
  {
    currency: "CAD",
    name: "Canada CPI",
    impact: "high",
    etHour: 8,
    etMinute: 30,
    approximate: true,
    note: "Canadian inflation, mid-month. Primary driver of BoC-rate expectations and CAD.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 2, 3)],
  },
  {
    currency: "AUD",
    name: "Australia Employment Change",
    impact: "medium",
    etHour: 20,
    etMinute: 30,
    approximate: true,
    note: "Aussie jobs report (released Sydney morning). Moves AUD and RBA pricing.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 4, 3)],
  },
  {
    currency: "AUD",
    name: "Australia CPI (Quarterly)",
    impact: "high",
    etHour: 20,
    etMinute: 30,
    approximate: true,
    note: "Quarterly inflation — the RBA's headline input; large AUD reaction on surprises.",
    datesInMonth: (y, m) => ([0, 3, 6, 9].includes(m) ? [nthWeekdayOfMonth(y, m, 3, 4)] : []),
  },
  {
    currency: "NZD",
    name: "New Zealand CPI (Quarterly)",
    impact: "high",
    etHour: 18,
    etMinute: 45,
    approximate: true,
    note: "Quarterly Kiwi inflation. Sparse data means each print moves NZD hard.",
    datesInMonth: (y, m) => ([0, 3, 6, 9].includes(m) ? [nthWeekdayOfMonth(y, m, 3, 3)] : []),
  },
  {
    currency: "CHF",
    name: "Switzerland CPI",
    impact: "low",
    etHour: 2,
    etMinute: 30,
    approximate: true,
    note: "Swiss inflation, early month. Usually low and stable; SNB-watched.",
    datesInMonth: (y, m) => [addDays(firstBusinessDay(y, m), 2)],
  },
  {
    currency: "CNY",
    name: "China CPI",
    impact: "medium",
    etHour: 21,
    etMinute: 30,
    approximate: true,
    note: "Chinese inflation (released Beijing morning). Read for global demand and commodity FX.",
    datesInMonth: (y, m) => [nthWeekdayOfMonth(y, m, 3, 2)],
  },
  {
    currency: "CNY",
    name: "China Manufacturing PMI",
    impact: "medium",
    etHour: 21,
    etMinute: 30,
    approximate: true,
    note: "Official factory gauge at month-end. A lead on AUD/NZD and risk sentiment.",
    datesInMonth: (y, m) => [addDays(new Date(y, m + 1, 0), -1)],
  },
];

interface WeeklyRule {
  currency: Currency;
  name: string;
  impact: ImpactLevel;
  weekday: number; // 0 = Sunday
  etHour: number;
  etMinute: number;
  approximate: boolean;
  note: string;
}

const WEEKLY_RULES: WeeklyRule[] = [
  {
    currency: "USD",
    name: "Initial Jobless Claims",
    impact: "medium",
    weekday: 4,
    etHour: 8,
    etMinute: 30,
    approximate: false,
    note: "Weekly unemployment filings every Thursday. Trend matters more than any single week.",
  },
  {
    currency: "USD",
    name: "Crude Oil Inventories (EIA)",
    impact: "low",
    weekday: 3,
    etHour: 10,
    etMinute: 30,
    approximate: false,
    note: "Weekly US crude stock change. Mostly an oil/energy-desk event.",
  },
];

/**
 * FOMC rate decisions — the one series where rules of thumb aren't good enough,
 * so the published two-day meeting calendar is embedded (decision = day two,
 * 14:00 ET, press conference 14:30). Update yearly; still flagged approximate
 * so the UI reminds users to double-check against the Fed's site.
 */
const FOMC_DECISIONS: Record<number, [number, number][]> = {
  2025: [
    [0, 29],
    [2, 19],
    [4, 7],
    [5, 18],
    [6, 30],
    [8, 17],
    [9, 29],
    [11, 10],
  ],
  2026: [
    [0, 28],
    [2, 18],
    [3, 29],
    [5, 17],
    [6, 29],
    [8, 16],
    [9, 28],
    [11, 9],
  ],
};

function fomcEventsForWeek(weekStart: Date): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  const weekEnd = addDays(weekStart, 7);
  for (const [year, days] of Object.entries(FOMC_DECISIONS)) {
    for (const [month, day] of days) {
      const d = new Date(Number(year), month, day);
      if (d >= weekStart && d < weekEnd) {
        out.push({
          id: `fomc-${isoDate(d)}`,
          date: isoDate(d),
          etHour: 14,
          etMinute: 0,
          currency: "USD",
          name: "FOMC Rate Decision",
          impact: "high",
          approximate: true,
          note: "Federal Reserve interest-rate decision + press conference 30 min later. The highest-volatility scheduled event.",
        });
      }
    }
  }
  return out;
}

/**
 * Other major central-bank rate decisions. Dates follow each bank's published
 * 2025–2026 meeting calendar; still flagged approximate so the UI reminds users
 * to confirm against the official source. Times are the local release hour in ET.
 */
interface CentralBank {
  currency: Currency;
  name: string;
  etHour: number;
  etMinute: number;
  note: string;
  /** [month (0-based), day] pairs by year. */
  dates: Record<number, [number, number][]>;
}

const CENTRAL_BANKS: CentralBank[] = [
  {
    currency: "EUR",
    name: "ECB Rate Decision",
    etHour: 8,
    etMinute: 15,
    note: "European Central Bank rate decision, press conference 30 min later. Top-tier EUR event.",
    dates: {
      2025: [
        [0, 30],
        [2, 6],
        [3, 17],
        [5, 5],
        [6, 24],
        [8, 11],
        [9, 30],
        [11, 18],
      ],
      2026: [
        [0, 29],
        [2, 12],
        [3, 16],
        [5, 4],
        [6, 16],
        [8, 10],
        [9, 29],
        [11, 17],
      ],
    },
  },
  {
    currency: "GBP",
    name: "BoE Rate Decision",
    etHour: 7,
    etMinute: 0,
    note: "Bank of England Bank Rate + MPC vote split. Drives GBP and gilt yields.",
    dates: {
      2025: [
        [1, 6],
        [2, 20],
        [4, 8],
        [5, 19],
        [7, 7],
        [8, 18],
        [10, 6],
        [11, 18],
      ],
      2026: [
        [1, 5],
        [2, 19],
        [4, 7],
        [5, 18],
        [7, 6],
        [8, 17],
        [10, 5],
        [11, 17],
      ],
    },
  },
  {
    currency: "JPY",
    name: "BoJ Rate Decision",
    etHour: 22,
    etMinute: 0,
    note: "Bank of Japan policy decision (released Tokyo). Large JPY moves on any policy-normalisation hint.",
    dates: {
      2025: [
        [0, 24],
        [2, 19],
        [3, 30],
        [5, 17],
        [6, 31],
        [8, 19],
        [9, 30],
        [11, 19],
      ],
      2026: [
        [0, 23],
        [2, 18],
        [3, 28],
        [5, 16],
        [6, 29],
        [8, 18],
        [9, 29],
        [11, 18],
      ],
    },
  },
  {
    currency: "CAD",
    name: "BoC Rate Decision",
    etHour: 9,
    etMinute: 45,
    note: "Bank of Canada rate decision. Primary CAD driver alongside Canada CPI.",
    dates: {
      2025: [
        [0, 29],
        [2, 12],
        [3, 16],
        [5, 4],
        [6, 30],
        [8, 17],
        [9, 29],
        [11, 10],
      ],
      2026: [
        [0, 28],
        [2, 11],
        [3, 15],
        [5, 3],
        [6, 29],
        [8, 16],
        [9, 28],
        [11, 9],
      ],
    },
  },
  {
    currency: "AUD",
    name: "RBA Rate Decision",
    etHour: 23,
    etMinute: 30,
    note: "Reserve Bank of Australia decision (released Sydney). Moves AUD and, by proxy, NZD.",
    dates: {
      2025: [
        [1, 18],
        [3, 1],
        [4, 20],
        [6, 8],
        [7, 12],
        [8, 30],
        [10, 4],
        [11, 9],
      ],
      2026: [
        [1, 3],
        [2, 17],
        [4, 5],
        [5, 16],
        [7, 11],
        [8, 29],
        [10, 3],
        [11, 8],
      ],
    },
  },
  {
    currency: "NZD",
    name: "RBNZ Rate Decision",
    etHour: 21,
    etMinute: 0,
    note: "Reserve Bank of New Zealand decision (released Wellington). Sharp NZD reactions.",
    dates: {
      2025: [
        [1, 18],
        [3, 8],
        [4, 27],
        [6, 8],
        [7, 19],
        [9, 7],
        [10, 25],
      ],
      2026: [
        [1, 24],
        [3, 14],
        [4, 26],
        [6, 7],
        [7, 18],
        [9, 6],
        [10, 24],
      ],
    },
  },
  {
    currency: "CHF",
    name: "SNB Rate Decision",
    etHour: 3,
    etMinute: 30,
    note: "Swiss National Bank quarterly decision. Franc-sensitive; watch for intervention language.",
    dates: {
      2025: [
        [2, 20],
        [5, 19],
        [8, 25],
        [11, 11],
      ],
      2026: [
        [2, 19],
        [5, 18],
        [8, 24],
        [11, 10],
      ],
    },
  },
];

function centralBankEventsForWeek(weekStart: Date): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  const weekEnd = addDays(weekStart, 7);
  for (const bank of CENTRAL_BANKS) {
    for (const [year, days] of Object.entries(bank.dates)) {
      for (const [month, day] of days) {
        const d = new Date(Number(year), month, day);
        if (d >= weekStart && d < weekEnd) {
          out.push({
            id: `${bank.name}-${isoDate(d)}`.replace(/\s+/g, "-").toLowerCase(),
            date: isoDate(d),
            etHour: bank.etHour,
            etMinute: bank.etMinute,
            currency: bank.currency,
            name: bank.name,
            impact: "high",
            approximate: true,
            note: bank.note,
          });
        }
      }
    }
  }
  return out;
}

export const builtinScheduleProvider: EventProvider = {
  async getEventsForWeek(weekStart: Date): Promise<EconomicEvent[]> {
    const events: EconomicEvent[] = [
      ...fomcEventsForWeek(weekStart),
      ...centralBankEventsForWeek(weekStart),
    ];
    const weekEnd = addDays(weekStart, 7);

    // Monthly rules: evaluate the months the week touches.
    const months = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      months.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    for (const key of months) {
      const [y, m] = key.split("-").map(Number);
      for (const rule of MONTHLY_RULES) {
        for (const d of rule.datesInMonth(y, m)) {
          if (d >= weekStart && d < weekEnd) {
            events.push({
              id: `${rule.name}-${isoDate(d)}`.replace(/\s+/g, "-").toLowerCase(),
              date: isoDate(d),
              etHour: rule.etHour,
              etMinute: rule.etMinute,
              currency: rule.currency,
              name: rule.name,
              impact: rule.impact,
              approximate: rule.approximate,
              note: rule.note,
            });
          }
        }
      }
    }

    // Weekly rules.
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      for (const rule of WEEKLY_RULES) {
        if (d.getDay() === rule.weekday) {
          events.push({
            id: `${rule.name}-${isoDate(d)}`.replace(/\s+/g, "-").toLowerCase(),
            date: isoDate(d),
            etHour: rule.etHour,
            etMinute: rule.etMinute,
            currency: rule.currency,
            name: rule.name,
            impact: rule.impact,
            approximate: rule.approximate,
            note: rule.note,
          });
        }
      }
    }

    events.sort(
      (a, b) => a.date.localeCompare(b.date) || a.etHour - b.etHour || a.etMinute - b.etMinute,
    );
    return events;
  },
};

/** The seam: point this at a licensed API provider later — pages won't change. */
const activeProvider: EventProvider = builtinScheduleProvider;

export function getEventsForWeek(weekStart: Date): Promise<EconomicEvent[]> {
  return activeProvider.getEventsForWeek(weekStart);
}

export const CURRENCIES: Currency[] = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "CNY",
];
