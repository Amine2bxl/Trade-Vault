import { useState, useMemo } from 'react';
import { Plus, ArrowUpDown, Pencil, Trash2, Eye, ChevronDown, ChevronUp, Trash, ArrowUpRight, ArrowDownRight, Minus, Download, Target } from 'lucide-react';
import { Trade, isBreakEven } from '../types';
import { formatPnl, formatShortDate, directionLabel, directionBadgeClass } from '../utils/tradeCalcs';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';
import TradeDetailModal from '../components/TradeDetailModal';

interface JournalProps { trades: Trade[]; onEdit: (trade: Trade) => void; onDelete: (id: string) => void; onDeleteAll: () => void; onAdd: () => void; onOpenMissed: () => void; }
type SortKey = 'date' | 'symbol' | 'pnl' | 'strategy' | 'rMultiple';
type SortDir = 'asc' | 'desc';
type ResultFilter = 'all' | 'win' | 'loss' | 'be';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportTradesCSV(trades: Trade[]) {
  const headers = ['Date','Symbol','Direction','P&L','Risk','R Multiple','Strategy','Setup Quality','Confidence','Entry Time','Exit Time','Confluences','Mistakes','Notes'];
  const rows = trades.map(t => [
    t.date, t.symbol, t.direction, t.pnl, t.riskAmount, t.rMultiple, t.strategy,
    t.setupQuality, t.confidence, t.entryTime, t.exitTime,
    t.confluences.join('; '), t.mistakes.join('; '), t.notes,
  ].map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tradevault-journal-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Journal({ trades, onEdit, onDelete, onDeleteAll, onAdd, onOpenMissed }: JournalProps) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewing, setViewing] = useState<Trade | null>(null);

  const strategies = useMemo(() => ['all', ...new Set(trades.map(t => t.strategy))], [trades]);

  const filtered = useMemo(() => {
    let list = [...trades];
    if (search) { const s = search.toLowerCase(); list = list.filter(t => t.symbol.toLowerCase().includes(s) || t.notes.toLowerCase().includes(s) || t.confluences.some((c: string) => c.toLowerCase().includes(s)) || t.mistakes.some((m: string) => m.toLowerCase().includes(s))); }
    if (strategyFilter !== 'all') list = list.filter(t => t.strategy === strategyFilter);
    if (resultFilter === 'win') list = list.filter(t => !isBreakEven(t) && t.pnl > 0);
    if (resultFilter === 'loss') list = list.filter(t => !isBreakEven(t) && t.pnl < 0);
    if (resultFilter === 'be') list = list.filter(t => isBreakEven(t));
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === 'pnl') cmp = a.pnl - b.pnl;
      else if (sortKey === 'strategy') cmp = a.strategy.localeCompare(b.strategy);
      else if (sortKey === 'rMultiple') cmp = a.rMultiple - b.rMultiple;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [trades, search, strategyFilter, resultFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('desc'); } };
  const SortIcon = ({ col }: { col: SortKey }) => { if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-700" />; return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />; };
  const inputClass = 'bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all';

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-2 mb-3 md:mb-6">
        <div className="animate-fade-in-up stagger-0 min-w-0"><h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent truncate">{t('journal.title')}</h1><p className="text-[11px] md:text-sm text-slate-500 mt-0.5 md:mt-1">{filtered.length} {t('common.trades')}</p></div>
        <div className="flex items-center gap-1.5 md:gap-3 animate-fade-in-up stagger-1 shrink-0">
          <button onClick={() => exportTradesCSV(trades)} className="flex items-center gap-1.5 md:gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-2.5 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all">
            <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /><span className="hidden md:inline">{t('common.exportCsv')}</span>
          </button>
          <button onClick={onDeleteAll} className="flex items-center gap-1.5 md:gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-2.5 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all">
            <Trash className="w-3.5 h-3.5 md:w-4 md:h-4" /><span className="hidden md:inline">{t('common.deleteAll')}</span>
          </button>
          <button onClick={onAdd} className="hidden md:flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5">
            <Plus className="w-4 h-4" /> {t('common.addTrade')}
          </button>
        </div>
      </div>

      {/* Result filter pill group + Missed Setups shortcut */}
      <div className="flex items-center gap-1.5 mb-3 md:mb-5">
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 flex-1 md:flex-none md:w-auto md:inline-flex">
          {([
            { v: 'all', label: t('common.all') },
            { v: 'win', label: t('common.win') },
            { v: 'loss', label: t('common.loss') },
            { v: 'be', label: t('common.be') },
          ] as { v: ResultFilter; label: string }[]).map(opt => (
            <button key={opt.v} onClick={() => setResultFilter(opt.v)}
              className={cn(
                'flex-1 md:flex-none md:px-5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all',
                resultFilter === opt.v
                  ? opt.v === 'win' ? 'bg-emerald-500/15 text-emerald-400'
                    : opt.v === 'loss' ? 'bg-red-500/15 text-red-400'
                    : opt.v === 'be' ? 'bg-slate-500/20 text-slate-200'
                    : 'bg-blue-500/15 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}>{opt.label}</button>
          ))}
        </div>
        <button
          onClick={onOpenMissed}
          title={t('missed.title')}
          className="shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs md:text-sm font-semibold transition-all"
        >
          <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">{t('missed.title')}</span>
        </button>
      </div>

      {/* ── Mobile: Card List ── */}
      <div className="md:hidden space-y-2 animate-fade-in-up stagger-2">
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-slate-600 text-sm">{t('common.noTradesFound')}</div>
        ) : filtered.map(trade => { const be = isBreakEven(trade); return (
          <div key={trade.id} className="glass rounded-xl overflow-hidden trade-card">
            <div className="flex items-center gap-2 px-2.5 py-2">
              <button type="button" className="flex-1 min-w-0 flex items-center gap-2.5 text-left active:opacity-70 transition-opacity" onClick={() => setViewing(trade)}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  be ? 'bg-slate-500/10' : trade.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                  {be ? <Minus className="w-4 h-4 text-slate-300" /> :
                    trade.pnl >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-white truncate">{trade.symbol}</span>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded leading-none', directionBadgeClass(trade.direction))}>{directionLabel(trade.direction)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{trade.strategy} · {formatShortDate(trade.date)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-[13px] font-bold leading-tight', be ? 'text-slate-300' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(trade.pnl)}</div>
                  <div className={cn('text-[10px] font-semibold', be ? 'text-slate-300/60' : trade.rMultiple >= 0 ? 'text-emerald-400/60' : 'text-red-400/60')}>{trade.rMultiple.toFixed(1)}R</div>
                </div>
              </button>
              <div className="flex items-center shrink-0 -mr-1">
                <button onClick={() => onEdit(trade)} aria-label={t('common.edit')} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 active:bg-blue-500/10 active:text-blue-400 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(trade.id)} aria-label={t('common.delete')} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 active:bg-red-500/10 active:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        );})}
      </div>

      {/* ── Desktop: Table ── */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden animate-fade-in-up stagger-2">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {(['date', 'symbol', 'strategy', 'pnl', 'rMultiple'] as SortKey[]).map(key => (
                <th key={key} onClick={() => handleSort(key)} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none">
                  <span className="flex items-center gap-1.5">{
                    key === 'pnl' ? t('journal.colPnl')
                    : key === 'rMultiple' ? t('journal.colRR')
                    : key === 'date' ? t('journal.colDate')
                    : key === 'symbol' ? t('journal.colSymbol')
                    : t('journal.colStrategy')
                  }<SortIcon col={key} /></span>
                </th>
              ))}
              <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.side')}</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.risk')}</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-600 text-sm">{t('common.noTradesFound')}</td></tr>
            ) : filtered.map(trade => { const be = isBreakEven(trade); return (
                <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setViewing(trade)}>
                  <td className="px-5 py-3 text-sm text-slate-300">{formatShortDate(trade.date)}</td>
                  <td className="px-5 py-3"><span className="text-sm font-bold text-white">{trade.symbol}</span></td>
                  <td className="px-5 py-3 text-sm text-slate-400">{trade.strategy}</td>
                  <td className="px-5 py-3"><span className={cn('text-sm font-bold', be ? 'text-slate-300' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(trade.pnl)}</span></td>
                  <td className="px-5 py-3"><span className={cn('text-sm font-bold', be ? 'text-slate-300' : trade.rMultiple >= 0 ? 'text-emerald-400' : 'text-red-400')}>{trade.rMultiple.toFixed(2)}R</span></td>
                  <td className="px-5 py-3"><span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg', directionBadgeClass(trade.direction))}>{directionLabel(trade.direction)}</span></td>
                  <td className="px-5 py-3 text-sm text-slate-400">${trade.riskAmount.toFixed(0)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setViewing(trade)} aria-label={t('missed.preview')} title={t('missed.preview')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onEdit(trade)} aria-label={t('common.edit')} title={t('common.edit')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onDelete(trade.id)} aria-label={t('common.delete')} title={t('common.delete')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );})}
          </tbody>
        </table>
        </div>
      </div>

      {viewing && (
        <TradeDetailModal
          trades={[viewing]}
          date={viewing.date}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
