// Jeu de données de vérification L0 — chiffres vérifiables à la main.
// 20 trades : 14 au risque connu (octobre 3,8R + septembre 4,5R → 0,59R),
// 2 manuels sans risque, 3 broker relus (risque « par défaut »), 1 CSV non relu.
// Gains bruts 3 300 $, pertes brutes 1 080 $ → PF 3,06 ; 13 gains / 20 → 65 %.
// Rapport de septembre archivé SANS version de méthode (PF 99, synthèse IA).
import { writeFileSync } from "node:fs";
const USER_ID = "b0000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "b0000000-0000-4000-8000-0000000000a1";
const EMAIL = "tv-l0-ui@test.dev";
const now = new Date().toISOString();
let n = 0;
const trade = (date, o) => ({
  id: `l0-${++n}`,
  user_id: USER_ID,
  account_id: ACCOUNT_ID,
  trade_date: date,
  symbol: "NQ",
  direction: o.pnl >= 0 ? "long" : "short",
  pnl: 0,
  risk_amount: 0,
  r_multiple: 0,
  strategy: "ORB",
  mistakes: [],
  setup_quality: 4,
  notes: "",
  screenshots: [],
  entry_time: "09:30",
  exit_time: "09:45",
  confluences: [],
  confidence: 70,
  mae: null,
  mfe: null,
  slippage: null,
  is_example: false,
  calibration_factor: 1,
  replay_session_id: null,
  session_id: null,
  copied_from: null,
  quantity: null,
  entry_price: null,
  exit_price: null,
  fees: null,
  broker: null,
  external_id: null,
  broker_account: null,
  review_pending: false,
  created_at: `${date}T20:00:00+00:00`,
  updated_at: `${date}T20:00:00+00:00`,
  ...o,
});
// Octobre 2026 : 8 manuels au risque connu (R : +2 −1 −1 +1,5 −0,5 +3 −1 +0,8 → somme 2,8 ; moyenne 0,35R)
const rs = [2, -1, -1, 1.5, -0.5, 3, -1, 0.8];
const days = [
  "2026-10-01",
  "2026-10-02",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
  "2026-10-09",
  "2026-10-12",
];
const trades = rs.map((r, i) =>
  trade(days[i], {
    pnl: r * 200,
    risk_amount: 200,
    r_multiple: r,
    mistakes: r < 0 && i === 2 ? ["FOMO entry", "Revenge trade"] : [],
  }),
);
// 2 manuels sans risque saisi (R inconnu, stocké 0)
trades.push(
  trade("2026-10-13", { pnl: 150 }),
  trade("2026-10-14", { pnl: -80, direction: "short" }),
);
// 3 trades broker relus, risque « par défaut » 100
trades.push(
  trade("2026-10-15", {
    pnl: 250,
    risk_amount: 100,
    r_multiple: 2.5,
    broker: "tradovate",
    external_id: "x1",
    entry_time: "15:31",
    exit_time: "15:50",
  }),
  trade("2026-10-16", {
    pnl: -100,
    risk_amount: 100,
    r_multiple: -1,
    broker: "tradovate",
    external_id: "x2",
    entry_time: "15:40",
    exit_time: "16:02",
  }),
  trade("2026-10-19", {
    pnl: 40,
    risk_amount: 100,
    r_multiple: 0.4,
    broker: "tradovate",
    external_id: "x3",
    entry_time: "16:05",
    exit_time: "16:20",
  }),
);
// 1 import CSV non relu : P&L observé 300, pas de risque
trades.push(
  trade("2026-10-20", { pnl: 300, review_pending: true, setup_quality: 3, confidence: 50 }),
);
// Septembre 2026 : 6 manuels (mois du rapport archivé)
for (const [d, r] of [
  ["2026-09-08", 1],
  ["2026-09-09", -1],
  ["2026-09-10", 2],
  ["2026-09-15", 1],
  ["2026-09-16", 1],
  ["2026-09-22", 0.5],
])
  trades.push(trade(d, { pnl: r * 200, risk_amount: 200, r_multiple: r }));

const legacyReport = {
  month: "2026-09",
  totalPnl: 900,
  trades: 6,
  wins: 5,
  losses: 1,
  breakEven: 0,
  winRate: 0.83,
  profitFactor: 99,
  expectancy: 150,
  expectancyR: 1.33,
  sharpe: 4.2,
  sortino: 99,
  maxDrawdown: 200,
  weekly: [{ week: 2, pnl: 400, trades: 3 }],
  bestSetups: [{ strategy: "ORB", pnl: 900, count: 6, winRate: 0.83 }],
  worstSetups: [],
  mistakes: [{ name: "FOMO entry", count: 2, cost: -300 }],
  prev: null,
  aiSummary: "Your FOMO cost you $300 this month — eliminate it to unlock your edge.",
};

const seed = {
  user: {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: EMAIL,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    confirmed_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { name: "L0 Check" },
    identities: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: now,
  },
  tables: {
    profiles: [
      {
        id: USER_ID,
        name: "L0 Check",
        email: EMAIL,
        account_balance: 25000,
        starting_balance: 25000,
        language: "en",
        currency: "USD",
        confluences: [],
        active_account_id: ACCOUNT_ID,
        onboarding_goal: "consistency",
        onboarding_assets: ["indices"],
        onboarding_style: "intraday",
        onboarding_experience: "intermediate",
        onboarding_pain: "discipline",
        onboarding_monthly_target: 5,
        onboarding_uses_ict: false,
        onboarding_brokers: [],
        onboarding_skipped: false,
        onboarded_at: "2026-01-01T00:00:00+00:00",
        jarvis_first_name: "Sam",
        jarvis_completed_at: "2026-01-01T00:00:00+00:00",
        trading_rules: null,
        trading_plan: null,
        checklist_config: null,
        trustpilot_prompted_at: now,
        trustpilot_status: "dismissed",
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: now,
      },
    ],
    accounts: [
      {
        id: ACCOUNT_ID,
        user_id: USER_ID,
        name: "Eval 25K",
        type: "prop",
        starting_balance: 25000,
        currency: "USD",
        color: "#31d68a",
        is_default: true,
        calibration_scale: 1,
        original_balance: null,
        calibrated_at: null,
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: now,
      },
    ],
    subscriptions: [
      {
        user_id: USER_ID,
        plan: "elite_yearly",
        status: "active",
        source: "comp",
        current_period_end: "2027-09-01T00:00:00+00:00",
        cancel_at_period_end: false,
        stripe_customer_id: null,
        trial_ends_at: null,
      },
    ],
    trades,
    monthly_reports: [
      {
        id: "mr-1",
        user_id: USER_ID,
        month: "2026-09",
        report: legacyReport,
        created_at: "2026-10-01T06:00:00Z",
        updated_at: "2026-10-01T06:00:00Z",
      },
    ],
    goal_plans: [],
    user_preferences: [],
    missed_opportunities: [],
    notifications: [],
  },
};
writeFileSync(process.argv[2], JSON.stringify(seed, null, 1));
console.log(`seed: ${trades.length} trades`);
