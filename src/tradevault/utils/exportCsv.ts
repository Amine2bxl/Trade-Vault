import { Trade } from '../types';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportTradesCSV(trades: Trade[]) {
  const headers = ['Date','Symbol','Direction','P&L','Risk','R Multiple','Strategy','Setup Quality','Confidence','Entry Time','Exit Time','Confluences','Mistakes','MAE','MFE','Slippage','Notes'];
  const rows = trades.map(t => [
    t.date, t.symbol, t.direction, t.pnl, t.riskAmount, t.rMultiple, t.strategy,
    t.setupQuality, t.confidence, t.entryTime, t.exitTime,
    t.confluences.join('; '), t.mistakes.join('; '),
    t.mae ?? '', t.mfe ?? '', t.slippage ?? '', t.notes,
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
