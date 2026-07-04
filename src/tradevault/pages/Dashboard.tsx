import { Plus, TrendingUp, TrendingDown, Target, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Sparkles } from 'lucide-react';
import { Trade, isBreakEven } from '../types';
import { computeStats, formatPnl, formatPct, formatShortDate, directionLabel, directionBadgeClass } from '../utils/tradeCalcs';
import StatsCard from '../components/StatsCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../utils/cn';
import { CHART_ANIMATION, tooltipStyle, glowActiveDot } from '../utils/chartTheme';
import { useT } from '../i18n/LanguageContext';

interface DashboardProps { trades: Trade[]; onAddTrade: () => void; }

export default function Dashboard({ trades, onAddTrade }: DashboardProps) {
  const { t } = useT();
  const stats = computeStats(trades);
  const recentTrades = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t('dashboard.greetingStillUp');
    if (h < 12) return t('dashboard.greetingMorning');
    if (h < 18) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div className="animate-fade-in-up stagger-0">
          <div className="flex items-center gap-2 text-[11px] md:text-xs font-semibold text-blue-400/80 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getGreeting()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{t('dashboard.title')}</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <button onClick={onAddTrade} className="hidden md:flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 animate-fade-in-up stagger-1">
          <Plus className="w-4 h-4" /> {t('common.addTrade')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatsCard title={t('stats.totalPnl')} value={formatPnl(stats.totalPnl)} subtitle={`${stats.totalTrades} ${t('common.trades')}`} icon={stats.totalPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} trend={stats.totalPnl >= 0 ? 'up' : 'down'} delay={0} />
        <StatsCard title={t('stats.winRate')} value={formatPct(stats.winRate)} subtitle={`${stats.wins}W / ${stats.losses}L${stats.breakEven > 0 ? ` / ${stats.breakEven}BE` : ''}`} icon={<Target className="w-4 h-4" />} trend={stats.winRate >= 0.5 ? 'up' : 'down'} delay={60} />
        <StatsCard title={t('dashboard.profitFactor')} value={stats.profitFactor >= 99 ? '99+' : stats.profitFactor.toFixed(2)} subtitle={`${t('dashboard.avgRR')} ${stats.avgRR.toFixed(2)}`} icon={<Activity className="w-4 h-4" />} trend={stats.profitFactor >= 1.5 ? 'up' : stats.profitFactor < 1 ? 'down' : 'neutral'} delay={120} />
        <StatsCard title={t('dashboard.maxDrawdown')} value={formatPnl(-stats.maxDrawdown)} subtitle={t('dashboard.peakToTrough')} icon={<BarChart3 className="w-4 h-4" />} trend="down" delay={180} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Equity Curve */}
        <div className="relative col-span-1 md:col-span-2 glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-4 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{t('dashboard.equityCurve')}</h3>
            <span className={cn('text-xs font-bold tabular-nums', stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(stats.totalPnl)}</span>
          </div>
          {stats.equityCurve.length > 0 ? (
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.equityCurve} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="55%" stopColor="#3b82f6" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => { const p = v.split('-'); return `${p[1]}/${p[0].slice(2)}`; }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={45} />
                  <Tooltip {...tooltipStyle} formatter={((value: any) => [`$${Number(value).toFixed(2)}`, 'Equity'])} labelFormatter={(v) => formatShortDate(v)} />
                  <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2.5} fill="url(#eqGrad)" dot={false} activeDot={glowActiveDot('#3b82f6')} {...CHART_ANIMATION} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (<div className="h-48 md:h-64 flex items-center justify-center text-slate-600 text-sm">{t('common.noTradesYet')}</div>)}
        </div>

        {/* Quick Stats */}
        <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-5 space-y-2 md:space-y-3">
          <h3 className="text-sm font-semibold text-white">{t('stats.performance')}</h3>
          {[
            { label: t('dashboard.avgWin'), value: formatPnl(stats.avgWin), color: 'text-emerald-400', dot: 'bg-emerald-400' },
            { label: t('dashboard.avgLoss'), value: formatPnl(stats.avgLoss), color: 'text-red-400', dot: 'bg-red-400' },
            { label: t('dashboard.bestTrade'), value: stats.bestTrade ? formatPnl(stats.bestTrade.pnl) : '$0.00', color: 'text-emerald-400', dot: 'bg-emerald-400' },
            { label: t('dashboard.worstTrade'), value: stats.worstTrade ? formatPnl(stats.worstTrade.pnl) : '$0.00', color: 'text-red-400', dot: 'bg-red-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5 md:py-2 border-b border-white/[0.04]">
              <span className="flex items-center gap-2 text-xs text-slate-500"><span className={cn('w-1.5 h-1.5 rounded-full', item.dot)} />{item.label}</span>
              <span className={cn('text-xs md:text-sm font-bold tabular-nums', item.color)}>{item.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-1.5 md:py-2">
            <span className="text-xs text-slate-500">{t('dashboard.currentStreak')}</span>
            <span className={cn('text-xs md:text-sm font-bold',
              stats.currentStreakType === 'win' ? 'text-emerald-400' :
              stats.currentStreakType === 'loss' ? 'text-red-400' :
              stats.currentStreakType === 'be' ? 'text-slate-300' : 'text-slate-400')}>
              {stats.currentStreak}{stats.currentStreakType === 'win' ? 'W' : stats.currentStreakType === 'loss' ? 'L' : stats.currentStreakType === 'be' ? 'BE' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="mt-4 md:mt-6 glass rounded-2xl overflow-hidden card-premium animate-fade-in-up stagger-6">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-white/[0.06]"><h3 className="text-sm font-semibold text-white">{t('dashboard.recentTrades')}</h3></div>
        {/* Mobile: Card view */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {recentTrades.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-600 text-sm">{t('common.noTradesYet')}</div>
          ) : recentTrades.map(trade => {
            const be = isBreakEven(trade);
            return (
            <div key={trade.id} className="px-4 py-3 trade-card">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  be ? 'bg-slate-500/10' : trade.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                  {be ? <Minus className="w-4 h-4 text-slate-300" /> :
                    trade.pnl >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{trade.symbol}</span>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', directionBadgeClass(trade.direction))}>{directionLabel(trade.direction)}</span>
                  </div>
                  <div className="text-[10px] text-slate-600">{formatShortDate(trade.date)} · {trade.rMultiple.toFixed(1)}R</div>
                </div>
                <div className="text-right">
                  <div className={cn('text-sm font-bold', be ? 'text-slate-300' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(trade.pnl)}</div>
                  <div className="text-[10px] text-slate-600">${trade.riskAmount.toFixed(0)} {t('dashboard.riskSuffix')}</div>
                </div>
              </div>
            </div>
          );})}
        </div>
        {/* Desktop: Table view */}
        <div className="hidden md:block divide-y divide-white/[0.04]">
          {recentTrades.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-600 text-sm">{t('dashboard.noTradesCta')}</div>
          ) : recentTrades.map(trade => {
            const be = isBreakEven(trade);
            return (
            <div key={trade.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                be ? 'bg-slate-500/10' : trade.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                {be ? <Minus className="w-4 h-4 text-slate-300" /> :
                  trade.pnl >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{trade.symbol}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', directionBadgeClass(trade.direction))}>{directionLabel(trade.direction)}</span>
                  <span className="text-[10px] text-slate-600">{trade.strategy}</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">{formatShortDate(trade.date)} · {t('common.risk')} ${trade.riskAmount.toFixed(0)} · {trade.rMultiple.toFixed(1)}R</div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn('text-sm font-bold', be ? 'text-slate-300' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(trade.pnl)}</div>
                <div className="text-[10px] text-slate-600">${trade.riskAmount.toFixed(0)} × {trade.rMultiple.toFixed(1)}R</div>
              </div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
