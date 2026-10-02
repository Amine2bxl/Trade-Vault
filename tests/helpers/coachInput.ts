import type { CoachInput } from "../../src/modules/ai/agents/coach.agent";

/**
 * Un contexte client COMPLET et réaliste — ce que la Conversation envoie pour
 * un trader actif : statistiques, 25 trades récents, erreurs, signaux de
 * comportement, objectifs, règles, souvenirs, historique de conversation.
 *
 * Sert à mesurer ce que le Context Engine retire selon la question : avant le
 * LOT 2, TOUT partait à chaque question, « salut » compris.
 */
export function fullCoachInput(question: string, over: Partial<CoachInput> = {}): CoachInput {
  const trades = Array.from({ length: 25 }, (_, i) => ({
    date: `2026-09-${String(30 - i).padStart(2, "0")}`,
    symbol: i % 2 ? "NQ" : "ES",
    direction: i % 3 ? "long" : "short",
    pnl: i % 3 === 0 ? -137.5 : 212.25,
    rMultiple: i % 3 === 0 ? -1 : 1.7,
    strategy: i % 2 ? "ORB" : "VWAP reclaim",
    mistakes: i % 4 === 0 ? ["FOMO", "Moved stop"] : [],
    setupQuality: (i % 5) + 1,
    confluences: ["HTF trend", "Liquidity sweep"],
    notes: i % 3 === 0 ? "Entered before confirmation, chased the move after the open." : undefined,
  }));
  return {
    question,
    language: "fr",
    currency: "EUR",
    today: "2026-10-01",
    stats: {
      totalPnl: 4_812.5,
      winRate: 0.583,
      totalTrades: 312,
      profitFactor: 1.62,
      avgWin: 241.1,
      avgLoss: -151.3,
      maxDrawdown: 1_904.2,
      expectancy: 15.42,
      avgRR: 1.59,
      currentStreak: 2,
    },
    trades,
    mistakes: [
      { name: "FOMO", count: 23, totalPnl: -1_843.2 },
      { name: "Moved stop", count: 11, totalPnl: -962.4 },
      { name: "Revenge trade", count: 6, totalPnl: -710.8 },
      { name: "Oversized", count: 4, totalPnl: -455.1 },
    ],
    signals: {
      byWeekday: [1, 2, 3, 4, 5].map((d) => ({
        day: d,
        trades: 60 + d,
        netPnl: d * 113.4 - 400,
        winRate: 0.5 + d / 50,
      })),
      bySession: [
        { session: "london", trades: 98, netPnl: 2_310.4 },
        { session: "newyork", trades: 190, netPnl: 2_902.1 },
        { session: "asia", trades: 24, netPnl: -400 },
      ],
      bySymbol: [
        { symbol: "NQ", trades: 180, netPnl: 3_120.5 },
        { symbol: "ES", trades: 132, netPnl: 1_692 },
      ],
      byStrategy: [
        { strategy: "ORB", trades: 170, netPnl: 3_400.2 },
        { strategy: "VWAP reclaim", trades: 142, netPnl: 1_412.3 },
      ],
      riskAfterLoss: { trades: 64, sizeChangePct: 18.4, netPnl: -1_204.6 },
      overtrading: { days: 9, extraTrades: 31, netPnl: -1_533.9 },
      setupQuality: { a: 0.71, b: 0.55, c: 0.41 },
      conviction: { high: 0.66, low: 0.47 },
      disciplinePct: 72.4,
      recentForm: { last20WinRate: 0.6, prev20WinRate: 0.5 },
    },
    goals: [
      { kind: "net_pnl", target: 10_000, current: 4_812.5 },
      { kind: "win_rate", target: 60, current: 58.3 },
    ],
    rules: [
      { kind: "max_trades", text: "Pas plus de 3 trades par jour", enabled: true },
      { kind: "stop_after_losses", text: "Stop après 2 pertes", enabled: true },
      { kind: "custom", text: "Pas de trade 5 minutes avant une annonce", enabled: true },
    ],
    adherence: [
      { text: "Pas plus de 3 trades par jour", kept: 41, applicable: 50, ratePct: 82 },
      { text: "Stop après 2 pertes", kept: 18, applicable: 25, ratePct: 72 },
    ],
    edge: {
      score: 64,
      weakest: "risk",
      windowDays: 30,
      subs: {
        clean: { value: 71, detail: "71% clean trades" },
        risk: { value: 48, detail: "risk above plan on 9 days" },
        days: { value: 66 },
        routine: { value: null },
      },
    },
    memory: [
      { kind: "commitment", content: "Je coupe après deux pertes consécutives, sans exception." },
      { kind: "lesson", content: "Mes pertes viennent des entrées avant la confirmation." },
      { kind: "preference", content: "Préfère des réponses courtes avec un chiffre clé." },
      { kind: "profile", content: "Scalpeur NQ/ES, 2 ans d'expérience." },
    ],
    profile: "Scalpeur NQ/ES, 2 ans d'expérience, objectif : passer un challenge prop.",
    calibration: { originalBalance: 100_000, currentBalance: 50_000, scale: 0.5 },
    conversation: Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content:
        i % 2
          ? "Sur tes 20 derniers trades, le win rate tient, mais la taille grimpe après une perte."
          : "Et sur la semaine dernière, qu'est-ce que tu vois ?",
    })),
    ...over,
  };
}
