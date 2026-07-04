import { useMemo, useState } from 'react';
import { Trade } from '../types';
import { computeStats, formatPnl, formatPct, formatShortDate } from '../utils/tradeCalcs';
import { cn } from '../utils/cn';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line, ReferenceLine } from 'recharts';
import Mistakes from './Mistakes';
import { useT } from '../i18n/LanguageContext';
import { CHART_ANIMATION, tooltipStyle, glowActiveDot, equityYDomain, EQUITY_X_PADDING } from '../utils/chartTheme';

interface AnalyticsProps { trades: Trade[]; }
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US', es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
  nl: 'nl-NL', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', ar: 'ar-SA', hi: 'hi-IN',
};

export default function Analytics({ trades }: AnalyticsProps) {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'en-US';
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const DAY_NAMES = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, 1 + i))), [locale]);
  const MONTH_NAMES_SHORT = useMemo(() => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, i, 1))), [locale]);
  const stats = computeStats(trades);
  const dayOfWeekData = useMemo(() => Object.entries(stats.pnlByDayOfWeek).filter(([day]) => { const d = parseInt(day); return d >= 1 && d <= 5; }).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([day, data]) => { const dec = data.count - data.breakEven; return ({ day: DAY_NAMES[parseInt(day)], pnl: Math.round(data.pnl * 100) / 100, trades: data.count, winRate: dec > 0 ? Math.round(data.wins / dec * 100) : 0 }); }), [stats.pnlByDayOfWeek, DAY_NAMES]);
  const strategyData = useMemo(() => Object.entries(stats.pnlByStrategy).map(([strategy, data]) => { const dec = data.count - data.breakEven; return ({ strategy, pnl: Math.round(data.pnl * 100) / 100, trades: data.count, winRate: dec > 0 ? Math.round(data.wins / dec * 100) : 0 }); }).sort((a, b) => b.pnl - a.pnl), [stats.pnlByStrategy]);
  const winLossData = useMemo(() => {
    const arr = [
      { name: t('common.win'), value: stats.wins, color: '#10b981' },
      { name: t('common.loss'), value: stats.losses, color: '#ef4444' },
    ];
    if (stats.breakEven > 0) arr.push({ name: t('common.be'), value: stats.breakEven, color: '#f59e0b' });
    return arr;
  }, [stats.wins, stats.losses, stats.breakEven, t]);
  const pnlDistribution = useMemo(() => { const b = [{ range: '< -$500', count: 0, fill: '#ef4444' }, { range: '-$500~-$200', count: 0, fill: '#f87171' }, { range: '-$200~$0', count: 0, fill: '#fca5a5' }, { range: t('common.be'), count: 0, fill: '#f59e0b' }, { range: '$0~$200', count: 0, fill: '#86efac' }, { range: '$200~$500', count: 0, fill: '#4ade80' }, { range: '> $500', count: 0, fill: '#10b981' }]; for (const trade of trades) { if (trade.direction === 'be') b[3].count++; else if (trade.pnl < -500) b[0].count++; else if (trade.pnl < -200) b[1].count++; else if (trade.pnl < 0) b[2].count++; else if (trade.pnl < 200) b[4].count++; else if (trade.pnl < 500) b[5].count++; else b[6].count++; } return b; }, [trades, t]);
  const symbolData = useMemo(() => { const map: Record<string, { pnl: number; count: number }> = {}; for (const t of trades) { if (!map[t.symbol]) map[t.symbol] = { pnl: 0, count: 0 }; map[t.symbol].pnl += t.pnl; map[t.symbol].count++; } return Object.entries(map).map(([symbol, data]) => ({ symbol, pnl: Math.round(data.pnl * 100) / 100, trades: data.count })).sort((a, b) => b.pnl - a.pnl); }, [trades]);
  const monthlyData = useMemo(() => { const map: Record<string, { pnl: number; count: number; wins: number; be: number; totalRR: number }> = {}; for (const t of trades) { const k = t.date.substring(0, 7); if (!map[k]) map[k] = { pnl: 0, count: 0, wins: 0, be: 0, totalRR: 0 }; map[k].pnl += t.pnl; map[k].count++; map[k].totalRR += Math.abs(t.rMultiple); if (t.direction === 'be') map[k].be++; else if (t.pnl > 0) map[k].wins++; } return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, data]) => { const [y, m] = key.split('-'); const dec = data.count - data.be; return { month: `${MONTH_NAMES_SHORT[parseInt(m) - 1]} '${y.slice(-2)}`, pnl: Math.round(data.pnl * 100) / 100, trades: data.count, winRate: dec > 0 ? Math.round(data.wins / dec * 100) : 0, avgRR: data.count > 0 ? +(data.totalRR / data.count).toFixed(2) : 0 }; }); }, [trades]);
  const profitFactorData = useMemo(() => { const tp = trades.filter(t => t.direction !== 'be' && t.pnl > 0).reduce((s, t) => s + t.pnl, 0); const tl = Math.abs(trades.filter(t => t.direction !== 'be' && t.pnl < 0).reduce((s, t) => s + t.pnl, 0)); const pf = tl > 0 ? tp / tl : tp > 0 ? 99 : 0; return { totalProfits: tp, totalLosses: tl, profitFactor: pf, isProfitable: pf > 1 }; }, [trades]);

  if (trades.length === 0) return (<div className="p-4 md:p-8"><h1 className="text-xl md:text-2xl font-bold text-white mb-2">{t('analytics.title')}</h1><div className="glass rounded-2xl p-10 text-center text-slate-600">{t('analytics.noTrades')}</div></div>);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0"><h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{t('analytics.title')}</h1><p className="text-xs md:text-sm text-slate-500 mt-1">{t('analytics.subtitle')}</p></div>

      <div className="space-y-4 md:space-y-6">
        {/* Profit Factor */}
        <div className={cn('glass rounded-2xl p-4 md:p-6 card-premium animate-fade-in-up stagger-1 border', profitFactorData.isProfitable ? 'border-emerald-500/15' : 'border-red-500/15')}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-white mb-0.5">{t('analytics.profitFactor')}</h3><p className="text-[10px] text-slate-500">{t('analytics.profitsOverLosses')}</p></div>
            <div className="flex items-center gap-3 md:gap-6 flex-wrap">
              <div className="text-center"><div className="text-[9px] md:text-[10px] text-slate-500">{t('analytics.profits')}</div><div className="text-sm md:text-lg font-bold text-emerald-400">{formatPnl(profitFactorData.totalProfits)}</div></div>
              <div className="text-lg text-slate-600">÷</div>
              <div className="text-center"><div className="text-[9px] md:text-[10px] text-slate-500">{t('analytics.losses')}</div><div className="text-sm md:text-lg font-bold text-red-400">{formatPnl(-profitFactorData.totalLosses)}</div></div>
              <div className="text-lg text-slate-600">=</div>
              <div className="text-center"><div className="text-[9px] md:text-[10px] text-slate-500">{t('analytics.factor')}</div><div className={cn('text-2xl md:text-3xl font-bold', profitFactorData.isProfitable ? 'text-emerald-400' : 'text-red-400')}>{profitFactorData.profitFactor >= 99 ? '99+' : profitFactorData.profitFactor.toFixed(2)}</div></div>
              <span className={cn('px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold', profitFactorData.isProfitable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20')}>
                {profitFactorData.isProfitable ? `✓ ${t('analytics.profitable')}` : `✗ ${t('analytics.losing')}`}
              </span>
            </div>
          </div>
          <div className="mt-2 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', profitFactorData.isProfitable ? 'bg-emerald-500/60' : 'bg-red-500/60')} style={{ width: `${Math.min(profitFactorData.profitFactor / 3 * 100, 100)}%` }} />
          </div>
        </div>

        {/* Equity + Pie */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="relative md:col-span-2 glass rounded-3xl p-4 md:p-6 card-premium animate-fade-in-up stagger-2 overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
            <h3 className="text-sm font-semibold text-white mb-4">{t('analytics.equityCurve')}</h3>
            <div className="h-56 md:h-80 chart-organic">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.equityCurve} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="55%" stopColor="#3b82f6" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" padding={EQUITY_X_PADDING} tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => { const p = v.split('-'); return `${p[1]}/${p[0].slice(2)}`; }} axisLine={false} tickLine={false} />
                  <YAxis domain={equityYDomain} tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={45} />
                  <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
                  <Tooltip {...tooltipStyle} formatter={((value: any) => [`$${Number(value).toFixed(2)}`, t('analytics.equityCurve')])} labelFormatter={(v) => formatShortDate(v)} />
                  <Area type="natural" dataKey="equity" stroke="#3b82f6" strokeWidth={2.5} fill="url(#eqG)" dot={false} activeDot={glowActiveDot('#3b82f6')} style={{ filter: 'drop-shadow(0 2px 6px rgba(59,130,246,0.35))' }} {...CHART_ANIMATION} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-3">
            <h3 className="text-sm font-semibold text-white mb-3">{t('analytics.winLoss')}</h3>
            <div className="h-40 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%" cy="45%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    cornerRadius={6}
                    dataKey="value"
                    stroke="none"
                    onMouseEnter={(_, i) => setActivePieIndex(i)}
                    onMouseLeave={() => setActivePieIndex(null)}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {winLossData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={e.color}
                        style={{
                          filter: activePieIndex === i ? `drop-shadow(0 0 8px ${e.color})` : 'none',
                          transform: activePieIndex === i ? 'scale(1.04)' : 'scale(1)',
                          transformOrigin: 'center',
                          transformBox: 'fill-box',
                          transition: 'transform 200ms ease-out, filter 200ms ease-out',
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="bottom" formatter={(v) => <span className="text-[10px] text-slate-400">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-1"><div className="text-xl md:text-2xl font-bold text-white">{formatPct(stats.winRate)}</div><div className="text-[10px] text-slate-500">{t('analytics.winRateLabel')}</div></div>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-4">
          <h3 className="text-sm font-semibold text-white mb-1">{t('analytics.monthlyPerformance')}</h3>
          <p className="text-[10px] text-slate-600 mb-3">{t('analytics.monthlyPerformanceSub')}</p>
          {monthlyData.length > 0 ? (
            <div className="h-52 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={50} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 100]} width={35} />
                  <Tooltip {...tooltipStyle} formatter={((value: any, name: any) => { if (name === 'winRate') return [`${value}%`, t('analytics.winRateLabel')]; if (name === 'avgRR') return [`${value}R`, t('dashboard.avgRR')]; return [`$${Number(value).toFixed(2)}`, t('journal.colPnl')]; })} />
                  <Bar yAxisId="left" dataKey="pnl" radius={[4, 4, 0, 0]} {...CHART_ANIMATION}>{monthlyData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.55} />)}</Bar>
                  <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} activeDot={glowActiveDot('#3b82f6')} name="winRate" {...CHART_ANIMATION} />
                  <Line yAxisId="right" type="monotone" dataKey="avgRR" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={{ fill: '#f59e0b', r: 2, strokeWidth: 0 }} activeDot={glowActiveDot('#f59e0b')} name="avgRR" {...CHART_ANIMATION} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/50" /><span className="text-[9px] text-slate-500">{t('journal.colPnl')}</span></span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500" /><span className="text-[9px] text-slate-500">WR%</span></span>
                <span className="flex items-center gap-1"><span className="w-4 h-0 border-t border-dashed border-amber-500" /><span className="text-[9px] text-slate-500">RR</span></span>
              </div>
            </div>
          ) : <div className="h-40 flex items-center justify-center text-slate-600 text-sm">{t('analytics.noData')}</div>}
        </div>

        {/* Day of Week + Strategy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-5">
            <h3 className="text-sm font-semibold text-white mb-3">{t('analytics.pnlWinRateByDay')}</h3>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dayOfWeekData}>
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={50} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 100]} width={35} />
                  <Tooltip {...tooltipStyle} formatter={((value: any, name: any) => [name === 'winRate' ? `${value}%` : `$${Number(value).toFixed(2)}`, name === 'winRate' ? t('analytics.winRateLabel') : t('journal.colPnl')])} />
                  <Bar yAxisId="left" dataKey="pnl" radius={[4, 4, 0, 0]} {...CHART_ANIMATION}>{dayOfWeekData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.6} />)}</Bar>
                  <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} activeDot={glowActiveDot('#3b82f6')} {...CHART_ANIMATION} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-6">
            <h3 className="text-sm font-semibold text-white mb-3">{t('analytics.pnlByStrategy')}</h3>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strategyData} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                  <YAxis dataKey="strategy" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={85} />
                  <Tooltip {...tooltipStyle} formatter={((value: any) => [`$${Number(value).toFixed(2)}`, t('journal.colPnl')])} />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]} {...CHART_ANIMATION}>{strategyData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#3b82f6' : '#ef4444'} fillOpacity={0.7} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Distribution + Symbol */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-7">
            <h3 className="text-sm font-semibold text-white mb-3">{t('analytics.pnlDistribution')}</h3>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlDistribution}>
                  <XAxis dataKey="range" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={35} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} {...CHART_ANIMATION}>{pnlDistribution.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.7} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-8">
            <h3 className="text-sm font-semibold text-white mb-3">{t('analytics.symbolPerformance')}</h3>
            <div className="space-y-1.5 max-h-48 md:max-h-64 overflow-y-auto">
              {symbolData.map(s => (
                <div key={s.symbol} className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg">
                  <span className="text-xs font-bold text-white w-12">{s.symbol}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className={cn('h-full rounded-full', s.pnl >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50')} style={{ width: `${Math.min(Math.abs(s.pnl) / (Math.max(...symbolData.map(x => Math.abs(x.pnl)), 1)) * 100, 100)}%` }} /></div>
                  <span className={cn('text-xs font-bold w-20 text-right', s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(s.pnl)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only: Mistakes content below Analytics */}
      <div className="md:hidden mt-6">
        <Mistakes trades={trades} embedded />
      </div>
    </div>
  );
}
