import { useMemo } from 'react';
import { AlertTriangle, TrendingDown, AlertCircle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { Trade } from '../types';
import { computeStats, formatPnl } from '../utils/tradeCalcs';
import { cn } from '../utils/cn';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MistakesProps { trades: Trade[]; embedded?: boolean; }
const MISTAKE_TIPS: Record<string, string> = {
  'No stop loss': 'Always set a stop loss before entering. Risk management is non-negotiable. Place your stop and size your position before clicking buy.',
  'Overtrading': 'Set a max of 3-5 trades per day. Quality over quantity. If you\'ve hit your limit, close the platform.',
  'Revenge trade': 'After a loss, step away for 15 minutes. Take deep breaths. The market will be there tomorrow.',
  'FOMO entry': 'Wait for your setup. Missing a trade costs $0. Entering badly can cost everything.',
  'Premature exit': 'Trust your plan. Move your stop to breakeven instead of closing. Let the trade work.',
  'Holding too long': 'Set clear profit targets before entering. When price hits your target — exit.',
  'Size too large': 'Risk no more than 1-2% per trade. If you\'re sweating, your size is too big.',
  'Ignored plan': 'Write your plan before the market opens. Follow it mechanically.',
  'Chased entry': 'Wait for pullbacks. If price already moved 2R without you, let it go.',
  'Averaged down': 'Cut losers, don\'t add to them. Adding doubles your risk.',
  'Ignored market conditions': 'Check SPY/QQQ trend and sector strength before trading.',
  'Low liquidity': 'Only trade stocks with avg volume > 1M shares.',
};

export default function Mistakes({ trades, embedded = false }: MistakesProps) {
  const stats = computeStats(trades);
  const mistakeData = useMemo(() => Object.entries(stats.mistakeStats).map(([mistake, data]) => ({ mistake, count: data.count, totalPnl: Math.round(data.totalPnl * 100) / 100, avgPnl: Math.round(data.totalPnl / data.count * 100) / 100 })).sort((a, b) => b.count - a.count), [stats.mistakeStats]);
  const topMistakes = mistakeData.slice(0, 3);
  const totalMistakes = mistakeData.reduce((s, m) => s + m.count, 0);
  const totalCost = mistakeData.reduce((s, m) => s + m.totalPnl, 0);
  const tradesWithMistakes = trades.filter(t => t.mistakes.length > 0).length;
  const cleanTrades = trades.length - tradesWithMistakes;
  const cleanDecided = trades.filter(t => t.mistakes.length === 0 && t.direction !== 'be').length;
  const mistakeDecided = trades.filter(t => t.mistakes.length > 0 && t.direction !== 'be').length;
  const cleanWinRate = cleanDecided > 0 ? trades.filter(t => t.mistakes.length === 0 && t.direction !== 'be' && t.pnl > 0).length / cleanDecided : 0;
  const mistakeWinRate = mistakeDecided > 0 ? trades.filter(t => t.mistakes.length > 0 && t.direction !== 'be' && t.pnl > 0).length / mistakeDecided : 0;
  const costData = useMemo(() => [...mistakeData].sort((a, b) => a.totalPnl - b.totalPnl), [mistakeData]);

  if (trades.length === 0) {
    if (embedded) return null;
    return (<div className="p-4 md:p-8"><h1 className="text-xl md:text-2xl font-bold text-white mb-2">Mistakes</h1><div className="glass rounded-2xl p-10 text-center text-slate-600">Add trades to track mistakes</div></div>);
  }

  return (
    <div className={cn(embedded ? 'pt-2' : 'p-4 md:p-8 max-w-[1400px] mx-auto')}>
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0"><h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Mistakes Tracker</h1><p className="text-xs md:text-sm text-slate-500 mt-1">Identify and eliminate costly errors</p></div>
      <div className="space-y-4 md:space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {[
            { icon: <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />, label: 'Total Mistakes', value: String(totalMistakes), sub: `${tradesWithMistakes} trades`, color: 'text-white', delay: 0 },
            { icon: <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />, label: 'Total Cost', value: formatPnl(totalCost), sub: `avg ${formatPnl(totalMistakes > 0 ? totalCost / totalMistakes : 0)}`, color: 'text-red-400', delay: 1 },
            { icon: <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-400" />, label: 'Clean WR', value: `${(cleanWinRate * 100).toFixed(1)}%`, sub: `${cleanTrades} clean`, color: 'text-emerald-400', delay: 2 },
            { icon: <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />, label: 'Mistake WR', value: `${(mistakeWinRate * 100).toFixed(1)}%`, sub: `${tradesWithMistakes} mistake`, color: 'text-amber-400', delay: 3 },
          ].map(card => (
            <div key={card.label} className={cn('glass rounded-xl md:rounded-2xl p-3 md:p-5 card-premium animate-fade-in-up', `stagger-${card.delay}`)}>
              <div className="flex items-center gap-1.5 mb-1 md:mb-2">{card.icon}<span className="text-[9px] md:text-[10px] text-slate-500">{card.label}</span></div>
              <div className={cn('text-lg md:text-2xl font-bold', card.color)}>{card.value}</div>
              <div className="text-[9px] md:text-[10px] text-slate-600 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="md:col-span-2 glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-4">
            <h3 className="text-sm font-semibold text-white mb-3">Mistake Cost Analysis</h3>
            {costData.length > 0 ? (
              <div className="h-56 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                    <YAxis dataKey="mistake" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', fontSize: 11 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} formatter={((value: any) => [`$${Number(value).toFixed(2)}`])} />
                    <Bar dataKey="totalPnl" radius={[0, 4, 4, 0]}>{costData.map((e, i) => <Cell key={i} fill={e.totalPnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (<div className="h-40 flex items-center justify-center text-slate-600 text-sm"><div className="text-center"><CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />No mistakes!</div></div>)}
          </div>
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-5">
            <h3 className="text-sm font-semibold text-white mb-3">Most Common</h3>
            <div className="space-y-2.5">
              {mistakeData.slice(0, 8).map(m => (<div key={m.mistake}><div className="flex items-center justify-between mb-0.5"><span className="text-[10px] md:text-xs text-slate-300 truncate mr-2">{m.mistake}</span><span className="text-[10px] md:text-xs font-bold text-slate-400">{m.count}×</span></div><div className="w-full bg-white/[0.05] rounded-full h-1"><div className="h-full rounded-full bg-red-500/40" style={{ width: `${(m.count / (mistakeData[0]?.count || 1)) * 100}%` }} /></div></div>))}
              {mistakeData.length === 0 && <div className="text-sm text-slate-600 text-center py-4">No mistakes</div>}
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-6">
          <div className="flex items-center gap-2 mb-3 md:mb-4"><Lightbulb className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-white">Improvement Tips</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {topMistakes.length > 0 ? topMistakes.map((m, idx) => (
              <div key={m.mistake} className={cn('bg-white/[0.03] border rounded-xl md:rounded-2xl p-3 md:p-4 card-premium', idx === 0 ? 'border-red-500/20' : 'border-white/[0.06]')}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {idx === 0 && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400">PRIORITY</span>}
                  <AlertCircle className="w-3 h-3 text-red-400" /><span className="text-[10px] md:text-xs font-bold text-red-400">{m.mistake}</span>
                </div>
                <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">{MISTAKE_TIPS[m.mistake] || 'Focus on reducing this mistake.'}</p>
                <div className="mt-1.5 text-[9px] text-slate-600">{m.count}× · {formatPnl(m.totalPnl)}</div>
              </div>
            )) : <div className="col-span-full text-center py-4 text-slate-600 text-sm">No mistakes — great discipline!</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
