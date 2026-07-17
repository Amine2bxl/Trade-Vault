import { GoalConfig, GoalTask, MonthlyReport, Trade, TradingPlan } from './types';

export const DEFAULT_GOALS: GoalConfig[] = [
  { id: 'consistency', title: 'Trade with consistency', description: 'Build a repeatable process and follow it every session.', selected: true, target: 'Complete 80% of planned sessions' },
  { id: 'risk', title: 'Protect your downside', description: 'Keep risk predictable and make capital preservation automatic.', selected: true, target: 'Respect the risk cap on every trade' },
  { id: 'profitability', title: 'Improve profitability', description: 'Focus on the few behaviors that create positive expectancy.', selected: false, target: 'Finish the month above 0R' },
  { id: 'discipline', title: 'Strengthen discipline', description: 'Reduce impulsive trades and execute only qualified setups.', selected: false, target: 'Zero revenge trades this month' },
  { id: 'review', title: 'Review with intention', description: 'Turn every trading week into a concrete learning loop.', selected: false, target: 'Complete four weekly reviews' },
  { id: 'scale', title: 'Scale responsibly', description: 'Earn the right to increase size through stable execution.', selected: false, target: 'Meet your plan criteria before scaling' },
];

export const DEFAULT_TRADING_PLAN: TradingPlan = {
  mission: '', markets: 'US equities', sessions: 'New York', riskPerTrade: 1, maxDailyLoss: 2, maxWeeklyLoss: 5,
  maxOpenPositions: 2, maxTradesPerDay: 3, stopAfterLosses: 2, minimumRiskReward: 2,
  rules: ['Only trade pre-defined setups', 'Define invalidation before entry', 'No revenge trades'],
  setups: ['Breakout + retest', 'Trend continuation'],
  preMarketRoutine: ['Check economic calendar', 'Mark key levels', 'Write the session bias'],
  postMarketRoutine: ['Screenshot each trade', 'Grade execution', 'Write one lesson'],
  notes: '',
};

export function buildGoalTasks(goals: GoalConfig[], month: string): GoalTask[] {
  const selected = goals.filter((goal) => goal.selected);
  return selected.flatMap((goal, goalIndex) => {
    const taskTemplates: Record<string, string[]> = {
      consistency: ['Schedule and complete four planned sessions', 'Complete a pre-market checklist before each session', 'Review execution every Friday'],
      risk: ['Write risk and invalidation before every entry', 'Stop trading when the daily loss limit is reached', 'Review position sizing at month end'],
      profitability: ['Trade only setups with positive journal expectancy', 'Review the top and bottom strategy every week', 'Protect the process on losing days'],
      discipline: ['Define the setup before opening the platform', 'Take a 15-minute reset after a loss', 'Log every deviation from the plan'],
      review: ['Complete a weekly performance review', 'Tag recurring mistakes after each session', 'Choose one behavior to improve next week'],
      scale: ['Track plan adherence for two consecutive weeks', 'Confirm drawdown and risk limits are respected', 'Review scaling criteria before increasing size'],
    };
    return (taskTemplates[goal.id] || ['Define one measurable action for this goal', 'Review progress at the end of the week', 'Record one lesson learned']).map((title, index) => ({
      id: `${month}-${goal.id}-${index}`,
      goalId: goal.id,
      title,
      detail: goal.target,
      completed: false,
    }));
  }).map((task, index) => ({ ...task, detail: `${task.detail} · Step ${index + 1}` }));
}

export function buildMonthlyReport(month: string, trades: Trade[]): MonthlyReport {
  const rows = trades.filter((trade) => trade.date.slice(0, 7) === month);
  const wins = rows.filter((trade) => trade.pnl > 0).length;
  const losses = rows.filter((trade) => trade.pnl < 0).length;
  const breakEven = rows.length - wins - losses;
  const grossWin = rows.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(rows.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
  const strategies = rows.reduce<Record<string, number>>((map, trade) => { map[trade.strategy] = (map[trade.strategy] || 0) + trade.pnl; return map; }, {});
  const mistakes = rows.flatMap((trade) => trade.mistakes).reduce<Record<string, number>>((map, mistake) => { map[mistake] = (map[mistake] || 0) + 1; return map; }, {});
  const topStrategy = Object.entries(strategies).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const topMistake = Object.entries(mistakes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No recurring mistake';
  let equity = 0; let peak = 0; let maxDrawdown = 0;
  rows.forEach((trade) => { equity += trade.pnl; peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity - peak); });
  return {
    id: `report-${month}`, month, generatedAt: new Date().toISOString(), tradeCount: rows.length, wins, losses, breakEven,
    pnl: rows.reduce((sum, trade) => sum + trade.pnl, 0), winRate: wins + losses ? wins / (wins + losses) * 100 : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0, avgR: rows.length ? rows.reduce((sum, trade) => sum + trade.rMultiple, 0) / rows.length : 0,
    maxDrawdown: Math.abs(maxDrawdown), topStrategy, topMistake,
    actions: rows.length ? [`Keep leaning into ${topStrategy}`, `Review ${topMistake.toLowerCase()}`, 'Protect the habits that created your best sessions'] : ['Log your first trades of the month', 'Complete a post-session review', 'Keep your risk rules visible'],
  };
}
