import { useMemo, useRef, useState } from 'react';
import { Bell, FileDown, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { buildMonthlyReport, exportReportCsv, parseTradeCsv } from '../utils/monthlyReport';
import { sendPushToSelf } from '@/lib/push.functions';
import { useServerFn } from '@tanstack/react-start';
import type { Trade } from '../types';

export default function MonthlyReports({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { t } = useT();
  const sendPush = useServerFn(sendPushToSelf);
  const inputRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [imported, setImported] = useState<Trade[]>([]);
  const [report, setReport] = useState(() => buildMonthlyReport(month, trades, [], 0));
  const allTrades = imported.length ? [...trades, ...imported] : trades;
  const current = useMemo(() => buildMonthlyReport(month, allTrades, [], 0), [month, allTrades]);
  const generate = async () => { setReport(current); if (user) { try { await sendPush({ data: { title: 'TradeVault', body: `Your ${month} report is ready.` } }); } catch {} } toast.success('Monthly report generated'); };
  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); const parsed = parseTradeCsv(text, user?.id ?? 'import'); setImported(parsed); toast.success(`${parsed.length} trades imported`); event.target.value = ''; };
  const download = () => { const blob = new Blob([exportReportCsv(report)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tradevault-report-${month}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">TradeVault / Reports</p><h1 className="mt-2 text-3xl md:text-4xl font-bold text-white">{t('nav.monthlyReports')}</h1><p className="mt-2 text-sm text-slate-400">A clean monthly readout of performance, process, and next actions.</p></div><div className="flex flex-wrap items-center gap-2"><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onImport} className="hidden" /><button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-200"><Upload className="h-4 w-4" />Import CSV</button><button onClick={generate} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2.5 text-sm font-bold text-slate-950"><FileText className="h-4 w-4" />Generate</button></div></div>
      <section className="glass-strong rounded-3xl p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><label className="text-xs font-semibold text-slate-400">Report month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label><div className="flex gap-2"><button onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300"><FileDown className="h-4 w-4" />Export CSV</button><span className="inline-flex items-center gap-2 rounded-xl bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200"><Bell className="h-4 w-4" />Push ready</span></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Net P&L', `${report.netPnl.toFixed(2)}`], ['Trades', String(report.tradeCount)], ['Win rate', `${report.winRate.toFixed(1)}%`], ['Profit factor', report.profitFactor.toFixed(2)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-white">{value}</div></div>)}</div></section>
      <section className="glass-strong rounded-3xl p-5 md:p-6"><h2 className="text-sm font-bold uppercase tracking-wider text-white">Report insights</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{[report.summary, `Top strategy: ${report.topStrategy || 'No strategy data yet'}`, `Top mistake: ${report.topMistake || 'No mistake data yet'}`, ...report.actions].map((item) => <div key={item} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-relaxed text-slate-300">{item}</div>)}</div></section>
    </div>
  );
}
