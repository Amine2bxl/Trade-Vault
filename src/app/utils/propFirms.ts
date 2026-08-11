// ── Prop Firm Configuration System ──
// Each prop firm has its own rules. Extensible — add new firms by adding entries.

export interface PropFirm {
  id: string;
  name: string;
  challenges: PropChallenge[];
}

export interface PropChallenge {
  id: string;
  name: string;
  startingBalance: number;
  profitTarget: number;
  profitTargetPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxDailyLoss: number;
  maxDailyLossPct: number;
  maxTradingDays: number;
  maxTradesPerDay: number;
  trailingDrawdown: boolean;
  description: string;
}

export const PROP_FIRMS: PropFirm[] = [
  {
    id: "apex",
    name: "Apex Trader Funding",
    challenges: [
      {
        id: "apex-25k",
        name: "Apex $25K",
        startingBalance: 25000,
        profitTarget: 1500,
        profitTargetPct: 6,
        maxDrawdown: 1500,
        maxDrawdownPct: 6,
        maxDailyLoss: 0,
        maxDailyLossPct: 0,
        maxTradingDays: 30,
        maxTradesPerDay: 10,
        trailingDrawdown: true,
        description: "$25K account · $1,500 profit target · EOD trailing drawdown",
      },
      {
        id: "apex-50k",
        name: "Apex $50K",
        startingBalance: 50000,
        profitTarget: 3000,
        profitTargetPct: 6,
        maxDrawdown: 2500,
        maxDrawdownPct: 5,
        maxDailyLoss: 0,
        maxDailyLossPct: 0,
        maxTradingDays: 30,
        maxTradesPerDay: 10,
        trailingDrawdown: true,
        description: "$50K account · $3,000 profit target · EOD trailing drawdown",
      },
      {
        id: "apex-100k",
        name: "Apex $100K",
        startingBalance: 100000,
        profitTarget: 6000,
        profitTargetPct: 6,
        maxDrawdown: 3000,
        maxDrawdownPct: 3,
        maxDailyLoss: 0,
        maxDailyLossPct: 0,
        maxTradingDays: 30,
        maxTradesPerDay: 10,
        trailingDrawdown: true,
        description: "$100K account · $6,000 profit target · EOD trailing drawdown",
      },
    ],
  },
  {
    id: "topstep",
    name: "Topstep",
    challenges: [
      {
        id: "topstep-50k",
        name: "Topstep $50K",
        startingBalance: 50000,
        profitTarget: 3000,
        profitTargetPct: 6,
        maxDrawdown: 2000,
        maxDrawdownPct: 4,
        maxDailyLoss: 1000,
        maxDailyLossPct: 2,
        maxTradingDays: 30,
        maxTradesPerDay: 10,
        trailingDrawdown: false,
        description: "$50K account · $3,000 target · Static drawdown · $1,000 daily loss limit",
      },
      {
        id: "topstep-100k",
        name: "Topstep $100K",
        startingBalance: 100000,
        profitTarget: 6000,
        profitTargetPct: 6,
        maxDrawdown: 3000,
        maxDrawdownPct: 3,
        maxDailyLoss: 2000,
        maxDailyLossPct: 2,
        maxTradingDays: 30,
        maxTradesPerDay: 10,
        trailingDrawdown: false,
        description: "$100K account · $6,000 target · Static drawdown · $2,000 daily loss limit",
      },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    challenges: [
      {
        id: "custom",
        name: "Custom Challenge",
        startingBalance: 50000,
        profitTarget: 3000,
        profitTargetPct: 6,
        maxDrawdown: 2500,
        maxDrawdownPct: 5,
        maxDailyLoss: 500,
        maxDailyLossPct: 1,
        maxTradingDays: 30,
        maxTradesPerDay: 5,
        trailingDrawdown: true,
        description: "Configure your own challenge parameters",
      },
    ],
  },
];

export function findFirm(id: string): PropFirm | undefined {
  return PROP_FIRMS.find((f) => f.id === id);
}

export function findChallenge(id: string): PropChallenge | undefined {
  for (const firm of PROP_FIRMS) {
    const c = firm.challenges.find((ch) => ch.id === id);
    if (c) return c;
  }
  return undefined;
}

export function formatMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}$${abs.toLocaleString("en-US")}`;
}
