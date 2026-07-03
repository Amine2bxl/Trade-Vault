import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { Trade, MissedOpportunity } from '../types';
import { loadMissedOpportunities } from '../store';
import { useAuth } from '../contexts/AuthContext';

import { cn } from '../utils/cn';
import TradeDetailModal from '../components/TradeDetailModal';
import MissedSetupDetailModal from '../components/MissedSetupDetailModal';
import MissedOpportunities from './MissedOpportunities';

interface CalendarPageProps { trades: Trade[]; }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage({ trades }: CalendarPageProps) {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMissed, setSelectedMissed] = useState<MissedOpportunity | null>(null);
  const [missed, setMissed] = useState<MissedOpportunity[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadMissedOpportunities(user.id)
      .then((d) => { if (active) setMissed(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  const missedByDate = useMemo(() => {
    const map: Record<string, MissedOpportunity[]> = {};
    for (const m of missed) (map[m.date] ??= []).push(m);
    return map;
  }, [missed]);

  const dailyData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; trades: Trade[]; avgRR: number; totalRR: number; wins: number; breakEven: number; winRate: number }> = {};
    for (const t of trades) {
      if (!map[t.date]) map[t.date] = { pnl: 0, count: 0, trades: [], avgRR: 0, totalRR: 0, wins: 0, breakEven: 0, winRate: 0 };
      map[t.date].pnl += t.pnl; map[t.date].count++; map[t.date].trades.push(t);
      map[t.date].avgRR += Math.abs(t.rMultiple);
      map[t.date].totalRR += t.rMultiple;
      if (t.direction === 'be') map[t.date].breakEven++;
      else if (t.pnl > 0) map[t.date].wins++;
    }
    for (const k of Object.keys(map)) {
      if (map[k].count > 0) map[k].avgRR = map[k].avgRR / map[k].count;
      const decided = map[k].count - map[k].breakEven;
      map[k].winRate = decided > 0 ? map[k].wins / decided : 0;
    }
    return map;
  }, [trades]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const days: (number | null)[] = [];
    for (let i = 0; i < mondayOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); };
  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const monthlySummary = useMemo(() => {
    let total = 0, tradingDays = 0, winDays = 0, beDays = 0, avgRRsum = 0, rrCount = 0, decidedTrades = 0, totalWins = 0, totalRR = 0;
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const dateStr = getDateStr(d); const data = dailyData[dateStr];
      if (data) {
        total += data.pnl; tradingDays++;
        if (data.pnl > 0) winDays++;
        if (data.count > 0 && data.count === data.breakEven) beDays++;
        avgRRsum += data.avgRR; rrCount++;
        totalRR += data.totalRR;
        const dec = data.count - data.breakEven;
        decidedTrades += dec; totalWins += data.wins;
      }
    }
    return { total, tradingDays, winDays, beDays, avgRR: rrCount > 0 ? avgRRsum / rrCount : 0, totalRR, winRate: decidedTrades > 0 ? totalWins / decidedTrades : 0 };
  }, [year, month, dailyData]);

  const selectedTrades = selectedDate ? (dailyData[selectedDate]?.trades || []) : [];
  const calendarRows = useMemo(() => { const rows: (number | null)[][] = []; for (let i = 0; i < calendarDays.length; i += 7) rows.push(calendarDays.slice(i, i + 7)); return rows; }, [calendarDays]);

  return (
    <div className="p-3 md:p-8 max-w-[1400px] mx-auto">
      <div className="mb-3 md:mb-6 animate-fade-in-up stagger-0"><h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Calendar</h1><p className="text-[11px] md:text-sm text-slate-500 mt-0.5 md:mt-1">Daily performance overview</p></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 mb-3 md:mb-6">
        {[
          { label: 'Monthly P&L', value: monthlySummary.tradingDays === 0 ? '$0.00' : `${monthlySummary.total >= 0 ? '' : '-'}$${Math.abs(monthlySummary.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: monthlySummary.tradingDays === 0 ? 'text-white' : monthlySummary.total > 0 ? 'text-emerald-400' : monthlySummary.total < 0 ? 'text-red-400' : 'text-white', delay: 0 },
          { label: 'Trading Days', value: String(monthlySummary.tradingDays), color: 'text-white', delay: 1 },
          { label: 'Winning Days', value: `${monthlySummary.winDays}/${monthlySummary.tradingDays}`, color: monthlySummary.tradingDays === 0 ? 'text-white' : 'text-emerald-400', delay: 2 },
          { label: 'Avg R:R', value: monthlySummary.avgRR.toFixed(2), color: monthlySummary.tradingDays === 0 ? 'text-white' : 'text-blue-400', delay: 3 },
          { label: 'Total RR', value: `${monthlySummary.totalRR.toFixed(2)}R`, color: monthlySummary.tradingDays === 0 ? 'text-white' : monthlySummary.totalRR > 0 ? 'text-emerald-400' : monthlySummary.totalRR < 0 ? 'text-red-400' : 'text-white', delay: 4 },
          { label: 'Win Rate', value: `${(monthlySummary.winRate * 100).toFixed(1)}%`, color: monthlySummary.tradingDays === 0 ? 'text-white' : monthlySummary.winRate > 0.5 ? 'text-emerald-400' : monthlySummary.winRate < 0.5 ? 'text-red-400' : 'text-white', delay: 5 },
        ].map(card => (
          <div key={card.label} className={cn('glass rounded-xl md:rounded-2xl p-2.5 md:p-4 card-premium animate-fade-in-up', `stagger-${card.delay}`)}>
            <div className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5 md:mb-1">{card.label}</div>
            <div className={cn('text-sm md:text-xl font-bold tabular-nums', card.color)}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="glass rounded-2xl md:rounded-3xl overflow-hidden animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-5 border-b border-white/[0.06]">
          <button onClick={prevMonth} className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <h3 className="text-base md:text-lg font-bold text-white">{MONTHS[month]} '{String(year).slice(-2)}</h3>
            <button onClick={goToday} className="text-[10px] md:text-xs text-blue-400 hover:text-blue-300 font-semibold px-2 md:px-3 py-1 rounded-lg hover:bg-blue-500/10 transition-all active:scale-95">Today</button>
          </div>
          <button onClick={nextMonth} className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {DAYS.map(d => <div key={d} className={cn('py-2 md:py-3 text-center text-[8px] md:text-[10px] font-bold uppercase tracking-widest', d === 'Sat' || d === 'Sun' ? 'text-slate-700' : 'text-slate-500')}>{d}</div>)}
        </div>
        <div className="p-1.5 md:p-3 space-y-1 md:space-y-2">
          {calendarRows.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-7 gap-1 md:gap-2">
              {row.map((day, colIdx) => {
                if (day === null) return <div key={`e-${rowIdx}-${colIdx}`} className="h-14 md:min-h-[100px]" />;
                const dateStr = getDateStr(day);
                const data = dailyData[dateStr];
                const isAllBE = data && data.count > 0 && data.count === data.breakEven;
                const isWin = data && !isAllBE && data.pnl > 0;
                const isLoss = data && !isAllBE && data.pnl < 0;
                const isNeutral = data && !isAllBE && data.pnl === 0;
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const isWeekend = colIdx >= 5;
                const dayMissed = missedByDate[dateStr] || [];
                const missedCount = dayMissed.length;
                return (
                  <button key={dateStr} onClick={() => {
                    if (data) setSelectedDate(dateStr);
                    else if (dayMissed.length > 0) setSelectedMissed(dayMissed[0]);
                  }} disabled={!data && missedCount === 0}
                    className={cn(
                      'h-14 md:min-h-[100px] md:p-3 p-1.5 rounded-lg md:rounded-2xl text-left transition-all duration-300 relative overflow-hidden group',
                      isWin && 'bg-gradient-to-br from-emerald-500/[0.18] to-emerald-600/[0.06] border border-emerald-500/20',
                      isLoss && 'bg-gradient-to-br from-red-500/[0.14] to-red-600/[0.05] border border-red-500/15',
                      isAllBE && 'bg-gradient-to-br from-slate-500/[0.16] to-slate-600/[0.05] border border-slate-500/25',
                      isNeutral && 'bg-white/[0.03] border border-white/[0.06]',
                      !data && !isWeekend && !missedCount && 'border border-transparent',
                      !data && missedCount > 0 && 'bg-amber-500/[0.06] border border-amber-500/20',
                      !data && isWeekend && 'bg-white/[0.01]',
                      isToday && 'ring-1 ring-blue-500/40',
                      (data || missedCount > 0) && 'cursor-pointer active:scale-95'
                    )}>
                    {missedCount > 0 && (
                      <span
                        className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-[1px] rounded-full bg-amber-500/25 text-amber-300 text-[8px] md:text-[10px] font-bold"
                        title={`${missedCount} ${'missed'}`}
                      >
                        <Target className="w-2 h-2 md:w-2.5 md:h-2.5" />
                        {missedCount}
                      </span>
                    )}
                    <div className={cn('text-[10px] md:text-sm mb-0.5 md:mb-1.5',
                      isWin ? 'font-bold text-emerald-300' :
                      isLoss ? 'font-bold text-red-300' :
                      isAllBE ? 'font-bold text-slate-200' :
                      isToday ? 'font-bold text-blue-400' :
                      isWeekend ? 'text-slate-700' : 'font-medium text-slate-500'
                    )}>{day}</div>
                    {data && (
                      <div className={cn('text-[10px] md:text-sm font-bold',
                        isAllBE ? 'text-slate-300' :
                        isWin ? 'text-emerald-400' :
                        isLoss ? 'text-red-400' : 'text-slate-400')}>
                        {isAllBE ? 'BE' : `${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}`}
                      </div>
                    )}
                    {data && (
                      <div className="flex items-center gap-0.5 md:gap-1.5 mt-0.5">
                        <span className={cn('text-[7px] md:text-[10px] font-bold px-0.5 md:px-1.5 py-0 md:py-0.5 rounded md:rounded-md',
                          isAllBE ? 'bg-slate-500/20 text-slate-300' :
                          isWin ? 'bg-emerald-500/20 text-emerald-400' :
                          isLoss ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] text-slate-400')}>{data.count}t</span>
                        {data.breakEven > 0 && !isAllBE && <span className="text-[7px] md:text-[10px] font-bold text-slate-300 hidden md:inline">{data.breakEven}BE</span>}
                        {data.avgRR > 0 && <span className="text-[7px] md:text-[10px] font-semibold text-blue-400 hidden md:inline">RR{data.avgRR.toFixed(1)}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6 mt-4 px-2 flex-wrap">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20" /><span className="text-[10px] text-slate-500">Winning Day</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-gradient-to-br from-red-500/15 to-red-600/5 border border-red-500/15" /><span className="text-[10px] text-slate-500">Losing Day</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-600/5 border border-slate-500/25" /><span className="text-[10px] text-slate-500">Break Even Day</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg ring-1 ring-blue-500/40" /><span className="text-[10px] text-slate-500">Today</span></div>
      </div>

      {selectedDate && selectedTrades.length > 0 && (
        <TradeDetailModal
          trades={selectedTrades}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          missed={missedByDate[selectedDate] || []}
          onOpenMissed={(m) => { setSelectedDate(null); setSelectedMissed(m); }}
        />
      )}

      {selectedMissed && (
        <MissedSetupDetailModal
          missed={selectedMissed}
          onClose={() => setSelectedMissed(null)}
        />
      )}

      {/* Mobile: Missed Opportunities embedded below calendar */}
      <div className="md:hidden mt-6">
        <MissedOpportunities />
      </div>
    </div>
  );
}
